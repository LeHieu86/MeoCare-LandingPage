/**
 * /api/stock-returns
 *
 * Phiếu Hoàn Hàng — đảo chiều của stock-requests.
 * Chi nhánh (manager) hoàn hàng NGƯỢC về Kho Tổng.
 * Stock-manager xác nhận "đã nhận" → tự trừ kho chi nhánh + cộng kho trung tâm.
 *
 * Trạng thái: pending → received | cancelled
 */
const express = require("express");
const prisma  = require("../lib/prisma");
const { verifyToken }  = require("../middleware/auth");
const { storeContext } = require("../middleware/storeContext");
const { getIO } = require("../socket");

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────────────
const requireBranchOrStock = (req, res, next) => {
  if (!["admin", "stock-manager", "manager"].includes(req.user?.role)) {
    return res.status(403).json({ error: "Không có quyền truy cập." });
  }
  next();
};

/** Mã phiếu hoàn: HT-YYYYMMDD-NNN */
async function genReturnCode() {
  const today   = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix  = `HT-${dateStr}-`;
  const last    = await prisma.stockReturn.findFirst({
    where:   { return_code: { startsWith: prefix } },
    orderBy: { return_code: "desc" },
    select:  { return_code: true },
  });
  let nextNum = 1;
  if (last) {
    const match = last.return_code.match(/-(\d+)$/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }
  return `${prefix}${String(nextNum).padStart(3, "0")}`;
}

async function getWarehouseStoreId() {
  const warehouse = await prisma.store.findFirst({
    where: { isWarehouse: true },
    select: { id: true },
  });
  if (!warehouse) throw new Error("Chưa có kho trung tâm. Vui lòng đánh dấu 1 store là kho trung tâm.");
  return warehouse.id;
}

const RETURN_INCLUDE = {
  from_store: { select: { id: true, name: true } },
  items: {
    include: {
      inventoryItem: { select: { id: true, sku: true, barcode: true, name: true, unit: true, current_stock: true } },
    },
  },
};

// ── GET / — Danh sách phiếu hoàn ──────────────────────────────────────────────
// stock-manager/admin: thấy tất cả. manager: chỉ chi nhánh mình.
router.get("/", verifyToken, storeContext, requireBranchOrStock, async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const isStock = ["admin", "stock-manager"].includes(req.user.role);

    const where = {};
    if (status) where.status = status;
    if (!isStock) {
      if (!req.storeId) return res.status(400).json({ error: "Không xác định được chi nhánh." });
      where.from_store_id = req.storeId;
    }

    const [items, total] = await Promise.all([
      prisma.stockReturn.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
        include: RETURN_INCLUDE,
      }),
      prisma.stockReturn.count({ where }),
    ]);

    res.json({ data: items, total, page: parseInt(page) });
  } catch (err) {
    console.error("[GET /stock-returns]", err);
    res.status(500).json({ error: err.message || "Lỗi server." });
  }
});

// ── GET /:id — Chi tiết ───────────────────────────────────────────────────────
router.get("/:id", verifyToken, storeContext, requireBranchOrStock, async (req, res) => {
  try {
    const ret = await prisma.stockReturn.findUnique({
      where: { id: parseInt(req.params.id) },
      include: RETURN_INCLUDE,
    });
    if (!ret) return res.status(404).json({ error: "Không tìm thấy phiếu hoàn." });
    // Branch chỉ xem phiếu của mình
    const isStock = ["admin", "stock-manager"].includes(req.user.role);
    if (!isStock && ret.from_store_id !== req.storeId) {
      return res.status(403).json({ error: "Không có quyền xem phiếu này." });
    }
    res.json(ret);
  } catch (err) {
    console.error("[GET /stock-returns/:id]", err);
    res.status(500).json({ error: err.message || "Lỗi server." });
  }
});

