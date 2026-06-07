-- Bảng lưu Idempotency-Key: chống request trùng phía client (đặt đơn, đặt lịch, xác nhận thanh toán)
CREATE TABLE "idempotency_keys" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "statusCode" INTEGER,
    "responseBody" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- Unique trên key: lần INSERT đầu thắng, request trùng đồng thời sẽ dính P2002 → trả 409 (đang xử lý)
CREATE UNIQUE INDEX "idempotency_keys_key_key" ON "idempotency_keys"("key");

-- Index thời gian để job dọn key cũ (>24h)
CREATE INDEX "idempotency_keys_createdAt_idx" ON "idempotency_keys"("createdAt");
