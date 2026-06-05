-- Thêm cột last_login để theo dõi lần đăng nhập gần nhất của tài khoản
-- (dùng tính khoảng thời gian "ngưng hoạt động" của khách hàng)
ALTER TABLE "users" ADD COLUMN "last_login" TIMESTAMP(3);
