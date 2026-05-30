-- CreateTable Department
CREATE TABLE "departments" (
  "id" SERIAL NOT NULL,
  "store_id" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "head_id" INTEGER,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "departments_store_id_idx" ON "departments"("store_id");
ALTER TABLE "departments" ADD CONSTRAINT "departments_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable Position
CREATE TABLE "positions" (
  "id" SERIAL NOT NULL,
  "department_id" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "level" INTEGER NOT NULL DEFAULT 1,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "positions_department_id_idx" ON "positions"("department_id");
ALTER TABLE "positions" ADD CONSTRAINT "positions_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable Employee: thêm các field mới
ALTER TABLE "employees"
  ADD COLUMN "department_id" INTEGER,
  ADD COLUMN "position_id" INTEGER,
  ADD COLUMN "employment_type" TEXT NOT NULL DEFAULT 'full-time',
  ADD COLUMN "contract_type" TEXT NOT NULL DEFAULT 'permanent',
  ADD COLUMN "cccd" TEXT,
  ADD COLUMN "birth_date" TIMESTAMP(3),
  ADD COLUMN "address" TEXT;

CREATE INDEX "employees_employment_type_idx" ON "employees"("employment_type");

ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable LeaveBalance
CREATE TABLE "leave_balances" (
  "id" SERIAL NOT NULL,
  "employee_id" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "leave_type" TEXT NOT NULL,
  "total_days" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "used_days" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "leave_balances_employee_id_year_leave_type_key" ON "leave_balances"("employee_id", "year", "leave_type");
CREATE INDEX "leave_balances_employee_id_idx" ON "leave_balances"("employee_id");
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable LeaveRequest: thêm workflow 2 tầng + loại phép mới
ALTER TABLE "leave_requests"
  ADD COLUMN "manager_status" TEXT,
  ADD COLUMN "manager_approved_by" INTEGER,
  ADD COLUMN "manager_approved_at" TIMESTAMP(3),
  ADD COLUMN "manager_note" TEXT,
  ADD COLUMN "hr_status" TEXT,
  ADD COLUMN "hr_approved_by" INTEGER,
  ADD COLUMN "hr_approved_at" TIMESTAMP(3),
  ADD COLUMN "hr_note" TEXT;
