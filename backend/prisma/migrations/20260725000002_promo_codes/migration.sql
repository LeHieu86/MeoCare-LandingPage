-- Mã giảm giá khách tự nhập (voucher ship/%/tiền) áp cho đơn hàng & dịch vụ.
CREATE TABLE "promo_codes" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "applies_to" TEXT NOT NULL DEFAULT 'both',
    "value" INTEGER NOT NULL DEFAULT 0,
    "max_discount" INTEGER,
    "min_order" INTEGER,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "usage_limit" INTEGER,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "per_customer_limit" INTEGER DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "promo_codes_code_key" ON "promo_codes"("code");
CREATE INDEX "promo_codes_active_idx" ON "promo_codes"("active");

CREATE TABLE "promo_redemptions" (
    "id" SERIAL NOT NULL,
    "code_id" INTEGER NOT NULL,
    "phone" TEXT,
    "order_ref" TEXT,
    "discount" INTEGER NOT NULL,
    "used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "promo_redemptions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "promo_redemptions_code_id_idx" ON "promo_redemptions"("code_id");
CREATE INDEX "promo_redemptions_phone_idx" ON "promo_redemptions"("phone");
ALTER TABLE "promo_redemptions" ADD CONSTRAINT "promo_redemptions_code_id_fkey" FOREIGN KEY ("code_id") REFERENCES "promo_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