// ── POST / — Chi nhánh tạo phiếu hoàn ─────────────────────────────────────────
router.post("/", verifyToken, storeContext, requireBranchOrStock, async (req, res) => {
  try {
    const { note, items } = req.body;
    const branchStoreId = req.storeId;
    if (!branchStoreId) {
      return res.status(400).json({ error: "Không xác định được chi nhánh. Vui lòng truyền store_id." });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Phiếu hoàn phải có ít nhất 1 sản phẩm." });
    }
    for (const it of items) {
      if (!it.inventory_item_id) return res.status(400).json({ error: "Mỗi dòng phải có inventory_item_id." });
      if (!it.quantity || it.quantity <= 0) return res.status(400).json({ error: "Số lượng phải lớn hơn 0." });
    }

    // Hàng hoàn phải thuộc CHI NHÁNH này và đủ tồn
    const itemIds  = items.map((i) => i.inventory_item_id);
    const invItems = await prisma.inventoryItem.findMany({
      where: { id: { in: itemIds }, store_id: branchStoreId },
      select: { id: true, name: true, current_stock: true },
    });
    if (invItems.length !== itemIds.length) {
      return res.status(400).json({ error: "Một số sản phẩm không thuộc kho chi nhánh này." });
    }
    const stockMap = Object.fromEntries(invItems.map((i) => [i.id, i]));
    const insufficient = items.filter((it) => it.quantity > (stockMap[it.inventory_item_id]?.current_stock ?? 0));
    if (insufficient.length > 0) {
      return res.status(400).json({
        error: `Tồn không đủ để hoàn: ${insufficient.map((it) => `${stockMap[it.inventory_item_id]?.name} (hoàn ${it.quantity}, còn ${stockMap[it.inventory_item_id]?.current_stock})`).join(", ")}`,
      });
    }

    const returnCode = await genReturnCode();
    const created = await prisma.stockReturn.create({
      data: {
        return_code:   returnCode,
        from_store_id: branchStoreId,
        note:          note || null,
        status:        "pending",
        items: {
          create: items.map((it) => ({
            inventory_item_id: it.inventory_item_id,
            quantity:          it.quantity,
            note:              it.note || null,
          })),
        },
      },
      include: RETURN_INCLUDE,
    });

    // Realtime → stock-manager (đúng chiều: hàng đang đi VỀ kho)
    try {
      const io = getIO();
      if (io) io.to("stock-room").emit("return:new", {
        id: `rt_${created.id}_${Date.now()}`,
        event: "return:new",
        title: "↩️ Phiếu hoàn hàng mới",
        body: `Phiếu ${created.return_code} — ${created.from_store?.name ?? "Chi nhánh"} hoàn hàng về kho`,
        sound: true,
        time: new Date().toISOString(),
      });
    } catch { /* không critical */ }

    res.status(201).json(created);
  } catch (err) {
    console.error("[POST /stock-returns]", err);
    res.status(500).json({ error: err.message || "Lỗi server." });
  }
});

