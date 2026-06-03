/**
 * /api/admin/store-expenses
 * Quản lý chi phí vận hành từng chi nhánh — chỉ admin
 */
const express = require("express");
const prisma  = require("../lib/prisma");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Chỉ admin mới có quyền." });
  }
  next();
};

// Admin xem tất cả, manager chỉ xem/nhập chi nhánh của mình
const requireManagerOrAdmin = (req, res, next) => {
  const role = req.user?.role;
  if (!["admin", "manager"].includes(role)) {
    return res.status(403).json({ error: "Không có quyền." });
  }
  next();
};

const EXPENSE_TYPES = ["electricity", "water", "rent", "other"];

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/store-expenses/summary?month=6&year=2026
// Trả về doanh thu + chi phí nhập hàng + chi phí vận hành theo từng chi nhánh
// ─────────────────────────────────────────────────────────────────────────────
router.get("/summary", verifyToken, requireAdmin, async (req, res) => {
  try {
    const month = parseInt(req.query.month || new Date().getMonth() + 1);
    const year  = parseInt(req.query.year  || new Date().getFullYear());

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth   = new Date(year, month, 0, 23, 59, 59);

    // Lấy tất cả chi nhánh (trừ kho)
    const stores = await prisma.store.findMany({
      where:   { isActive: true, isWarehouse: false },
      select:  { id: true, name: true },
      orderBy: { id: "asc" },
    });

    const results = await Promise.all(stores.map(async (store) => {
      // 1. Doanh thu = tổng đơn hàng delivered trong tháng
      const orders = await prisma.order.findMany({
        where: {
          store_id:   store.id,
          status:     "delivered",
          created_at: { gte: startOfMonth, lte: endOfMonth },
        },
        select: { total: true },
      });
      const revenue = orders.reduce((s, o) => s + (o.total || 0), 0);

      // 2. Chi phí nhập hàng = tổng PO received trong tháng
      const pos = await prisma.purchaseOrder.findMany({
        where: {
          store_id:   store.id,
          status:     "confirmed",
          created_at: { gte: startOfMonth, lte: endOfMonth },
        },
        select: { total_cost: true },
      });
      const importCost = pos.reduce((s, p) => s + (p.total_cost || 0), 0);

      // 3. Chi phí vận hành (điện, nước, thuê MB...) nhập tay
      const expenses = await prisma.storeExpense.findMany({
        where: { store_id: store.id, month, year },
        select: { type: true, amount: true, note: true, id: true },
      });
      const operatingCost = expenses.reduce((s, e) => s + (e.amount || 0), 0);

      const profit = revenue - importCost - operatingCost;

      return {
        storeId:      store.id,
        storeName:    store.name,
        revenue,
        importCost,
        operatingCost,
        expenses,        // chi tiết từng khoản
        profit,
      };
    }));

    res.json({ month, year, stores: results });
  } catch (err) {
    console.error("[GET /admin/store-expenses/summary]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/store-expenses?storeId=1&month=6&year=2026
// ─────────────────────────────────────────────────────────────────────────────
router.get("/", verifyToken, requireManagerOrAdmin, async (req, res) => {
  try {
    const { storeId, month, year } = req.query;
    const where = {};
    // Manager chỉ thấy chi nhánh của mình
    if (req.user.role === "manager") {
      where.store_id = req.user.store_id;
    } else if (storeId) {
      where.store_id = parseInt(storeId);
    }
    if (month) where.month = parseInt(month);
    if (year)  where.year  = parseInt(year);

    const expenses = await prisma.storeExpense.findMany({
      where,
      include: { store: { select: { id: true, name: true } } },
      orderBy: [{ year: "desc" }, { month: "desc" }, { id: "asc" }],
    });
    res.json(expenses);
  } catch (err) {
    console.error("[GET /admin/store-expenses]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/store-expenses
// Body: { storeId, month, year, type, amount, note? }
// ─────────────────────────────────────────────────────────────────────────────
router.post("/", verifyToken, requireManagerOrAdmin, async (req, res) => {
  try {
    const { storeId, month, year, type, amount, note, receipt_url } = req.body;

    if (!storeId || !month || !year || !type || amount === undefined) {
      return res.status(400).json({ error: "Thiếu thông tin bắt buộc." });
    }
    if (!EXPENSE_TYPES.includes(type)) {
      return res.status(400).json({ error: "Loại chi phí không hợp lệ." });
    }

    // Manager chỉ được nhập chi phí cho chi nhánh của mình
    if (req.user.role === "manager" && req.user.store_id !== parseInt(storeId)) {
      return res.status(403).json({ error: "Chỉ được nhập chi phí cho chi nhánh của mình." });
    }

    // Manager không được nhập chi phí thuê mặt bằng (admin quản)
    if (req.user.role === "manager" && type === "rent") {
      return res.status(403).json({ error: "Chi phí thuê mặt bằng do admin quản lý." });
    }

    const expense = await prisma.storeExpense.create({
      data: {
        store_id:    parseInt(storeId),
        month:       parseInt(month),
        year:        parseInt(year),
        type,
        amount:      parseInt(amount),
        note:        note?.trim() || null,
        receipt_url: receipt_url?.trim() || null,
      },
      include: { store: { select: { id: true, name: true } } },
    });
    res.status(201).json(expense);
  } catch (err) {
    console.error("[POST /admin/store-expenses]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/admin/store-expenses/:id
// ─────────────────────────────────────────────────────────────────────────────
router.put("/:id", verifyToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { type, amount, note, receipt_url } = req.body;

    const data = {};
    if (type        && EXPENSE_TYPES.includes(type)) data.type        = type;
    if (amount      !== undefined) data.amount      = parseInt(amount);
    if (note        !== undefined) data.note        = note?.trim() || null;
    if (receipt_url !== undefined) data.receipt_url = receipt_url?.trim() || null;

    const expense = await prisma.storeExpense.update({
      where: { id },
      data,
      include: { store: { select: { id: true, name: true } } },
    });
    res.json(expense);
  } catch (err) {
    console.error("[PUT /admin/store-expenses/:id]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/admin/store-expenses/:id
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/:id", verifyToken, requireManagerOrAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // Manager: kiểm tra quyền sở hữu
    if (req.user.role === "manager") {
      const expense = await prisma.storeExpense.findUnique({ where: { id } });
      if (!expense) return res.status(404).json({ error: "Không tìm thấy." });
      if (expense.store_id !== req.user.store_id) {
        return res.status(403).json({ error: "Không có quyền xóa chi phí này." });
      }
      if (expense.type === "rent") {
        return res.status(403).json({ error: "Chi phí thuê mặt bằng do admin quản lý." });
      }
    }

    await prisma.storeExpense.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error("[DELETE /admin/store-expenses/:id]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

module.exports = router;
