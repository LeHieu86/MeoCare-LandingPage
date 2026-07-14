-- Cache điểm đánh giá trên Product để endpoint list sản phẩm KHÔNG phải gộp review mỗi request.
-- rating_avg / review_count được cập nhật khi có review mới (routes/reviews.js) và backfill 1 lần cho dữ liệu cũ.
ALTER TABLE "products" ADD COLUMN "rating_avg" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "products" ADD COLUMN "review_count" INTEGER NOT NULL DEFAULT 0;
