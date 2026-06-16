-- Phiếu Hoàn Hàng: chi nhánh hoàn hàng ngược về Kho Tổng (đảo chiều stock_requests).
CREATE TABLE "stock_returns" (
    "id" SERIAL NOT NULL,
    "return_code" TEXT NOT NULL,
    "from_store_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "received_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_returns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_return_items" (
    "id" SERIAL NOT NULL,
    "return_id" INTEGER NOT NULL,
    "inventory_item_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" TEXT,

    CONSTRAINT "stock_return_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stock_returns_return_code_key" ON "stock_returns"("return_code");
CREATE INDEX "stock_returns_from_store_id_idx" ON "stock_returns"("from_store_id");
CREATE INDEX "stock_returns_status_idx" ON "stock_returns"("status");
CREATE INDEX "stock_return_items_return_id_idx" ON "stock_return_items"("return_id");
CREATE INDEX "stock_return_items_inventory_item_id_idx" ON "stock_return_items"("inventory_item_id");

ALTER TABLE "stock_returns" ADD CONSTRAINT "stock_returns_from_store_id_fkey"
    FOREIGN KEY ("from_store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_return_items" ADD CONSTRAINT "stock_return_items_return_id_fkey"
    FOREIGN KEY ("return_id") REFERENCES "stock_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_return_items" ADD CONSTRAINT "stock_return_items_inventory_item_id_fkey"
    FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
