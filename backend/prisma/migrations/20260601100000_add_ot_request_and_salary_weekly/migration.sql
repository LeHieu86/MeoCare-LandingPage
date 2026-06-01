-- CreateTable: ot_requests
CREATE TABLE "ot_requests" (
    "id"              SERIAL       NOT NULL,
    "employee_id"     INTEGER      NOT NULL,
    "store_id"        INTEGER      NOT NULL,
    "created_by_id"   INTEGER      NOT NULL,
    "date"            TIMESTAMP(3) NOT NULL,
    "hours"           DOUBLE PRECISION NOT NULL,
    "reason"          TEXT         NOT NULL,
    "ot_type"         TEXT         NOT NULL DEFAULT 'planned',
    "status"          TEXT         NOT NULL DEFAULT 'pending',
    "approved_by_id"  INTEGER,
    "approved_at"     TIMESTAMP(3),
    "rejected_reason" TEXT,
    "pay_month"       INTEGER      NOT NULL,
    "pay_year"        INTEGER      NOT NULL,
    "pay_week"        INTEGER,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ot_requests_pkey" PRIMARY KEY ("id")
);

-- AlterTable: salary_records — hỗ trợ kỳ lương tuần (part-time)
ALTER TABLE "salary_records"
    ADD COLUMN "period_type" TEXT         NOT NULL DEFAULT 'monthly',
    ADD COLUMN "week"        INTEGER,
    ADD COLUMN "week_start"  TIMESTAMP(3),
    ADD COLUMN "week_end"    TIMESTAMP(3);

-- DropIndex: unique cũ (không có week)
DROP INDEX "salary_records_employee_id_month_year_key";

-- CreateIndex: unique mới (có week — NULL = kỳ tháng)
CREATE UNIQUE INDEX "salary_records_employee_id_month_year_week_key"
    ON "salary_records"("employee_id", "month", "year", "week");

-- CreateIndex: period_type
CREATE INDEX "salary_records_period_type_idx" ON "salary_records"("period_type");

-- CreateIndex: ot_requests
CREATE INDEX "ot_requests_employee_id_idx"       ON "ot_requests"("employee_id");
CREATE INDEX "ot_requests_store_id_idx"           ON "ot_requests"("store_id");
CREATE INDEX "ot_requests_status_idx"             ON "ot_requests"("status");
CREATE INDEX "ot_requests_pay_month_pay_year_idx" ON "ot_requests"("pay_month", "pay_year");

-- AddForeignKey: ot_requests
ALTER TABLE "ot_requests" ADD CONSTRAINT "ot_requests_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ot_requests" ADD CONSTRAINT "ot_requests_store_id_fkey"
    FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ot_requests" ADD CONSTRAINT "ot_requests_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ot_requests" ADD CONSTRAINT "ot_requests_approved_by_id_fkey"
    FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
