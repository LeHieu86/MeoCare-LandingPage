const express = require("express");
const { verifyToken } = require("../middleware/auth");
const prisma = require("../lib/prisma");

const router = express.Router();

/* ══════════════════════════════════════════════════════
   GET /api/sell-components/:variantId — Lấy mapping của 1 variant
   ══════════════════════════════════════════════════════ */
router.get("/:variantId", verifyToken, async (req, res) => {
  try {
    const variantId = parseInt(req.params.variantId);

    const components = await prisma.sellProductComponent.findMany({
      where: { variant_id: variantId },
      include: {
        inventoryItem: {
          select: { id: true, sku: true, name: true, unit: true, current_stock: true, average_cost: true },
        },
      },
      orderBy: { id: "asc" },
    });

    /* Tính giá vốn dự kiến của combo = SUM(qty × average_cost) */
    const estimatedCogs = components.reduce(
      (sum, c) => sum + c.qty * c.inventoryItem.average_cost,
      0
    );

    res.json({ success: true, components, estimatedCogs });
  } catch (err) {
    console.error("Lỗi lấy components:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

/* ══════════════════════════════════════════════════════
   PUT /api/sell-components/:variantId — Cập nhật toàn bộ mapping của 1 variant
   (upsert theo kiểu replace-all: xóa cũ, tạo mới)
   ══════════════════════════════════════════════════════ */
router.put("/:variantId", verifyToken, async (req, res) => {
  try {
    const variantId = parseInt(req.params.variantId);
    const { components } = req.body;

    /* Validate */
    if (!Array.isArray(components)) {
      return res.status(400).json({ success: false, message: "components phải là mảng" });
    }

    for (const c of components) {
      if (!c.inventory_item_id) {
        return res.status(400).json({ success: false, message: "inventory_item_id không được trống" });
      }
      if (!c.qty || c.qty <= 0) {
        return res.status(400).json({ success: false, message: "qty phải > 0" });
      }
    }

    /* Kiểm tra variant tồn tại */
    const variant = await prisma.variant.findUnique({ where: { id: variantId } });
    if (!variant) return res.status(404).json({ success: false, message: "Variant không tồn tại" });

    /* Replace all: xóa cũ → tạo mới */
    await prisma.$transaction(async (tx) => {
      await tx.sellProductComponent.deleteMany({ where: { variant_id: variantId } });

      if (components.length > 0) {
        await tx.sellProductComponent.createMany({
          data: components.map((c) => ({
            variant_id: variantId,
            inventory_item_id: c.inventory_item_id,
            qty: c.qty,
          })),
        });
      }
    });

    /* Trả về mapping mới + estimated COGS */
    const newComponents = await prisma.sellProductComponent.findMany({
      where: { variant_id: variantId },
      include: {
        inventoryItem: {
          select: { id: true, sku: true, name: true, unit: true, current_stock: true, average_cost: true },
        },
      },
    });

    const estimatedCogs = newComponents.reduce(
      (sum, c) => sum + c.qty * c.inventoryItem.average_cost,
      0
    );

    res.json({
      success: true,
      components: newComponents,
      estimatedCogs,
      message: "Đã cập nhật mapping combo",
    });
  } catch (err) {
    console.error("Lỗi cập nhật components:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

/* ══════════════════════════════════════════════════════
   DELETE /api/sell-components/:variantId — Xóa toàn bộ mapping
   ══════════════════════════════════════════════════════ */
router.delete("/:variantId", verifyToken, async (req, res) => {
  try {
    const variantId = parseInt(req.params.variantId);
    await prisma.sellProductComponent.deleteMany({ where: { variant_id: variantId } });
    res.json({ success: true, message: "Đã xóa mapping combo" });
  } catch (err) {
    console.error("Lỗi xóa components:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

module.exports = router;