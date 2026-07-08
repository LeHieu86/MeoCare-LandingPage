-- CreateTable
CREATE TABLE "packaging_orders" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "store_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "note" TEXT,
    "total_input_cost" INTEGER NOT NULL DEFAULT 0,
    "remainder_qty" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packaging_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packaging_inputs" (
    "id" SERIAL NOT NULL,
    "packaging_order_id" INTEGER NOT NULL,
    "inventory_item_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "units_per_input" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "packaging_inputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packaging_outputs" (
    "id" SERIAL NOT NULL,
    "packaging_order_id" INTEGER NOT NULL,
    "inventory_item_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "units_per_pack" INTEGER NOT NULL DEFAULT 1,
    "unit_cost" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "packaging_outputs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "packaging_orders_code_key" ON "packaging_orders"("code");

-- CreateIndex
CREATE INDEX "packaging_orders_store_id_idx" ON "packaging_orders"("store_id");

-- CreateIndex
CREATE INDEX "packaging_orders_status_idx" ON "packaging_orders"("status");

-- CreateIndex
CREATE INDEX "packaging_inputs_packaging_order_id_idx" ON "packaging_inputs"("packaging_order_id");

-- CreateIndex
CREATE INDEX "packaging_outputs_packaging_order_id_idx" ON "packaging_outputs"("packaging_order_id");

-- AddForeignKey
ALTER TABLE "packaging_orders" ADD CONSTRAINT "packaging_orders_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packaging_inputs" ADD CONSTRAINT "packaging_inputs_packaging_order_id_fkey" FOREIGN KEY ("packaging_order_id") REFERENCES "packaging_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packaging_inputs" ADD CONSTRAINT "packaging_inputs_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packaging_outputs" ADD CONSTRAINT "packaging_outputs_packaging_order_id_fkey" FOREIGN KEY ("packaging_order_id") REFERENCES "packaging_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packaging_outputs" ADD CONSTRAINT "packaging_outputs_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
