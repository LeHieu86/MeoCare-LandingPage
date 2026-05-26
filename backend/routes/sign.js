const express = require("express");
const crypto  = require("crypto");
const fs      = require("fs");
const path    = require("path");

const prisma = require("../lib/prisma");
const { verifyToken } = require("../middleware/auth");

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

// ── Helper: tìm record (order hoặc booking) từ invoiceNo ────────────────────
// invoiceNo "BK-123" = booking, ngược lại = order
async function loadInvoiceRecord(invoiceNo) {
  if (invoiceNo.startsWith("BK-")) {
    const id = parseInt(invoiceNo.slice(3), 10);
    if (Number.isNaN(id)) return null;
    const b = await prisma.booking.findUnique({ where: { id } });
    if (!b) return null;
    // Tổng cộng cho booking — phải tính giống frontend để chữ ký khớp
    const days = Math.max(1, Math.ceil((new Date(b.check_out) - new Date(b.check_in)) / (1000*60*60*24)));
    const unitPrice = days === 1 ? 70000 : 50000;
    return {
      kind: "booking",
      raw: b,
      flat: {
        invoice_no: invoiceNo,
        customer_name:  b.owner_name,
        customer_phone: b.owner_phone,
        total: days * unitPrice,
        created_at: b.created_at,
      },
    };
  }

  const order = await prisma.order.findUnique({
    where: { invoice_no: invoiceNo },
    include: { customer: { select: { name: true, phone: true } } },
  });
  if (!order) return null;
  return {
    kind: "order",
    raw: order,
    flat: {
      invoice_no: order.invoice_no,
      customer_name:  order.customer?.name,
      customer_phone: order.customer?.phone,
      total: order.total,
      created_at: order.created_at,
    },
  };
}

async function saveSignature(rec, signature) {
  if (rec.kind === "booking") {
    await prisma.booking.update({
      where: { id: rec.raw.id },
      data: { digital_signature: signature },
    });
  } else {
    await prisma.order.update({
      where: { invoice_no: rec.raw.invoice_no },
      data: { signature },
    });
  }
}

function getStoredSignature(rec) {
  return rec.kind === "booking" ? rec.raw.digital_signature : rec.raw.signature;
}

/* ─────────────────────────────────────────────────────────────────────────────
   GET /api/sign/payload/:invoiceNo
   Trả về chuỗi payload để laptop ký — browser cần biết ký cái gì
───────────────────────────────────────────────────────────────────────────── */
router.get("/payload/:invoiceNo", async (req, res) => {
  try {
    const rec = await loadInvoiceRecord(req.params.invoiceNo);
    if (!rec) return res.status(404).json({ error: "Không tìm thấy hóa đơn" });

    res.json({
      invoiceNo: rec.flat.invoice_no,
      payload: buildPayload(rec.flat),
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
router.post("/:invoiceNo", verifyToken, async (req, res) => {
  try {
    const { invoiceNo } = req.params;
    const { signature } = req.body;
    if (!signature) return res.status(400).json({ error: "Thiếu signature" });

    const rec = await loadInvoiceRecord(invoiceNo);
    if (!rec) return res.status(404).json({ error: "Không tìm thấy hóa đơn" });

    await saveSignature(rec, signature);

    const verifyUrl = `${process.env.APP_URL || "http://localhost:3000"}/verify/${invoiceNo}`;
    res.json({
      success: true,
      invoiceNo,
      verifyUrl,
      signedAt: new Date().toISOString(),
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
    const rec = await loadInvoiceRecord(req.params.invoiceNo);
    if (!rec) return res.status(404).json({ valid: false, error: "Không tìm thấy hóa đơn" });

    const storedSig = getStoredSignature(rec);
    if (!storedSig) return res.json({ valid: false, error: "Hóa đơn chưa được ký" });

    const pubKeyPath = process.env.SIGN_PUBKEY_PATH;
    if (!pubKeyPath || !fs.existsSync(pubKeyPath)) {
      return res.status(500).json({ valid: false, error: "Không tìm thấy public key trên server" });
    }
    const publicKey = fs.readFileSync(pubKeyPath, "utf8");

    const payload = buildPayload(rec.flat);
    const verify = crypto.createVerify("SHA256");
    verify.update(payload);
    verify.end();
    const valid = verify.verify(publicKey, storedSig, "base64");

    res.json({
      valid,
      kind:         rec.kind,
      invoiceNo:    rec.flat.invoice_no,
      customerName: rec.flat.customer_name,
      total:        rec.flat.total,
      createdAt:    rec.flat.created_at,
      message: valid
        ? "✅ Hóa đơn hợp lệ — nội dung chưa bị chỉnh sửa"
        : "❌ Chữ ký không khớp — hóa đơn có thể đã bị chỉnh sửa",
    });
  } catch (err) {
    res.status(500).json({ valid: false, error: err.message });
  }
});

module.exports = router;