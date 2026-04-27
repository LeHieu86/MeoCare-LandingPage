const express = require("express");
// THAY ĐỔI: Import Prisma
const prisma = require("../lib/prisma");

const router = express.Router();

/* ── Helper tạo mã hóa đơn ───────────────────────── */
// THAY ĐỔI: Thêm async vì Prisma là bất đồng bộ
async function generateInvoiceNo() {
  const today = new Date();

  const y = String(today.getFullYear()).slice(-2);
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");

  const prefix = `MC${y}${m}${d}`;

  // THAY ĐỔI: Dùng Prisma count với startsWith thay vì LIKE của SQL
  const count = await prisma.order.count({
    where: {
      invoice_no: { startsWith: prefix },
    },
  });

  const num = String(count + 1).padStart(3, "0");
  return `${prefix}-${num}`;
}

/* ── GET /api/orders/my?phone= ─────────────────── */
router.get("/my", async (req, res) => {
  const { phone } = req.query;
  if (!phone)
    return res
      .status(400)
      .json({ success: false, message: "Cần số điện thoại" });

  try {
    const customer = await prisma.customer.findFirst({ where: { phone } });
    if (!customer) return res.json({ success: true, orders: [] });

    const orders = await prisma.order.findMany({
      where: { customer_id: customer.id },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: { select: { id: true, name: true, image: true } },
              },
            },
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

/* ── PUT /api/orders/:id/confirm ───────────────── */
router.put("/:id/confirm", async (req, res) => {
  const orderId = parseInt(req.params.id);
  const { phone } = req.body;

  if (!phone)
    return res
      .status(400)
      .json({ success: false, message: "Cần số điện thoại" });
  if (Number.isNaN(orderId))
    return res.status(400).json({ success: false, message: "ID không hợp lệ" });

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true },
    });

    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy đơn hàng" });
    if (order.customer.phone !== phone)
      return res
        .status(403)
        .json({ success: false, message: "Không có quyền" });
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

/* ── GET /api/orders ───────────────────────────── */
router.get("/", async (req, res) => {
  try {
    // THAY ĐỔI: Dùng findMany + include
    const rows = await prisma.order.findMany({
      include: {
        customer: {
          select: { name: true, phone: true, address: true },
        },
      },
      orderBy: { id: "desc" },
    });

    // ✨ QUAN TRỌNG: Map dữ liệu lồng nhau thành dữ liệu phẳng để không vỡ Frontend
    const formattedData = rows.map((order) => ({
      id: order.id,
      invoice_no: order.invoice_no,
      customer_id: order.customer_id,
      subtotal: order.subtotal,
      ship_fee: order.ship_fee,
      discount: order.discount,
      total: order.total,
      note: order.note,
      signature: order.signature,
      created_at: order.created_at,
      // Giải phóng object customer ra cùng cấp
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

/* ── GET /api/orders/:id ───────────────────────────── */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id: parseInt(id) },
      include: {
        customer: { select: { name: true, phone: true, address: true } },
        items: {
          include: {
            variant: {
              // ✅ đi qua variant
              include: {
                product: { select: { name: true } },
              },
            },
          },
          orderBy: { id: "asc" },
        },
      },
    });

    if (!order)
      return res.status(404).json({ error: "Không tìm thấy đơn hàng" });

    // ✨ QUAN TRỌNG: Map phẳng cả Order, Customer và Items
    const formattedOrder = {
      id: order.id,
      invoice_no: order.invoice_no,
      customer_id: order.customer_id,
      subtotal: order.subtotal,
      ship_fee: order.ship_fee,
      discount: order.discount,
      total: order.total,
      note: order.note,
      signature: order.signature,
      created_at: order.created_at,
      customer_name: order.customer?.name,
      customer_phone: order.customer?.phone,
      customer_address: order.customer?.address,
      // Map riêng array items
      items: order.items.map((item) => ({
        id: item.id,
        order_id: item.order_id,
        product_id: item.product_id,
        variant_name: item.variant_name,
        price: item.price,
        qty: item.qty,
        subtotal: item.subtotal,
        product_name: item.variant?.product?.name, // Đổi từ object product sang chuỗi product_name
      })),
    };

    res.json(formattedOrder);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

/* ── POST /api/orders ───────────────────────────── */
router.post("/", async (req, res) => {
  try {
    const { customer, items, ship_fee, discount, note } = req.body;

    if (!customer || !items || items.length === 0) {
      return res.status(400).json({ error: "Invalid order data" });
    }

    const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
    const total = subtotal + (ship_fee || 0) - (discount || 0);

    // Chờ hàm tạo mã hóa đơn (Vì nó là async)
    const invoiceNo = await generateInvoiceNo();

    /* ── TRANSACTION CỦA PRISMA ───────────────── */
    const result = await prisma.$transaction(async (tx) => {
      /* 1. Customer */
      const newCustomer = await tx.customer.create({
        data: {
          name: customer.name,
          phone: customer.phone || "",
          address: customer.address || "",
          // created_at không cần truyền, Prisma Schema đã có @default(now())
        },
      });

      /* 2. Order */
      const newOrder = await tx.order.create({
        data: {
          invoice_no: invoiceNo,
          customer_id: newCustomer.id,
          subtotal: subtotal,
          ship_fee: ship_fee || 0,
          discount: discount || 0,
          total: total,
          note: note || "",
        },
      });

      /* 3. Order Items */
      // Thay vì dùng vòng lặp for, Prisma có hàm createMany cực nhanh và an toàn
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

      return {
        orderId: newOrder.id,
        invoiceNo: invoiceNo,
      };
    }); // Kết thúc Transaction

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
