const cron = require("node-cron");
const prisma = require("../lib/prisma");
const push = require("../lib/webpush");

/**
 * Thông báo "mèo đang được cho ăn" TỰ ĐỘNG theo giờ cố định → gửi cho CHỦ MÈO đang
 * gửi mèo (booking boarding đang active). Ghép chủ mèo qua owner_phone == user.phone,
 * nên chỉ tới được khách ĐÃ ĐĂNG NHẬP (có subscription gắn user_id).
 *
 * Ngoài lịch này, nhân viên còn có thể bấm thủ công qua POST /api/push/feeding/:id.
 * Chống trùng trong ngày bằng Set in-memory (reset khi restart — chấp nhận được,
 * giống jobs/notifyReminders.js).
 */

const TZ = process.env.TZ || "Asia/Ho_Chi_Minh";
const CRON = process.env.PUSH_FEEDING_CRON || "0 8,17 * * *"; // 08:00 & 17:00

const sentKeys = new Set(); // "feeding:<bookingId>:<meal>:<date>"

const todayStr = () => new Date().toLocaleDateString("sv-SE", { timeZone: TZ }); // YYYY-MM-DD
const nowHour = () =>
  Number(new Date().toLocaleString("en-US", { timeZone: TZ, hour: "2-digit", hour12: false }));

async function run() {
  if (!push.isEnabled()) return;
  try {
    const today = todayStr();
    const meal = nowHour() < 12 ? "sáng" : "chiều";

    // Mèo đang lưu trú hôm nay (check_in <= today <= check_out). check_in/out là chuỗi
    // "YYYY-MM-DD" nên so sánh chuỗi cho kết quả đúng theo thứ tự thời gian.
    const bookings = await prisma.booking.findMany({
      where: {
        service_type: "boarding",
        status: "active",
        check_in: { lte: today },
        check_out: { gte: today },
      },
      select: { id: true, cat_name: true, owner_phone: true },
    });

    for (const b of bookings) {
      if (!b.owner_phone) continue;
      const key = `feeding:${b.id}:${meal}:${today}`;
      if (sentKeys.has(key)) continue;

      const cat = b.cat_name || "bé mèo";
      const n = await push.sendToBookingOwner(b, {
        title: "MeoCare 🐱",
        body: `Bé ${cat} của bạn đang được cho ăn cữ ${meal} rồi nè! 🐟`,
        url: "/portal",
        tag: `feeding-${b.id}`,
      });
      if (n > 0) sentKeys.add(key); // chỉ đánh dấu khi thực sự gửi được
    }
  } catch (e) {
    console.error("[pushFeeding] lỗi:", e?.message || e);
  }
}

cron.schedule(CRON, run, { timezone: TZ });

module.exports = { run };
