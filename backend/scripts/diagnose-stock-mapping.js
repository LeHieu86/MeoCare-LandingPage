/**
 * scripts/diagnose-stock-mapping.js  (CHỈ ĐỌC)
 * ─────────────────────────────────────────────────────────────────────────────
 * Soi liên kết variant↔kho cho các đơn ĐÃ GIAO chưa trừ kho, để phát hiện
 * InventoryItem TRÙNG/DƯ (một variant bị map tới nhiều hàng cùng tên).
 *
 * node scripts/diagnose-stock-mapping.js
 * ─────────────────────────────────────────────────────────────────────────────
 */
const _path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: _path.resolve(__dirname, "../.env") });
dotenv.config({ path: _path.resolve(__dirname, "../../.env") });
const prisma = require("../lib/prisma");

async function main() {
  const orders = await prisma.order.findMany({
    where: { status: "delivered" },
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

  for (const o of orders) {
    const mv = await prisma.stockMovement.count({
      where: { reference_type: "order", reference_id: o.id, type: "sale" },
    });
    if (mv > 0) continue; // chỉ soi đơn chưa trừ

    console.log(`\n=== Đơn #${o.invoice_no} (id ${o.id}, kênh ${o.channel}) ===`);
    for (const item of o.items) {
      console.log(`  • Dòng bán: "${item.variant_name}" ×${item.qty} (product_id ${item.product_id})`);
      const matched = item.product?.variants?.find((v) => v.name === item.variant_name);
      if (!matched) { console.log(`      ✗ KHÔNG khớp variant nào theo tên`); continue; }
      console.log(`      → khớp variant id ${matched.id}`);
      const sc = matched.sellComponents || [];
      const iv = matched.inventoryItems || [];
      if (sc.length) {
        console.log(`      SellProductComponent (${sc.length}):`);
        for (const c of sc) console.log(`        - inv #${c.inventory_item_id} "${c.inventoryItem?.name}" | qty/combo ${c.qty} | tồn ${c.inventoryItem?.current_stock}`);
      }
      if (iv.length) {
        console.log(`      InventoryItem.variant_id (${iv.length}):`);
        for (const i of iv) console.log(`        - inv #${i.id} "${i.name}" | tồn ${i.current_stock} | product_id ${i.product_id}`);
      }
      const total = sc.length + iv.length;
      if (total > 1) console.log(`      ⚠️ Variant này map tới ${total} mục kho — kiểm tra xem có TRÙNG/DƯ không.`);
      if (total === 0) console.log(`      ✗ Variant CHƯA map kho nào (không trừ được).`);
    }
  }

  // Liệt kê các InventoryItem trùng tên trong cùng store (nghi trùng lặp)
  const all = await prisma.inventoryItem.findMany({
    select: { id: true, store_id: true, name: true, sku: true, current_stock: true, variant_id: true, product_id: true, isActive: true },
    orderBy: [{ store_id: "asc" }, { name: "asc" }],
  });
  const byKey = new Map();
  for (const i of all) {
    const k = `${i.store_id}||${i.name.trim().toLowerCase()}`;
    (byKey.get(k) || byKey.set(k, []).get(k)).push(i);
  }
  console.log(`\n=== InventoryItem TRÙNG TÊN (cùng chi nhánh) ===`);
  let found = false;
  for (const [, list] of byKey) {
    if (list.length > 1) {
      found = true;
      console.log(`  • "${list[0].name}" (store ${list[0].store_id}) có ${list.length} bản:`);
      for (const i of list) console.log(`      - #${i.id} sku=${i.sku} tồn=${i.current_stock} variant_id=${i.variant_id} product_id=${i.product_id} active=${i.isActive}`);
    }
  }
  if (!found) console.log(`  (không có tên trùng)`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
