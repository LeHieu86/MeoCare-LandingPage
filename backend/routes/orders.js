const express = require("express");
const jwt = require("jsonwebtoken");
const { verifyToken, JWT_SECRET } = require("../middleware/auth");
const prisma = require("../lib/prisma");
const { getIO } = require("../socket");

const router = express.Router();

/* ── CONSTANTS ────────────────────────────────────── */
const STATUS_FLOW = ["pending", "confirmed", "shipping", "delivered"];
const STATUS_LABEL = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  shipping: "Đang giao",
  delivered: "Đã giao",
  cancelled: "Đã hủy",
};

const QR_EXPIRE_MINUTES = 10;

/* ── Helper tạo mã hóa đơn ─────────────────────────
   Dùng MAX số chứ không phải count(): tránh trùng khi có đơn bị xoá
   hoặc race khi 2 đơn cùng tạo. Có retry để chống race condition nhỏ.
─────────────────────────────────────────────────── */
async function generateInvoiceNo() {
  const today = new Date();
  const y = String(today.getFullYear()).slice(-2);
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const prefix = `MC${y}${m}${d}`;

  // Lấy đơn lớn nhất hôm nay
  const last = await prisma.order.findFirst({
    where: { invoice_no: { startsWith: prefix } },
    orderBy: { invoice_no: "desc" },
    select: { invoice_no: true },
  });

  let nextNum = 1;
  if (last) {
    const m = last.invoice_no.match(/-(\d+)$/);
    if (m) nextNum = parseInt(m[1], 10) + 1;
  }

  return `${prefix}-${String(nextNum).padStart(3, "0")}`;
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
router.get("/", verifyToken, async (req, res) => {
  try {
    const rows = await prisma.order.findMany({
      where: {
        // Chỉ ẩn đơn bank đang ở trạng thái "unpaid" (đang chờ khách quét QR)
        // Đơn bank đã paid / refund_pending / refunded → vẫn hiển thị
        NOT: {
          payment_method: "bank",
          payment_status: "unpaid",
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
      cancel_requested_at: order.cancel_requested_at,
      cancel_request_reason: order.cancel_request_reason,
      cancel_rejected_at: order.cancel_rejected_at,
      cancel_rejected_reason: order.cancel_rejected_reason,
      cancelled_at: order.cancelled_at,
      cancel_reason: order.cancel_reason,
      cancelled_by: order.cancelled_by,
      refund_bank_name: order.refund_bank_name,
      refund_bank_account: order.refund_bank_account,
      refund_bank_holder: order.refund_bank_holder,
      refund_bank_bin: order.refund_bank_bin,
      refund_tx_ref: order.refund_tx_ref,
      refund_proof_url: order.refund_proof_url,
      refunded_at: order.refunded_at,
    }));

    res.json({ data: formattedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

/* ── GET /api/orders/:id — Chi tiết đơn ───────────── */
router.get("/:id", verifyToken, async (req, res) => {
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
      cancel_requested_at: order.cancel_requested_at,
      cancel_request_reason: order.cancel_request_reason,
      cancel_rejected_at: order.cancel_rejected_at,
      cancel_rejected_reason: order.cancel_rejected_reason,
      cancelled_at: order.cancelled_at,
      cancel_reason: order.cancel_reason,
      cancelled_by: order.cancelled_by,
      refund_bank_name: order.refund_bank_name,
      refund_bank_account: order.refund_bank_account,
      refund_bank_holder: order.refund_bank_holder,
      refund_bank_bin: order.refund_bank_bin,
      refund_tx_ref: order.refund_tx_ref,
      refund_proof_url: order.refund_proof_url,
      refunded_at: order.refunded_at,
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
router.put("/:id/status", verifyToken, async (req, res) => {
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

// Chuyển order sang "delivered" + cộng dồn sold cho từng product trong đơn.
// Trả về order đã update. Idempotent: nếu đã delivered thì không cộng sold lần nữa.
async function markOrderDelivered(orderId) {
  return await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: { select: { product_id: true, qty: true } } },
    });
    if (!order) return null;
    if (order.status === "delivered") return order;

    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: "delivered" },
    });

    // Gom qty theo product_id (đơn có thể có nhiều variant cùng product)
    const soldByProduct = {};
    for (const it of order.items) {
      if (!it.product_id) continue;
      soldByProduct[it.product_id] = (soldByProduct[it.product_id] || 0) + it.qty;
    }
    for (const [pid, qty] of Object.entries(soldByProduct)) {
      await tx.product.update({
        where: { id: parseInt(pid) },
        data: { sold: { increment: qty } },
      });
    }
    return updated;
  });
}

// Helper: chuẩn hoá refund_account và validate
function buildRefundData(refund_account) {
  if (!refund_account) return null;
  const { bank_name, bank_account, bank_holder, bank_bin } = refund_account;
  if (!bank_account || !bank_name || !bank_holder) return null;
  return {
    refund_bank_name: bank_name.trim(),
    refund_bank_account: bank_account.trim(),
    refund_bank_holder: bank_holder.trim(),
    refund_bank_bin: bank_bin?.trim() || null,
  };
}

/* ── POST /api/orders/:id/cancel ───────────────────────────────────────────
   - by=customer: TẠO YÊU CẦU HỦY, status không đổi, chờ admin duyệt.
   - by=admin: HỦY NGAY (admin chủ động); paid → set refund_pending.
──────────────────────────────────────────────────────────────────────────── */
router.post("/:id/cancel", async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    if (Number.isNaN(orderId))
      return res.status(400).json({ success: false, message: "ID không hợp lệ" });

    const { reason, by, phone, refund_account } = req.body;
    if (!reason || !reason.trim())
      return res.status(400).json({ success: false, message: "Vui lòng chọn lý do" });
    if (by !== "admin" && by !== "customer")
      return res.status(400).json({ success: false, message: "Thiếu thông tin người hủy" });

    // Admin path yêu cầu JWT hợp lệ
    if (by === "admin") {
      const token = req.headers["authorization"]?.split(" ")[1];
      if (!token) return res.status(401).json({ success: false, message: "Yêu cầu đăng nhập" });
      try { jwt.verify(token, JWT_SECRET); } catch {
        return res.status(401).json({ success: false, message: "Token không hợp lệ" });
      }
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true },
    });
    if (!order)
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn" });

    if (order.status !== "pending" && order.status !== "confirmed") {
      return res.status(400).json({
        success: false,
        message: `Không thể hủy ở trạng thái "${STATUS_LABEL[order.status] || order.status}"`,
      });
    }

    const isPaid = order.payment_method === "bank" && order.payment_status === "paid";
    const refundData = buildRefundData(refund_account);

    // ── KHÁCH HÀNG: tạo yêu cầu hủy, không đổi status ──
    if (by === "customer") {
      if (!phone || order.customer.phone !== phone)
        return res.status(403).json({ success: false, message: "Không có quyền" });

      if (order.cancel_requested_at)
        return res.status(400).json({ success: false, message: "Yêu cầu hủy đang chờ duyệt" });

      // Đơn paid bắt buộc cung cấp STK ngay khi gửi yêu cầu
      if (isPaid && !refundData) {
        return res.status(400).json({
          success: false,
          message: "Đơn đã thanh toán — cần cung cấp STK để hoàn tiền",
          require_refund_account: true,
        });
      }

      const updated = await prisma.order.update({
        where: { id: orderId },
        data: {
          cancel_requested_at: new Date(),
          cancel_request_reason: reason.trim(),
          cancel_rejected_at: null,
          cancel_rejected_reason: null,
          ...(refundData || {}),
        },
      });
      return res.json({ success: true, order: updated, message: "Đã gửi yêu cầu hủy. Chờ shop duyệt." });
    }

    // ── ADMIN: hủy ngay ──
    const data = {
      status: "cancelled",
      cancel_reason: reason.trim(),
      cancelled_by: "admin",
      cancelled_at: new Date(),
    };
    if (isPaid) {
      if (!refundData) {
        return res.status(400).json({
          success: false,
          message: "Đơn đã thanh toán — cần STK để hoàn tiền",
          require_refund_account: true,
        });
      }
      data.payment_status = "refund_pending";
      Object.assign(data, refundData);
    }
    const updated = await prisma.order.update({ where: { id: orderId }, data });
    res.json({ success: true, order: updated });
  } catch (err) {
    console.error("Lỗi xử lý hủy đơn:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

/* ── POST /api/orders/:id/cancel-request/withdraw — Khách rút yêu cầu hủy ── */
router.post("/:id/cancel-request/withdraw", async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const { phone } = req.body;
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true },
    });
    if (!order) return res.status(404).json({ success: false, message: "Không tìm thấy đơn" });
    if (!phone || order.customer.phone !== phone)
      return res.status(403).json({ success: false, message: "Không có quyền" });
    if (!order.cancel_requested_at)
      return res.status(400).json({ success: false, message: "Không có yêu cầu hủy nào" });

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        cancel_requested_at: null,
        cancel_request_reason: null,
      },
    });
    res.json({ success: true, order: updated });
  } catch (err) {
    console.error("Lỗi rút yêu cầu hủy:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

/* ── POST /api/orders/:id/cancel-request/approve — Admin duyệt yêu cầu ── */
router.post("/:id/cancel-request/approve", verifyToken, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ success: false, message: "Không tìm thấy đơn" });
    if (!order.cancel_requested_at)
      return res.status(400).json({ success: false, message: "Đơn không có yêu cầu hủy" });

    const isPaid = order.payment_method === "bank" && order.payment_status === "paid";
    const data = {
      status: "cancelled",
      cancel_reason: order.cancel_request_reason,
      cancelled_by: "customer",        // vốn là khách yêu cầu
      cancelled_at: new Date(),
      cancel_requested_at: null,        // clear yêu cầu
    };
    if (isPaid) data.payment_status = "refund_pending";

    const updated = await prisma.order.update({ where: { id: orderId }, data });
    res.json({ success: true, order: updated });
  } catch (err) {
    console.error("Lỗi duyệt yêu cầu hủy:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

/* ── POST /api/orders/:id/cancel-request/reject — Admin từ chối yêu cầu ── */
router.post("/:id/cancel-request/reject", verifyToken, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const { reason } = req.body;
    if (!reason || !reason.trim())
      return res.status(400).json({ success: false, message: "Cần nhập lý do từ chối" });

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ success: false, message: "Không tìm thấy đơn" });
    if (!order.cancel_requested_at)
      return res.status(400).json({ success: false, message: "Đơn không có yêu cầu hủy" });

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        cancel_requested_at: null,
        cancel_rejected_at: new Date(),
        cancel_rejected_reason: reason.trim(),
      },
    });
    res.json({ success: true, order: updated });
  } catch (err) {
    console.error("Lỗi từ chối yêu cầu hủy:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

/* ── POST /api/orders/:id/refund — Admin xác nhận đã chuyển khoản hoàn tiền ──
   Body: { tx_ref, proof_url }
─────────────────────────────────────────────────────────────────────────── */
router.post("/:id/refund", verifyToken, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    if (Number.isNaN(orderId))
      return res.status(400).json({ success: false, message: "ID không hợp lệ" });

    const { tx_ref, proof_url } = req.body;
    if (!tx_ref || !tx_ref.trim())
      return res.status(400).json({ success: false, message: "Thiếu mã giao dịch" });
    if (!proof_url || !proof_url.trim())
      return res.status(400).json({ success: false, message: "Thiếu ảnh biên lai" });

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ success: false, message: "Không tìm thấy đơn" });
    if (order.payment_status !== "refund_pending") {
      return res.status(400).json({
        success: false,
        message: "Đơn không ở trạng thái chờ hoàn tiền",
      });
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        payment_status: "refunded",
        refund_tx_ref: tx_ref.trim(),
        refund_proof_url: proof_url.trim(),
        refunded_at: new Date(),
      },
    });
    res.json({ success: true, order: updated });
  } catch (err) {
    console.error("Lỗi xác nhận refund:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

/* ── GET /api/orders/refund-queue — Admin xem đơn chờ hoàn tiền ── */
router.get("/refund-queue/list", verifyToken, async (_req, res) => {
  try {
    const rows = await prisma.order.findMany({
      where: { payment_status: "refund_pending" },
      include: { customer: { select: { name: true, phone: true } } },
      orderBy: { cancelled_at: "desc" },
    });
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
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

    const updated = await markOrderDelivered(orderId);

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

    const updated = await markOrderDelivered(orderId);

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

    if (!customer || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Thiếu thông tin đơn hàng" });
    }
    if (!customer.name?.trim() || !customer.phone?.trim()) {
      return res.status(400).json({ error: "Thiếu tên hoặc số điện thoại khách hàng" });
    }
    for (const item of items) {
      if (!Number.isInteger(item.qty) || item.qty <= 0 || item.qty > 10000) {
        return res.status(400).json({ error: "Số lượng sản phẩm không hợp lệ" });
      }
      if (typeof item.price !== "number" || item.price < 0) {
        return res.status(400).json({ error: "Giá sản phẩm không hợp lệ" });
      }
    }
    if (ship_fee !== undefined && (typeof ship_fee !== "number" || ship_fee < 0)) {
      return res.status(400).json({ error: "Phí giao hàng không hợp lệ" });
    }

    const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);

    if (discount !== undefined && (typeof discount !== "number" || discount < 0 || discount > subtotal)) {
      return res.status(400).json({ error: "Giảm giá không hợp lệ" });
    }

    const total = subtotal + (ship_fee || 0) - (discount || 0);
    if (total < 0) {
      return res.status(400).json({ error: "Tổng tiền không hợp lệ" });
    }

    const method = payment_method === "bank" ? "bank" : "cod";

    // Retry loop để chống race condition khi 2 đơn cùng tạo
    let result, attempts = 0;
    while (attempts < 5) {
      const invoiceNo = await generateInvoiceNo();
      try {
        result = await prisma.$transaction(async (tx) => {
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
        break; // thành công
      } catch (e) {
        if (e?.code === "P2002" && e?.meta?.target?.includes("invoice_no")) {
          attempts++;
          continue; // trùng → thử lại với invoice_no mới
        }
        throw e;
      }
    }

    if (!result) throw new Error("Không tạo được invoice_no sau 5 lần thử");

    // Thông báo realtime cho admin
    try {
      const io = getIO();
      if (io) {
        io.to("admin-room").emit("order:new", {
          invoiceNo: result.invoiceNo,
          orderId:   result.orderId,
          customerName: customer.name || "",
          total,
        });
      }
    } catch { /* socket emit không critical */ }

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