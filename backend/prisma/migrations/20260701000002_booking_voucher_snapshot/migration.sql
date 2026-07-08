-- Snapshot loại + value của voucher lên booking để CLIENT tự tính tiền giảm vào hóa đơn.
-- Trước đây chỉ lưu voucher_label (nhãn) nên không ra được giá cụ thể → phải áp tay.
ALTER TABLE "bookings" ADD COLUMN "voucher_type" TEXT;
ALTER TABLE "bookings" ADD COLUMN "voucher_value" JSONB;
