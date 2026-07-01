-- Món pate (thực đơn admin) + đón mèo tận nhà (phí theo khoảng cách).

-- ServiceTypeDef: cột pickupOptions + bổ sung "dishes" vào food_options của các dòng cũ.
ALTER TABLE "service_type_defs"
  ADD COLUMN "pickup_options" JSONB NOT NULL
  DEFAULT '{"enabled":true,"baseFee":20000,"perKm":5000,"freeKm":0,"maxKm":15,"note":"Phí đón tận nhà là ước tính theo khoảng cách; nhân viên xác nhận lại khi liên hệ."}';

UPDATE "service_type_defs"
SET "food_options" = "food_options" || '{"dishes":[{"name":"Pate Hải Sản","ingredients":"Cá hồi, cá ngừ, tôm, bí đỏ, dầu cá hồi"},{"name":"Pate Dinh Dưỡng","ingredients":"Ức gà, trứng, gan gà, rau củ, vitamin tổng hợp"}]}'::jsonb
WHERE NOT ("food_options" ? 'dishes');

-- Booking: món pate đã chọn + thông tin đón tận nhà (nullable, không ảnh hưởng đơn cũ).
ALTER TABLE "bookings" ADD COLUMN "food_dishes" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "bookings" ADD COLUMN "pickup_method" TEXT;
ALTER TABLE "bookings" ADD COLUMN "pickup_address" TEXT;
ALTER TABLE "bookings" ADD COLUMN "pickup_distance_km" DOUBLE PRECISION;
ALTER TABLE "bookings" ADD COLUMN "pickup_fee" INTEGER;
