-- Liên kết booking với hồ sơ mèo đã chọn (Pet.id) — tham chiếu lỏng (KHÔNG FK, giống
-- voucher_id), phục vụ chọn đúng mèo lúc tạo dịch vụ + tích điểm/lịch sử mèo sau này.
ALTER TABLE "bookings" ADD COLUMN "pet_id" INTEGER;

CREATE INDEX "bookings_pet_id_idx" ON "bookings"("pet_id");
