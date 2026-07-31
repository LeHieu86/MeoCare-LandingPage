/**
 * push.js — API cho Web Push (thông báo đẩy ra điện thoại khách PWA).
 *
 *  GET  /api/push/vapid-public-key   → public key để client subscribe
 *  POST /api/push/subscribe          → lưu/cập nhật subscription (soft-auth gắn user_id)
 *  POST /api/push/detach             → gỡ liên kết user (khách logout) — vẫn nhận lời chào
 *  POST /api/push/unsubscribe        → xoá hẳn subscription (khách tắt thông báo)
 *  POST /api/push/feeding/:bookingId → nhân viên bấm "đã cho ăn" (auth staff)
 *  POST /api/push/test               → gửi thử cho chính mình (auth staff)
 */

const express = require("express");
const { verifyToken, optionalAuth } = require("../middleware/auth");
const { storeContext } = require("../middleware/storeContext");
const prisma = require("../lib/prisma");
const push = require("../lib/webpush");

const router = express.Router();

// Nhân viên được phép bắn thông báo cho ăn / gửi thử (loại trừ role khách "client"/"customer").
const STAFF_ROLES = ["admin", "manager", "employee", "stock-manager", "hr-manager", "accountant"];
const requireStaff = (req, res, next) => {
  if (!STAFF_ROLES.includes(req.user?.role)) {
    return res.status(403).json({ error: "Không có quyền." });
  }
  next();
};

// Bóc { endpoint, keys:{p256dh, auth} } an toàn từ body.
function parseSub(body) {
  const sub = body?.subscription || body;
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;
  if (!endpoint || !p256dh || !auth) return null;
  return { endpoint, p256dh, auth };
}

// ── Public key ────────────────────────────────────────────────────────────────
router.get("/vapid-public-key", (_req, res) => {
  const key = push.getPublicKey();
  if (!key) return res.status(503).json({ error: "Push chưa được cấu hình trên máy chủ." });
  res.json({ key });
});

// ── Đăng ký / cập nhật subscription ──────────────────────────────────────────
// optionalAuth: có token hợp lệ → gắn user_id (để gửi thông báo cho ăn đúng chủ mèo);
// không có/không hợp lệ → user_id = null (vẫn nhận lời chào chung).
router.post("/subscribe", optionalAuth, async (req, res) => {
  const parsed = parseSub(req.body);
  if (!parsed) return res.status(400).json({ error: "Thiếu thông tin subscription." });

  const user_id = req.user?.id ?? null;
  const user_agent = (req.headers["user-agent"] || "").slice(0, 255);

  try {
    await prisma.pushSubscription.upsert({
      where: { endpoint: parsed.endpoint },
      update: { p256dh: parsed.p256dh, auth: parsed.auth, user_id, user_agent, last_seen: new Date() },
      create: { ...parsed, user_id, user_agent },
    });
    res.json({ ok: true });
  } catch (e) {
    console.error("[push] subscribe lỗi:", e?.message || e);
    res.status(500).json({ error: "Lưu subscription lỗi." });
  }
});

// ── Gỡ liên kết user (logout) — giữ subscription để vẫn nhận lời chào ─────────
router.post("/detach", async (req, res) => {
  const endpoint = req.body?.endpoint;
  if (!endpoint) return res.status(400).json({ error: "Thiếu endpoint." });
  try {
    await prisma.pushSubscription.updateMany({ where: { endpoint }, data: { user_id: null } });
    res.json({ ok: true });
  } catch (e) {
    console.error("[push] detach lỗi:", e?.message || e);
    res.status(500).json({ error: "Lỗi." });
  }
});

// ── Xoá hẳn (khách tắt thông báo) ────────────────────────────────────────────
router.post("/unsubscribe", async (req, res) => {
  const endpoint = req.body?.endpoint;
  if (!endpoint) return res.status(400).json({ error: "Thiếu endpoint." });
  try {
    await prisma.pushSubscription.deleteMany({ where: { endpoint } });
    res.json({ ok: true });
  } catch (e) {
    console.error("[push] unsubscribe lỗi:", e?.message || e);
    res.status(500).json({ error: "Lỗi." });
  }
});

// ── Nhân viên bấm "đã cho ăn" → gửi ngay cho chủ mèo ─────────────────────────
router.post("/feeding/:bookingId", verifyToken, requireStaff, async (req, res) => {
  const id = Number(req.params.bookingId);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "bookingId không hợp lệ." });

  try {
    const booking = await prisma.booking.findUnique({
      where: { id },
      select: { id: true, cat_name: true, owner_phone: true },
    });
    if (!booking) return res.status(404).json({ error: "Không tìm thấy booking." });

    const meal = (req.body?.meal || "").trim(); // "sáng" | "chiều" | "tối" | ""
    const cat = booking.cat_name || "bé mèo";
    const body = req.body?.message
      ? String(req.body.message)
      : `Bé ${cat} của bạn vừa được cho ăn${meal ? ` cữ ${meal}` : ""} rồi nè! 🐟`;

    const sent = await push.sendToBookingOwner(booking, {
      title: "MeoCare 🐱",
      body,
      url: "/portal",
      tag: `feeding-${booking.id}`,
    });
    res.json({ ok: true, sent });
  } catch (e) {
    console.error("[push] feeding lỗi:", e?.message || e);
    res.status(500).json({ error: "Gửi thông báo lỗi." });
  }
});

