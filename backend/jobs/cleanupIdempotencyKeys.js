const cron = require("node-cron");
const prisma = require("../lib/prisma");

/**
 * Dọn các Idempotency-Key cũ hơn 24 giờ.
 *
 * Key chỉ cần tồn tại đủ lâu để chặn replay/retry của cùng một thao tác (vài giây tới
 * vài phút trong thực tế). Giữ 24h là dư an toàn. Sau đó xóa để bảng không phình to.
 */

const RETENTION_HOURS = 24;

async function cleanupIdempotencyKeys() {
  try {
    const cutoff = new Date(Date.now() - RETENTION_HOURS * 60 * 60 * 1000);
    const result = await prisma.idempotencyKey.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    if (result.count > 0) {
      console.log(`[CleanupIdempotency] ✔ Đã xóa ${result.count} idempotency-key quá 24h.`);
    }
  } catch (err) {
    console.error("[CleanupIdempotency] Lỗi khi dọn idempotency-key:", err);
  }
}

// Chạy mỗi giờ vào phút :15 (lệch với các job khác chạy phút :00 / :30)
cron.schedule("15 * * * *", () => {
  cleanupIdempotencyKeys();
});

// Chạy ngay lúc khởi động server để dọn key tồn từ lần chạy trước
cleanupIdempotencyKeys();

module.exports = { cleanupIdempotencyKeys };
