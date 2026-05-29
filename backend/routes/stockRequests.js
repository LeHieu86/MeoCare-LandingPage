/**
 * /api/stock-requests
 *
 * Chi nhánh (manager) tạo phiếu yêu cầu hàng từ kho trung tâm.
 * Stock-manager xác nhận và cập nhật trạng thái.
 * Khi "delivered" → tự động trừ kho trung tâm + cộng kho chi nhánh.
 */
const express = require("express");
const prisma  = require("../lib/prisma");
const { verifyToken }  = require("../middleware/auth");
const { storeContext } = require("../middleware/storeContext");

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────────────
const requireStockManager = (req, res, next) => {
  if (!["admin", "stock-manager"].includes(req.user?.role)) {
    return res.status(403).json({ error: "Chỉ stock-manager mới có quyền này." });
  }
  next();
};

const requireBranchOrStock = (req, res, next) => {
  if (!["admin", "stock-manager", "manager"].includes(req.user?.role)) {
    return res.status(403).json({ error: "Không có quyền truy cập." });
  }
  next();
};

/** Tạo request_code tự động: SR-YYYYMMDD-NNN */
async function genRequestCode() {
  const today   = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix  = `SR-${dateStr}-`;
  const count   = await prisma.stockRequest.count({
    where: { request_code: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}

/** Lấy store_id của kho trung tâm (is_warehouse = true) */
async function getWarehouseStoreId() {
  const warehouse = await prisma.store.findFirst({
    where: { is_warehouse: true },
    select: { id: true },
  });
  if (!warehouse) throw new Error("Chưa có kho trung tâm. Vui lòng đánh dấu 1 store là kho trung tâm.");
  return warehouse.id;
}

// ── GET / — Danh sách phiếu nhập ──────────────────────────────────────────────
// stock-manager: thấy tất cả
// manager: chỉ thấy của chi nhánh mình
router.get("/", verifyToken, storeContext, requireBranchOrStock, async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const role    = req.user.role;
    const isStock = ["admin", "stock-manager"].includes(role);

    const where = {};
    if (status) where.status = status;
    if (!isStock) {
      // Branch chỉ thấy phiếu của store mình
      if (!req.storeId) return res.status(400).json({ error: "Không xác định được chi nhánh." });
      where.from_store_id = req.storeId;
    }

    const [items, total] = await Promise.all([
      prisma.stockRequest.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
        include: {
          from_store: { select: { id: true, name: true } },
          items: {
            include: {
              inventoryItem: {
                select: { id: true, sku: true, name: true, unit: true, current_stock: true, product_id: true, variant_id: true },
              },
            },
          },
        },
      }),
      prisma.stockRequest.count({ where }),
    ]);

    res.json({ data: items, total, page: parseInt(page) });
  } catch (err) {
    console.error("[GET /stock-requests]", err);
    res.status(500).json({ error: err.message || "Lỗi server." });
  }
});

// ── POST / — Chi nhánh tạo phiếu nhập ────────────────────────────────────────
router.post("/", verifyToken, storeContext, requireBranchOrStock, async (req, res) => {
  try {
    const { note, items } = req.body;

    // Xác định store của branch (manager dùng store_id từ JWT, admin phải truyền)
    const branchStoreId = req.storeId;
    if (!branchStoreId) {
      return res.status(400).json({ error: "Không xác định được chi nhánh. Vui lòng truyền store_id." });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Phiếu nhập phải có ít nhất 1 sản phẩm." });
    }

    // Validate items — mỗi item cần inventory_item_id và quantity > 0
    for (const item of items) {
      if (!item.inventory_item_id) {
        return res.status(400).json({ error: "Mỗi dòng phải có inventory_item_id." });
      }
      if (!item.quantity || item.quantity <= 0) {
        return res.status(400).json({ error: "Số lượng phải lớn hơn 0." });
      }
    }

    // Kiểm tra inventory items tồn tại và thuộc kho trung tâm
    const warehouseId = await getWarehouseStoreId();
    const itemIds     = items.map((i) => i.inventory_item_id);
    const invItems    = await prisma.inventoryItem.findMany({
      where: { id: { in: itemIds }, store_id: warehouseId },
      select: { id: true, name: true, current_stock: true },
    });

    if (invItems.length !== itemIds.length) {
      return res.status(400).json({
        error: "Một số sản phẩm không tồn tại trong kho trung tâm.",
      });
    }

    const requestCode = await genRequestCode();

    const created = await prisma.stockRequest.create({
      data: {
        request_code:  requestCode,
        from_store_id: branchStoreId,
        note:          note || null,
        status:        "pending",
        items: {
          create: items.map((item) => ({
            inventory_item_id: item.inventory_item_id,
            quantity:          item.quantity,
            note:              item.note || null,
          })),
        },
      },
      include: {
        from_store: { select: { id: true, name: true } },
        items: {
          include: {
            inventoryItem: { select: { id: true, sku: true, name: true, unit: true } },
          },
        },
      },
    });

    res.status(201).json(created);
  } catch (err) {
    console.error("[POST /stock-requests]", err);
    res.status(500).json({ error: err.message || "Lỗi server." });
  }
});

// ── PUT /:id/status — Stock-manager cập nhật trạng thái ──────────────────────
const STATUS_FLOW = {
  pending:   "confirmed",
  confirmed: "shipping",
  shipping:  "delivered",
};

