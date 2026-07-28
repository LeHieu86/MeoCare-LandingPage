const cron = require("node-cron");
const prisma = require("../lib/prisma");
const push = require("../lib/webpush");

/**
 * Lời chào hằng ngày → gửi Web Push cho MỌI thiết bị đã bật thông báo
 * (kể cả khách chưa đăng nhập). Cá nhân hoá bằng tên nếu đã đăng nhập.
 */

const TZ = process.env.TZ || "Asia/Ho_Chi_Minh";
const CRON = process.env.PUSH_GREETING_CRON || "30 7 * * *"; // 07:30 mỗi ngày

// {name} = " <Tên>" nếu đã đăng nhập, "" nếu ẩn danh. Xoay vòng theo ngày cho đỡ nhàm.
const GREETINGS = [
  "Chào buổi sáng{name}! Hôm nay bạn và bé mèo thế nào? 🐾",
  "Sáng an lành{name}! Chúc bạn một ngày nhiều niềm vui bên boss mèo 🐱",
  "Buổi sáng tốt lành{name}! Đừng quên vuốt ve bé mèo một cái nhé 💛",
  "Chào ngày mới{name}! MeoCare chúc bạn tràn đầy năng lượng ☀️",
  "Meo meo~ chào buổi sáng{name}! Hôm nay bạn ổn chứ? 🐈",
];

async function run() {
  if (!push.isEnabled()) return;
  try {
    const rows = await prisma.pushSubscription.findMany({
      include: { user: { select: { fullName: true } } },
    });
    if (!rows.length) return;

    const template = GREETINGS[Math.floor(Date.now() / 86400000) % GREETINGS.length];

    await Promise.all(
      rows.map((row) => {
        const nm = row.user?.fullName;
        const name = nm && nm !== "Null" ? ` ${nm.trim().split(/\s+/).slice(-1)[0]}` : "";
        return push.sendToSubscriptions([row], {
          title: "MeoCare 🐱",
          body: template.replace("{name}", name),
          url: "/",
          tag: "greeting",
        });
      })
    );
    console.log(`[pushGreeting] Đã gửi lời chào cho ${rows.length} thiết bị.`);
  } catch (e) {
    console.error("[pushGreeting] lỗi:", e?.message || e);
  }
}

cron.schedule(CRON, run, { timezone: TZ });

module.exports = { run };
