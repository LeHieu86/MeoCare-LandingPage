-- Thêm toạ độ (lat/lng) cho chi nhánh để tìm chi nhánh gần khách hàng nhất
ALTER TABLE "stores" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "stores" ADD COLUMN "longitude" DOUBLE PRECISION;
