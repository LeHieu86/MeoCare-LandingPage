/**
 * scripts/reconcile-pos-stock.js
 * ─────────────────────────────────────────────────────────────────────────────
 * ĐỒNG BỘ LẠI TỒN KHO cho các đơn ĐÃ GIAO trước đây nhưng CHƯA từng trừ kho
 * (bug: bán quầy POS nhảy thẳng "delivered", bỏ qua bước trừ kho + cộng sold + COGS).
 *
 * Cách hoạt động:
 *   - Tìm mọi Order status="delivered" mà KHÔNG có StockMovement type "sale" nào
 *     tham chiếu tới đơn đó → đây là các đơn bị bỏ sót (chủ yếu là POS).
 *   - Khớp hàng theo TÊN variant → SellProductComponent (combo) hoặc variant_id,
 *     GIỐNG HỆT hàm deductOrderStock trong routes/orders.js (không có fallback product_id).
 *   - Tính số cần trừ mỗi InventoryItem, giá vốn (cogs), và số cần cộng vào sold.
 *
 * AN TOÀN:
 *   - Mặc định DRY-RUN: chỉ IN BÁO CÁO, KHÔNG ghi gì. Thêm cờ --apply để thực thi.
 *   - IDEMPOTENT: đơn nào đã có movement "sale" thì BỎ QUA → chạy lại nhiều lần vô hại.
 *   - Không để tồn ÂM: nếu số cần trừ > tồn hiện tại (tồn đã lệch), chỉ trừ tối đa số
 *     có và ĐÁNH DẤU món đó để KIỂM KÊ TAY (in ở cuối). KHÔNG đoán số vật lý.
 *   - Mỗi đơn chạy trong 1 transaction (all-or-nothing).
 *
 * Chạy trên máy có .env trỏ ĐÚNG DB cần sửa (thường là DB production trên server):
 *   node scripts/reconcile-pos-stock.js                 # xem trước (dry-run)
 *   node scripts/reconcile-pos-stock.js --since=2026-01-01
 *   node scripts/reconcile-pos-stock.js --apply         # thực thi
 *   node scripts/reconcile-pos-stock.js --apply --since=2026-06-01
 * ─────────────────────────────────────────────────────────────────────────────
 */
// Nạp .env GIỐNG server.js (backend/.env + root .env) TRƯỚC khi require prisma,
// vì lib/prisma khởi tạo PrismaClient (đọc DATABASE_URL) ngay lúc require.
const _path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: _path.resolve(__dirname, "../.env") });     // backend/.env
dotenv.config({ path: _path.resolve(__dirname, "../../.env") });  // root .env

const prisma = require("../lib/prisma");

const APPLY = process.argv.includes("--apply");
const sinceArg = (process.argv.find((a) => a.startsWith("--since=")) || "").split("=")[1];
const SINCE = sinceArg ? new Date(sinceArg) : null;

const fmt = (n) => new Intl.NumberFormat("vi-VN").format(n) + "đ";

