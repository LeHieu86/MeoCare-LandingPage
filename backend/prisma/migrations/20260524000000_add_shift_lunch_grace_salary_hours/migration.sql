-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Thêm cấu hình nghỉ trưa & biên độ chấm công cho ca làm
--            Thêm tổng giờ làm & snapshot loại lương cho bảng lương
-- ─────────────────────────────────────────────────────────────────────────────

-- ── shifts: thêm nghỉ trưa + grace period ────────────────────────────────────
ALTER TABLE "shifts"
    ADD COLUMN IF NOT EXISTS "lunch_break_start"  TEXT,
    ADD COLUMN IF NOT EXISTS "lunch_break_end"    TEXT,
    ADD COLUMN IF NOT EXISTS "late_grace_minutes"  INTEGER NOT NULL DEFAULT 10,
    ADD COLUMN IF NOT EXISTS "early_grace_minutes" INTEGER NOT NULL DEFAULT 10;

-- ── salary_records: thêm totalWorkHours (part-time) + salaryType snapshot ───
ALTER TABLE "salary_records"
    ADD COLUMN IF NOT EXISTS "total_work_hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "salary_type"      TEXT NOT NULL DEFAULT 'monthly';
