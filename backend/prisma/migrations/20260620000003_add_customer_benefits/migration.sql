-- Phase 3: Ví ưu đãi khách mua mèo (gắn theo SĐT).
-- CustomerMembership = giảm % đồ ăn ongoing (1/SĐT). BenefitVoucher = ưu đãi dùng 1 lần.
-- KHÔNG FK tới Customer/User — khóa theo phone để áp cả đơn POS lẫn booking.

CREATE TABLE "customer_memberships" (
    "id" SERIAL NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "tier" TEXT NOT NULL DEFAULT 'cat-owner',
    "food_discount_pct" INTEGER NOT NULL DEFAULT 0,
    "discount_until" TIMESTAMP(3),
    "points" INTEGER NOT NULL DEFAULT 0,
    "source_sale_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_memberships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "benefit_vouchers" (
    "id" SERIAL NOT NULL,
    "phone" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "value" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'active',
    "valid_until" TIMESTAMP(3),
    "source_sale_id" INTEGER,
    "used_at" TIMESTAMP(3),
    "used_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "benefit_vouchers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_memberships_phone_key" ON "customer_memberships"("phone");
CREATE INDEX "benefit_vouchers_phone_status_idx" ON "benefit_vouchers"("phone", "status");
CREATE INDEX "benefit_vouchers_source_sale_id_idx" ON "benefit_vouchers"("source_sale_id");
