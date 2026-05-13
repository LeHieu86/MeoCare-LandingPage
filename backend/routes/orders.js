const express = require("express");
const { verifyToken } = require("../middleware/auth");
const prisma = require("../lib/prisma");

const router = express.Router();

/* ── CONSTANTS ────────────────────────────────────── */
const STATUS_FLOW = ["pending", "confirmed", "shipping", "delivered"];
const STATUS_LABEL = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  shipping: "Đang giao",
  delivered: "Đã giao",
};

const QR_EXPIRE_MINUTES = 10;

/* ── Helper tạo mã hóa đơn ───────────────────────── */
async function generateInvoiceNo() {
  const today = new Date();
  const y = String(today.getFullYear()).slice(-2);
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const prefix = `MC${y}${m}${d}`;

  const count = await prisma.order.count({
    where: { invoice_no: { startsWith: prefix } },
  });

  const num = String(count + 1).padStart(3, "0");
  return `${prefix}-${num}`;
}

/* ══════════════════════════════════════════════════════
   ⚠️ QUAN TRỌNG: /my PHẢI nằm TRƯỚC /:id
   ══════════════════════════════════════════════════════ */

/* ── GET /api/orders/my — Đơn hàng của khách (Auth) ── */
router.get("/my", verifyToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { phone: true },
    });

    if (!user || !user.phone || user.phone === "Null") {
      return res.json({ success: true, orders: [] });
    }

    const customer = await prisma.customer.findFirst({
      where: { phone: user.phone },
    });
    if (!customer) return res.json({ success: true, orders: [] });

    const orders = await prisma.order.findMany({
      where: { customer_id: customer.id },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, image: true } },
          },
        },
        reviews: { select: { productId: true, orderId: true } },
      },
      orderBy: { id: "desc" },
    });

    res.json({ success: true, orders });
  } catch (err) {
    console.error("Lỗi lấy đơn hàng:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

/* ── GET /api/orders — Danh sách đơn (Admin) ──────── */
router.get("/", async (req, res) => {
  try {
    const rows = await prisma.order.findMany({
      where: {
        NOT: {
          payment_method: "bank",
          payment_status: { not: "paid" },
        },
      },
      include: {
        customer: {
          select: { name: true, phone: true, address: true },
        },
      },
      orderBy: { id: "desc" },
    });

    const formattedData = rows.map((order) => ({
      id: order.id,
      invoice_no: order.invoice_no,
      customer_id: order.customer_id,
      subtotal: order.subtotal,
      ship_fee: order.ship_fee,
      discount: order.discount,
      total: order.total,
      status: order.status,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      note: order.note,
      signature: order.signature,
      created_at: order.created_at,
      name: order.customer?.name,
      phone: order.customer?.phone,
      address: order.customer?.address,
    }));

    res.json({ data: formattedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

/* ── GET /api/orders/:id — Chi tiết đơn ───────────── */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id: parseInt(id) },
      include: {
        customer: { select: { name: true, phone: true, address: true } },
        items: {
          include: {
            product: { select: { name: true } },
          },
          orderBy: { id: "asc" },
        },
      },
    });

    if (!order)
      return res.status(404).json({ error: "Không tìm thấy đơn hàng" });

    const formattedOrder = {
      id: order.id,
      invoice_no: order.invoice_no,
      customer_id: order.customer_id,
      subtotal: order.subtotal,
      ship_fee: order.ship_fee,
      discount: order.discount,
      total: order.total,
      status: order.status,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      note: order.note,
      signature: order.signature,
      created_at: order.created_at,
      customer_name: order.customer?.name,
      customer_phone: order.customer?.phone,
      customer_address: order.customer?.address,
      items: order.items.map((item) => ({
        id: item.id,
        order_id: item.order_id,
        product_id: item.product_id,
        variant_name: item.variant_name,
        price: item.price,
        qty: item.qty,
        subtotal: item.subtotal,
        product_name: item.product?.name,
      })),
    };

    res.json(formattedOrder);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

/* ── PUT /api/orders/:id/status — Admin cập nhật trạng thái ── */
router.put("/:id/status", async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const { status } = req.body;

    if (Number.isNaN(orderId))
      return res.status(400).json({ success: false, message: "ID không hợp lệ" });

    if (!STATUS_FLOW.includes(status))
      return res.status(400).json({ success: false, message: "Trạng thái không hợp lệ" });

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order)
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });

    const currentIdx = STATUS_FLOW.indexOf(order.status);
    const newIdx = STATUS_FLOW.indexOf(status);

    if (newIdx <= currentIdx) {
      return res.status(400).json({
        success: false,
        message: `Không thể chuyển từ "${STATUS_LABEL[order.status]}" sang "${STATUS_LABEL[status]}"`,
      });
    }

    if (status === "delivered") {
      return res.status(400).json({
        success: false,
        message: "Trạng thái 'Đã giao' chỉ khách hàng mới xác nhận được",
      });
    }

    /* ── Khi chuyển sang "confirmed": tính COGS + trừ tồn kho ── */
    if (status === "confirmed") {
      const orderWithItems = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              variant: {
                include: {
                  sellComponents: {
                    include: {
                      inventoryItem: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      await prisma.$transaction(async (tx) => {
        for (const item of orderWithItems.items) {
          const components = item.variant?.sellComponents || [];
          let cogsAmount = 0;

          for (const comp of components) {
            const inv = comp.inventoryItem;
            const neededQty = comp.qty * item.qty;
            const itemCogs  = inv.average_cost * neededQty;
            cogsAmount += itemCogs;

            const newStock = Math.max(0, inv.current_stock - neededQty);

            /* Trừ tồn kho */
            await tx.inventoryItem.update({
              where: { id: inv.id },
              data: { current_stock: newStock },
            });

            /* Ghi StockMovement type "sale" */
            await tx.stockMovement.create({
              data: {
                inventory_item_id: inv.id,
                type: "sale",
                qty_change: -neededQty,
                qty_before: inv.current_stock,
                qty_after: newStock,
                unit_cost: inv.average_cost,
                reference_type: "order",
                reference_id: orderId,
                note: `Bán từ đơn hàng #${order.invoice_no}`,
              },
            });
          }

          /* Lưu COGS vào OrderItem */
          if (cogsAmount > 0) {
            await tx.orderItem.update({
              where: { id: item.id },
              data: { cogs_amount: cogsAmount },
            });
          }
        }

        /* Cập nhật trạng thái đơn */
        await tx.order.update({ where: { id: orderId }, data: { status } });
      });

      const updated = await prisma.order.findUnique({ where: { id: orderId } });
      return res.json({ success: true, order: updated });
    }

    /* Các trạng thái khác (shipping) → update bình thường */
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status },
    });

    res.json({ success: true, order: updated });
  } catch (err) {
    console.error("Lỗi cập nhật trạng thái:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

/* ── PUT /api/orders/:id/received — Khách xác nhận đã nhận ── */
router.put("/:id/received", verifyToken, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    if (Number.isNaN(orderId))
      return res.status(400).json({ success: false, message: "ID không hợp lệ" });

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { phone: true },
    });

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true },
    });

    if (!order)
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });

    if (order.customer.phone !== user?.phone)
      return res.status(403).json({ success: false, message: "Không có quyền" });

    if (order.status !== "shipping")
      return res.status(400).json({
        success: false,
        message: "Chỉ có thể xác nhận khi đơn đang giao",
      });

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status: "delivered" },
    });

    res.json({ success: true, order: updated });
  } catch (err) {
    console.error("Lỗi xác nhận nhận hàng:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

/* ── PUT /api/orders/:id/confirm — Legacy (giữ tương thích) ── */
router.put("/:id/confirm", async (req, res) => {
  const orderId = parseInt(req.params.id);
  const { phone } = req.body;

  if (!phone)
    return res.status(400).json({ success: false, message: "Cần số điện thoại" });
  if (Number.isNaN(orderId))
    return res.status(400).json({ success: false, message: "ID không hợp lệ" });

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true },
    });

    if (!order)
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
    if (order.customer.phone !== phone)
      return res.status(403).json({ success: false, message: "Không có quyền" });
    if (order.status === "delivered")
      return res.json({ success: true, message: "Đã xác nhận trước đó" });

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status: "delivered" },
    });

    res.json({ success: true, order: updated });
  } catch (err) {
    console.error("Lỗi xác nhận đơn hàng:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

/* ── POST /api/orders — Tạo đơn hàng mới ─────────── */
router.post("/", async (req, res) => {
  try {
    const { customer, items, ship_fee, discount, note, payment_method } = req.body;

    if (!customer || !items || items.length === 0) {
      return res.status(400).json({ error: "Invalid order data" });
    }

    const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
    const total = subtotal + (ship_fee || 0) - (discount || 0);
    const invoiceNo = await generateInvoiceNo();

    const method = payment_method === "bank" ? "bank" : "cod";

    const result = await prisma.$transaction(async (tx) => {
      let finalCustomer = null;
      if (customer.phone) {
        finalCustomer = await tx.customer.findFirst({
          where: { phone: customer.phone },
        });
      }

      if (finalCustomer) {
        finalCustomer = await tx.customer.update({
          where: { id: finalCustomer.id },
          data: {
            name: customer.name,
            address: customer.address || finalCustomer.address,
          },
        });
      } else {
        finalCustomer = await tx.customer.create({
          data: {
            name: customer.name,
            phone: customer.phone || "",
            address: customer.address || "",
          },
        });
      }

      const paymentExpiredAt =
        method === "bank"
          ? new Date(Date.now() + QR_EXPIRE_MINUTES * 60 * 1000)
          : null;

      const newOrder = await tx.order.create({
        data: {
          invoice_no: invoiceNo,
          customer_id: finalCustomer.id,
          subtotal,
          ship_fee: ship_fee || 0,
          discount: discount || 0,
          total,
          status: "pending",
          payment_method: method,
          payment_status: "unpaid",
          payment_expired_at: paymentExpiredAt,
          note: note || "",
        },
      });

      await tx.orderItem.createMany({
        data: items.map((item) => ({
          order_id: newOrder.id,
          product_id: item.product_id || null,
          variant_name: item.variant_name,
          price: item.price,
          qty: item.qty,
          subtotal: item.price * item.qty,
        })),
      });

      return { orderId: newOrder.id, invoiceNo };
    });

    res.json({
      success: true,
      invoice_no: result.invoiceNo,
      order_id: result.orderId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Create order failed" });
  }
});

module.exports = router;