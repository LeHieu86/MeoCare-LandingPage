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
const { getIO } = require("../socket");

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────────────
const requireBranchOrStock = (req, res, next) => {
  if (!["admin", "stock-manager", "manager"].includes(req.user?.role)) {
    return res.status(403).json({ error: "Không có quyền truy cập." });
  }
  next();
};

/** Tạo request_code tự động: SR-YYYYMMDD-NNN (dùng MAX để tránh trùng) */
async function genRequestCode() {
  const today   = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix  = `SR-${dateStr}-`;
  const last    = await prisma.stockRequest.findFirst({
    where:   { request_code: { startsWith: prefix } },
    orderBy: { request_code: "desc" },
    select:  { request_code: true },
  });
  let nextNum = 1;
  if (last) {
    const match = last.request_code.match(/-(\d+)$/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }
  return `${prefix}${String(nextNum).padStart(3, "0")}`;
}

/** Lấy store_id của kho trung tâm (is_warehouse = true) */
async function getWarehouseStoreId() {
  const warehouse = await prisma.store.findFirst({
    where: { isWarehouse: true },
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
          from_store: {
            select: {
              id: true, name: true,
              users: {
                where: { role: 'manager' },
                select: { fullName: true, phone: true },
                take: 1,
              },
            },
          },
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

    // Thông báo realtime cho stock-manager
    try {
      const io = getIO();
      if (io) io.to("stock-room").emit("stock:new", {
        id: `sr_${created.id}_${Date.now()}`,
        event: "stock:new",
        title: "📦 Phiếu nhập mới từ chi nhánh",
        body: `Phiếu ${created.request_code} — ${created.from_store?.name ?? "Chi nhánh"} yêu cầu hàng`,
        time: new Date().toISOString(),
      });
    } catch { /* không critical */ }

    res.status(201).json(created);
  } catch (err) {
    console.error("[POST /stock-requests]", err);
    res.status(500).json({ error: err.message || "Lỗi server." });
  }
});

// ── PUT /:id/status — Cập nhật trạng thái phiếu nhập ────────────────────────
// pending   → confirmed : stock-manager
// confirmed → shipping  : stock-manager
// shipping  → delivered : branch manager (người nhận hàng)
// * → cancelled         : stock-manager hoặc manager của chi nhánh đó
const STATUS_FLOW = {
  pending:   "confirmed",
  confirmed: "shipping",
  shipping:  "delivered",
};

router.put("/:id/status", verifyToken, requireBranchOrStock, async (req, res) => {
  try {
    const id     = parseInt(req.params.id);
    const { status } = req.body;
    const role   = req.user?.role;
    const isStock = ["admin", "stock-manager"].includes(role);
    const isBranch = role === "manager";

    const allowed = ["confirmed", "shipping", "delivered", "cancelled"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Trạng thái không hợp lệ. Chọn: ${allowed.join(", ")}` });
    }

    // Phân quyền theo từng bước
    if (["confirmed", "shipping"].includes(status) && !isStock) {
      return res.status(403).json({ error: "Chỉ stock-manager mới có thể xác nhận hoặc giao hàng." });
    }
    if (status === "delivered" && !isBranch && !isStock) {
      return res.status(403).json({ error: "Chỉ quản lý chi nhánh mới có thể xác nhận đã nhận hàng." });
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

    // Branch manager chỉ được thao tác trên phiếu của chi nhánh mình
    if (isBranch && req.user.store_id && request.from_store_id !== req.user.store_id) {
      return res.status(403).json({ error: "Không có quyền thao tác phiếu này." });
    }

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
      // Pre-check: đảm bảo tồn kho đủ trước khi vào transaction
      const insufficientItems = [];
      for (const item of request.items) {
        const qty         = item.fulfilled_qty > 0 ? item.fulfilled_qty : item.quantity;
        const freshInv    = await prisma.inventoryItem.findUnique({
          where: { id: item.inventoryItem.id }, select: { current_stock: true, name: true },
        });
        if ((freshInv?.current_stock ?? 0) < qty) {
          insufficientItems.push(`${freshInv?.name ?? item.inventoryItem.id} (cần ${qty}, còn ${freshInv?.current_stock ?? 0})`);
        }
      }
      if (insufficientItems.length > 0) {
        return res.status(400).json({
          error: `Kho không đủ hàng để giao:\n${insufficientItems.join('\n')}`,
        });
      }

      await prisma.$transaction(async (tx) => {
        // Idempotent guard
        const currentReq = await tx.stockRequest.findUnique({
          where: { id }, select: { status: true },
        });
        if (currentReq?.status === "delivered") return;

        for (const item of request.items) {
          const warehouseItem = item.inventoryItem;
          const qty           = item.fulfilled_qty > 0 ? item.fulfilled_qty : item.quantity;

          // 1. Đọc lại tồn kho trong transaction (fresh read)
          const freshWarehouse = await tx.inventoryItem.findUnique({
            where: { id: warehouseItem.id }, select: { current_stock: true },
          });
          const before = freshWarehouse?.current_stock ?? 0;
          if (before < qty) throw new Error(`Tồn kho không đủ: ${warehouseItem.name}`);

          // 2. Atomic decrement tồn kho trung tâm
          await tx.inventoryItem.update({
            where: { id: warehouseItem.id },
            data:  { current_stock: { decrement: qty }, updated_at: now },
          });
          const newWarehouseStock = before - qty;

          // 3. StockMovement: xuất kho trung tâm
          await tx.stockMovement.create({
            data: {
              inventory_item_id: warehouseItem.id,
              type:              "transfer_out",
              qty_change:        -qty,
              qty_before:        before,
              qty_after:         newWarehouseStock,
              reference_type:    "stock_request",
              reference_id:      request.id,
              note:              `Xuất cho ${request.from_store_id} - Phiếu ${request.request_code}`,
            },
          });

          // 3. Upsert InventoryItem tại chi nhánh (tránh race condition + unique conflict)
          // Ưu tiên tìm theo product_id+variant_id nếu có, fallback theo sku
          let branchItem = warehouseItem.product_id
            ? await tx.inventoryItem.findFirst({
                where: {
                  store_id:   request.from_store_id,
                  product_id: warehouseItem.product_id,
                  variant_id: warehouseItem.variant_id,
                },
              })
            : null;

          // Fallback: tìm theo compound key (store_id, sku)
          if (!branchItem) {
            branchItem = await tx.inventoryItem.findFirst({
              where: { store_id: request.from_store_id, sku: warehouseItem.sku },
            });
          }

          if (!branchItem) {
            // Tạo mới — đảm bảo SKU unique trong store bằng cách append store_id nếu cần
            const skuForBranch = warehouseItem.sku;
            branchItem = await tx.inventoryItem.create({
              data: {
                store_id:        request.from_store_id,
                product_id:      warehouseItem.product_id,
                variant_id:      warehouseItem.variant_id,
                sku:             skuForBranch,
                name:            warehouseItem.name,
                unit:            warehouseItem.unit,
                current_stock:   0,
                average_cost:    warehouseItem.average_cost,
                min_stock_alert: 0,
              },
            }).catch(async (e) => {
              // Nếu vẫn conflict (race condition), thử lấy lại
              if (e.code === "P2002") {
                return tx.inventoryItem.findFirst({
                  where: { store_id: request.from_store_id, sku: warehouseItem.sku },
                });
              }
              throw e;
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

    // Thông báo realtime — chỉ emit cho bên đối diện, không emit về cho bên vừa thao tác
    try {
      const io = getIO();
      if (io) {
        const statusLabel = { confirmed: "đã xác nhận", shipping: "đang giao hàng", delivered: "đã giao hàng", cancelled: "đã hủy" }[status] ?? status;
        const payload = {
          id: `sr_${id}_${status}_${Date.now()}`,
          event: "stock:updated",
          title: `🔄 Phiếu nhập ${statusLabel}`,
          body: `Phiếu ${updated?.request_code} — ${statusLabel}`,
          time: new Date().toISOString(),
        };
        if (isStock) {
          // Stock vừa thao tác → thông báo cho manager chi nhánh
          io.to("manager-room").emit("stock:updated", payload);
          io.to("admin-room").emit("stock:updated", payload);
        } else {
          // Manager chi nhánh vừa thao tác (delivered) → thông báo cho stock
          io.to("stock-room").emit("stock:updated", payload);
          io.to("admin-room").emit("stock:updated", payload);
        }
      }
    } catch { /* không critical */ }

    res.json(updated);
  } catch (err) {
    console.error("[PUT /stock-requests/:id/status]", err);
    res.status(500).json({ error: err.message || "Lỗi server." });
  }
});

// ── GET /warehouse-inventory — Catalog sản phẩm kho trung tâm ────────────────
// Trả về Products với variants + tồn kho warehouse.
// Chi nhánh dùng để chọn sản phẩm/variant khi tạo phiếu nhập.
router.get("/warehouse-inventory", verifyToken, requireBranchOrStock, async (req, res) => {
  try {
    const warehouseId = await getWarehouseStoreId();
    const { search }  = req.query;

    // Lấy tất cả InventoryItem trong warehouse (có hoặc không có product_id)
    const invItems = await prisma.inventoryItem.findMany({
      where: {
        store_id:  warehouseId,
        isActive:  true,
        ...(search ? {
          OR: [
            { name:    { contains: search, mode: "insensitive" } },
            { product: { name: { contains: search, mode: "insensitive" } } },
          ],
        } : {}),
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
      orderBy: [{ name: "asc" }],
    });

    // Nhóm theo product_id (nếu có), fallback: mỗi InventoryItem là 1 "product" riêng
    const productMap = new Map();
    for (const item of invItems) {
      if (item.product_id) {
        // Có link product → nhóm theo product
        const pid = item.product_id;
        if (!productMap.has(pid)) {
          productMap.set(pid, {
            product_id:   item.product.id,
            product_name: item.product.name,
            category:     item.product.category ?? "",
            image:        item.product.image ?? null,
            variants:     [],
          });
        }
        productMap.get(pid).variants.push({
          inventory_item_id: item.id,
          variant_id:        item.variant_id,
          variant_name:      item.variant?.name ?? null,
          price:             item.variant?.price ?? null,
          sku:               item.sku,
          unit:              item.unit,
          current_stock:     item.current_stock,
        });
      } else {
        // Không link product → tạo entry riêng với key "inv-{id}"
        const key = `inv-${item.id}`;
        productMap.set(key, {
          product_id:   null,
          product_name: item.name,
          category:     "",
          image:        null,
          variants: [{
            inventory_item_id: item.id,
            variant_id:        null,
            variant_name:      null,
            price:             null,
            sku:               item.sku,
            unit:              item.unit,
            current_stock:     item.current_stock,
          }],
        });
      }
    }

    res.json(Array.from(productMap.values()));
  } catch (err) {
    console.error("[GET /stock-requests/warehouse-inventory]", err);
    res.status(500).json({ error: err.message || "Lỗi server." });
  }
});

module.exports = router;
