-- CreateTable: chi phí vận hành chi nhánh (điện, nước, mặt bằng, khác)
CREATE TABLE "store_expenses" (
    "id"         SERIAL       NOT NULL,
    "store_id"   INTEGER      NOT NULL,
    "month"      INTEGER      NOT NULL,
    "year"       INTEGER      NOT NULL,
    "type"       TEXT         NOT NULL,
    "amount"     INTEGER      NOT NULL,
    "note"       TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "store_expenses_store_id_idx"  ON "store_expenses"("store_id");
CREATE INDEX "store_expenses_month_year_idx" ON "store_expenses"("month", "year");

-- AddForeignKey
ALTER TABLE "store_expenses"
    ADD CONSTRAINT "store_expenses_store_id_fkey"
    FOREIGN KEY ("store_id") REFERENCES "stores"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
