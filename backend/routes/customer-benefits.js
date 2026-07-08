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

// ── GET /my — ví ưu đãi của CHÍNH khách đang đăng nhập (web khách) ────────────
router.get("/my", verifyToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { phone: true },
    });
    const phone = (user?.phone || "").trim();
    if (phone.length < 6) {
      return res.json({ success: true, phone: "", membership: null, membershipActive: false, foodDiscountPct: 0, vouchers: [] });
    }
    const now = new Date();
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
    console.error("[GET /customer-benefits/my]", err);
    res.status(500).json({ error: "Không tải được ưu đãi của bạn." });
  }
});

// ── GET / — danh sách ưu đãi toàn hệ thống (Quản lý ưu đãi) ───────────────────
// Membership + voucher khóa theo SĐT (không theo store) → quản lý/admin xem toàn bộ.
router.get("/", verifyToken, requireBranch, async (_req, res) => {
  try {
    const now = new Date();
    // Tự đánh dấu voucher hết hạn trước khi đọc
    await prisma.benefitVoucher.updateMany({
      where: { status: "active", valid_until: { lt: now } },
      data: { status: "expired" },
    });

    const [memberships, vouchers] = await Promise.all([
      prisma.customerMembership.findMany({ orderBy: { updated_at: "desc" } }),
      prisma.benefitVoucher.findMany({ orderBy: { created_at: "desc" }, take: 2000 }),
    ]);

    const isActive = (m) =>
      m.food_discount_pct > 0 && (!m.discount_until || m.discount_until > now);
    const soon = new Date(now.getTime() + 7 * 86400000);

    res.json({
      success: true,
      stats: {
        membersTotal: memberships.length,
        membersActive: memberships.filter(isActive).length,
        vouchersActive: vouchers.filter((v) => v.status === "active").length,
        vouchersUsed: vouchers.filter((v) => v.status === "used").length,
        vouchersExpiringSoon: vouchers.filter(
          (v) => v.status === "active" && v.valid_until && v.valid_until <= soon
        ).length,
      },
      memberships: memberships.map((m) => ({ ...m, active: isActive(m) })),
      vouchers,
    });
  } catch (err) {
    console.error("[GET /customer-benefits]", err);
    res.status(500).json({ error: "Không tải được danh sách ưu đãi." });
  }
});

// ── POST /vouchers — TẶNG voucher thủ công cho 1 SĐT ──────────────────────────
router.post("/vouchers", verifyToken, requireBranch, async (req, res) => {
  try {
    const b = req.body || {};
    const phone = (b.phone || "").toString().trim();
    if (phone.length < 6) return res.status(400).json({ error: "Số điện thoại không hợp lệ." });
    if (!b.type || !b.title) return res.status(400).json({ error: "Thiếu loại hoặc tên ưu đãi." });

    const validUntil = b.valid_until
      ? new Date(b.valid_until)
      : (b.valid_days ? new Date(Date.now() + parseInt(b.valid_days, 10) * 86400000) : null);

    const voucher = await prisma.benefitVoucher.create({
      data: {
        phone,
        type: b.type.toString(),
        title: b.title.toString().trim(),
        value: b.value && typeof b.value === "object" ? b.value : {},
        status: "active",
        max_uses: Math.max(1, parseInt(b.max_uses, 10) || 1),
        valid_until: validUntil,
      },
    });
    res.status(201).json({ success: true, voucher });
  } catch (err) {
    console.error("[POST /customer-benefits/vouchers]", err);
    res.status(500).json({ error: "Không tạo được voucher." });
  }
});

// ── POST /memberships — TẶNG / chỉnh membership (giảm đồ ăn) theo SĐT ──────────
router.post("/memberships", verifyToken, requireBranch, async (req, res) => {
  try {
    const b = req.body || {};
    const phone = (b.phone || "").toString().trim();
    if (phone.length < 6) return res.status(400).json({ error: "Số điện thoại không hợp lệ." });
    const pct = Math.min(100, Math.max(0, parseInt(b.food_discount_pct ?? 0, 10) || 0));

    let until = null;
    if (b.discount_until) until = new Date(b.discount_until);
    else if (b.months) { until = new Date(); until.setMonth(until.getMonth() + parseInt(b.months, 10)); }

    const membership = await prisma.customerMembership.upsert({
      where: { phone },
      update: {
        ...(b.name != null ? { name: b.name.toString() } : {}),
        food_discount_pct: pct,
        ...(until ? { discount_until: until } : {}),
        ...(b.points != null ? { points: parseInt(b.points, 10) || 0 } : {}),
      },
      create: {
        phone,
        name: (b.name || "").toString(),
        tier: "cat-owner",
        food_discount_pct: pct,
        discount_until: until,
        points: b.points != null ? parseInt(b.points, 10) || 0 : 0,
      },
    });
    res.json({ success: true, membership });
  } catch (err) {
    console.error("[POST /customer-benefits/memberships]", err);
    res.status(500).json({ error: "Không lưu được ưu đãi thành viên." });
  }
});

// ── POST /vouchers/:id/cancel — THU HỒI / hủy voucher ─────────────────────────
router.post("/vouchers/:id/cancel", verifyToken, requireBranch, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const v = await prisma.benefitVoucher.findUnique({ where: { id } });
    if (!v) return res.status(404).json({ error: "Không tìm thấy voucher." });
    if (v.status === "used") return res.status(409).json({ error: "Voucher đã dùng — không thể hủy." });
    const reason = (req.body?.reason || "").toString().trim();
    const voucher = await prisma.benefitVoucher.update({
      where: { id },
      data: { status: "cancelled", used_ref: reason ? `cancelled:${reason}` : "cancelled" },
    });
    res.json({ success: true, voucher });
  } catch (err) {
    console.error("[POST /customer-benefits/vouchers/:id/cancel]", err);
    res.status(500).json({ error: "Không hủy được voucher." });
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

    // Multi-use: tăng số lần dùng; chỉ chuyển 'used' khi đã dùng đủ max_uses.
    const maxUses = v.max_uses || 1;
    const newCount = (v.used_count || 0) + 1;
    const status = newCount >= maxUses ? "used" : "active";
    const updated = await prisma.benefitVoucher.update({
      where: { id },
      data: { used_count: newCount, status, used_at: new Date(), used_ref: usedRef },
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
