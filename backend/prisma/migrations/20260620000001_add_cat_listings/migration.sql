-- Bán mèo (Phase 1): catalog mèo + hồ sơ sức khỏe.
-- Mèo là CÁ THỂ DUY NHẤT (không phải hàng tồn đếm số lượng) → bảng riêng cat_listings,
-- mỗi con gắn 1 chi nhánh (store_id) đang giữ. cat_health_records = hồ sơ tiêm/tẩy giun/khám.

CREATE TABLE "cat_listings" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "store_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "breed" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '',
    "gender" TEXT NOT NULL DEFAULT 'male',
    "birth_date" TIMESTAMP(3),
    "weight" DOUBLE PRECISION,
    "price" INTEGER NOT NULL DEFAULT 0,
    "cost" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT,
    "description" TEXT,
    "image" TEXT NOT NULL DEFAULT '',
    "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "vaccinated" BOOLEAN NOT NULL DEFAULT false,
    "dewormed" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'available',
    "published" BOOLEAN NOT NULL DEFAULT true,
    "sold_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cat_listings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cat_health_records" (
    "id" SERIAL NOT NULL,
    "cat_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'vaccine',
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "vet" TEXT,
    "next_due" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cat_health_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cat_listings_code_key" ON "cat_listings"("code");
CREATE INDEX "cat_listings_store_id_idx" ON "cat_listings"("store_id");
CREATE INDEX "cat_listings_status_idx" ON "cat_listings"("status");
CREATE INDEX "cat_listings_published_idx" ON "cat_listings"("published");
CREATE INDEX "cat_listings_breed_idx" ON "cat_listings"("breed");
CREATE INDEX "cat_health_records_cat_id_idx" ON "cat_health_records"("cat_id");

ALTER TABLE "cat_listings" ADD CONSTRAINT "cat_listings_store_id_fkey"
    FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cat_health_records" ADD CONSTRAINT "cat_health_records_cat_id_fkey"
    FOREIGN KEY ("cat_id") REFERENCES "cat_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
