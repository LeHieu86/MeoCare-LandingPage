const express = require("express");
const { verifyToken } = require("../middleware/auth");
const prisma = require("../lib/prisma");
const { calcAverageCost } = require("./inventory");

const router = express.Router();

async function generatePoNumber() {
  const today = new Date();
  const y = String(today.getFullYear()).slice(-2);
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const prefix = `PN${y}${m}${d}`;
  const count = await prisma.purchaseOrder.count({
    where: { po_number: { startsWith: prefix } },
  });
  return `${prefix}-${String(count + 1).padStart(3, "0")}`;
}

/* ── GET /api/purchase-orders ── */
router.get("/", verifyToken, async (req, res) => {
  try {
    const orders = await prisma.purchaseOrder.findMany({
      include: {
        supplier: { select: { name: true, phone: true } },
        _count: { select: { items: true } },
      },
      orderBy: { id: "desc" },
    });

    res.json({
      success: true,
      orders: orders.map((po) => ({
        id: po.id,
        po_number: po.po_number,
        supplier_name: po.supplier?.name,
        supplier_phone: po.supplier?.phone,
        total_cost: po.total_cost,
        status: po.status,
        note: po.note,
        item_count: po._count.items,
        confirmed_at: po.confirmed_at,
        created_at: po.created_at,
      })),
    });
  } catch (err) {
    console.error("Lỗi lấy phiếu nhập:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

/* ── GET /api/purchase-orders/stats/profit — Lợi nhuận thật ── */
router.get("/stats/profit", verifyToken, async (req, res) => {
  try {
    const { from, to } = req.query;
    const dateFilter = {};
    if (from) dateFilter.gte = new Date(from);
    if (to)   dateFilter.lte = new Date(to);

    const whereOrder = {
      status: "delivered",
      ...(from || to ? { created_at: dateFilter } : {}),
    };

    const [revenueAgg, cogsAgg] = await Promise.all([
      prisma.order.aggregate({ where: whereOrder, _sum: { total: true } }),
      prisma.orderItem.aggregate({ where: { order: whereOrder }, _sum: { cogs_amount: true } }),
    ]);

    const revenue = revenueAgg._sum.total || 0;
    const cogs    = cogsAgg._sum.cogs_amount || 0;
    const profit  = revenue - cogs;
    const margin  = revenue > 0 ? parseFloat(((profit / revenue) * 100).toFixed(1)) : 0;

    res.json({ success: true, stats: { revenue, cogs, profit, margin } });
  } catch (err) {
    console.error("Lỗi thống kê:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

/* ── GET /api/purchase-orders/:id ── */
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: {
          include: {
            inventoryItem: {
              select: { name: true, sku: true, unit: true, current_stock: true, average_cost: true },
            },
          },
          orderBy: { id: "asc" },
        },
      },
    });
    if (!po) return res.status(404).json({ success: false, message: "Không tìm thấy" });
    res.json({ success: true, order: po });
  } catch (err) {
    console.error("Lỗi chi tiết phiếu nhập:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

/* ── POST /api/purchase-orders — Tạo phiếu nhập (draft) ──
   Mỗi item có thể là:
   - { inventory_item_id, unit_cost, qty }           → chọn từ kho sẵn có
   - { name, sku?, unit?, unit_cost, qty }            → hàng mới, tự tạo InventoryItem
*/
router.post("/", verifyToken, async (req, res) => {
  try {
    const { supplier_id, items, note } = req.body;

    if (!supplier_id) return res.status(400).json({ success: false, message: "Chưa chọn nhà cung cấp" });
    if (!items || items.length === 0) return res.status(400).json({ success: false, message: "Phải có ít nhất 1 sản phẩm" });

    for (const item of items) {
      if (!item.inventory_item_id && !item.name?.trim())
        return res.status(400).json({ success: false, message: "Mỗi hàng hóa phải có tên hoặc chọn từ kho" });
      if (!item.unit_cost || item.unit_cost <= 0) return res.status(400).json({ success: false, message: "Giá nhập phải > 0" });
      if (!item.qty || item.qty <= 0) return res.status(400).json({ success: false, message: "Số lượng phải > 0" });
    }

    const totalCost = items.reduce((sum, i) => sum + i.unit_cost * i.qty, 0);
    const poNumber  = await generatePoNumber();

    const result = await prisma.$transaction(async (tx) => {
      /* Resolve inventory_item_id: tạo mới nếu chưa có */
      const resolvedItems = [];
      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        let invItemId = item.inventory_item_id;

        if (!invItemId) {
          const skuRaw = item.sku?.trim().toUpperCase() || `NK-${poNumber}-${idx + 1}`;
          const existing = await tx.inventoryItem.findUnique({ where: { sku: skuRaw } });
          if (existing) {
            invItemId = existing.id;
          } else {
            const created = await tx.inventoryItem.create({
              data: {
                sku: skuRaw,
                name: item.name.trim(),
                unit: item.unit?.trim() || "hộp",
                min_stock_alert: 0,
              },
            });
            invItemId = created.id;
          }
        }

        resolvedItems.push({ invItemId, unit_cost: item.unit_cost, qty: item.qty });
      }

      const po = await tx.purchaseOrder.create({
        data: { po_number: poNumber, supplier_id, total_cost: totalCost, status: "draft", note: note || "" },
      });
      await tx.purchaseOrderItem.createMany({
        data: resolvedItems.map((i) => ({
          po_id: po.id,
          inventory_item_id: i.invItemId,
          unit_cost: i.unit_cost,
          qty: i.qty,
          subtotal: i.unit_cost * i.qty,
        })),
      });
      return po;
    });

    res.json({ success: true, po_number: poNumber, po_id: result.id });
  } catch (err) {
    console.error("Lỗi tạo phiếu nhập:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

/* ── PUT /api/purchase-orders/:id/confirm — Xác nhận nhập kho ──
   Flow:
   1. Tính average_cost mới (bình quân gia quyền)
   2. Cộng current_stock
   3. Ghi StockMovement type "purchase"
   4. status → confirmed
*/
router.put("/:id/confirm", verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: { include: { inventoryItem: true } } },
    });

    if (!po) return res.status(404).json({ success: false, message: "Không tìm thấy" });
    if (po.status !== "draft") return res.status(400).json({ success: false, message: "Phiếu này đã được xử lý" });

    await prisma.$transaction(async (tx) => {
      for (const item of po.items) {
        const inv = item.inventoryItem;
        const newAvgCost = calcAverageCost(inv.current_stock, inv.average_cost, item.qty, item.unit_cost);
        const newStock   = inv.current_stock + item.qty;

        await tx.inventoryItem.update({
          where: { id: inv.id },
          data: { current_stock: newStock, average_cost: newAvgCost },
        });

        await tx.stockMovement.create({
          data: {
            inventory_item_id: inv.id,
            type: "purchase",
            qty_change: item.qty,
            qty_before: inv.current_stock,
            qty_after: newStock,
            unit_cost: item.unit_cost,
            reference_type: "purchase_order",
            reference_id: po.id,
            note: `Nhập từ phiếu ${po.po_number}`,
          },
        });
      }

      await tx.purchaseOrder.update({
        where: { id },
        data: { status: "confirmed", confirmed_at: new Date() },
      });
    });

    res.json({ success: true, message: "Đã xác nhận nhập kho & cập nhật tồn kho" });
  } catch (err) {
    console.error("Lỗi xác nhận phiếu nhập:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

/* ── PUT /api/purchase-orders/:id/cancel ── */
router.put("/:id/cancel", verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) return res.status(404).json({ success: false, message: "Không tìm thấy" });
    if (po.status !== "draft") return res.status(400).json({ success: false, message: "Chỉ hủy được phiếu nháp" });

    await prisma.purchaseOrder.update({ where: { id }, data: { status: "cancelled" } });
    res.json({ success: true, message: "Đã hủy phiếu nhập" });
  } catch (err) {
    console.error("Lỗi hủy phiếu:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

module.exports = router;