router.put("/:id/status", verifyToken, requireStockManager, async (req, res) => {
  try {
    const id     = parseInt(req.params.id);
    const { status } = req.body;

    const allowed = ["confirmed", "shipping", "delivered", "cancelled"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Trạng thái không hợp lệ. Chọn: ${allowed.join(", ")}` });
    }

    const request = await prisma.stockRequest.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            inventoryItem: true,
          },
        },
      },
    });
    if (!request) return res.status(404).json({ error: "Không tìm thấy phiếu nhập." });

    // Kiểm tra flow hợp lệ (không được bỏ bước trừ cancelled)
    if (status !== "cancelled" && STATUS_FLOW[request.status] !== status) {
      return res.status(400).json({
        error: `Không thể chuyển từ "${request.status}" sang "${status}".`,
      });
    }

    const now     = new Date();
    const updates = { status, updated_at: now };
    if (status === "confirmed") updates.confirmed_at = now;
    if (status === "shipping")  updates.shipped_at   = now;
    if (status === "delivered") updates.delivered_at = now;

    // Khi delivered: thực hiện chuyển hàng kho → chi nhánh
    if (status === "delivered") {
      const warehouseId = await getWarehouseStoreId();

      await prisma.$transaction(async (tx) => {
        for (const item of request.items) {
          const warehouseItem = item.inventoryItem;
          const qty           = item.fulfilled_qty > 0 ? item.fulfilled_qty : item.quantity;

          // 1. Trừ kho trung tâm
          const newWarehouseStock = warehouseItem.current_stock - qty;
          await tx.inventoryItem.update({
            where: { id: warehouseItem.id },
            data:  { current_stock: newWarehouseStock, updated_at: now },
          });

          // 2. StockMovement: xuất kho trung tâm
          await tx.stockMovement.create({
            data: {
              inventory_item_id: warehouseItem.id,
              type:              "transfer_out",
              qty_change:        -qty,
              qty_before:        warehouseItem.current_stock,
              qty_after:         newWarehouseStock,
              reference_type:    "stock_request",
              reference_id:      request.id,
              note:              `Xuất cho ${request.from_store_id} - Phiếu ${request.request_code}`,
            },
          });

          // 3. Tìm hoặc tạo InventoryItem tại chi nhánh
          let branchItem = await tx.inventoryItem.findFirst({
            where: {
              store_id:   request.from_store_id,
              // Ưu tiên match theo product_id+variant_id, fallback theo sku
              OR: warehouseItem.product_id
                ? [
                    { product_id: warehouseItem.product_id, variant_id: warehouseItem.variant_id },
                    { sku: warehouseItem.sku },
                  ]
                : [{ sku: warehouseItem.sku }],
            },
          });

          if (!branchItem) {
            // Tạo mới InventoryItem cho chi nhánh
            branchItem = await tx.inventoryItem.create({
              data: {
                store_id:       request.from_store_id,
                product_id:     warehouseItem.product_id,
                variant_id:     warehouseItem.variant_id,
                sku:            warehouseItem.sku,
                name:           warehouseItem.name,
                unit:           warehouseItem.unit,
                current_stock:  0,
                average_cost:   warehouseItem.average_cost,
                min_stock_alert: 0,
              },
            });
          }

          const newBranchStock = branchItem.current_stock + qty;
          await tx.inventoryItem.update({
            where: { id: branchItem.id },
            data:  { current_stock: newBranchStock, updated_at: now },
          });

          // 4. StockMovement: nhập kho chi nhánh
          await tx.stockMovement.create({
            data: {
              inventory_item_id: branchItem.id,
              type:              "transfer_in",
              qty_change:        qty,
              qty_before:        branchItem.current_stock,
              qty_after:         newBranchStock,
              reference_type:    "stock_request",
              reference_id:      request.id,
              note:              `Nhận từ kho trung tâm - Phiếu ${request.request_code}`,
            },
          });
        }

        // 5. Cập nhật status phiếu
        await tx.stockRequest.update({
          where: { id },
          data:  updates,
        });
      });
    } else {
      await prisma.stockRequest.update({ where: { id }, data: updates });
    }

    const updated = await prisma.stockRequest.findUnique({
      where: { id },
      include: {
        from_store: { select: { id: true, name: true } },
        items: {
          include: {
            inventoryItem: { select: { id: true, sku: true, name: true, unit: true, current_stock: true } },
          },
        },
      },
    });

    res.json(updated);
  } catch (err) {
    console.error("[PUT /stock-requests/:id/status]", err);
    res.status(500).json({ error: err.message || "Lỗi server." });
  }
});

// ── GET /warehouse-inventory — Danh sách hàng trong kho trung tâm ─────────────
// Dùng để chi nhánh chọn sản phẩm khi tạo phiếu
router.get("/warehouse-inventory", verifyToken, requireBranchOrStock, async (req, res) => {
  try {
    const warehouseId = await getWarehouseStoreId();
    const { search }  = req.query;

    const items = await prisma.inventoryItem.findMany({
      where: {
        store_id:  warehouseId,
        is_active: true,
        ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
      },
      select: {
        id:            true,
        sku:           true,
        name:          true,
        unit:          true,
        current_stock: true,
        product_id:    true,
        variant_id:    true,
        product: { select: { id: true, name: true, category: true, image: true } },
        variant: { select: { id: true, name: true, price: true } },
      },
      orderBy: { name: "asc" },
    });

    res.json(items);
  } catch (err) {
    console.error("[GET /stock-requests/warehouse-inventory]", err);
    res.status(500).json({ error: err.message || "Lỗi server." });
  }
});

module.exports = router;
