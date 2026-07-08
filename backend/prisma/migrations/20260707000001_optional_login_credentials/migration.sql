-- Tách hồ sơ nhân viên khỏi tài khoản đăng nhập.
-- username/password cho phép NULL: nhân viên có hồ sơ (tên/email/mã NV) nhưng CHƯA được
-- cấp đăng nhập; sau đó admin cấp username+password riêng ở mục "Tài Khoản" theo mã NV.
-- Postgres: cột UNIQUE cho phép nhiều giá trị NULL nên không xung đột.

ALTER TABLE "users" ALTER COLUMN "username" DROP NOT NULL;
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;
