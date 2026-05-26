-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Thêm indexes tối ưu hiệu suất truy vấn
-- Tất cả dùng IF NOT EXISTS → an toàn khi chạy lại
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Products ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "products_category_idx"  ON "products"("category");
CREATE INDEX IF NOT EXISTS "products_sold_idx"      ON "products"("sold");

-- ── Variants (FK) ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "variants_product_id_idx" ON "variants"("product_id");

-- ── Reviews ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "reviews_order_id_idx" ON "reviews"("order_id");
-- reviews_product_id_idx đã có từ schema trước

-- ── Cart items ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "cart_items_cart_id_idx"    ON "cart_items"("cartId");
CREATE INDEX IF NOT EXISTS "cart_items_product_id_idx" ON "cart_items"("productId");

-- ── Cameras (FK) ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "cameras_room_id_idx" ON "cameras"("room_id");

-- ── Services (FK) ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "services_room_id_idx"      ON "services"("room_id");
CREATE INDEX IF NOT EXISTS "services_customer_id_idx"  ON "services"("customer_id");

-- ── Bookings ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "bookings_status_idx"               ON "bookings"("status");
CREATE INDEX IF NOT EXISTS "bookings_room_id_idx"              ON "bookings"("room_id");
CREATE INDEX IF NOT EXISTS "bookings_service_type_idx"         ON "bookings"("service_type");
CREATE INDEX IF NOT EXISTS "bookings_owner_phone_idx"          ON "bookings"("owner_phone");
CREATE INDEX IF NOT EXISTS "bookings_check_in_idx"             ON "bookings"("check_in");
CREATE INDEX IF NOT EXISTS "bookings_status_created_at_idx"    ON "bookings"("status", "created_at");

-- ── Tokens ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "tokens_room_id_idx"    ON "tokens"("room_id");
CREATE INDEX IF NOT EXISTS "tokens_expired_at_idx" ON "tokens"("expired_at");

-- ── Pets (FK) ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "pets_user_id_idx" ON "pets"("user_id");

-- ── Access logs ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "access_logs_user_id_idx"              ON "access_logs"("user_id");
CREATE INDEX IF NOT EXISTS "access_logs_camera_id_access_time_idx" ON "access_logs"("camera_id", "access_time");

-- ── Purchase order items (FK) ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "purchase_order_items_po_id_idx"             ON "purchase_order_items"("po_id");
CREATE INDEX IF NOT EXISTS "purchase_order_items_inventory_item_id_idx" ON "purchase_order_items"("inventory_item_id");

-- ── Inventory items ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "inventory_items_is_active_idx" ON "inventory_items"("is_active");

-- ── Service packages (FK) ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "service_packages_service_type_id_idx" ON "service_packages"("service_type_id");
CREATE INDEX IF NOT EXISTS "service_packages_is_active_idx"       ON "service_packages"("is_active");

-- ── Service type defs ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "service_type_defs_available_idx" ON "service_type_defs"("available");

-- ── HR: Employees ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "employees_department_idx" ON "employees"("department");
-- employees_status_idx đã có từ schema trước

-- ── HR: Shift assignments ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "shift_assignments_status_idx" ON "shift_assignments"("status");
-- shift_assignments_date_idx + employee_id_idx đã có

-- ── HR: Attendances ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "attendances_employee_id_date_idx" ON "attendances"("employee_id", "date");
CREATE INDEX IF NOT EXISTS "attendances_status_idx"           ON "attendances"("status");
-- attendances_date_idx đã có

-- ── HR: Salary records ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "salary_records_status_idx" ON "salary_records"("status");
-- salary_records employee_id + year_month đã có
