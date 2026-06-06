const cron = require("node-cron");
const prisma = require("../lib/prisma");

/**
 * Tự động hủy các đơn thanh toán ONLINE (bank) mà khách CHƯA trả tiền sau 48 giờ.
 *
 * Lý do: đơn bank/unpaid hiện ở Kho tổng dưới dạng "Chờ thanh toán" để theo dõi,
 * nhưng nếu để lâu sẽ tạo "hàng tồn ảo" (đơn treo không bao giờ chốt). Sau 48h
 * không thanh toán → coi như khách bỏ đơn, hệ thống tự hủy để dọn dẹp.
 *
 * An toàn:
 *  - Chỉ đụng đơn payment_method='bank' + payment_status='unpaid' + status='pending'.
 *    → COD không ảnh hưởng; đơn đã 'paid'/'confirmed' không ảnh hưởng.
 *  - Đơn chưa 'confirmed' nên CHƯA trừ tồn kho (COGS chỉ trừ khi confirm) → không cần hoàn kho.
 *  - Chưa thu tiền nên KHÔNG cần hoàn tiền (không set refund_pending).
 */

const CANCEL_REASON = "Đơn tự hủy: quá 48 giờ chưa thanh toán";
const EXPIRE_HOURS = 48;

async function cancelStaleUnpaidOrders() {
  try {
    const cutoff = new Date(Date.now() - EXPIRE_HOURS * 60 * 60 * 1000);

    const result = await prisma.order.updateMany({
      where: {
        payment_method: "bank",
        payment_status: "unpaid",
        status: "pending",
        created_at: { lt: cutoff },
      },
      data: {
        status: "cancelled",
        cancel_reason: CANCEL_REASON,
        cancelled_by: "system",
        cancelled_at: new Date(),
      },
    });

    if (result.count > 0) {
      console.log(`[AutoCancelUnpaid] ✔ Đã hủy ${result.count} đơn online quá 48h chưa thanh toán.`);
    }
  } catch (err) {
    console.error("[AutoCancelUnpaid] Lỗi khi hủy đơn chưa thanh toán:", err);
  }
}

// Chạy mỗi giờ vào phút :30 (lệch với job đặt lịch chạy phút :00)
cron.schedule("30 * * * *", () => {
  console.log("[AutoCancelUnpaid] Kiểm tra đơn online quá hạn thanh toán...");
  cancelStaleUnpaidOrders();
});

// Chạy ngay lúc khởi động server để dọn các đơn cũ
cancelStaleUnpaidOrders();

module.exports = { cancelStaleUnpaidOrders };
