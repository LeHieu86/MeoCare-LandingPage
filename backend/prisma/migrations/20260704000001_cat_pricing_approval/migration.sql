-- Định giá mèo theo cấu hình admin + luồng duyệt giá vốn.
-- Manager kê cost_items → cost=Σ; hệ thống tính price = cost×(1+markup), làm tròn (config admin).
-- Chỉ mèo pricing_status='approved' mới được bán và hiện trên web.

ALTER TABLE "cat_listings" ADD COLUMN "cost_items" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "cat_listings" ADD COLUMN "pricing_status" TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE "cat_listings" ADD COLUMN "pricing_markup" INTEGER;
ALTER TABLE "cat_listings" ADD COLUMN "pricing_reviewed_by" INTEGER;
ALTER TABLE "cat_listings" ADD COLUMN "pricing_reviewed_at" TIMESTAMP(3);
ALTER TABLE "cat_listings" ADD COLUMN "pricing_reject_reason" TEXT;

-- Backfill: mèo hiện có coi như đã duyệt (giữ nguyên đang bán/đang hiện web, tránh bị ẩn đột ngột).
UPDATE "cat_listings" SET "pricing_status" = 'approved';
