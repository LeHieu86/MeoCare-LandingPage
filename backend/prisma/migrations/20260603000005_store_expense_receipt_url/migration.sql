-- AlterTable: thêm receipt_url để lưu link ảnh/PDF hóa đơn chi phí vận hành
ALTER TABLE "store_expenses" ADD COLUMN "receipt_url" TEXT;
