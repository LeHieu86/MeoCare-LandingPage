const express = require("express");
const prisma = require("../lib/prisma");

const router = express.Router();

/* ── CẤU HÌNH NGÂN HÀNG ── */
const BANK_CONFIG = {
  bankId: "MB",
  bankBin: "970422",
  bankName: "MB Bank",
  accountNo: "122687",
  accountName: "LE TRUONG HIEU",
};

const QR_EXPIRE_MINUTES = 10;

/* ── Helper: tạo VietQR URL ── */
function buildQrUrl({ amount, content }) {
  const params = new URLSearchParams({
    amount: String(amount),
    addInfo: content,
    accountName: BANK_CONFIG.accountName,
  });
  return `https://img.vietqr.io/image/${BANK_CONFIG.bankBin}-${BANK_CONFIG.accountNo}-compact2.png?${params}`;
}

/* ══════════════════════════════════════════════════════
   GET /api/payment/:orderId — Lấy thông tin thanh toán
   ══════════════════════════════════════════════════════ */
router.get("/:orderId", async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId);
    if (Number.isNaN(orderId)) {
      return res.status(400).json({ success: false, message: "ID không hợp lệ" });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        invoice_no: true,
        total: true,
        status: true,
        payment_method: true,
        payment_status: true,
        payment_expired_at: true,
        created_at: true,
      },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Không tìm thấy đơn hàng" });
    }

    if (order.payment_method !== "bank") {
      return res.status(400).json({ success: false, message: "Đơn hàng không dùng chuyển khoản" });
    }

    const transferContent = order.invoice_no;

    const expiredAt = order.payment_expired_at
      ? new Date(order.payment_expired_at)
      : new Date(new Date(order.created_at).getTime() + QR_EXPIRE_MINUTES * 60 * 1000);

    if (!order.payment_expired_at) {
      await prisma.order.update({
        where: { id: orderId },
        data: { payment_expired_at: expiredAt },
      });
    }

    const now = new Date();
    const isExpired = now > expiredAt;
    const isPaid = order.payment_status === "paid";

    res.json({
      success: true,
      payment: {
        orderId: order.id,
        invoiceNo: order.invoice_no,
        amount: order.total,
        status: isPaid ? "paid" : isExpired ? "expired" : "pending",

        bankName: BANK_CONFIG.bankName,
        accountNo: BANK_CONFIG.accountNo,
        accountName: BANK_CONFIG.accountName,
        transferContent,

        qrUrl: buildQrUrl({ amount: order.total, content: transferContent }),

        expiredAt: expiredAt.toISOString(),
        createdAt: order.created_at,
      },
    });
  } catch (err) {
    console.error("Lỗi lấy thông tin thanh toán:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

/* ══════════════════════════════════════════════════════
   GET /api/payment/:orderId/status — Poll trạng thái
   ══════════════════════════════════════════════════════ */
router.get("/:orderId/status", async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId);
    if (Number.isNaN(orderId)) {
      return res.status(400).json({ success: false, message: "ID không hợp lệ" });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        payment_status: true,
        payment_expired_at: true,
      },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Không tìm thấy" });
    }

    const now = new Date();
    const isExpired = order.payment_expired_at && now > new Date(order.payment_expired_at);
    const isPaid = order.payment_status === "paid";

    res.json({
      success: true,
      status: isPaid ? "paid" : isExpired ? "expired" : "pending",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

/* ══════════════════════════════════════════════════════
   POST /api/payment/webhook — Webhook từ Casso / SePay
   ══════════════════════════════════════════════════════ */
router.post("/webhook", async (req, res) => {
  try {
    const { data } = req.body;
    const transactions = Array.isArray(data) ? data : [data];

    for (const tx of transactions) {
      if (!tx) continue;

      const amount = tx.amount || tx.transferAmount || 0;
      const content = (tx.description || tx.content || tx.addDescription || "").toUpperCase().trim();

      if (amount <= 0) continue;

      const invoiceNo = extractInvoiceNo(content);
      if (!invoiceNo) {
        console.log(`[Webhook] Không tìm thấy mã hóa đơn trong: "${content}"`);
        continue;
      }

      const order = await prisma.order.findFirst({
        where: {
          invoice_no: invoiceNo,
          payment_method: "bank",
          payment_status: { not: "paid" },
        },
      });

      if (!order) {
        console.log(`[Webhook] Không match đơn nào: "${invoiceNo}"`);
        continue;
      }

      if (amount < order.total) {
        console.log(`[Webhook] Số tiền thiếu: nhận ${amount}, cần ${order.total} (đơn ${order.invoice_no})`);
        continue;
      }

      await prisma.order.update({
        where: { id: order.id },
        data: {
          payment_status: "paid",
          status: order.status === "pending" ? "confirmed" : order.status,
        },
      });

      console.log(`[Webhook] ✅ Đơn ${order.invoice_no} đã thanh toán (${amount}đ)`);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("[Webhook] Lỗi xử lý:", err);
    res.status(500).json({ success: false });
  }
});

function extractInvoiceNo(content) {
  const match = content.match(/MC\d{6}-\d{3}/);
  return match ? match[0] : null;
}

/* ── PUT /api/payment/:orderId/extend — Gia hạn QR ── */
router.put("/:orderId/extend", async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId);
    if (Number.isNaN(orderId)) {
      return res.status(400).json({ success: false, message: "ID không hợp lệ" });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true, invoice_no: true, total: true,
        payment_method: true, payment_status: true, created_at: true,
      },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Không tìm thấy" });
    }
    if (order.payment_method !== "bank") {
      return res.status(400).json({ success: false, message: "Đơn không dùng chuyển khoản" });
    }
    if (order.payment_status === "paid") {
      return res.status(400).json({ success: false, message: "Đơn đã thanh toán" });
    }

    /* Gia hạn thêm 10 phút từ bây giờ */
    const newExpiredAt = new Date(Date.now() + QR_EXPIRE_MINUTES * 60 * 1000);

    await prisma.order.update({
      where: { id: orderId },
      data: { payment_expired_at: newExpiredAt },
    });

    const transferContent = order.invoice_no;

    res.json({
      success: true,
      payment: {
        orderId: order.id,
        invoiceNo: order.invoice_no,
        amount: order.total,
        status: "pending",
        bankName: BANK_CONFIG.bankName,
        accountNo: BANK_CONFIG.accountNo,
        accountName: BANK_CONFIG.accountName,
        transferContent,
        qrUrl: buildQrUrl({ amount: order.total, content: transferContent }),
        expiredAt: newExpiredAt.toISOString(),
        createdAt: order.created_at,
      },
    });
  } catch (err) {
    console.error("Lỗi gia hạn QR:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

/* ── PUT /api/payment/:orderId/admin-confirm — Xác nhận thủ công (admin) ── */
router.put("/:orderId/admin-confirm", async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId);
    if (Number.isNaN(orderId)) {
      return res.status(400).json({ success: false, message: "ID không hợp lệ" });
    }

    const adminToken = req.headers["x-admin-token"];
    if (adminToken !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ success: false, message: "Không có quyền" });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, invoice_no: true, payment_method: true, payment_status: true, status: true },
    });

    if (!order) return res.status(404).json({ success: false, message: "Không tìm thấy" });
    if (order.payment_status === "paid") return res.json({ success: true, message: "Đơn đã thanh toán rồi" });

    await prisma.order.update({
      where: { id: orderId },
      data: {
        payment_status: "paid",
        status: order.status === "pending" ? "confirmed" : order.status,
      },
    });

    console.log(`[Admin] ✅ Xác nhận thủ công đơn ${order.invoice_no}`);
    res.json({ success: true, message: `Đã xác nhận thanh toán cho đơn ${order.invoice_no}` });
  } catch (err) {
    console.error("Lỗi admin confirm:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

module.exports = router;