-- Địa chỉ có cấu trúc trên hồ sơ khách (User) — nhập 1 lần, tái dùng đặt lịch/đơn hàng.
ALTER TABLE "users" ADD COLUMN "addr_house" TEXT;
ALTER TABLE "users" ADD COLUMN "addr_street" TEXT;
ALTER TABLE "users" ADD COLUMN "addr_ward" TEXT;
ALTER TABLE "users" ADD COLUMN "addr_city" TEXT;
