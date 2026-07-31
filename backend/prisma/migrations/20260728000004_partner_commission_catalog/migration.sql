-- Hàng ĐỐI TÁC ký gửi cho mèo (cat_listings) và sản phẩm (products):
-- MeoCare bán hộ đối tác và hưởng hoa hồng. Mặc định false = hàng của cửa hàng.
ALTER TABLE "cat_listings" ADD COLUMN "is_partner" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "cat_listings" ADD COLUMN "partner_name" TEXT;
ALTER TABLE "cat_listings" ADD COLUMN "commission_pct" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "products" ADD COLUMN "is_partner" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "products" ADD COLUMN "partner_name" TEXT;
ALTER TABLE "products" ADD COLUMN "commission_pct" DOUBLE PRECISION NOT NULL DEFAULT 0;
