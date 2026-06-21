/**
 * /api/customer-benefits — Ví ưu đãi khách mua mèo (Phase 3)
 *
 *   GET  /lookup?phone=     — ví của 1 khách: membership (giảm % đồ ăn) + voucher còn hiệu lực
 *   POST /vouchers/:id/redeem — đánh dấu voucher đã dùng (nhân viên áp tại đơn/booking)
 *   GET  /config            — admin: xem cấu hình gói ưu đãi
 *   PUT  /config            — admin: chỉnh cấu hình (config-driven, giống bookingHours)
 *
 * Ưu đãi khóa theo SĐT (không FK Customer/User) → áp được cả đơn POS lẫn booking.
 */
const express = require("express");
const prisma = require("../lib/prisma");
const { verifyToken } = require("../middleware/auth");
const { requireBranch, requireAdmin } = require("../middleware/requireRole");
const catPerks = require("../lib/catPerks");

const router = express.Router();

// ── GET /lookup?phone= — ví ưu đãi của khách ──────────────────────────────────
router.get("/lookup", verifyToken, requireBranch, async (req, res) => {
  try {
    const phone = (req.query.phone || "").toString().trim();
    if (phone.length < 6) return res.status(400).json({ error: "Thiếu/không hợp lệ số điện thoại." });
    const now = new Date();

    // Tự đánh dấu voucher hết hạn trước khi đọc
    await prisma.benefitVoucher.updateMany({
      where: { phone, status: "active", valid_until: { lt: now } },
      data: { status: "expired" },
    });

    const [membership, vouchers] = await Promise.all([
      prisma.customerMembership.findUnique({ where: { phone } }),
      prisma.benefitVoucher.findMany({ where: { phone, status: "active" }, orderBy: { created_at: "desc" } }),
    ]);

    const membershipActive = !!membership &&
      membership.food_discount_pct > 0 &&
      (!membership.discount_until || membership.discount_until > now);

    res.json({
      success: true,
      phone,
      membership,
      membershipActive,
      foodDiscountPct: membershipActive ? membership.food_discount_pct : 0,
      vouchers,
    });
  } catch (err) {
    console.error("[GET /customer-benefits/lookup]", err);
    res.status(500).json({ error: "Không tra được ví ưu đãi." });
  }
});

// ── POST /vouchers/:id/redeem — đánh dấu đã dùng ──────────────────────────────
router.post("/vouchers/:id/redeem", verifyToken, requireBranch, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const v = await prisma.benefitVoucher.findUnique({ where: { id } });
    if (!v) return res.status(404).json({ error: "Không tìm thấy voucher." });
    if (v.status !== "active") return res.status(409).json({ error: "Voucher đã dùng hoặc hết hạn." });
    if (v.valid_until && v.valid_until < new Date()) {
      await prisma.benefitVoucher.update({ where: { id }, data: { status: "expired" } });
      return res.status(409).json({ error: "Voucher đã hết hạn." });
    }

    const b = req.body || {};
    const usedRef = b.used_ref
      || (b.order_id ? `order:${b.order_id}` : null)
      || (b.booking_id ? `booking:${b.booking_id}` : null)
      || (b.note ? String(b.note) : "Áp tại quầy");

    const updated = await prisma.benefitVoucher.update({
      where: { id },
      data: { status: "used", used_at: new Date(), used_ref: usedRef },
    });
    res.json({ success: true, voucher: updated });
  } catch (err) {
    console.error("[POST /customer-benefits/vouchers/:id/redeem]", err);
    res.status(500).json({ error: "Không thể đánh dấu voucher." });
  }
});

// ── Config (admin) ────────────────────────────────────────────────────────────
router.get("/config", verifyToken, requireAdmin, async (_req, res) => {
  try {
    res.json({ success: true, config: await catPerks.getConfig(), defaults: catPerks.DEFAULTS });
  } catch (err) {
    console.error("[GET /customer-benefits/config]", err);
    res.status(500).json({ error: "Lỗi đọc cấu hình." });
  }
});

router.put("/config", verifyToken, requireAdmin, async (req, res) => {
  try {
    const config = await catPerks.updateConfig(req.body || {});
    res.json({ success: true, config });
  } catch (err) {
    console.error("[PUT /customer-benefits/config]", err);
    res.status(500).json({ error: "Lỗi lưu cấu hình." });
  }
});

module.exports = router;
