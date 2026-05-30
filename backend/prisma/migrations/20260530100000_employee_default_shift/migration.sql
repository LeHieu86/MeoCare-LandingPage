-- AlterTable: thêm default_shift_id vào employees
ALTER TABLE "employees" ADD COLUMN "default_shift_id" INTEGER;
ALTER TABLE "employees" ADD CONSTRAINT "employees_default_shift_id_fkey"
  FOREIGN KEY ("default_shift_id") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
