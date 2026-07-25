-- Mã giảm giá khách tự nhập cho booking dịch vụ (redeem lúc hoàn tất).
ALTER TABLE "bookings" ADD COLUMN "promo_code" TEXT;
ALTER TABLE "bookings" ADD COLUMN "promo_discount" INTEGER DEFAULT 0;
