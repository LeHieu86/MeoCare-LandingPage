-- Phân loại mặt hàng kho: nguyên liệu đầu vào (bulk) vs thành phẩm bán lẻ (retail).
-- Dùng để lọc dropdown phiếu đóng gói (đầu vào chỉ bulk, đầu ra chỉ retail).
ALTER TABLE "inventory_items" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'bulk';

-- Backfill: item đã gắn với product/variant bán → coi là thành phẩm (retail);
-- còn lại giữ mặc định bulk. User chỉnh tay vài trường hợp đặc biệt sau.
UPDATE "inventory_items"
SET "kind" = 'retail'
WHERE "variant_id" IS NOT NULL OR "product_id" IS NOT NULL;
