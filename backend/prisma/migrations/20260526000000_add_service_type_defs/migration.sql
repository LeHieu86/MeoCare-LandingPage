-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Tạo bảng service_type_defs — quản lý loại dịch vụ qua Admin
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "service_type_defs" (
    "id"               SERIAL          PRIMARY KEY,
    "key"              TEXT            NOT NULL,
    "icon"             TEXT            NOT NULL DEFAULT '🐾',
    "name"             TEXT            NOT NULL,
    "subtitle"         TEXT            NOT NULL DEFAULT '',
    "description"      TEXT            NOT NULL DEFAULT '',
    "price_from"       TEXT            NOT NULL DEFAULT 'Liên hệ',
    "price_per_day"    INTEGER         NOT NULL DEFAULT 0,
    "price_multi_day"  INTEGER         NOT NULL DEFAULT 0,
    "color"            TEXT            NOT NULL DEFAULT 'linear-gradient(135deg, #C7B8EA 0%, #9F8FD9 100%)',
    "accent"           TEXT            NOT NULL DEFAULT '#9F8FD9',
    "bg_accent"        TEXT            NOT NULL DEFAULT 'linear-gradient(135deg, #C7B8EA 0%, #9F8FD9 100%)',
    "available"        BOOLEAN         NOT NULL DEFAULT false,
    "use_time_progress" BOOLEAN        NOT NULL DEFAULT false,
    "stages"           JSONB           NOT NULL DEFAULT '[]',
    "sort_order"       INTEGER         NOT NULL DEFAULT 0,
    "created_at"       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    "updated_at"       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT "service_type_defs_key_key" UNIQUE ("key")
);

-- ── Seed dữ liệu 3 loại dịch vụ gốc ────────────────────────────────────────
INSERT INTO "service_type_defs"
    ("key","icon","name","subtitle","description","price_from",
     "price_per_day","price_multi_day","color","accent","bg_accent",
     "available","use_time_progress","stages","sort_order")
VALUES
  ('boarding','🏠','Giữ mèo','Khách sạn cho thú cưng',
   'Gửi mèo theo ngày, đầy đủ tiện nghi, có camera quan sát 24/7',
   '50.000đ/ngày', 70000, 50000,
   'linear-gradient(135deg, #FFB899 0%, #FF9B71 100%)',
   '#FF9B71',
   'linear-gradient(135deg, #FFB899 0%, #FF9B71 100%)',
   true, true,
   '[{"key":"pending","label":"Chờ nhận"},{"key":"received","label":"Đã nhận"},{"key":"active","label":"Đang chăm sóc"},{"key":"almost_done","label":"Sắp trả"},{"key":"completed","label":"Hoàn tất"}]',
   1),

  ('grooming','✂️','Grooming','Tắm & làm đẹp',
   'Tắm, sấy, cắt tỉa lông, vệ sinh tai - móng, làm đẹp toàn diện',
   'Liên hệ', 0, 0,
   'linear-gradient(135deg, #C7B8EA 0%, #9F8FD9 100%)',
   '#9F8FD9',
   'linear-gradient(135deg, #C7B8EA 0%, #9F8FD9 100%)',
   false, false,
   '[{"key":"pending","label":"Chờ"},{"key":"active","label":"Đang grooming"},{"key":"ready","label":"Sẵn sàng nhận"},{"key":"completed","label":"Hoàn tất"}]',
   2),

  ('medical','🏥','Khám bệnh','Dịch vụ thú y',
   'Khám tổng quát, tiêm phòng, điều trị các bệnh thường gặp ở mèo',
   'Liên hệ', 0, 0,
   'linear-gradient(135deg, #A8D8EA 0%, #7BB6E0 100%)',
   '#7BB6E0',
   'linear-gradient(135deg, #A8D8EA 0%, #7BB6E0 100%)',
   false, false,
   '[{"key":"pending","label":"Chờ khám"},{"key":"active","label":"Đang khám"},{"key":"treatment","label":"Điều trị"},{"key":"completed","label":"Hoàn tất"}]',
   3)

ON CONFLICT ("key") DO NOTHING;
