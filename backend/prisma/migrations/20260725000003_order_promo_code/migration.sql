-- Lưu mã giảm giá khách đã dùng trên đơn (snapshot).
ALTER TABLE "orders" ADD COLUMN "promo_code" TEXT;
