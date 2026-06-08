const cron = require("node-cron");
const prisma = require("../lib/prisma");

/**
 * Dọn refresh token đã HẾT HẠN hoặc đã REVOKE (xoay vòng/đăng xuất) quá 7 ngày.
 * Giữ token revoked thêm 7 ngày để còn phát hiện hành vi tái sử dụng nếu cần soi log.
 */
const REVOKED_RETAIN_DAYS = 7;

async function cleanupRefreshTokens() {
  try {
    const now = new Date();
    const revokedCutoff = new Date(Date.now() - REVOKED_RETAIN_DAYS * 86400000);
    const result = await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expires_at: { lt: now } },
          { revoked: true, created_at: { lt: revokedCutoff } },
        ],
      },
    });
    if (result.count > 0) {
      console.log(`[CleanupRefreshTokens] ✔ Đã xóa ${result.count} refresh token hết hạn/revoked.`);
    }
  } catch (err) {
    console.error("[CleanupRefreshTokens] Lỗi khi dọn refresh token:", err);
  }
}

// Chạy mỗi ngày lúc 03:20
cron.schedule("20 3 * * *", () => {
  cleanupRefreshTokens();
});

// Dọn ngay khi khởi động
cleanupRefreshTokens();

module.exports = { cleanupRefreshTokens };
