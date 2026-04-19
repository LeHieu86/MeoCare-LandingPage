const express = require("express");
const crypto  = require("crypto");
const fs      = require("fs");
const path    = require("path");

// THAY ĐỔI: Import Prisma
const prisma = require("../lib/prisma");

const router = express.Router();

// ── Tạo payload chuẩn để ký / verify ─────────────────────────────────────────
function buildPayload(order) {
  return [
    order.invoice_no,
    order.customer_name  || "",
    order.customer_phone || "",
    String(order.total),
    // ⚠️ QUAN TRỌNG: Ép Date object của Prisma về chuẩn ISO string
    // Nếu không, chữ ký số sẽ bị lỗi (không khớp) khi verify!
    order.created_at.toISOString(), 
  ].join("|");
}

/* ─────────────────────────────────────────────────────────────────────────────
   GET /api/sign/payload/:invoiceNo
   Trả về chuỗi payload để laptop ký — browser cần biết ký cái gì
───────────────────────────────────────────────────────────────────────────── */
router.get("/payload/:invoiceNo", async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { invoice_no: req.params.invoiceNo },
      include: {
        customer: { select: { name: true, phone: true } }
      }
    });

    if (!order) return res.status(404).json({ error: "Không tìm thấy đơn hàng" });

    // ✨ Map dữ liệu lồng nhau thành dạng phẳng để đưa vào hàm buildPayload
    const flatOrder = {
      invoice_no: order.invoice_no,
      total: order.total,
      created_at: order.created_at,
      customer_name: order.customer?.name,
      customer_phone: order.customer?.phone
    };

    res.json({
      invoiceNo: flatOrder.invoice_no,
      payload: buildPayload(flatOrder), 
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────────────────────────────────────
   POST /api/sign/:invoiceNo
   Nhận signature từ browser (đã ký trên laptop), lưu vào DB
   Body: { signature: "base64..." }
───────────────────────────────────────────────────────────────────────────── */
router.post("/:invoiceNo", async (req, res) => {
  try {
    const { invoiceNo }  = req.params;
    const { signature }  = req.body;

    if (!signature) return res.status(400).json({ error: "Thiếu signature" });

    // Kiểm tra đơn tồn tại (Chỉ cần lấy ID, không cần join gì cả)
    const order = await prisma.order.findUnique({
      where: { invoice_no: invoiceNo }
    });
    if (!order) return res.status(404).json({ error: "Không tìm thấy đơn hàng" });

    // Lưu signature (Chỉ cập nhật 1 trường duy nhất)
    await prisma.order.update({
      where: { invoice_no: invoiceNo },
      data: { signature }
    });

    const verifyUrl = `${process.env.APP_URL || "http://localhost:3000"}/verify/${invoiceNo}`;

    res.json({
      success:   true,
      invoiceNo,
      verifyUrl,
      signedAt:  new Date().toISOString(),
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────────────────────────────────────
   GET /api/sign/verify/:invoiceNo
   Xác thực signature bằng public key (meocare.pem trên server)
───────────────────────────────────────────────────────────────────────────── */
router.get("/verify/:invoiceNo", async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { invoice_no: req.params.invoiceNo },
      include: {
        customer: { select: { name: true, phone: true } }
      }
    });

    if (!order)          return res.status(404).json({ valid: false, error: "Không tìm thấy đơn hàng" });
    if (!order.signature) return res.json({ valid: false, error: "Đơn chưa được ký" });

    // Public key trên server — chỉ cần .pem, không cần .key
    const pubKeyPath = process.env.SIGN_PUBKEY_PATH;
    if (!pubKeyPath || !fs.existsSync(pubKeyPath)) {
      return res.status(500).json({ valid: false, error: "Không tìm thấy public key trên server" });
    }

    const publicKey = fs.readFileSync(pubKeyPath, "utf8");
    
    // ✨ Phải Map phẳng y hệt như lúc GET /payload thì chữ ký mới khớp!
    const flatOrder = {
      invoice_no: order.invoice_no,
      total: order.total,
      created_at: order.created_at,
      customer_name: order.customer?.name,
      customer_phone: order.customer?.phone
    };
    
    const payload = buildPayload(flatOrder);

    // Logic mã hóa (Giữ nguyên 100%)
    const verify = crypto.createVerify("SHA256");
    verify.update(payload);
    verify.end();
    const valid = verify.verify(publicKey, order.signature, "base64");

    res.json({
      valid,
      invoiceNo:    flatOrder.invoice_no,
      customerName: flatOrder.customer_name,
      total:        flatOrder.total,
      createdAt:    flatOrder.created_at,
      message: valid
        ? "✅ Hóa đơn hợp lệ — nội dung chưa bị chỉnh sửa"
        : "❌ Chữ ký không khớp — hóa đơn có thể đã bị chỉnh sửa",
    });

  } catch (err) {
    res.status(500).json({ valid: false, error: err.message });
  }
});

module.exports = router;