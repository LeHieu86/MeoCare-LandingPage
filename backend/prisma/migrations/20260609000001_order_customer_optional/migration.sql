-- Cho phép đơn KHÔNG có khách (bán quầy "khách lẻ"): customer_id nullable
ALTER TABLE "orders" ALTER COLUMN "customer_id" DROP NOT NULL;
