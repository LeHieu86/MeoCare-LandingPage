-- AlterTable: thêm start_time / end_time cho nghỉ không lương theo giờ
ALTER TABLE "leave_requests" ADD COLUMN "start_time" TEXT;
ALTER TABLE "leave_requests" ADD COLUMN "end_time" TEXT;