// ── Nhân viên bấm "đã cho ăn" HÀNG LOẠT → báo mọi mèo đang lưu trú ────────────
// storeContext: manager/employee tự giới hạn theo chi nhánh trong token; admin/owner
// truyền ?store_id để lọc 1 chi nhánh, không truyền = tất cả. Mỗi mèo 1 thông báo
// riêng (kèm tên mèo) nên chủ có 2 bé đang gửi sẽ nhận 2 tin.
router.post("/feeding-broadcast", verifyToken, storeContext, requireStaff, async (req, res) => {
  try {
    const meal = String(req.body?.meal || (new Date().getHours() < 12 ? "sáng" : "chiều")).trim();

    const where = { service_type: "boarding", status: "active" };
    if (req.storeId != null) where.store_id = req.storeId; // null = admin xem toàn hệ thống

    const bookings = await prisma.booking.findMany({
      where,
      select: { id: true, cat_name: true, owner_phone: true },
    });

    let sent = 0;          // tổng số thông báo đẩy đã gửi được
    let notifiedOwners = 0; // số booking có ít nhất 1 thiết bị nhận (chủ đã bật thông báo)
    for (const b of bookings) {
      if (!b.owner_phone) continue;
      const cat = b.cat_name || "bé mèo";
      const n = await push.sendToBookingOwner(b, {
        title: "MeoCare 🐱",
        body: `Bé ${cat} của bạn đang được cho ăn cữ ${meal} rồi nè! 🐟`,
        url: "/portal",
        tag: `feeding-${b.id}`,
      });
      sent += n;
      if (n > 0) notifiedOwners++;
    }

    res.json({ ok: true, bookings: bookings.length, notifiedOwners, sent, meal });
  } catch (e) {
    console.error("[push] feeding-broadcast lỗi:", e?.message || e);
    res.status(500).json({ error: "Gửi thông báo hàng loạt lỗi." });
  }
});

// ── Gửi thử cho chính mình (kiểm thử nhanh) ──────────────────────────────────
router.post("/test", verifyToken, requireStaff, async (req, res) => {
  try {
    const rows = await prisma.pushSubscription.findMany({ where: { user_id: req.user.id } });
    const sent = await push.sendToSubscriptions(rows, {
      title: "MeoCare — Thử thông báo 🔔",
      body: req.body?.message || "Nếu bạn thấy thông báo này thì Web Push đã hoạt động!",
      url: "/",
      tag: "test",
    });
    res.json({ ok: true, sent, subscriptions: rows.length });
  } catch (e) {
    console.error("[push] test lỗi:", e?.message || e);
    res.status(500).json({ error: "Lỗi." });
  }
});

// ── Gửi thủ công cho TẤT CẢ khách đã bật thông báo (phao dự phòng khi cron lỗi) ──
router.post("/broadcast", verifyToken, requireStaff, async (req, res) => {
  try {
    const body = (req.body?.body || "").toString().trim();
    if (!body) return res.status(400).json({ error: "Thiếu nội dung thông báo." });
    const sent = await push.broadcast({
      title: (req.body?.title || "MeoCare 🐱").toString(),
      body,
      url: req.body?.url || "/",
      tag: "manual-broadcast",
    });
    // Đếm tổng số thiết bị đã đăng ký (để nhân viên biết có ai bật hay chưa).
    const subscriptions = await prisma.pushSubscription.count();
    res.json({ ok: true, sent, subscriptions });
  } catch (e) {
    console.error("[push] broadcast lỗi:", e?.message || e);
    res.status(500).json({ error: "Gửi thông báo hàng loạt lỗi." });
  }
});

// ── Gửi thủ công cho MỘT khách cụ thể (theo user_id) ─────────────────────────
router.post("/send-user/:userId", verifyToken, requireStaff, async (req, res) => {
  const id = Number(req.params.userId);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "userId không hợp lệ." });
  try {
    const body = (req.body?.body || "").toString().trim();
    if (!body) return res.status(400).json({ error: "Thiếu nội dung thông báo." });
    const rows = await prisma.pushSubscription.findMany({ where: { user_id: id } });
    const sent = await push.sendToSubscriptions(rows, {
      title: (req.body?.title || "MeoCare 🐱").toString(),
      body,
      url: req.body?.url || "/",
      tag: `manual-user-${id}`,
    });
    res.json({ ok: true, sent, subscriptions: rows.length });
  } catch (e) {
    console.error("[push] send-user lỗi:", e?.message || e);
    res.status(500).json({ error: "Gửi thông báo lỗi." });
  }
});

module.exports = router;
