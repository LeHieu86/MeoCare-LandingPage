-- Nhập camera thông minh: lưu hãng + thành phần kết nối, backend tự ghép RTSP URL.
ALTER TABLE "cameras" ADD COLUMN "brand" TEXT;
ALTER TABLE "cameras" ADD COLUMN "cam_host" TEXT;
ALTER TABLE "cameras" ADD COLUMN "cam_user" TEXT;
ALTER TABLE "cameras" ADD COLUMN "cam_pass" TEXT;
ALTER TABLE "cameras" ADD COLUMN "cam_port" INTEGER;
ALTER TABLE "cameras" ADD COLUMN "cam_channel" INTEGER;
