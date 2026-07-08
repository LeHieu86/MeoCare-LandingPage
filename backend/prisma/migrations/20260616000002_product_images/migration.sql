-- Thư viện ảnh sản phẩm (tối đa 9). Cột "image" cũ giữ làm ảnh bìa (= images[0]).
-- Mặc định mảng rỗng → sản phẩm cũ không bị ảnh hưởng (FE fallback về [image]).
ALTER TABLE "products" ADD COLUMN "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