// ── PUT /:id/status — received (stock-manager) | cancelled ────────────────────
router.put("/:id/status", verifyToken, storeContext, requireBranchOrStock, async (req, res) => {
  try {
    const id     = parseInt(req.params.id);
    const status = req.body.status;
    const now    = new Date();

    if (!["received", "cancelled"].includes(status)) {
      return res.status(400).json({ error: "Trạng thái không hợp lệ." });
    }

    const ret = await prisma.stockReturn.findUnique({
      where: { id },
      include: { items: { include: { inventoryItem: true } } },
    });
    if (!ret) return res.status(404).json({ error: "Không tìm thấy phiếu hoàn." });
    if (ret.status !== "pending") {
      return res.status(400).json({ error: `Phiếu đã ở trạng thái "${ret.status}", không thể đổi.` });
    }

    const isStock  = ["admin", "stock-manager"].includes(req.user.role);
    const isOwner  = ret.from_store_id === req.storeId;

    // Phân quyền: nhận hàng = stock-manager; hủy = stock-manager hoặc chi nhánh chủ phiếu
    if (status === "received" && !isStock) {
      return res.status(403).json({ error: "Chỉ kho trung tâm mới xác nhận nhận hàng hoàn." });
    }
    if (status === "cancelled" && !isStock && !isOwner) {
      return res.status(403).json({ error: "Không có quyền hủy phiếu này." });
    }

    if (status === "cancelled") {
      await prisma.stockReturn.update({ where: { id }, data: { status: "cancelled" } });
      try {
        const io = getIO();
        if (io) io.to("manager-room").emit("return:updated", {
          id: `rt_${id}_${Date.now()}`, event: "return:updated",
          title: "Phiếu hoàn đã hủy", body: `Phiếu ${ret.return_code} đã bị hủy.`,
          sound: true, time: now.toISOString(),
        });
      } catch { /* */ }
      return res.json({ success: true, status: "cancelled" });
    }

    // ── received: chuyển tồn CHI NHÁNH → KHO TỔNG ───────────────────────────────
    const warehouseId = await getWarehouseStoreId();

    // Pre-check tồn chi nhánh còn đủ
    const shortage = [];
    for (const it of ret.items) {
      const fresh = await prisma.inventoryItem.findUnique({
        where: { id: it.inventory_item_id }, select: { current_stock: true, name: true },
      });
      if ((fresh?.current_stock ?? 0) < it.quantity) {
        shortage.push(`${fresh?.name ?? it.inventory_item_id} (hoàn ${it.quantity}, còn ${fresh?.current_stock ?? 0})`);
      }
    }
    if (shortage.length > 0) {
      return res.status(400).json({ error: `Tồn chi nhánh không đủ để hoàn: ${shortage.join(", ")}` });
    }

    await prisma.$transaction(async (tx) => {
      const cur = await tx.stockReturn.findUnique({ where: { id }, select: { status: true } });
      if (cur?.status === "received") return; // idempotent

      for (const it of ret.items) {
        const branchItem = it.inventoryItem;
        const qty        = it.quantity;

        // 1. Trừ kho chi nhánh
        const freshBranch = await tx.inventoryItem.findUnique({
          where: { id: branchItem.id }, select: { current_stock: true },
        });
        const branchBefore = freshBranch?.current_stock ?? 0;
        if (branchBefore < qty) throw new Error(`Tồn chi nhánh không đủ: ${branchItem.name}`);
        await tx.inventoryItem.update({
          where: { id: branchItem.id },
          data:  { current_stock: { decrement: qty }, updated_at: now },
        });
        await tx.stockMovement.create({ data: {
          inventory_item_id: branchItem.id,
          type:              "transfer_out",
          qty_change:        -qty,
          qty_before:        branchBefore,
          qty_after:         branchBefore - qty,
          unit_cost:         branchItem.average_cost,
          reference_type:    "stock_return",
          reference_id:      id,
          note:              `Hoàn về Kho Tổng - Phiếu ${ret.return_code}`,
        }});

        // 2. Tìm/tạo item tương ứng tại KHO TỔNG (ưu tiên product/variant, fallback SKU)
        let whItem = branchItem.product_id
          ? await tx.inventoryItem.findFirst({
              where: { store_id: warehouseId, product_id: branchItem.product_id, variant_id: branchItem.variant_id },
            })
          : null;
        if (!whItem) {
          whItem = await tx.inventoryItem.findFirst({
            where: { store_id: warehouseId, sku: branchItem.sku },
          });
        }
        if (!whItem) {
          whItem = await tx.inventoryItem.create({
            data: {
              store_id:        warehouseId,
              product_id:      branchItem.product_id,
              variant_id:      branchItem.variant_id,
              sku:             branchItem.sku,
              name:            branchItem.name,
              unit:            branchItem.unit,
              kind:            branchItem.kind,
              current_stock:   0,
              average_cost:    branchItem.average_cost,
              min_stock_alert: 0,
            },
          });
        }

        // 3. Cộng kho trung tâm + bình quân gia quyền giá vốn
        const whBefore   = whItem.current_stock;
        const whNewStock = whBefore + qty;
        const newAvg     = whNewStock > 0
          ? Math.round((whBefore * whItem.average_cost + qty * branchItem.average_cost) / whNewStock)
          : branchItem.average_cost;
        await tx.inventoryItem.update({
          where: { id: whItem.id },
          data:  { current_stock: whNewStock, average_cost: newAvg, updated_at: now },
        });
        await tx.stockMovement.create({ data: {
          inventory_item_id: whItem.id,
          type:              "transfer_in",
          qty_change:        qty,
          qty_before:        whBefore,
          qty_after:         whNewStock,
          unit_cost:         branchItem.average_cost,
          reference_type:    "stock_return",
          reference_id:      id,
          note:              `Nhận hàng hoàn từ ${ret.from_store_id} - Phiếu ${ret.return_code}`,
        }});
      }

      await tx.stockReturn.update({
        where: { id },
        data:  { status: "received", received_at: now },
      });
    });

    // Realtime → chi nhánh (đúng chiều: kho đã nhận hàng hoàn)
    try {
      const io = getIO();
      if (io) io.to("manager-room").emit("return:updated", {
        id: `rt_${id}_${Date.now()}`, event: "return:updated",
        title: "✅ Kho đã nhận hàng hoàn",
        body: `Phiếu ${ret.return_code} đã được Kho Tổng xác nhận nhận hàng.`,
        sound: true, time: now.toISOString(),
      });
    } catch { /* */ }

    res.json({ success: true, status: "received" });
  } catch (err) {
    console.error("[PUT /stock-returns/:id/status]", err);
    res.status(500).json({ error: err.message || "Lỗi server." });
  }
});

module.exports = router;
