const express = require("express");
const { verifyToken } = require("../middleware/auth");
const { storeContext } = require("../middleware/storeContext");
const { storeWhere, injectStoreId } = require("../lib/storeFilter");
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
router.get("/", verifyToken, storeContext, async (req, res) => {
  try {
    const { search, low_stock, inactive } = req.query;

    const where = { ...storeWhere(req) };

    /* Mặc định chỉ hiện hàng đang hoạt động */
    if (!inactive) {
      where.isActive = true;
    }

    /* Tìm kiếm theo tên hoặc SKU */
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { sku:  { contains: search, mode: "insensitive" } },
      ];
    }

    /* Lọc hàng tồn kho thấp — filter trong JS vì Prisma không hỗ trợ field-to-field comparison */
    // (low_stock=1 sẽ được áp dụng sau khi fetch, xem phần map bên dưới)

    const items = await prisma.inventoryItem.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        _count:   { select: { sellComponents: true } },
        variant:  { select: { price: true, name: true } },
      },
    });

    // Với item chưa có variant_id → tìm variant theo tên (partial match)
    // InventoryItem name thường = "ProductName — VariantName"
    // Variant name = "VariantName" → dùng includes() thay vì exact match
    const allVariants = await prisma.variant.findMany({
      select: { id: true, name: true, price: true },
      orderBy: { name: "asc" },
    });

    /* Đánh dấu hàng tồn thấp */
    const result = items.map((item) => {
      // Ưu tiên: variant_id trực tiếp
      let sellPrice = item.variant?.price ?? 0;

      // Fallback: item.name chứa variant.name (ví dụ: "Hạt X — Mèo Con 500g" chứa "Mèo Con 500g")
      if (!sellPrice) {
        const itemNameLower = item.name.toLowerCase().trim();
        // Ưu tiên variant có tên dài hơn để tránh match nhầm
        const matched = allVariants
          .filter(v => v.price > 0 && itemNameLower.includes(v.name.toLowerCase().trim()))
          .sort((a, b) => b.name.length - a.name.length)[0];
        if (matched) sellPrice = matched.price;
      }

      return {
        id: item.id,
        sku: item.sku,
        name: item.name,
        barcode: item.barcode,
        unit: item.unit,
        kind: item.kind,
        current_stock: item.current_stock,
        average_cost: item.average_cost,
        sell_price: sellPrice,
        min_stock_alert: item.min_stock_alert,
        is_active: item.isActive,
        note: item.note,
        created_at: item.created_at,
        combo_count: item._count.sellComponents,
        is_low_stock: item.min_stock_alert > 0 && item.current_stock <= item.min_stock_alert,
      };
    });

    // Áp dụng low_stock filter sau khi đã tính is_low_stock
    const finalResult = low_stock === "1"
      ? result.filter(i => i.is_low_stock)
      : result;

    res.json({ success: true, items: finalResult });
  } catch (err) {
    console.error("Lỗi lấy inventory:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

/* ══════════════════════════════════════════════════════
   GET /api/inventory/barcode/:code
   Tra cứu sản phẩm theo barcode để dùng ở POS
   Flow: barcode → InventoryItem → SellProductComponent → Variant → Product
   ══════════════════════════════════════════════════════ */
router.get("/barcode/:code", verifyToken, async (req, res) => {
  try {
    const { code } = req.params;

    const invItem = await prisma.inventoryItem.findFirst({
      where: { barcode: code, is_active: true },
      select: { id: true, name: true, sku: true, barcode: true },
    });

    if (!invItem) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy sản phẩm với barcode: ${code}`,
      });
    }

    const component = await prisma.sellProductComponent.findFirst({
      where: { inventory_item_id: invItem.id },
      include: {
        variant: {
          include: {
            product: {
              select: { id: true, name: true, category: true, image: true },
            },
          },
        },
      },
    });

    if (!component) {
      return res.status(404).json({
        success: false,
        message: `Barcode tìm thấy "${invItem.name}" nhưng chưa được map với sản phẩm bán nào`,
        inventoryItem: invItem,
      });
    }

    const variant = component.variant;
    const product = variant.product;

    return res.json({
      success: true,
      result: {
        product: { id: product.id, name: product.name, category: product.category, image: product.image },
        variant: { id: variant.id, name: variant.name, price: variant.price },
        inventoryItem: { id: invItem.id, name: invItem.name, barcode: invItem.barcode },
      },
    });
  } catch (err) {
    console.error("Lỗi tra barcode:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

/* ══════════════════════════════════════════════════════
   GET /api/inventory/:id — Chi tiết 1 item + lịch sử biến động
   ══════════════════════════════════════════════════════ */
router.get("/:id", verifyToken, storeContext, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const item = await prisma.inventoryItem.findUnique({
      where: { id, ...storeWhere(req) },
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
   GET /api/inventory/:id/variants
   Danh sách Variant (thuộc Product) đang link tới InventoryItem này
   qua SellProductComponent — dùng cho "Import từ kho" trong AdminPanel.
   ══════════════════════════════════════════════════════ */
router.get("/:id/variants", verifyToken, storeContext, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const components = await prisma.sellProductComponent.findMany({
      where: { inventory_item_id: id },
      include: {
        variant: {
          include: { product: { select: { id: true, name: true } } },
        },
      },
      orderBy: { id: "asc" },
    });
    const variants = components.map((c) => ({
      id: c.variant.id,
      name: c.variant.name,
      price: c.variant.price,
      qty_per_unit: c.qty,
      inventory_item_id: c.inventory_item_id,
      product: c.variant.product,
    }));
    res.json({ success: true, variants });
  } catch (err) {
    console.error("Lỗi lấy variants theo inventory:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

/* ══════════════════════════════════════════════════════
   POST /api/inventory — Tạo hàng hóa mới
   ══════════════════════════════════════════════════════ */
router.post("/", verifyToken, storeContext, async (req, res) => {
  try {
    const { sku, name, barcode, unit, min_stock_alert, note, kind } = req.body;

    if (!sku?.trim()) return res.status(400).json({ success: false, message: "SKU không được trống" });
    if (!name?.trim()) return res.status(400).json({ success: false, message: "Tên không được trống" });
    const itemKind = ["bulk", "retail", "both"].includes(kind) ? kind : "bulk";

    /* Check SKU trùng trong cùng store */
    const existing = await prisma.inventoryItem.findFirst({
      where: { sku: sku.trim().toUpperCase(), ...storeWhere(req) },
    });
    if (existing) return res.status(409).json({ success: false, message: `SKU "${sku}" đã tồn tại` });

    const item = await prisma.inventoryItem.create({
      data: {
        sku: sku.trim().toUpperCase(),
        name: name.trim(),
        barcode: barcode?.trim() || null,
        unit: unit?.trim() || "hộp",
        kind: itemKind,
        min_stock_alert: parseInt(min_stock_alert) || 0,
        note: note?.trim() || null,
        ...injectStoreId(req),
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
router.put("/:id", verifyToken, storeContext, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, barcode, unit, min_stock_alert, note, is_active, kind } = req.body;

    if (!name?.trim()) return res.status(400).json({ success: false, message: "Tên không được trống" });

    const exists = await prisma.inventoryItem.findUnique({ where: { id, ...storeWhere(req) } });
    if (!exists) return res.status(404).json({ success: false, message: "Không tìm thấy" });

    const item = await prisma.inventoryItem.update({
      where: { id },
      data: {
        name: name.trim(),
        barcode: barcode?.trim() || null,
        unit: unit?.trim() || "hộp",
        kind: ["bulk", "retail", "both"].includes(kind) ? kind : undefined,
        min_stock_alert: parseInt(min_stock_alert) || 0,
        note: note?.trim() || null,
        isActive: is_active !== undefined ? Boolean(is_active) : undefined,
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
router.put("/:id/adjust", verifyToken, storeContext, async (req, res) => {
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

    const item = await prisma.inventoryItem.findUnique({ where: { id, ...storeWhere(req) } });
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
router.delete("/:id", verifyToken, storeContext, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const item = await prisma.inventoryItem.findUnique({ where: { id, ...storeWhere(req) } });
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
      data: { isActive: false },
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
router.get("/stats/overview", verifyToken, storeContext, async (req, res) => {
  try {
    const items = await prisma.inventoryItem.findMany({
      where: { isActive: true, ...storeWhere(req) },
      select: {
        current_stock: true,
        average_cost: true,
        min_stock_alert: true,
      },
    });

    const totalItems = items.length;

    const totalStockValue = items.reduce(
      (sum, i) => sum + i.current_stock * i.average_cost,
      0
    );

    const lowStockCount = items.filter(
      (i) =>
        i.min_stock_alert > 0 &&
        i.current_stock <= i.min_stock_alert
    ).length;

    res.json({
      success: true,
      stats: {
        total_items: totalItems,
        total_stock_value: totalStockValue,
        low_stock_count: lowStockCount,
      },
    });
  } catch (err) {
    console.error("Lỗi thống kê inventory:", err);

    res.status(500).json({
      success: false,
      message: "Lỗi server",
    });
  }
});

module.exports = {
  router,
  calcAverageCost,
};