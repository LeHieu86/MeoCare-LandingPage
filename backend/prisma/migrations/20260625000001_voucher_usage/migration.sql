-- Voucher ưu đãi: hỗ trợ dùng NHIỀU lần (max_uses) + đếm số lần đã dùng (used_count).
ALTER TABLE "benefit_vouchers" ADD COLUMN "max_uses" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "benefit_vouchers" ADD COLUMN "used_count" INTEGER NOT NULL DEFAULT 0;
