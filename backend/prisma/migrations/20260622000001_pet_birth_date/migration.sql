-- Thêm ngày sinh (tùy chọn) cho thú cưng → hiển thị tuổi theo tháng cho mèo con (<1 năm).
-- age (năm) giữ nguyên cho tương thích; birth_date có giá trị thì FE ưu tiên hiển thị theo tháng.
ALTER TABLE "pets" ADD COLUMN "birth_date" TIMESTAMP(3);
