const cron = require("node-cron");
const prisma = require("../lib/prisma");
const { notifyOwner } = require("../lib/notify");

/**
 * Nhắc việc cho chủ tiệm qua Telegram:
 *  - Nhận/Trả mèo sắp tới giờ (trước ~1 tiếng).
 *  - Đơn chuyển khoản (bank) chưa thanh toán SẮP bị auto-cancel (job auto-cancel = 48h).
 *
 * Chống nhắc trùng: Set in-memory theo id+loại (reset khi restart server — chấp nhận được).
 */

const TZ = process.env.TZ || "Asia/Ho_Chi_Minh";
const LEAD_MIN = 75;        // báo trước tối đa ~1 tiếng (cron chạy mỗi 15')
const UNPAID_WARN_FROM_H = 44; // đơn bank quá 44h (sắp tới mốc huỷ 48h) thì nhắc

const notified = new Set();  // "pickup:<id>" | "dropoff:<id>" | "unpaid:<id>"

const todayStr = () => new Date().toLocaleDateString("sv-SE", { timeZone: TZ }); // YYYY-MM-DD
const toDateTime = (dateStr, timeStr) => new Date(`${dateStr}T${(timeStr || "12:00")}:00`);

async function run() {
  try {
    const now = Date.now();
    const windowEnd = now + LEAD_MIN * 60000;
    const today = todayStr();

    // ── Nhận & Trả mèo hôm nay sắp tới giờ ──
    const bookings = await prisma.booking.findMany({
      where: {
        status: { in: ["pending", "active"] },
        OR: [{ check_in: today }, { check_out: today }],
      },
      select: {
        id: true, cat_name: true, owner_name: true, owner_phone: true, store_id: true,
        check_in: true, check_in_time: true, check_out: true, check_out_time: true, status: true,
      },
    });

    for (const b of bookings) {
      // Nhận mèo (đơn còn pending)
      if (b.check_in === today && b.status === "pending") {
        const t = toDateTime(b.check_in, b.check_in_time).getTime();
        const key = `pickup:${b.id}`;
        if (t >= now && t <= windowEnd && !notified.has(key)) {
          notified.add(key);
          notifyOwner(
            `⏰ SẮP NHẬN MÈO (CN #${b.store_id})\n` +
            `Mèo: ${b.cat_name || "?"} — Chủ: ${b.owner_name || "?"} (${b.owner_phone || "?"})\n` +
            `Giờ nhận: ${b.check_in_time || "?"} hôm nay`
          );
        }
      }
      // Trả mèo (đơn đang active)
      if (b.check_out === today && b.status === "active") {
        const t = toDateTime(b.check_out, b.check_out_time).getTime();
        const key = `dropoff:${b.id}`;
        if (t >= now && t <= windowEnd && !notified.has(key)) {
          notified.add(key);
          notifyOwner(
            `⏰ SẮP TRẢ MÈO (CN #${b.store_id})\n` +
            `Mèo: ${b.cat_name || "?"} — Chủ: ${b.owner_name || "?"} (${b.owner_phone || "?"})\n` +
            `Giờ trả: ${b.check_out_time || "?"} hôm nay`
          );
        }
      }
    }

    // ── Đơn bank chưa trả sắp bị huỷ tự động ──
    const warnCutoff = new Date(now - UNPAID_WARN_FROM_H * 3600000);
    const unpaid = await prisma.order.findMany({
      where: {
        payment_method: "bank",
        payment_status: "unpaid",
        status: "pending",
        created_at: { lt: warnCutoff },
      },
      select: { id: true, invoice_no: true, total: true, customer: { select: { name: true, phone: true } } },
    });
    for (const o of unpaid) {
      const key = `unpaid:${o.id}`;
      if (notified.has(key)) continue;
      notified.add(key);
      notifyOwner(
        `⚠️ ĐƠN CHUYỂN KHOẢN SẮP BỊ HUỶ (quá ${UNPAID_WARN_FROM_H}h chưa trả)\n` +
        `Mã: ${o.invoice_no} — ${o.customer?.name || "?"} (${o.customer?.phone || "?"})\n` +
        `Tổng: ${Number(o.total).toLocaleString("vi-VN")}đ`
      );
    }
  } catch (err) {
    console.error("[NotifyReminders] Lỗi:", err.message);
  }
}

// Chạy mỗi 15 phút
cron.schedule("*/15 * * * *", run);

module.exports = { run };
