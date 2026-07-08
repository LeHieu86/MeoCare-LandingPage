const cron = require("node-cron");
const prisma = require("../lib/prisma");

/**
 * Tự động hủy các đơn đặt lịch "pending" đã quá hạn check_in.
 * Chạy mỗi giờ — kiểm tra đơn pending có check_in < ngày hôm nay.
 *
 * Logic:
 *  - check_in lưu dạng "YYYY-MM-DD" (string)
 *  - Đơn pending mà check_in < today → khách không đến đúng hẹn, cửa hàng không xác nhận
 *  - Cập nhật status = "cancelled", cancel_reason = "Đơn đặt lịch đã quá hạn xác nhận"
 */

const CANCEL_REASON = "Đơn đặt lịch đã quá hạn xác nhận";

async function expireOverdueBookings() {
  try {
    const today = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"

    const result = await prisma.booking.updateMany({
      where: {
        status: "pending",
        check_in: { lt: today },
      },
      data: {
        status: "cancelled",
        cancel_reason: CANCEL_REASON,
      },
    });

    if (result.count > 0) {
      console.log(`[AutoExpire] ✔ Đã hủy ${result.count} đơn đặt lịch quá hạn xác nhận.`);
    }
  } catch (err) {
    console.error("[AutoExpire] Lỗi khi hủy đơn quá hạn:", err);
  }
}

// Chạy mỗi giờ vào phút :00
cron.schedule("0 * * * *", () => {
  console.log("[AutoExpire] Kiểm tra đơn đặt lịch quá hạn...");
  expireOverdueBookings();
});

// Chạy ngay lúc khởi động server để catch kịp các đơn cũ
expireOverdueBookings();

module.exports = { expireOverdueBookings };
