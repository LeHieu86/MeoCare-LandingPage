-- Khách chọn ưu đãi (voucher) lúc đặt lịch — nhân viên áp + redeem thủ công lúc hoàn thành.
ALTER TABLE "bookings" ADD COLUMN "voucher_id" INTEGER;
ALTER TABLE "bookings" ADD COLUMN "voucher_label" TEXT;
