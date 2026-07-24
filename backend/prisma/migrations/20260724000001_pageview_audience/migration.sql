-- Phân tích đối tượng truy cập (nguồn/thiết bị/UTM) để chạy quảng cáo đúng người.
-- KHÔNG lưu IP, KHÔNG lưu user-agent thô — chỉ lưu kết quả phân loại.
ALTER TABLE "page_views" ADD COLUMN "source" TEXT;
ALTER TABLE "page_views" ADD COLUMN "device" TEXT;
ALTER TABLE "page_views" ADD COLUMN "utm_source" TEXT;
ALTER TABLE "page_views" ADD COLUMN "utm_medium" TEXT;
ALTER TABLE "page_views" ADD COLUMN "utm_campaign" TEXT;
