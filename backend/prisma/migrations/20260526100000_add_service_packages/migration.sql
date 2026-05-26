-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Thêm bảng service_packages + pricingType + thông tin gói vào bookings
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Thêm pricing_type vào service_type_defs ───────────────────────────────
ALTER TABLE "service_type_defs"
    ADD COLUMN IF NOT EXISTS "pricing_type" TEXT NOT NULL DEFAULT 'per_day';

UPDATE "service_type_defs" SET "pricing_type" = 'per_day'   WHERE "key" = 'boarding';
UPDATE "service_type_defs" SET "pricing_type" = 'package'   WHERE "key" = 'grooming';
UPDATE "service_type_defs" SET "pricing_type" = 'procedure' WHERE "key" = 'medical';

-- ── 2. Tạo bảng service_packages ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "service_packages" (
    "id"              SERIAL      PRIMARY KEY,
    "service_type_id" INTEGER     NOT NULL,
    "name"            TEXT        NOT NULL,
    "description"     TEXT        NOT NULL DEFAULT '',
    "price"           INTEGER     NOT NULL DEFAULT 0,
    "duration"        TEXT,
    "includes"        JSONB       NOT NULL DEFAULT '[]',
    "is_popular"      BOOLEAN     NOT NULL DEFAULT false,
    "is_active"       BOOLEAN     NOT NULL DEFAULT true,
    "sort_order"      INTEGER     NOT NULL DEFAULT 0,
    "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "service_packages_service_type_id_fkey"
        FOREIGN KEY ("service_type_id") REFERENCES "service_type_defs"("id") ON DELETE CASCADE
);

CREATE INDEX "service_packages_service_type_id_idx"
    ON "service_packages"("service_type_id");

-- ── 3. Thêm thông tin gói vào bảng bookings ──────────────────────────────────
ALTER TABLE "bookings"
    ADD COLUMN IF NOT EXISTS "service_type"  TEXT    NOT NULL DEFAULT 'boarding',
    ADD COLUMN IF NOT EXISTS "package_id"    INTEGER,
    ADD COLUMN IF NOT EXISTS "package_name"  TEXT,
    ADD COLUMN IF NOT EXISTS "package_price" INTEGER;

-- FK package_id → service_packages (bỏ IF NOT EXISTS vì PG không hỗ trợ)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'bookings_package_id_fkey'
    ) THEN
        ALTER TABLE "bookings"
            ADD CONSTRAINT "bookings_package_id_fkey"
            FOREIGN KEY ("package_id") REFERENCES "service_packages"("id") ON DELETE SET NULL;
    END IF;
END $$;

-- ── 4. Seed gói Grooming ──────────────────────────────────────────────────────
INSERT INTO "service_packages"
    ("service_type_id","name","description","price","duration","includes","is_popular","sort_order")
SELECT s.id, pkg.name, pkg.description, pkg.price, pkg.duration, pkg.includes::jsonb, pkg.is_popular, pkg.sort_order
FROM "service_type_defs" s
CROSS JOIN (VALUES
    ('Gói Cơ Bản',    'Phù hợp mèo ngắn lông hoặc không thích tắm lâu', 100000, '45-60 phút',
     '["Tắm sạch chuyên dụng","Sấy khô hoàn toàn","Cắt móng tay + chân","Vệ sinh tai cơ bản"]',       false, 1),
    ('Gói Tiêu Chuẩn','Phổ biến nhất, phù hợp mọi loại mèo',            150000, '60-90 phút',
     '["Tắm sạch chuyên dụng","Sấy khô hoàn toàn","Cắt móng tay + chân","Vệ sinh tai chuyên sâu","Chải lông & khử rối"]', true,  2),
    ('Gói Cao Cấp',   'Chăm sóc toàn diện, mèo ra về thơm tho và đẹp',  220000, '90-120 phút',
     '["Tất cả trong Gói Tiêu Chuẩn","Cắt tỉa lông tạo kiểu","Dưỡng lông chuyên dụng","Vệ sinh răng miệng","Nước hoa thú cưng"]', false, 3)
) AS pkg(name,description,price,duration,includes,is_popular,sort_order)
WHERE s.key = 'grooming'
ON CONFLICT DO NOTHING;

-- ── 5. Seed ca Khám bệnh ─────────────────────────────────────────────────────
INSERT INTO "service_packages"
    ("service_type_id","name","description","price","duration","includes","is_popular","sort_order")
SELECT s.id, pkg.name, pkg.description, pkg.price, pkg.duration, pkg.includes::jsonb, pkg.is_popular, pkg.sort_order
FROM "service_type_defs" s
CROSS JOIN (VALUES
    ('Khám Tổng Quát',             'Kiểm tra sức khoẻ định kỳ hàng năm',                     150000, '30-45 phút',
     '["Kiểm tra thể trạng tổng quát","Cân nặng & đánh giá dinh dưỡng","Tư vấn chế độ ăn","Cấp sổ khám bệnh"]',  true,  1),
    ('Tiêm Phòng',                 'Tiêm vắc-xin định kỳ phòng bệnh nguy hiểm',              80000,  '15-20 phút',
     '["Khám sàng lọc trước tiêm","Tiêm vắc-xin combo","Ghi sổ tiêm phòng","Tư vấn lịch nhắc"]',                 false, 2),
    ('Tẩy Giun / Ký Sinh Trùng',  'Điều trị giun sán, bọ chét, ve ngoài da',                120000, '20-30 phút',
     '["Xét nghiệm phân (nếu cần)","Thuốc tẩy giun nội ký sinh","Thuốc trị ngoại ký sinh","Hướng dẫn phòng ngừa"]', false, 3),
    ('Triệt Sản',                  'Phẫu thuật an toàn, gây mê chuyên nghiệp',               500000, '2-4 giờ (+ hồi phục)',
     '["Xét nghiệm máu trước phẫu thuật","Gây mê & theo dõi liên tục","Phẫu thuật triệt sản","Chăm sóc hậu phẫu","Thuốc về nhà"]', false, 4),
    ('Điều Trị Bệnh',              'Khám và điều trị các bệnh thường gặp ở mèo',             200000, '45-60 phút',
     '["Khám lâm sàng chi tiết","Chẩn đoán bệnh","Kê đơn thuốc","Hướng dẫn chăm sóc tại nhà","Tái khám miễn phí 3 ngày"]', true,  5)
) AS pkg(name,description,price,duration,includes,is_popular,sort_order)
WHERE s.key = 'medical'
ON CONFLICT DO NOTHING;
