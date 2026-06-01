-- AlterTable: thêm cột gender vào bảng employees
ALTER TABLE "employees" ADD COLUMN "gender" TEXT NOT NULL DEFAULT 'male';
