-- CreateTable
CREATE TABLE "access_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "camera_id" INTEGER NOT NULL,
    "access_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendances" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "shift_assignment_id" INTEGER,
    "date" TIMESTAMP(3) NOT NULL,
    "check_in" TIMESTAMP(3),
    "check_out" TIMESTAMP(3),
    "work_hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overtime_hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'present',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" SERIAL NOT NULL,
    "cat_name" TEXT NOT NULL DEFAULT '',
    "cat_breed" TEXT,
    "owner_name" TEXT NOT NULL DEFAULT '',
    "owner_phone" TEXT NOT NULL DEFAULT '',
    "service" TEXT NOT NULL DEFAULT 'day',
    "room_id" TEXT,
    "check_in" TEXT NOT NULL,
    "check_out" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "contract_status" TEXT NOT NULL DEFAULT 'unsigned',
    "signature" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "digital_signature" TEXT,
    "service_type" TEXT NOT NULL DEFAULT 'boarding',
    "package_id" INTEGER,
    "package_name" TEXT,
    "package_price" INTEGER,
    "store_id" INTEGER NOT NULL DEFAULT 1,
    "cancel_reason" TEXT,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cameras" (
    "id" SERIAL NOT NULL,
    "room_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rtsp_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'online',
    "disk_id" TEXT,
    "recording" BOOLEAN NOT NULL DEFAULT true,
    "rtsp_sub_url" TEXT,
    "store_id" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "cameras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" SERIAL NOT NULL,
    "cartId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "variantName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carts" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "head_id" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "employee_code" TEXT NOT NULL,
    "department" TEXT NOT NULL DEFAULT 'general',
    "position" TEXT NOT NULL DEFAULT 'Nhân viên',
    "start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_date" TIMESTAMP(3),
    "salary_type" TEXT NOT NULL DEFAULT 'monthly',
    "base_salary" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "bank_name" TEXT,
    "bank_account" TEXT,
    "bank_account_name" TEXT,
    "bank_bin" TEXT,
    "store_id" INTEGER NOT NULL DEFAULT 1,
    "department_id" INTEGER,
    "position_id" INTEGER,
    "employment_type" TEXT NOT NULL DEFAULT 'full-time',
    "contract_type" TEXT NOT NULL DEFAULT 'permanent',
    "cccd" TEXT,
    "birth_date" TIMESTAMP(3),
    "address" TEXT,
    "default_shift_id" INTEGER,
    "gender" TEXT NOT NULL DEFAULT 'male',

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" SERIAL NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "barcode" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'hộp',
    "current_stock" INTEGER NOT NULL DEFAULT 0,
    "average_cost" INTEGER NOT NULL DEFAULT 0,
    "min_stock_alert" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "store_id" INTEGER NOT NULL DEFAULT 1,
    "product_id" INTEGER,
    "variant_id" INTEGER,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_balances" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "leave_type" TEXT NOT NULL,
    "total_days" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "used_days" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "adjusted_by" INTEGER,
    "note" TEXT,

    CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "leave_type" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "total_days" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approved_by_id" INTEGER,
    "approved_at" TIMESTAMP(3),
    "reject_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "manager_status" TEXT,
    "manager_approved_by" INTEGER,
    "manager_approved_at" TIMESTAMP(3),
    "manager_note" TEXT,
    "hr_status" TEXT,
    "hr_approved_by" INTEGER,
    "hr_approved_at" TIMESTAMP(3),
    "hr_note" TEXT,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nas_config" (
    "id" SERIAL NOT NULL,
    "nas_root" TEXT NOT NULL DEFAULT '/mnt/nas',
    "rooms" JSONB NOT NULL DEFAULT '[]',
    "segment_duration" INTEGER NOT NULL DEFAULT 900,
    "date_format" TEXT NOT NULL DEFAULT '%d-%m-%Y',
    "output_format" TEXT NOT NULL DEFAULT '.mp4',
    "codec" TEXT NOT NULL DEFAULT 'copy',
    "source_dir" TEXT NOT NULL DEFAULT '/home/user/videos/input',
    "delete_source" BOOLEAN NOT NULL DEFAULT false,
    "run_mode" TEXT NOT NULL DEFAULT 'once',
    "log_file" TEXT NOT NULL DEFAULT '/tmp/recorder.log',
    "watch_interval" INTEGER NOT NULL DEFAULT 30,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "disks" JSONB NOT NULL DEFAULT '[]',
    "rotate_days" INTEGER NOT NULL DEFAULT 30,
    "store_id" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "nas_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "variant_name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "cogs_amount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "invoice_no" TEXT NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "ship_fee" INTEGER NOT NULL DEFAULT 0,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "signature" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payment_method" TEXT NOT NULL DEFAULT 'cod',
    "cancel_reason" TEXT,
    "cancel_rejected_at" TIMESTAMP(3),
    "cancel_rejected_reason" TEXT,
    "cancel_request_reason" TEXT,
    "cancel_requested_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'website',
    "payment_expired_at" TIMESTAMP(3),
    "payment_status" TEXT NOT NULL DEFAULT 'unpaid',
    "refund_bank_account" TEXT,
    "refund_bank_bin" TEXT,
    "refund_bank_holder" TEXT,
    "refund_bank_name" TEXT,
    "refund_proof_url" TEXT,
    "refund_tx_ref" TEXT,
    "refunded_at" TIMESTAMP(3),
    "store_id" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ot_requests" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "store_id" INTEGER NOT NULL,
    "created_by_id" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "ot_type" TEXT NOT NULL DEFAULT 'planned',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approved_by_id" INTEGER,
    "approved_at" TIMESTAMP(3),
    "rejected_reason" TEXT,
    "pay_month" INTEGER NOT NULL,
    "pay_year" INTEGER NOT NULL,
    "pay_week" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ot_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pets" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "gender" TEXT NOT NULL DEFAULT 'male',
    "breed" TEXT NOT NULL DEFAULT '',
    "age" INTEGER NOT NULL DEFAULT 0,
    "from_shop" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "avatar" TEXT,

    CONSTRAINT "pets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" SERIAL NOT NULL,
    "department_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "description" TEXT,
    "sold" INTEGER NOT NULL DEFAULT 0,
    "store_id" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" SERIAL NOT NULL,
    "po_id" INTEGER NOT NULL,
    "inventory_item_id" INTEGER NOT NULL,
    "unit_cost" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" SERIAL NOT NULL,
    "po_number" TEXT NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "total_cost" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "note" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "store_id" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "order_id" INTEGER,
    "user_id" INTEGER,
    "username" TEXT NOT NULL DEFAULT 'Khách hàng',
    "rating" INTEGER NOT NULL DEFAULT 5,
    "comment" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "camera_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "store_id" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_records" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "base_salary" INTEGER NOT NULL,
    "standard_days" DOUBLE PRECISION NOT NULL DEFAULT 26,
    "worked_days" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overtime_hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overtime_pay" INTEGER NOT NULL DEFAULT 0,
    "bonus" INTEGER NOT NULL DEFAULT 0,
    "allowance" INTEGER NOT NULL DEFAULT 0,
    "deduction" INTEGER NOT NULL DEFAULT 0,
    "unpaid_leave_days" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "net_salary" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "note" TEXT,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "total_work_hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "salary_type" TEXT NOT NULL DEFAULT 'monthly',
    "period_type" TEXT NOT NULL DEFAULT 'monthly',
    "week" INTEGER,
    "week_start" TIMESTAMP(3),
    "week_end" TIMESTAMP(3),

    CONSTRAINT "salary_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sell_product_components" (
    "id" SERIAL NOT NULL,
    "variant_id" INTEGER NOT NULL,
    "inventory_item_id" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,

    CONSTRAINT "sell_product_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_packages" (
    "id" SERIAL NOT NULL,
    "service_type_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "price" INTEGER NOT NULL DEFAULT 0,
    "duration" TEXT,
    "includes" JSONB NOT NULL DEFAULT '[]',
    "is_popular" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_type_defs" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '🐾',
    "name" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "price_from" TEXT NOT NULL DEFAULT 'Liên hệ',
    "price_per_day" INTEGER NOT NULL DEFAULT 0,
    "price_multi_day" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL DEFAULT 'linear-gradient(135deg, #C7B8EA 0%, #9F8FD9 100%)',
    "accent" TEXT NOT NULL DEFAULT '#9F8FD9',
    "bg_accent" TEXT NOT NULL DEFAULT 'linear-gradient(135deg, #C7B8EA 0%, #9F8FD9 100%)',
    "available" BOOLEAN NOT NULL DEFAULT false,
    "use_time_progress" BOOLEAN NOT NULL DEFAULT false,
    "stages" JSONB NOT NULL DEFAULT '[]',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "pricing_type" TEXT NOT NULL DEFAULT 'per_day',

    CONSTRAINT "service_type_defs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" SERIAL NOT NULL,
    "room_id" TEXT NOT NULL,
    "customer_id" INTEGER,
    "start_time" TEXT,
    "end_time" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_assignments" (
    "id" SERIAL NOT NULL,
    "shift_id" INTEGER NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "registered_by" TEXT NOT NULL DEFAULT 'manager',
    "created_by_id" INTEGER,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "max_slots" INTEGER NOT NULL DEFAULT 10,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "lunch_break_start" TEXT,
    "lunch_break_end" TEXT,
    "late_grace_minutes" INTEGER NOT NULL DEFAULT 10,
    "early_grace_minutes" INTEGER NOT NULL DEFAULT 10,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" SERIAL NOT NULL,
    "inventory_item_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "qty_change" INTEGER NOT NULL,
    "qty_before" INTEGER NOT NULL,
    "qty_after" INTEGER NOT NULL,
    "unit_cost" INTEGER NOT NULL DEFAULT 0,
    "reference_type" TEXT,
    "reference_id" INTEGER,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_request_items" (
    "id" SERIAL NOT NULL,
    "request_id" INTEGER NOT NULL,
    "inventory_item_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "fulfilled_qty" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,

    CONSTRAINT "stock_request_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_requests" (
    "id" SERIAL NOT NULL,
    "request_code" TEXT NOT NULL,
    "from_store_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "shipped_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stores" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_warehouse" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "note" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "store_id" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens" (
    "token" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "service_id" INTEGER,
    "expired_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_pkey" PRIMARY KEY ("token")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fullName" TEXT NOT NULL DEFAULT 'Null',
    "email" TEXT NOT NULL DEFAULT 'chua_cap_nhat@email.com',
    "phone" TEXT NOT NULL DEFAULT 'Null',
    "role" TEXT NOT NULL DEFAULT 'client',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "avatar" TEXT,
    "bank_account" TEXT,
    "bank_bin" TEXT,
    "bank_holder" TEXT,
    "bank_name" TEXT,
    "store_id" INTEGER,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variants" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,

    CONSTRAINT "variants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "access_logs_camera_id_access_time_idx" ON "access_logs"("camera_id" ASC, "access_time" ASC);

-- CreateIndex
CREATE INDEX "access_logs_user_id_idx" ON "access_logs"("user_id" ASC);

-- CreateIndex
CREATE INDEX "attendances_date_idx" ON "attendances"("date" ASC);

-- CreateIndex
CREATE INDEX "attendances_employee_id_date_idx" ON "attendances"("employee_id" ASC, "date" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "attendances_shift_assignment_id_key" ON "attendances"("shift_assignment_id" ASC);

-- CreateIndex
CREATE INDEX "attendances_status_idx" ON "attendances"("status" ASC);

-- CreateIndex
CREATE INDEX "bookings_check_in_idx" ON "bookings"("check_in" ASC);

-- CreateIndex
CREATE INDEX "bookings_owner_phone_idx" ON "bookings"("owner_phone" ASC);

-- CreateIndex
CREATE INDEX "bookings_room_id_idx" ON "bookings"("room_id" ASC);

-- CreateIndex
CREATE INDEX "bookings_service_type_idx" ON "bookings"("service_type" ASC);

-- CreateIndex
CREATE INDEX "bookings_status_created_at_idx" ON "bookings"("status" ASC, "created_at" ASC);

-- CreateIndex
CREATE INDEX "bookings_status_idx" ON "bookings"("status" ASC);

-- CreateIndex
CREATE INDEX "bookings_store_id_idx" ON "bookings"("store_id" ASC);

-- CreateIndex
CREATE INDEX "cameras_room_id_idx" ON "cameras"("room_id" ASC);

-- CreateIndex
CREATE INDEX "cameras_store_id_idx" ON "cameras"("store_id" ASC);

-- CreateIndex
CREATE INDEX "cart_items_cartId_idx" ON "cart_items"("cartId" ASC);

-- CreateIndex
CREATE INDEX "cart_items_productId_idx" ON "cart_items"("productId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "carts_userId_key" ON "carts"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone" ASC);

-- CreateIndex
CREATE INDEX "departments_store_id_idx" ON "departments"("store_id" ASC);

-- CreateIndex
CREATE INDEX "employees_department_idx" ON "employees"("department" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "employees_employee_code_key" ON "employees"("employee_code" ASC);

-- CreateIndex
CREATE INDEX "employees_employment_type_idx" ON "employees"("employment_type" ASC);

-- CreateIndex
CREATE INDEX "employees_status_idx" ON "employees"("status" ASC);

-- CreateIndex
CREATE INDEX "employees_store_id_idx" ON "employees"("store_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "employees_user_id_key" ON "employees"("user_id" ASC);

-- CreateIndex
CREATE INDEX "inventory_items_is_active_idx" ON "inventory_items"("is_active" ASC);

-- CreateIndex
CREATE INDEX "inventory_items_product_id_idx" ON "inventory_items"("product_id" ASC);

-- CreateIndex
CREATE INDEX "inventory_items_store_id_idx" ON "inventory_items"("store_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_store_id_sku_key" ON "inventory_items"("store_id" ASC, "sku" ASC);

-- CreateIndex
CREATE INDEX "inventory_items_variant_id_idx" ON "inventory_items"("variant_id" ASC);

-- CreateIndex
CREATE INDEX "leave_balances_employee_id_idx" ON "leave_balances"("employee_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "leave_balances_employee_id_year_leave_type_key" ON "leave_balances"("employee_id" ASC, "year" ASC, "leave_type" ASC);

-- CreateIndex
CREATE INDEX "leave_requests_employee_id_idx" ON "leave_requests"("employee_id" ASC);

-- CreateIndex
CREATE INDEX "leave_requests_status_idx" ON "leave_requests"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "nas_config_store_id_key" ON "nas_config"("store_id" ASC);

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id" ASC);

-- CreateIndex
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at" ASC);

-- CreateIndex
CREATE INDEX "orders_customer_id_idx" ON "orders"("customer_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "orders_invoice_no_key" ON "orders"("invoice_no" ASC);

-- CreateIndex
CREATE INDEX "orders_payment_status_idx" ON "orders"("payment_status" ASC);

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status" ASC);

-- CreateIndex
CREATE INDEX "orders_store_id_idx" ON "orders"("store_id" ASC);

-- CreateIndex
CREATE INDEX "ot_requests_employee_id_idx" ON "ot_requests"("employee_id" ASC);

-- CreateIndex
CREATE INDEX "ot_requests_pay_month_pay_year_idx" ON "ot_requests"("pay_month" ASC, "pay_year" ASC);

-- CreateIndex
CREATE INDEX "ot_requests_status_idx" ON "ot_requests"("status" ASC);

-- CreateIndex
CREATE INDEX "ot_requests_store_id_idx" ON "ot_requests"("store_id" ASC);

-- CreateIndex
CREATE INDEX "pets_user_id_idx" ON "pets"("user_id" ASC);

-- CreateIndex
CREATE INDEX "positions_department_id_idx" ON "positions"("department_id" ASC);

-- CreateIndex
CREATE INDEX "products_category_idx" ON "products"("category" ASC);

-- CreateIndex
CREATE INDEX "products_sold_idx" ON "products"("sold" ASC);

-- CreateIndex
CREATE INDEX "products_store_id_idx" ON "products"("store_id" ASC);

-- CreateIndex
CREATE INDEX "purchase_order_items_inventory_item_id_idx" ON "purchase_order_items"("inventory_item_id" ASC);

-- CreateIndex
CREATE INDEX "purchase_order_items_po_id_idx" ON "purchase_order_items"("po_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_po_number_key" ON "purchase_orders"("po_number" ASC);

-- CreateIndex
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status" ASC);

-- CreateIndex
CREATE INDEX "purchase_orders_store_id_idx" ON "purchase_orders"("store_id" ASC);

-- CreateIndex
CREATE INDEX "purchase_orders_supplier_id_idx" ON "purchase_orders"("supplier_id" ASC);

-- CreateIndex
CREATE INDEX "reviews_order_id_idx" ON "reviews"("order_id" ASC);

-- CreateIndex
CREATE INDEX "reviews_product_id_idx" ON "reviews"("product_id" ASC);

-- CreateIndex
CREATE INDEX "rooms_store_id_idx" ON "rooms"("store_id" ASC);

-- CreateIndex
CREATE INDEX "salary_records_employee_id_idx" ON "salary_records"("employee_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "salary_records_employee_id_month_year_week_key" ON "salary_records"("employee_id" ASC, "month" ASC, "year" ASC, "week" ASC);

-- CreateIndex
CREATE INDEX "salary_records_period_type_idx" ON "salary_records"("period_type" ASC);

-- CreateIndex
CREATE INDEX "salary_records_status_idx" ON "salary_records"("status" ASC);

-- CreateIndex
CREATE INDEX "salary_records_year_month_idx" ON "salary_records"("year" ASC, "month" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "sell_product_components_variant_id_inventory_item_id_key" ON "sell_product_components"("variant_id" ASC, "inventory_item_id" ASC);

-- CreateIndex
CREATE INDEX "service_packages_is_active_idx" ON "service_packages"("is_active" ASC);

-- CreateIndex
CREATE INDEX "service_packages_service_type_id_idx" ON "service_packages"("service_type_id" ASC);

-- CreateIndex
CREATE INDEX "service_type_defs_available_idx" ON "service_type_defs"("available" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "service_type_defs_key_key" ON "service_type_defs"("key" ASC);

-- CreateIndex
CREATE INDEX "services_customer_id_idx" ON "services"("customer_id" ASC);

-- CreateIndex
CREATE INDEX "services_room_id_idx" ON "services"("room_id" ASC);

-- CreateIndex
CREATE INDEX "shift_assignments_date_idx" ON "shift_assignments"("date" ASC);

-- CreateIndex
CREATE INDEX "shift_assignments_employee_id_idx" ON "shift_assignments"("employee_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "shift_assignments_shift_id_employee_id_date_key" ON "shift_assignments"("shift_id" ASC, "employee_id" ASC, "date" ASC);

-- CreateIndex
CREATE INDEX "shift_assignments_status_idx" ON "shift_assignments"("status" ASC);

-- CreateIndex
CREATE INDEX "stock_movements_inventory_item_id_idx" ON "stock_movements"("inventory_item_id" ASC);

-- CreateIndex
CREATE INDEX "stock_movements_reference_type_reference_id_idx" ON "stock_movements"("reference_type" ASC, "reference_id" ASC);

-- CreateIndex
CREATE INDEX "stock_movements_type_idx" ON "stock_movements"("type" ASC);

-- CreateIndex
CREATE INDEX "stock_request_items_inventory_item_id_idx" ON "stock_request_items"("inventory_item_id" ASC);

-- CreateIndex
CREATE INDEX "stock_request_items_request_id_idx" ON "stock_request_items"("request_id" ASC);

-- CreateIndex
CREATE INDEX "stock_requests_from_store_id_idx" ON "stock_requests"("from_store_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "stock_requests_request_code_key" ON "stock_requests"("request_code" ASC);

-- CreateIndex
CREATE INDEX "stock_requests_status_idx" ON "stock_requests"("status" ASC);

-- CreateIndex
CREATE INDEX "suppliers_store_id_idx" ON "suppliers"("store_id" ASC);

-- CreateIndex
CREATE INDEX "tokens_expired_at_idx" ON "tokens"("expired_at" ASC);

-- CreateIndex
CREATE INDEX "tokens_room_id_idx" ON "tokens"("room_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email" ASC);

-- CreateIndex
CREATE INDEX "users_store_id_idx" ON "users"("store_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username" ASC);

-- CreateIndex
CREATE INDEX "variants_product_id_idx" ON "variants"("product_id" ASC);

-- AddForeignKey
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_camera_id_fkey" FOREIGN KEY ("camera_id") REFERENCES "cameras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_shift_assignment_id_fkey" FOREIGN KEY ("shift_assignment_id") REFERENCES "shift_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "service_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cameras" ADD CONSTRAINT "cameras_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cameras" ADD CONSTRAINT "cameras_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_default_shift_id_fkey" FOREIGN KEY ("default_shift_id") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nas_config" ADD CONSTRAINT "nas_config_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ot_requests" ADD CONSTRAINT "ot_requests_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ot_requests" ADD CONSTRAINT "ot_requests_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ot_requests" ADD CONSTRAINT "ot_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ot_requests" ADD CONSTRAINT "ot_requests_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pets" ADD CONSTRAINT "pets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_records" ADD CONSTRAINT "salary_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sell_product_components" ADD CONSTRAINT "sell_product_components_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sell_product_components" ADD CONSTRAINT "sell_product_components_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_packages" ADD CONSTRAINT "service_packages_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "service_type_defs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_request_items" ADD CONSTRAINT "stock_request_items_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_request_items" ADD CONSTRAINT "stock_request_items_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "stock_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_requests" ADD CONSTRAINT "stock_requests_from_store_id_fkey" FOREIGN KEY ("from_store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variants" ADD CONSTRAINT "variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
