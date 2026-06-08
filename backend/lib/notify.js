/**
 * notify.js — Gửi thông báo ra ngoài cho CHỦ TIỆM (để không bỏ lỡ khi đang ở công ty).
 *
 * Kênh hiện tại: Telegram bot (miễn phí, push điện thoại tức thì).
 * Cấu hình .env:
 *   TELEGRAM_BOT_TOKEN=123456:ABC...        (lấy từ @BotFather)
 *   TELEGRAM_CHAT_ID=987654321              (id chat của bạn; nhiều người: ngăn bởi dấu phẩy)
 *
 * An toàn: thiếu cấu hình → bỏ qua; mọi lỗi mạng đều nuốt (KHÔNG bao giờ làm hỏng
 * luồng tạo đơn/booking/chat). Dùng text thuần (không parse_mode) để ký tự đặc biệt
 * trong tên/nội dung khách không làm vỡ tin nhắn.
 */

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHATS = (process.env.TELEGRAM_CHAT_ID || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

async function sendTelegram(chatId, text) {
  await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
    signal: AbortSignal.timeout(8000),
  });
}

/** Gửi thông báo tới chủ tiệm. Không throw — chỉ log nếu lỗi. */
async function notifyOwner(text) {
  if (!TG_TOKEN || TG_CHATS.length === 0) return; // chưa cấu hình
  try {
    await Promise.all(TG_CHATS.map((id) => sendTelegram(id, text)));
  } catch (e) {
    console.error("[notify] Gửi Telegram lỗi:", e?.message || e);
  }
}

// ── Throttle: tránh spam khi cùng một nguồn bắn liên tục (vd: khách nhắn nhiều tin) ──
const _lastSent = new Map(); // key -> timestamp

/** Chỉ gửi nếu key này chưa được gửi trong `minutes` phút gần nhất. */
async function notifyOwnerThrottled(key, minutes, text) {
  const now = Date.now();
  const last = _lastSent.get(key) || 0;
  if (now - last < minutes * 60000) return;
  _lastSent.set(key, now);
  return notifyOwner(text);
}

module.exports = { notifyOwner, notifyOwnerThrottled };
