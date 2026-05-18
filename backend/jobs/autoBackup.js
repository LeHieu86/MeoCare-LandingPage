const cron = require("node-cron");
const { createBackup, cleanOldBackups } = require("../utils/backup");

// Chạy mỗi ngày lúc 2:00 AM
cron.schedule("0 2 * * *", async () => {
  console.log("[AutoBackup] Bắt đầu backup tự động...");
  try {
    const result = await createBackup();
    const sizeMB = (result.size / 1024 / 1024).toFixed(2);
    console.log(`[AutoBackup] ✔ Tạo thành công: ${result.filename} (${sizeMB} MB)`);

    const deleted = cleanOldBackups(30);
    if (deleted > 0) {
      console.log(`[AutoBackup] Đã xóa ${deleted} backup cũ hơn 30 ngày.`);
    }
  } catch (err) {
    console.error("[AutoBackup] Thất bại:", err.message);
  }
});

console.log("[AutoBackup] Scheduler đã khởi động — chạy hàng ngày lúc 2:00 AM.");
