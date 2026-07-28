/**
 * webpush.js — Gửi thông báo đẩy (Web Push / VAPID) ra ĐIỆN THOẠI khách đã cài PWA.
 *
 * Khác với lib/notify.js (Telegram cho CHỦ TIỆM) và socket.js (in-app khi đang mở):
 * kênh này hiện thông báo ở khay hệ thống điện thoại KỂ CẢ khi app đã đóng.
 *
 * Cấu hình .env (sinh 1 lần: npx web-push generate-vapid-keys):
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...)
 *
 * An toàn: thiếu cấu hình → enabled=false, mọi hàm return sớm (KHÔNG làm hỏng luồng
 * tạo booking/đơn/chat). Subscription chết (HTTP 404/410) tự bị xoá khỏi DB.
 */

const webpush = require("web-push");
const prisma = require("./prisma");

const PUBLIC = process.env.VAPID_PUBLIC_KEY;
const PRIVATE = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@meocare.local";

let enabled = false;
if (PUBLIC && PRIVATE) {
  try {
    webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);
    enabled = true;
  } catch (e) {
    console.warn("[webpush] VAPID cấu hình lỗi, tính năng push TẮT:", e?.message || e);
  }
} else {
  console.warn("[webpush] Thiếu VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY — tính năng push đang TẮT.");
}

const isEnabled = () => enabled;
const getPublicKey = () => PUBLIC || null;

/** Chuyển bản ghi DB → object subscription mà web-push cần. */
function toSubscription(row) {
  return { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
}

/**
 * Gửi payload tới danh sách bản ghi subscription (rows từ DB).
 * Trả về số lượng gửi thành công. KHÔNG throw. Sub chết → xoá.
 */
async function sendToSubscriptions(rows, payload) {
  if (!enabled || !rows?.length) return 0;
  const body = JSON.stringify(payload);
  const results = await Promise.allSettled(
    rows.map((row) =>
      webpush.sendNotification(toSubscription(row), body, { TTL: 3600 })
    )
  );

  let sent = 0;
  const deadEndpoints = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      sent++;
    } else {
      const code = r.reason?.statusCode;
      // 404/410 = endpoint đã hết hiệu lực (khách gỡ app / đổi trình duyệt) → dọn.
      if (code === 404 || code === 410) deadEndpoints.push(rows[i].endpoint);
      else console.warn("[webpush] gửi lỗi:", code || r.reason?.message || r.reason);
    }
  });

  if (deadEndpoints.length) {
    try {
      await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: deadEndpoints } } });
    } catch { /* nuốt — không chặn luồng */ }
  }
  return sent;
}

/** Gửi cho TẤT CẢ subscription (lời chào hằng ngày, khuyến mãi chung...). */
async function broadcast(payload) {
  if (!enabled) return 0;
  try {
    const rows = await prisma.pushSubscription.findMany();
    return await sendToSubscriptions(rows, payload);
  } catch (e) {
    console.error("[webpush] broadcast lỗi:", e?.message || e);
    return 0;
  }
}

/** Gửi cho các user theo số điện thoại (ghép chủ mèo → subscription đã đăng nhập). */
async function sendToPhones(phones, payload) {
  if (!enabled) return 0;
  const list = (Array.isArray(phones) ? phones : [phones]).filter(Boolean);
  if (!list.length) return 0;
  try {
    const users = await prisma.user.findMany({
      where: { phone: { in: list } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    if (!ids.length) return 0;
    const rows = await prisma.pushSubscription.findMany({ where: { user_id: { in: ids } } });
    return await sendToSubscriptions(rows, payload);
  } catch (e) {
    console.error("[webpush] sendToPhones lỗi:", e?.message || e);
    return 0;
  }
}

/** Gửi cho đúng CHỦ MÈO của một booking (dựa trên owner_phone). */
async function sendToBookingOwner(booking, payload) {
  if (!booking?.owner_phone) return 0;
  return sendToPhones(booking.owner_phone, payload);
}

module.exports = {
  isEnabled,
  getPublicKey,
  sendToSubscriptions,
  broadcast,
  sendToPhones,
  sendToBookingOwner,
};
