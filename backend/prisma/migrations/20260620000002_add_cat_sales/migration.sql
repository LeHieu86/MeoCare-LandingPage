-- Phase 2: Bán mèo tại quầy (POS) — sổ doanh thu riêng.
-- Mỗi giao dịch bán 1 con (cat_id UNIQUE). KHÔNG sinh Order → doanh thu mèo tách biệt P&L.

CREATE TABLE "cat_sales" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "cat_id" INTEGER NOT NULL,
    "store_id" INTEGER NOT NULL,
    "sold_by" INTEGER,
    "buyer_name" TEXT NOT NULL DEFAULT '',
    "buyer_phone" TEXT NOT NULL DEFAULT '',
    "buyer_address" TEXT,
    "price" INTEGER NOT NULL,
    "cost" INTEGER NOT NULL DEFAULT 0,
    "payment_method" TEXT NOT NULL DEFAULT 'cash',
    "payment_status" TEXT NOT NULL DEFAULT 'paid',
    "contract_signed" BOOLEAN NOT NULL DEFAULT false,
    "signature" TEXT,
    "warranty_until" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'completed',
    "note" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "sold_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cat_sales_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cat_sales_code_key" ON "cat_sales"("code");
CREATE UNIQUE INDEX "cat_sales_cat_id_key" ON "cat_sales"("cat_id");
CREATE INDEX "cat_sales_store_id_idx" ON "cat_sales"("store_id");
CREATE INDEX "cat_sales_sold_at_idx" ON "cat_sales"("sold_at");
CREATE INDEX "cat_sales_status_idx" ON "cat_sales"("status");
CREATE INDEX "cat_sales_buyer_phone_idx" ON "cat_sales"("buyer_phone");

ALTER TABLE "cat_sales" ADD CONSTRAINT "cat_sales_cat_id_fkey"
    FOREIGN KEY ("cat_id") REFERENCES "cat_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cat_sales" ADD CONSTRAINT "cat_sales_store_id_fkey"
    FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
