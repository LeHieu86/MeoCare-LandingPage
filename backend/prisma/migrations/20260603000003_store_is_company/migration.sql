-- AlterTable: thêm is_company để đánh dấu trụ sở công ty (không phải chi nhánh phục vụ khách)
ALTER TABLE "stores" ADD COLUMN "is_company" BOOLEAN NOT NULL DEFAULT false;
