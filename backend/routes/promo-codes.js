/**
 * /api/promo-codes — MÃ GIẢM GIÁ khách tự nhập.
 *
 * - CRUD (admin): tạo/sửa/xóa/liệt kê mã.
 * - POST /validate (khách đã đăng nhập): checkout gọi để xem mã giảm bao nhiêu TRƯỚC khi đặt.
 *
 * Áp giảm THẬT + ghi nhận lượt dùng nằm ở luồng tạo đơn/booking (đợt 2/3), dùng lib/promoCodes.
 */
const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const promo = require("../lib/promoCodes");
const { verifyToken } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/requireRole");

// Lỗi do người nhập (→ trả 400 kèm message), phân biệt với lỗi hệ thống (→ 500).
const badInput = (msg) => Object.assign(new Error(msg), { userError: true });

// Chuẩn hoá + kiểm tra dữ liệu tạo/sửa mã. Ném badInput nếu sai.
function sanitize(body) {
  const code = promo.normalizeCode(body.code);
  if (!code) throw badInput("Chưa nhập mã.");
  if (!/^[A-Z0-9_-]{2,32}$/.test(code)) throw badInput("Mã chỉ gồm chữ/số/gạch, 2–32 ký tự.");

  const type = body.type;
  if (!promo.TYPES.includes(type)) throw badInput("Loại mã không hợp lệ.");

  // Ship chỉ có nghĩa với đơn hàng → ép phạm vi 'orders'.
  let applies_to = promo.SCOPES.includes(body.applies_to) ? body.applies_to : "both";
  if (type === "shipping") applies_to = "orders";

  const int = (v, d = null) => {
    if (v === "" || v === null || v === undefined) return d;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : d;
  };

  let value = int(body.value, 0) || 0;
  if (type === "percent") {
    if (value < 1 || value > 100) throw badInput("Giảm % phải từ 1 đến 100.");
  } else if (value < 0) {
    throw badInput("Giá trị giảm không hợp lệ.");
  }
  // shipping value 0 = miễn phí toàn bộ ship (hợp lệ).

  const toDate = (v) => (v ? new Date(v) : null);
  return {
    code, type, applies_to, value,
    max_discount: type === "percent" ? int(body.max_discount) : null,
    min_order: int(body.min_order),
    starts_at: toDate(body.starts_at),
    ends_at: toDate(body.ends_at),
    usage_limit: int(body.usage_limit),
    per_customer_limit: body.per_customer_limit === "" || body.per_customer_limit == null
      ? 1 : int(body.per_customer_limit),   // null = không giới hạn; mặc định 1
    active: body.active !== false,
    description: (body.description || "").trim() || null,
  };
}

// ── GET / — danh sách mã + số lượt đã dùng (admin) ───────────────────────────
router.get("/", verifyToken, requireAdmin, async (_req, res) => {
  try {
    const codes = await prisma.promoCode.findMany({
      orderBy: { created_at: "desc" },
      include: { _count: { select: { redemptions: true } } },
    });
    res.json({ success: true, codes });
  } catch (err) {
    console.error("[GET /promo-codes]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ── POST / — tạo mã (admin) ──────────────────────────────────────────────────
router.post("/", verifyToken, requireAdmin, async (req, res) => {
  try {
    const data = sanitize(req.body);
    const created = await prisma.promoCode.create({ data });
    res.json({ success: true, code: created });
  } catch (err) {
    if (err.code === "P2002") return res.status(400).json({ error: "Mã này đã tồn tại." });
    if (err.userError) return res.status(400).json({ error: err.message });
    console.error("[POST /promo-codes]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ── PUT /:id — sửa mã (admin) ────────────────────────────────────────────────
router.put("/:id", verifyToken, requireAdmin, async (req, res) => {
  try {
    const data = sanitize(req.body);
    const updated = await prisma.promoCode.update({ where: { id: parseInt(req.params.id, 10) }, data });
    res.json({ success: true, code: updated });
  } catch (err) {
    if (err.code === "P2002") return res.status(400).json({ error: "Mã này đã tồn tại." });
    if (err.code === "P2025") return res.status(404).json({ error: "Không tìm thấy mã." });
    if (err.userError) return res.status(400).json({ error: err.message });
    console.error("[PUT /promo-codes]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ── DELETE /:id — xóa mã (admin). Lượt dùng đã ghi nhận xóa theo (cascade). ───
router.delete("/:id", verifyToken, requireAdmin, async (req, res) => {
  try {
    await prisma.promoCode.delete({ where: { id: parseInt(req.params.id, 10) } });
    res.json({ success: true });
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Không tìm thấy mã." });
    console.error("[DELETE /promo-codes]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ── POST /validate — checkout xem mã giảm bao nhiêu (khách đã đăng nhập) ──────
// body: { code, scope:'order'|'service', subtotal, shipping_fee?, phone? }
router.post("/validate", verifyToken, async (req, res) => {
  try {
    const r = await promo.validate(req.body.code, {
      scope: req.body.scope,
      subtotal: req.body.subtotal,
      shipping_fee: req.body.shipping_fee,
      phone: req.body.phone,
    });
    if (!r.ok) return res.status(200).json({ success: false, reason: r.reason });
    res.json({
      success: true,
      discount: r.discount,
      code: r.code.code,
      type: r.code.type,
      description: r.code.description,
    });
  } catch (err) {
    console.error("[POST /promo-codes/validate]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

module.exports = router;
