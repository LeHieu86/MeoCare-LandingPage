-- Đối tác tiếp thị (affiliate) + hoa hồng cho đơn "Ghi nhận đơn hàng ngoài".
-- Đối tác nhập tay mỗi đơn (không có bảng Partner riêng). Hoa hồng tính theo % giá
-- bán mỗi sản phẩm; commission_total = tổng tiền hoa hồng do server tự tính.
ALTER TABLE "orders" ADD COLUMN "affiliate_name" TEXT;
ALTER TABLE "orders" ADD COLUMN "affiliate_phone" TEXT;
ALTER TABLE "orders" ADD COLUMN "affiliate_code" TEXT;
ALTER TABLE "orders" ADD COLUMN "commission_total" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "order_items" ADD COLUMN "commission_pct" DOUBLE PRECISION NOT NULL DEFAULT 0;
