-- ============================================================
-- Migration: stock_request_and_inventory_links
-- Mô tả:
--   1. Thêm is_warehouse vào stores
--   2. Thêm product_id, variant_id vào inventory_items (link catalog)
--   3. Bỏ unique(sku) → thêm unique(store_id, sku)
--   4. Tạo bảng stock_requests
--   5. Tạo bảng stock_request_items
-- ============================================================

-- 1. stores: thêm cột is_warehouse
ALTER TABLE "stores"
  ADD COLUMN IF NOT EXISTS "is_warehouse" BOOLEAN NOT NULL DEFAULT false;

-- 2. inventory_items: thêm product_id, variant_id
ALTER TABLE "inventory_items"
  ADD COLUMN IF NOT EXISTS "product_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "variant_id" INTEGER;

-- Foreign keys cho inventory_items
ALTER TABLE "inventory_items"
  ADD CONSTRAINT "inventory_items_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "inventory_items"
  ADD CONSTRAINT "inventory_items_variant_id_fkey"
    FOREIGN KEY ("variant_id") REFERENCES "variants"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS "inventory_items_product_id_idx" ON "inventory_items"("product_id");
CREATE INDEX IF NOT EXISTS "inventory_items_variant_id_idx" ON "inventory_items"("variant_id");

-- 3. Bỏ unique(sku) cũ → thêm unique(store_id, sku)
ALTER TABLE "inventory_items"
  DROP CONSTRAINT IF EXISTS "inventory_items_sku_key";

CREATE UNIQUE INDEX IF NOT EXISTS "inventory_items_store_id_sku_key"
  ON "inventory_items"("store_id", "sku");

-- 4. Tạo bảng stock_requests
CREATE TABLE IF NOT EXISTS "stock_requests" (
  "id"            SERIAL PRIMARY KEY,
  "request_code"  TEXT    NOT NULL,
  "from_store_id" INTEGER NOT NULL,
  "status"        TEXT    NOT NULL DEFAULT 'pending',
  "note"          TEXT,
  "confirmed_at"  TIMESTAMP(3),
  "shipped_at"    TIMESTAMP(3),
  "delivered_at"  TIMESTAMP(3),
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "stock_requests_from_store_id_fkey"
    FOREIGN KEY ("from_store_id") REFERENCES "stores"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "stock_requests_request_code_key"
  ON "stock_requests"("request_code");
CREATE INDEX IF NOT EXISTS "stock_requests_from_store_id_idx"
  ON "stock_requests"("from_store_id");
CREATE INDEX IF NOT EXISTS "stock_requests_status_idx"
  ON "stock_requests"("status");

-- 5. Tạo bảng stock_request_items
CREATE TABLE IF NOT EXISTS "stock_request_items" (
  "id"                SERIAL PRIMARY KEY,
  "request_id"        INTEGER NOT NULL,
  "inventory_item_id" INTEGER NOT NULL,
  "quantity"          INTEGER NOT NULL,
  "fulfilled_qty"     INTEGER NOT NULL DEFAULT 0,
  "note"              TEXT,

  CONSTRAINT "stock_request_items_request_id_fkey"
    FOREIGN KEY ("request_id") REFERENCES "stock_requests"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "stock_request_items_inventory_item_id_fkey"
    FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "stock_request_items_request_id_idx"
  ON "stock_request_items"("request_id");
CREATE INDEX IF NOT EXISTS "stock_request_items_inventory_item_id_idx"
  ON "stock_request_items"("inventory_item_id");
