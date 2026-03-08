const express = require("express");
const crypto  = require("crypto");
const fs      = require("fs");
const path    = require("path");
const db      = require("../db/database");

const router = express.Router();

// ── Tạo payload chuẩn để ký / verify ─────────────────────────────────────────
function buildPayload(order) {
  return [
    order.invoice_no,
    order.customer_name  || "",
    order.customer_phone || "",
    String(order.total),
    order.created_at,
  ].join("|");
}

/* ─────────────────────────────────────────────────────────────────────────────
   GET /api/sign/payload/:invoiceNo
   Trả về chuỗi payload để laptop ký — browser cần biết ký cái gì
───────────────────────────────────────────────────────────────────────────── */
router.get("/payload/:invoiceNo", (req, res) => {
  try {
    const order = db.prepare(`
      SELECT
        orders.invoice_no,
        orders.total,
        orders.created_at,
        customers.name  AS customer_name,
        customers.phone AS customer_phone
      FROM orders
      LEFT JOIN customers ON customers.id = orders.customer_id
      WHERE orders.invoice_no = ?
    `).get(req.params.invoiceNo);

    if (!order) return res.status(404).json({ error: "Không tìm thấy đơn hàng" });

    res.json({
      invoiceNo: order.invoice_no,
      payload:   buildPayload(order), // chuỗi browser sẽ ký
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
router.post("/:invoiceNo", (req, res) => {
  try {
    const { invoiceNo }  = req.params;
    const { signature }  = req.body;

    if (!signature) return res.status(400).json({ error: "Thiếu signature" });

    // Kiểm tra đơn tồn tại
    const order = db.prepare(`
      SELECT orders.invoice_no FROM orders WHERE invoice_no = ?
    `).get(invoiceNo);
    if (!order) return res.status(404).json({ error: "Không tìm thấy đơn hàng" });

    // Lưu signature
    db.prepare(`UPDATE orders SET signature = ? WHERE invoice_no = ?`)
      .run(signature, invoiceNo);

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
router.get("/verify/:invoiceNo", (req, res) => {
  try {
    const order = db.prepare(`
      SELECT
        orders.*,
        customers.name  AS customer_name,
        customers.phone AS customer_phone
      FROM orders
      LEFT JOIN customers ON customers.id = orders.customer_id
      WHERE orders.invoice_no = ?
    `).get(req.params.invoiceNo);

    if (!order)          return res.status(404).json({ valid: false, error: "Không tìm thấy đơn hàng" });
    if (!order.signature) return res.json({ valid: false, error: "Đơn chưa được ký" });

    // Public key trên server — chỉ cần .pem, không cần .key
    const pubKeyPath = process.env.SIGN_PUBKEY_PATH;
    if (!pubKeyPath || !fs.existsSync(pubKeyPath)) {
      return res.status(500).json({ valid: false, error: "Không tìm thấy public key trên server" });
    }

    const publicKey = fs.readFileSync(pubKeyPath, "utf8");
    const payload   = buildPayload(order);

    const verify = crypto.createVerify("SHA256");
    verify.update(payload);
    verify.end();
    const valid = verify.verify(publicKey, order.signature, "base64");

    res.json({
      valid,
      invoiceNo:    order.invoice_no,
      customerName: order.customer_name,
      total:        order.total,
      createdAt:    order.created_at,
      message: valid
        ? "✅ Hóa đơn hợp lệ — nội dung chưa bị chỉnh sửa"
        : "❌ Chữ ký không khớp — hóa đơn có thể đã bị chỉnh sửa",
    });

  } catch (err) {
    res.status(500).json({ valid: false, error: err.message });
  }
});

module.exports = router;