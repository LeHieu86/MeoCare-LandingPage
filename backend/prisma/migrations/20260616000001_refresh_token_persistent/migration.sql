-- "Ghi nhớ đăng nhập": phân biệt phiên dài hạn (cookie 90 ngày) vs phiên trình duyệt.
-- Mặc định true → giữ nguyên hành vi cũ cho mọi token hiện có.
ALTER TABLE "refresh_tokens" ADD COLUMN "persistent" BOOLEAN NOT NULL DEFAULT true;
