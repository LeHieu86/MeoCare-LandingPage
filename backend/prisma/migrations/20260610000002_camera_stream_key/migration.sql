-- Tên stream go2rtc bí mật (chống đoán cam_<id> để xem trộm camera)
ALTER TABLE "cameras" ADD COLUMN "stream_key" TEXT;

-- Backfill camera đã có bằng giá trị ngẫu nhiên duy nhất (PG16 có gen_random_uuid sẵn)
UPDATE "cameras" SET "stream_key" = replace(gen_random_uuid()::text, '-', '') WHERE "stream_key" IS NULL;

ALTER TABLE "cameras" ALTER COLUMN "stream_key" SET NOT NULL;
CREATE UNIQUE INDEX "cameras_stream_key_key" ON "cameras"("stream_key");
