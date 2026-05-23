-- AlterTable: Add employee relation column to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'client';

-- ─────────────────────────────────────────────────────────────────────────────
-- HR MODULE: Employees
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "employees" (
    "id"            SERIAL PRIMARY KEY,
    "user_id"       INTEGER NOT NULL UNIQUE,
    "employee_code" TEXT NOT NULL UNIQUE,
    "department"    TEXT NOT NULL DEFAULT 'general',
    "position"      TEXT NOT NULL DEFAULT 'Nhân viên',
    "start_date"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_date"      TIMESTAMP(3),
    "salary_type"   TEXT NOT NULL DEFAULT 'monthly',
    "base_salary"   INTEGER NOT NULL DEFAULT 0,
    "status"        TEXT NOT NULL DEFAULT 'active',
    "note"          TEXT,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "employees_status_idx" ON "employees"("status");

ALTER TABLE "employees"
    ADD CONSTRAINT "employees_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Shifts (Ca làm việc - template)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "shifts" (
    "id"         SERIAL PRIMARY KEY,
    "name"       TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time"   TEXT NOT NULL,
    "max_slots"  INTEGER NOT NULL DEFAULT 10,
    "is_active"  BOOLEAN NOT NULL DEFAULT true,
    "note"       TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Shift Assignments (Phân ca / Đăng ký ca)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "shift_assignments" (
    "id"              SERIAL PRIMARY KEY,
    "shift_id"        INTEGER NOT NULL,
    "employee_id"     INTEGER NOT NULL,
    "date"            TIMESTAMP(3) NOT NULL,
    "status"          TEXT NOT NULL DEFAULT 'scheduled',
    "registered_by"   TEXT NOT NULL DEFAULT 'manager',
    "created_by_id"   INTEGER,
    "note"            TEXT,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "shift_assignments_shift_id_employee_id_date_key"
    ON "shift_assignments"("shift_id", "employee_id", "date");

CREATE INDEX "shift_assignments_date_idx"      ON "shift_assignments"("date");
CREATE INDEX "shift_assignments_employee_idx"  ON "shift_assignments"("employee_id");

ALTER TABLE "shift_assignments"
    ADD CONSTRAINT "shift_assignments_shift_id_fkey"
    FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "shift_assignments"
    ADD CONSTRAINT "shift_assignments_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Attendances (Chấm công)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "attendances" (
    "id"                   SERIAL PRIMARY KEY,
    "employee_id"          INTEGER NOT NULL,
    "shift_assignment_id"  INTEGER UNIQUE,
    "date"                 TIMESTAMP(3) NOT NULL,
    "check_in"             TIMESTAMP(3),
    "check_out"            TIMESTAMP(3),
    "work_hours"           DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overtime_hours"       DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status"               TEXT NOT NULL DEFAULT 'present',
    "note"                 TEXT,
    "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "attendances_employee_id_idx" ON "attendances"("employee_id");
CREATE INDEX "attendances_date_idx"        ON "attendances"("date");

ALTER TABLE "attendances"
    ADD CONSTRAINT "attendances_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attendances"
    ADD CONSTRAINT "attendances_shift_assignment_id_fkey"
    FOREIGN KEY ("shift_assignment_id") REFERENCES "shift_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Leave Requests (Đơn xin nghỉ phép)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "leave_requests" (
    "id"              SERIAL PRIMARY KEY,
    "employee_id"     INTEGER NOT NULL,
    "leave_type"      TEXT NOT NULL,
    "start_date"      TIMESTAMP(3) NOT NULL,
    "end_date"        TIMESTAMP(3) NOT NULL,
    "total_days"      DOUBLE PRECISION NOT NULL,
    "reason"          TEXT NOT NULL,
    "status"          TEXT NOT NULL DEFAULT 'pending',
    "approved_by_id"  INTEGER,
    "approved_at"     TIMESTAMP(3),
    "reject_reason"   TEXT,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "leave_requests_employee_id_idx" ON "leave_requests"("employee_id");
CREATE INDEX "leave_requests_status_idx"      ON "leave_requests"("status");

ALTER TABLE "leave_requests"
    ADD CONSTRAINT "leave_requests_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Salary Records (Bảng lương hàng tháng)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "salary_records" (
    "id"                SERIAL PRIMARY KEY,
    "employee_id"       INTEGER NOT NULL,
    "month"             INTEGER NOT NULL,
    "year"              INTEGER NOT NULL,
    "base_salary"       INTEGER NOT NULL,
    "standard_days"     DOUBLE PRECISION NOT NULL DEFAULT 26,
    "worked_days"       DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overtime_hours"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overtime_pay"      INTEGER NOT NULL DEFAULT 0,
    "bonus"             INTEGER NOT NULL DEFAULT 0,
    "allowance"         INTEGER NOT NULL DEFAULT 0,
    "deduction"         INTEGER NOT NULL DEFAULT 0,
    "unpaid_leave_days" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "net_salary"        INTEGER NOT NULL DEFAULT 0,
    "status"            TEXT NOT NULL DEFAULT 'draft',
    "note"              TEXT,
    "paid_at"           TIMESTAMP(3),
    "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "salary_records_employee_id_month_year_key"
    ON "salary_records"("employee_id", "month", "year");

CREATE INDEX "salary_records_employee_id_idx" ON "salary_records"("employee_id");
CREATE INDEX "salary_records_year_month_idx"  ON "salary_records"("year", "month");

ALTER TABLE "salary_records"
    ADD CONSTRAINT "salary_records_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed default shifts
INSERT INTO "shifts" ("name", "start_time", "end_time", "max_slots", "note") VALUES
    ('Ca sáng',  '06:00', '14:00', 10, 'Ca sáng 6h-14h'),
    ('Ca chiều', '14:00', '22:00', 10, 'Ca chiều 14h-22h'),
    ('Ca tối',   '22:00', '06:00', 5,  'Ca tối 22h-6h sáng hôm sau');
