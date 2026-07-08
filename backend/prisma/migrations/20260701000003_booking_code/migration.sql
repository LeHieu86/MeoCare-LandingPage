-- Mã chứng từ ngẫu nhiên cho booking (DV-YYMMDD-NNNNNN) — thay mã tuần tự BD-000x đoán được.
-- Nullable + unique: Postgres cho phép nhiều NULL, đơn cũ backfill sau bằng prisma/backfill-booking-code.js.
ALTER TABLE "bookings" ADD COLUMN "code" TEXT;
CREATE UNIQUE INDEX "bookings_code_key" ON "bookings"("code");
