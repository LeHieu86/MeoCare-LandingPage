-- Vốn đầu tư ban đầu chi nhánh (CAPEX) + ngày khai trương để tính điểm hoàn vốn

-- AlterTable: ngày khai trương chi nhánh (mốc cộng dồn lợi nhuận)
ALTER TABLE "stores" ADD COLUMN "opened_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "capital_investments" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" INTEGER NOT NULL,
    "useful_life_months" INTEGER,
    "purchase_date" TIMESTAMP(3),
    "note" TEXT,
    "receipt_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "capital_investments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "capital_investments_store_id_idx" ON "capital_investments"("store_id");

-- AddForeignKey
ALTER TABLE "capital_investments" ADD CONSTRAINT "capital_investments_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
