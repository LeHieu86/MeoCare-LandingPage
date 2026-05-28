-- ════════════════════════════════════════════════════════════════
-- Migration: Multi-store support
-- Thêm bảng stores + store_id vào tất cả bảng chính
-- Tất cả dùng IF NOT EXISTS / ON CONFLICT → an toàn khi chạy lại
-- ════════════════════════════════════════════════════════════════

-- ── 1. Tạo bảng stores ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "stores" (
  "id"         SERIAL PRIMARY KEY,
  "name"       TEXT NOT NULL,
  "address"    TEXT,
  "phone"      TEXT,
  "is_active"  BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed store đầu tiên (cần tồn tại trước khi add FK)
INSERT INTO "stores" ("id", "name", "address", "phone", "is_active")
VALUES (1, 'MeoCare Chi nhánh 1', 'Hà Nội', '', true)
ON CONFLICT ("id") DO NOTHING;

-- Reset sequence sau khi insert thủ công
SELECT setval(pg_get_serial_sequence('"stores"', 'id'), COALESCE((SELECT MAX(id) FROM "stores"), 1));

-- ── 2. Thêm store_id vào từng bảng ──────────────────────────────

-- users (nullable — owner/customer không thuộc chi nhánh cụ thể)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "store_id" INTEGER;
CREATE INDEX IF NOT EXISTS "users_store_id_idx" ON "users"("store_id");

-- products
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "store_id" INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS "products_store_id_idx" ON "products"("store_id");

-- orders
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "store_id" INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS "orders_store_id_idx" ON "orders"("store_id");

-- rooms
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "store_id" INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS "rooms_store_id_idx" ON "rooms"("store_id");

-- cameras
ALTER TABLE "cameras" ADD COLUMN IF NOT EXISTS "store_id" INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS "cameras_store_id_idx" ON "cameras"("store_id");

-- bookings
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "store_id" INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS "bookings_store_id_idx" ON "bookings"("store_id");

-- employees
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "store_id" INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS "employees_store_id_idx" ON "employees"("store_id");

-- suppliers
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "store_id" INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS "suppliers_store_id_idx" ON "suppliers"("store_id");

-- inventory_items
ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "store_id" INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS "inventory_items_store_id_idx" ON "inventory_items"("store_id");

-- purchase_orders
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "store_id" INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS "purchase_orders_store_id_idx" ON "purchase_orders"("store_id");

-- nas_config: thêm store_id (singleton → per-store)
ALTER TABLE "nas_config" ADD COLUMN IF NOT EXISTS "store_id" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "nas_config" DROP CONSTRAINT IF EXISTS "nas_config_store_id_key";
ALTER TABLE "nas_config" ADD CONSTRAINT "nas_config_store_id_key" UNIQUE ("store_id");

-- ── 3. Thêm FK constraints ────────────────────────────────────────
-- users.store_id (nullable → ON DELETE SET NULL)
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_store_id_fkey";
ALTER TABLE "users"
  ADD CONSTRAINT "users_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "stores"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- products
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_store_id_fkey";
ALTER TABLE "products"
  ADD CONSTRAINT "products_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "stores"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- orders
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_store_id_fkey";
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "stores"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- rooms
ALTER TABLE "rooms" DROP CONSTRAINT IF EXISTS "rooms_store_id_fkey";
ALTER TABLE "rooms"
  ADD CONSTRAINT "rooms_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "stores"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- cameras
ALTER TABLE "cameras" DROP CONSTRAINT IF EXISTS "cameras_store_id_fkey";
ALTER TABLE "cameras"
  ADD CONSTRAINT "cameras_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "stores"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- bookings
ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_store_id_fkey";
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "stores"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- employees
ALTER TABLE "employees" DROP CONSTRAINT IF EXISTS "employees_store_id_fkey";
ALTER TABLE "employees"
  ADD CONSTRAINT "employees_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "stores"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- suppliers
ALTER TABLE "suppliers" DROP CONSTRAINT IF EXISTS "suppliers_store_id_fkey";
ALTER TABLE "suppliers"
  ADD CONSTRAINT "suppliers_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "stores"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- inventory_items
ALTER TABLE "inventory_items" DROP CONSTRAINT IF EXISTS "inventory_items_store_id_fkey";
ALTER TABLE "inventory_items"
  ADD CONSTRAINT "inventory_items_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "stores"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- purchase_orders
ALTER TABLE "purchase_orders" DROP CONSTRAINT IF EXISTS "purchase_orders_store_id_fkey";
ALTER TABLE "purchase_orders"
  ADD CONSTRAINT "purchase_orders_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "stores"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- nas_config
ALTER TABLE "nas_config" DROP CONSTRAINT IF EXISTS "nas_config_store_id_fkey";
ALTER TABLE "nas_config"
  ADD CONSTRAINT "nas_config_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "stores"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
