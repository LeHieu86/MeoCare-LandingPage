const cron = require("node-cron");
const { createBackup, cleanOldBackups } = require("../utils/backup");

// Chạy mỗi ngày lúc 2:00 AM
cron.schedule("0 2 * * *", async () => {
  console.log("[AutoBackup] Bắt đầu backup tự động...");
  try {
    const result = await createBackup();
    const sizeMB = (result.size / 1024 / 1024).toFixed(2);
    const offsite = result.r2 ? "✔ đã đẩy R2" : "⚠ CHỈ local (R2 chưa cấu hình)";
    console.log(`[AutoBackup] ✔ Postgres: ${result.filename} (${sizeMB} MB) — ${offsite}`);
    if (result.mongo) {
      const mMB = (result.mongo.size / 1024 / 1024).toFixed(2);
      console.log(`[AutoBackup] ✔ Mongo(chat): ${result.mongo.filename} (${mMB} MB) — ${result.mongo.r2 ? "✔ R2" : "⚠ local"}`);
    }

    const deleted = cleanOldBackups(30);
    if (deleted > 0) {
      console.log(`[AutoBackup] Đã xóa ${deleted} backup cũ hơn 30 ngày.`);
    }
  } catch (err) {
    console.error("[AutoBackup] Thất bại:", err.message);
  }
});

console.log("[AutoBackup] Scheduler đã khởi động — chạy hàng ngày lúc 2:00 AM.");
