const express = require("express");
const { verifyToken } = require("../middleware/auth");
const { storeContext } = require("../middleware/storeContext");
const { storeWhere, injectStoreId } = require("../lib/storeFilter");
const prisma = require("../lib/prisma");
const { calcAverageCost } = require("./inventory");

const router = express.Router();
const { getIO } = require("../socket");

async function generatePoNumber() {
  const today = new Date();
  const y = String(today.getFullYear()).slice(-2);
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const prefix = `PN${y}${m}${d}`;
  // Dùng MAX thay vì COUNT để tránh trùng khi có bản ghi bị xóa hoặc tạo đồng thời
  const last = await prisma.purchaseOrder.findFirst({
    where:   { po_number: { startsWith: prefix } },
    orderBy: { po_number: "desc" },
    select:  { po_number: true },
  });
  let nextNum = 1;
  if (last) {
    const match = last.po_number.match(/-(\d+)$/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }
  return `${prefix}-${String(nextNum).padStart(3, "0")}`;
}

/* ── GET /api/purchase-orders ── */
router.get("/", verifyToken, storeContext, async (req, res) => {
  try {
    const orders = await prisma.purchaseOrder.findMany({
      where: { ...storeWhere(req) },
      include: {
        supplier: { select: { name: true, phone: true } },
        _count: { select: { items: true } },
      },
      orderBy: { id: "desc" },
    });

    res.json({
      success: true,
      data: orders.map((po) => ({
        id:          po.id,
        po_number:   po.po_number,
        supplier:    po.supplier ? { name: po.supplier.name, phone: po.supplier.phone } : null,
        total_cost:  po.total_cost,
        status:      po.status,
        note:        po.note,
        item_count:  po._count.items,
        confirmed_at: po.confirmed_at,
        created_at:  po.created_at,
      })),
    });
  } catch (err) {
    console.error("Lỗi lấy phiếu nhập:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

/* ── GET /api/purchase-orders/stats/profit — Lợi nhuận thật ── */
router.get("/stats/profit", verifyToken, storeContext, async (req, res) => {
  try {
    const { from, to } = req.query;
    const dateFilter = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);

    const whereOrder = {
      status: "delivered",
      ...storeWhere(req),
      ...(from || to ? { created_at: dateFilter } : {}),
    };

    const [revenueAgg, cogsAgg] = await Promise.all([
      prisma.order.aggregate({ where: whereOrder, _sum: { total: true } }),
      prisma.orderItem.aggregate({
        where: { order: whereOrder },
        _sum: { cogs_amount: true },
      }),
    ]);

    const revenue = revenueAgg._sum.total || 0;
    const cogs = cogsAgg._sum.cogs_amount || 0;
    const profit = revenue - cogs;
    const margin =
      revenue > 0 ? parseFloat(((profit / revenue) * 100).toFixed(1)) : 0;

    res.json({ success: true, stats: { revenue, cogs, profit, margin } });
  } catch (err) {
    console.error("Lỗi thống kê:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

/* ── GET /api/purchase-orders/:id ── */
router.get("/:id", verifyToken, storeContext, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const po = await prisma.purchaseOrder.findUnique({
      where: { id, ...storeWhere(req) },
      include: {
        supplier: true,
        items: {
          include: {
            inventoryItem: {
              select: {
                id: true,
                name: true,
                sku: true,
                unit: true,
                current_stock: true,
                average_cost: true,
              },
            },
          },
          orderBy: { id: "asc" },
        },
      },
    });
    if (!po)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy" });
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
router.post("/", verifyToken, storeContext, async (req, res) => {
  try {
    const { supplierId, supplier_id, items, note } = req.body;
    const resolvedSupplierId = supplierId ?? supplier_id;

    if (!resolvedSupplierId)
      return res
        .status(400)
        .json({ success: false, message: "Chưa chọn nhà cung cấp" });
    if (!items || items.length === 0)
      return res
        .status(400)
        .json({ success: false, message: "Phải có ít nhất 1 sản phẩm" });

    for (const item of items) {
      if (!item.inventory_item_id && !item.name?.trim())
        return res
          .status(400)
          .json({
            success: false,
            message: "Mỗi hàng hóa phải có tên hoặc chọn từ kho",
          });
      if (!item.unit_cost || item.unit_cost <= 0)
        return res
          .status(400)
          .json({ success: false, message: "Giá nhập phải > 0" });
      if (!item.qty || item.qty <= 0)
        return res
          .status(400)
          .json({ success: false, message: "Số lượng phải > 0" });
    }

    const totalCost = items.reduce((sum, i) => sum + i.unit_cost * i.qty, 0);
    const poNumber = await generatePoNumber();

    const result = await prisma.$transaction(async (tx) => {
      /* Resolve inventory_item_id: tạo mới nếu chưa có */
      const resolvedItems = [];
      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        let invItemId = item.inventory_item_id;

        if (!invItemId) {
          const storeId    = req.storeId;
          const productId  = item.product_id  ? parseInt(item.product_id)  : null;
          const variantId  = item.variant_id  ? parseInt(item.variant_id)  : null;
          const skuRaw     = item.sku?.trim().toUpperCase() || `NK-${poNumber}-${idx + 1}`;

          // Ưu tiên tìm theo product_id+variant_id nếu có, fallback sang sku
          const existing = await tx.inventoryItem.findFirst({
            where: {
              store_id: storeId,
              ...(productId
                ? { product_id: productId, variant_id: variantId }
                : { sku: skuRaw }),
            },
          });

          if (existing) {
            invItemId = existing.id;
            // Cập nhật link product nếu chưa có
            if (productId && !existing.product_id) {
              await tx.inventoryItem.update({
                where: { id: existing.id },
                data: { product_id: productId, variant_id: variantId },
              });
            }
          } else {
            // Lấy tên từ product/variant nếu có
            let displayName = item.name?.trim() || skuRaw;
            let displayUnit = item.unit?.trim() || "cái";
            if (productId) {
              const product = await tx.product.findUnique({
                where: { id: productId },
                include: { variants: { where: variantId ? { id: variantId } : undefined } },
              });
              if (product) {
                const variant = product.variants?.[0];
                displayName = variant
                  ? `${product.name} — ${variant.name}`
                  : product.name;
                displayUnit = item.unit?.trim() || "cái";
              }
            }

            const created = await tx.inventoryItem.create({
              data: {
                sku:             skuRaw,
                name:            displayName,
                unit:            displayUnit,
                store_id:        storeId,
                product_id:      productId,
                variant_id:      variantId,
                min_stock_alert: 0,
              },
            });
            invItemId = created.id;
          }
        }

        resolvedItems.push({
          invItemId,
          unit_cost: item.unit_cost,
          qty: item.qty,
        });
      }

      const po = await tx.purchaseOrder.create({
        data: {
          po_number: poNumber,
          supplier_id: resolvedSupplierId,
          total_cost: totalCost,
          status: "draft",
          note: note || "",
          ...injectStoreId(req),
        },
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

    // Thông báo realtime cho stock-manager và admin
    try {
      const io = getIO();
      if (io) {
        const payload = {
          id: `po_${result.id}_${Date.now()}`,
          event: 'stock:new',
          title: '📦 Phiếu nhập hàng mới',
          body: `Phiếu ${poNumber} vừa được tạo bởi ${req.user?.username ?? 'manager'}`,
          time: new Date().toISOString(),
        };
        io.to('stock-room').emit('stock:new', payload);
        io.to('admin-room').emit('stock:new', payload);
      }
    } catch { /* không critical */ }

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
/* ── PUT /api/purchase-orders/:id/status — Flutter gọi chỗ này ── */
router.put("/:id/status", verifyToken, storeContext, async (req, res) => {
  try {
    const id     = parseInt(req.params.id);
    const { status } = req.body;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id, ...storeWhere(req) },
      include: { items: { include: { inventoryItem: true } } },
    });
    if (!po) return res.status(404).json({ success: false, message: "Không tìm thấy" });

    if (status === "confirmed") {
      if (po.status !== "draft")
        return res.status(400).json({ success: false, message: "Phiếu này đã được xử lý" });

      await prisma.$transaction(async (tx) => {
        // Optimistic lock: chỉ update nếu vẫn còn là "draft" — tránh confirm 2 lần đồng thời
        const locked = await tx.purchaseOrder.updateMany({
          where: { id, status: "draft" },
          data:  { status: "confirmed", confirmed_at: new Date() },
        });
        if (locked.count === 0) {
          throw new Error("ALREADY_CONFIRMED"); // đã bị confirm bởi request khác
        }

        for (const item of po.items) {
          const inv = item.inventoryItem;
          // Đọc lại tồn kho trong transaction để tính average_cost chính xác
          const freshInv   = await tx.inventoryItem.findUnique({ where: { id: inv.id } });
          const newAvgCost = calcAverageCost(freshInv.current_stock, freshInv.average_cost, item.qty, item.unit_cost);
          const before     = freshInv.current_stock;
          const newStock   = before + item.qty;

          await tx.inventoryItem.update({
            where: { id: inv.id },
            data:  { current_stock: newStock, average_cost: newAvgCost },
          });
          await tx.stockMovement.create({ data: {
            inventory_item_id: inv.id, type: "purchase",
            qty_change: item.qty, qty_before: before, qty_after: newStock,
            unit_cost: item.unit_cost, reference_type: "purchase_order", reference_id: po.id,
            note: `Nhập từ phiếu ${po.po_number}`,
          }});
        }
      }).catch(err => {
        if (err.message === "ALREADY_CONFIRMED")
          return res.status(409).json({ success: false, message: "Phiếu đã được xác nhận bởi thao tác khác" });
        throw err;
      });
      if (res.headersSent) return;
      try {
        const io = getIO();
        if (io) {
          const payload = {
            id: `po_confirm_${id}_${Date.now()}`,
            event: 'stock:confirmed',
            title: '✅ Phiếu nhập đã xác nhận',
            body: `Phiếu ${po.po_number} đã được nhập kho thành công`,
            poId: id, poNumber: po.po_number,
            time: new Date().toISOString(),
          };
          io.to('manager-room').emit('stock:confirmed', payload);
          io.to('admin-room').emit('stock:confirmed', payload);
          io.to('stock-room').emit('stock:confirmed', payload);
        }
      } catch { /* không critical */ }
      return res.json({ success: true, message: "Đã xác nhận nhập kho" });
    }

    if (status === "cancelled") {
      if (po.status !== "draft")
        return res.status(400).json({ success: false, message: "Chỉ hủy được phiếu ở trạng thái draft" });
      await prisma.purchaseOrder.update({ where: { id }, data: { status: "cancelled" } });
      try {
        const io = getIO();
        if (io) {
          const payload = {
            id: `po_cancel_${id}_${Date.now()}`,
            event: 'stock:cancelled',
            title: '❌ Phiếu nhập bị hủy',
            body: `Phiếu ${po.po_number} đã bị hủy`,
            poId: id, poNumber: po.po_number,
            time: new Date().toISOString(),
          };
          io.to('manager-room').emit('stock:cancelled', payload);
          io.to('admin-room').emit('stock:cancelled', payload);
        }
      } catch { /* không critical */ }
      return res.json({ success: true, message: "Đã hủy phiếu nhập" });
    }

    return res.status(400).json({ success: false, message: "Status không hợp lệ. Dùng: confirmed, cancelled" });
  } catch (err) {
    console.error("Lỗi cập nhật status phiếu nhập:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

// Legacy endpoint — redirect sang /:id/status để tránh duplicate logic
router.put("/:id/confirm", verifyToken, storeContext, async (req, res) => {
  try {
    req.body = { status: "confirmed" };
    // Forward sang handler chính
    return res.redirect(307, `/api/purchase-orders/${req.params.id}/status`);
  } catch (err) {
    console.error("Lỗi xác nhận phiếu nhập (legacy):", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

/* ── PUT /api/purchase-orders/:id/cancel ── */
router.put("/:id/cancel", verifyToken, storeContext, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const po = await prisma.purchaseOrder.findUnique({
      where: { id, ...storeWhere(req) },
    });

    if (!po)
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy",
      });

    if (po.status !== "draft")
      return res.status(400).json({
        success: false,
        message: "Chỉ hủy được phiếu ở trạng thái draft",
      });

    await prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: "cancelled",
      },
    });

    res.json({
      success: true,
      message: "Đã hủy phiếu nhập",
    });
  } catch (err) {
    console.error("Lỗi hủy phiếu nhập:", err);

    res.status(500).json({
      success: false,
      message: "Lỗi server",
    });
  }
});

module.exports = router;