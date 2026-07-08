-- Cấu hình khung giờ nhận/trả mèo (admin chỉnh trong app) gắn vào loại dịch vụ.
-- DEFAULT để dòng boarding hiện có tự nhận khung mặc định: T2-T7 18:00-22:00, CN 08:00-21:00.
ALTER TABLE "service_type_defs"
  ADD COLUMN "booking_hours" JSONB NOT NULL
  DEFAULT '{"enabled":true,"slotMinutes":30,"days":{"0":{"open":true,"start":"08:00","end":"21:00"},"1":{"open":true,"start":"18:00","end":"22:00"},"2":{"open":true,"start":"18:00","end":"22:00"},"3":{"open":true,"start":"18:00","end":"22:00"},"4":{"open":true,"start":"18:00","end":"22:00"},"5":{"open":true,"start":"18:00","end":"22:00"},"6":{"open":true,"start":"18:00","end":"22:00"}}}';

-- Giờ khách hẹn nhận / trả (HH:MM). Nullable → không ảnh hưởng booking cũ.
ALTER TABLE "bookings" ADD COLUMN "check_in_time" TEXT;
ALTER TABLE "bookings" ADD COLUMN "check_out_time" TEXT;