async function main() {
  console.log(`\n=== ĐỒNG BỘ TỒN KHO ĐƠN BỊ BỎ SÓT ===`);
  console.log(APPLY ? "CHẾ ĐỘ: ÁP DỤNG (ghi DB)" : "CHẾ ĐỘ: DRY-RUN (chỉ xem, không ghi)");
  if (SINCE) console.log(`Lọc từ ngày: ${SINCE.toISOString().slice(0, 10)}`);

  // 1) Ứng viên: đơn đã giao (kèm items + mapping variant→kho)
  const orders = await prisma.order.findMany({
    where: {
      status: "delivered",
      ...(SINCE ? { created_at: { gte: SINCE } } : {}),
    },
    include: {
      items: {
        include: {
          product: {
            include: {
              variants: {
                include: {
                  sellComponents: { include: { inventoryItem: true } },
                  inventoryItems: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: { created_at: "asc" },
  });

  // 2) Lọc đơn CHƯA từng có movement "sale"
  const missed = [];
  for (const o of orders) {
    const mv = await prisma.stockMovement.count({
      where: { reference_type: "order", reference_id: o.id, type: "sale" },
    });
    if (mv === 0) missed.push(o);
  }

  console.log(`\nTổng đơn đã giao xét: ${orders.length}`);
  console.log(`Đơn CHƯA trừ kho (sẽ đồng bộ): ${missed.length}`);
  if (missed.length === 0) {
    console.log("→ Không có gì để đồng bộ. Kết thúc.");
    return;
  }

  // 3) Gom nhu cầu trừ theo InventoryItem (chỉ để BÁO CÁO tổng quan)
  const needByInv = new Map(); // invId -> { name, need }
  const unmappedOrders = [];   // đơn không map được kho (bỏ qua, cần xem tay)
  for (const o of missed) {
    let anyMapped = false;
    for (const item of o.items) {
      const matched = item.product?.variants?.find((v) => v.name === item.variant_name);
      const parts = [];
      if (matched?.sellComponents?.length > 0) {
        for (const c of matched.sellComponents) parts.push({ id: c.inventory_item_id, name: c.inventoryItem?.name, qty: c.qty * item.qty });
      } else if (matched?.inventoryItems?.length > 0) {
        for (const inv of matched.inventoryItems) parts.push({ id: inv.id, name: inv.name, qty: item.qty });
      }
      if (parts.length > 0) anyMapped = true;
      for (const p of parts) {
        const cur = needByInv.get(p.id) || { name: p.name, need: 0 };
        cur.need += p.qty;
        needByInv.set(p.id, cur);
      }
    }
    if (!anyMapped) unmappedOrders.push(o);
  }

  // 4) Báo cáo: mỗi InventoryItem tồn hiện tại → sau khi trừ, cảnh báo âm
  const shortfalls = [];
  console.log(`\n--- Ảnh hưởng tồn kho theo từng hàng ---`);
  for (const [invId, { name, need }] of needByInv) {
    const inv = await prisma.inventoryItem.findUnique({ where: { id: invId }, select: { current_stock: true } });
    const cur = inv?.current_stock ?? 0;
    const after = cur - need;
    const flag = after < 0 ? "  ⚠️ SẼ ÂM → cần KIỂM KÊ TAY" : "";
    console.log(`  #${invId} ${name ?? ""}: tồn ${cur} − ${need} = ${after}${flag}`);
    if (after < 0) shortfalls.push({ invId, name, cur, need });
  }

  if (unmappedOrders.length > 0) {
    console.log(`\n⚠️ ${unmappedOrders.length} đơn KHÔNG map được hàng với kho (sẽ chỉ backfill sold/cogs nếu có, KHÔNG trừ kho được — kiểm tra liên kết variant↔kho):`);
    for (const o of unmappedOrders.slice(0, 30)) console.log(`   - #${o.invoice_no} (${o.channel})`);
    if (unmappedOrders.length > 30) console.log(`   … và ${unmappedOrders.length - 30} đơn nữa`);
  }

  if (!APPLY) {
    console.log(`\n(DRY-RUN) Chưa ghi gì. Chạy lại với --apply để thực thi.`);
    return;
  }

  // 5) ÁP DỤNG — mỗi đơn 1 transaction: trừ kho (clamp ≥0) + movement "sale" + cogs + sold
  console.log(`\n--- ĐANG ÁP DỤNG ---`);
  let okCount = 0;
  for (const o of missed) {
    try {
      await prisma.$transaction(async (tx) => {
        // Chốt an toàn trong tx: nếu vừa có movement (chạy song song) thì bỏ qua
        const exists = await tx.stockMovement.count({
          where: { reference_type: "order", reference_id: o.id, type: "sale" },
        });
        if (exists > 0) return;

        // Gom nhu cầu theo inv + map item→parts để tính cogs
        const need = new Map();
        const perItem = [];
        for (const item of o.items) {
          const matched = item.product?.variants?.find((v) => v.name === item.variant_name);
          const parts = [];
          if (matched?.sellComponents?.length > 0) {
            for (const c of matched.sellComponents) parts.push({ id: c.inventory_item_id, qty: c.qty * item.qty });
          } else if (matched?.inventoryItems?.length > 0) {
            for (const inv of matched.inventoryItems) parts.push({ id: inv.id, qty: item.qty });
          }
          for (const p of parts) need.set(p.id, (need.get(p.id) || 0) + p.qty);
          perItem.push({ itemId: item.id, parts });
        }

        // Trừ kho (clamp ≥0) + movement + lưu đơn giá vốn
        const unitCost = new Map();
        for (const [invId, qtyNeed] of need) {
          const inv = await tx.inventoryItem.findUnique({
            where: { id: invId }, select: { current_stock: true, average_cost: true },
          });
          const before = inv?.current_stock ?? 0;
          const actual = Math.min(qtyNeed, before); // KHÔNG để âm
          unitCost.set(invId, inv?.average_cost ?? 0);
          if (actual <= 0) continue;
          await tx.inventoryItem.update({ where: { id: invId }, data: { current_stock: { decrement: actual } } });
          await tx.stockMovement.create({
            data: {
              inventory_item_id: invId,
              type: "sale",
              qty_change: -actual,
              qty_before: before,
              qty_after: before - actual,
              unit_cost: inv?.average_cost ?? 0,
              reference_type: "order",
              reference_id: o.id,
              note: `[Đồng bộ] Bán từ đơn #${o.invoice_no}` + (qtyNeed > before ? ` (thiếu ${qtyNeed - before}, tồn đã lệch — cần kiểm kê)` : ""),
            },
          });
        }

        // Backfill cogs_amount cho từng OrderItem (chỉ khi đang 0)
        for (const { itemId, parts } of perItem) {
          let c = 0;
          for (const p of parts) c += (unitCost.get(p.id) || 0) * p.qty;
          if (c > 0) {
            await tx.orderItem.updateMany({ where: { id: itemId, cogs_amount: 0 }, data: { cogs_amount: c } });
          }
        }

        // Cộng sold cho từng product
        const soldByProduct = {};
        for (const it of o.items) {
          if (!it.product_id) continue;
          soldByProduct[it.product_id] = (soldByProduct[it.product_id] || 0) + it.qty;
        }
        for (const [pid, qty] of Object.entries(soldByProduct)) {
          await tx.product.update({ where: { id: parseInt(pid, 10) }, data: { sold: { increment: qty } } });
        }
      });
      okCount++;
    } catch (e) {
      console.error(`   ✗ Lỗi đơn #${o.invoice_no}: ${e.message}`);
    }
  }
  console.log(`\n✅ Đã đồng bộ ${okCount}/${missed.length} đơn.`);
  if (shortfalls.length > 0) {
    console.log(`\n⚠️ ${shortfalls.length} hàng bị trừ chạm 0 do tồn đã lệch — HÃY KIỂM KÊ TAY và điều chỉnh:`);
    for (const s of shortfalls) console.log(`   - #${s.invId} ${s.name ?? ""}: tồn ${s.cur}, cần ${s.need}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
