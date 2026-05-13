const express = require("express");
const { verifyToken } = require("../middleware/auth");
const prisma = require("../lib/prisma");

const router = express.Router();

/* ── Helper: tính average cost (bình quân gia quyền) ── */
function calcAverageCost(currentStock, currentAvgCost, incomingQty, incomingUnitCost) {
  const totalStock = currentStock + incomingQty;
  if (totalStock === 0) return 0;
  return Math.round(
    (currentStock * currentAvgCost + incomingQty * incomingUnitCost) / totalStock
  );
}

/* ══════════════════════════════════════════════════════
   GET /api/inventory — Danh sách hàng hóa tồn kho
   ══════════════════════════════════════════════════════ */
router.get("/", verifyToken, async (req, res) => {
  try {
    const { search, low_stock, inactive } = req.query;

    const where = {};

    /* Mặc định chỉ hiện hàng đang hoạt động */
    if (!inactive) {
      where.is_active = true;
    }

    /* Tìm kiếm theo tên hoặc SKU */
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { sku:  { contains: search, mode: "insensitive" } },
      ];
    }

    /* Lọc hàng tồn kho thấp */
    if (low_stock === "1") {
      where.AND = [
        { min_stock_alert: { gt: 0 } },
        { current_stock: { lte: prisma.inventoryItem.fields.min_stock_alert } },
      ];
    }

    const items = await prisma.inventoryItem.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        _count: { select: { sellComponents: true } },
      },
    });

    /* Đánh dấu hàng tồn thấp */
    const result = items.map((item) => ({
      id: item.id,
      sku: item.sku,
      name: item.name,
      barcode: item.barcode,
      unit: item.unit,
      current_stock: item.current_stock,
      average_cost: item.average_cost,
      min_stock_alert: item.min_stock_alert,
      is_active: item.is_active,
      note: item.note,
      created_at: item.created_at,
      combo_count: item._count.sellComponents,
      is_low_stock: item.min_stock_alert > 0 && item.current_stock <= item.min_stock_alert,
    }));

    res.json({ success: true, items: result });
  } catch (err) {
    console.error("Lỗi lấy inventory:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

/* ══════════════════════════════════════════════════════
   GET /api/inventory/:id — Chi tiết 1 item + lịch sử biến động
   ══════════════════════════════════════════════════════ */
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const item = await prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        sellComponents: {
          include: {
            variant: {
              include: {
                product: { select: { name: true } },
              },
            },
          },
        },
        stockMovements: {
          orderBy: { created_at: "desc" },
          take: 20,
        },
      },
    });

    if (!item) {
      return res.status(404).json({ success: false, message: "Không tìm thấy" });
    }

    res.json({ success: true, item });
  } catch (err) {
    console.error("Lỗi lấy chi tiết inventory:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

/* ══════════════════════════════════════════════════════
   POST /api/inventory — Tạo hàng hóa mới
   ══════════════════════════════════════════════════════ */
router.post("/", verifyToken, async (req, res) => {
  try {
    const { sku, name, barcode, unit, min_stock_alert, note } = req.body;

    if (!sku?.trim()) return res.status(400).json({ success: false, message: "SKU không được trống" });
    if (!name?.trim()) return res.status(400).json({ success: false, message: "Tên không được trống" });

    /* Check SKU trùng */
    const existing = await prisma.inventoryItem.findUnique({ where: { sku: sku.trim().toUpperCase() } });
    if (existing) return res.status(409).json({ success: false, message: `SKU "${sku}" đã tồn tại` });

    const item = await prisma.inventoryItem.create({
      data: {
        sku: sku.trim().toUpperCase(),
        name: name.trim(),
        barcode: barcode?.trim() || null,
        unit: unit?.trim() || "hộp",
        min_stock_alert: parseInt(min_stock_alert) || 0,
        note: note?.trim() || null,
      },
    });

    res.json({ success: true, item });
  } catch (err) {
    console.error("Lỗi tạo inventory item:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

/* ══════════════════════════════════════════════════════
   PUT /api/inventory/:id — Cập nhật thông tin hàng hóa
   (KHÔNG cập nhật stock/cost qua đây — dùng phiếu nhập)
   ══════════════════════════════════════════════════════ */
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, barcode, unit, min_stock_alert, note, is_active } = req.body;

    if (!name?.trim()) return res.status(400).json({ success: false, message: "Tên không được trống" });

    const item = await prisma.inventoryItem.update({
      where: { id },
      data: {
        name: name.trim(),
        barcode: barcode?.trim() || null,
        unit: unit?.trim() || "hộp",
        min_stock_alert: parseInt(min_stock_alert) || 0,
        note: note?.trim() || null,
        is_active: is_active !== undefined ? Boolean(is_active) : undefined,
      },
    });

    res.json({ success: true, item });
  } catch (err) {
    console.error("Lỗi cập nhật inventory:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

/* ══════════════════════════════════════════════════════
   PUT /api/inventory/:id/adjust — Điều chỉnh tồn kho thủ công
   (dùng cho hàng hỏng, kiểm kê lại, v.v.)
   ══════════════════════════════════════════════════════ */
router.put("/:id/adjust", verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { qty_change, note, type } = req.body;

    const validTypes = ["adjustment", "return", "damaged"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ success: false, message: "Loại điều chỉnh không hợp lệ" });
    }

    if (qty_change === 0 || qty_change === undefined) {
      return res.status(400).json({ success: false, message: "Số lượng thay đổi phải khác 0" });
    }

    const item = await prisma.inventoryItem.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ success: false, message: "Không tìm thấy" });

    const newStock = item.current_stock + parseInt(qty_change);
    if (newStock < 0) {
      return res.status(400).json({ success: false, message: "Tồn kho không thể âm" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.inventoryItem.update({
        where: { id },
        data: { current_stock: newStock },
      });

      await tx.stockMovement.create({
        data: {
          inventory_item_id: id,
          type,
          qty_change: parseInt(qty_change),
          qty_before: item.current_stock,
          qty_after: newStock,
          unit_cost: item.average_cost,
          reference_type: "manual",
          note: note || null,
        },
      });
    });

    res.json({ success: true, message: "Đã điều chỉnh tồn kho", new_stock: newStock });
  } catch (err) {
    console.error("Lỗi điều chỉnh tồn kho:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

/* ══════════════════════════════════════════════════════
   DELETE /api/inventory/:id — Xóa (chỉ khi stock = 0)
   ══════════════════════════════════════════════════════ */
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const item = await prisma.inventoryItem.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ success: false, message: "Không tìm thấy" });

    if (item.current_stock > 0) {
      return res.status(400).json({
        success: false,
        message: `Không thể xóa — còn ${item.current_stock} ${item.unit} trong kho. Hãy điều chỉnh về 0 trước.`,
      });
    }

    /* Soft delete: đánh dấu inactive thay vì xóa hẳn (giữ lịch sử) */
    await prisma.inventoryItem.update({
      where: { id },
      data: { is_active: false },
    });

    res.json({ success: true, message: "Đã vô hiệu hóa hàng hóa" });
  } catch (err) {
    console.error("Lỗi xóa inventory:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

/* ══════════════════════════════════════════════════════
   GET /api/inventory/stats/overview — Tổng quan tồn kho
   ══════════════════════════════════════════════════════ */
router.get("/stats/overview", verifyToken, async (req, res) => {
  try {
    const items = await prisma.inventoryItem.findMany({
      where: { is_active: true },
      select: { current_stock: true, average_cost: true, min_stock_alert: true },
    });

    const totalItems = items.length;
    const totalStockValue = items.reduce((sum, i) => sum + i.current_stock * i.average_cost, 0);
    const lowStockCount = items.filter(
      (i) => i.min_stock_alert > 0 && i.current_stock <= i.min_stock_alert
    ).length;
    const outOfStockCount = items.filter((i) => i.current_stock === 0).length;

    res.json({
      success: true,
      stats: {
        totalItems,
        totalStockValue,
        lowStockCount,
        outOfStockCount,
      },
    });
  } catch (err) {
    console.error("Lỗi stats inventory:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

module.exports = { router, calcAverageCost };