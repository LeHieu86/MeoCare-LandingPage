-- Báo cáo tháng gửi Kế toán duyệt (chi phí / lương / nhập hàng)

-- CreateTable
CREATE TABLE "finance_reports" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "store_id" INTEGER,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "total_amount" INTEGER NOT NULL DEFAULT 0,
    "item_count" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "submitted_by" INTEGER,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by" INTEGER,
    "reviewed_at" TIMESTAMP(3),
    CONSTRAINT "finance_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "finance_reports_type_status_idx" ON "finance_reports"("type", "status");

-- CreateIndex
CREATE INDEX "finance_reports_store_id_month_year_idx" ON "finance_reports"("store_id", "month", "year");

-- AddForeignKey
ALTER TABLE "finance_reports" ADD CONSTRAINT "finance_reports_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
