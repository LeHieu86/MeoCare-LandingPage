/**
 * /api/admin/store-expenses
 * Quản lý chi phí vận hành + báo cáo tài chính toàn diện theo chi nhánh
 */
const express = require("express");
const prisma  = require("../lib/prisma");
const { verifyToken } = require("../middleware/auth");
// Helper tài chính dùng chung (cùng định nghĩa với báo cáo hoàn vốn ở investments.js)
const { calcStaffCost, calcGoodsCost, calcRevenue, calcMonthlyPnL } = require("../lib/storeFinance");

const router = express.Router();

// ─── Middleware ────────────────────────────────────────────────────────────────
// Kế toán (accountant) được xem/quản lý tài chính như admin (báo cáo + chi phí vận hành).
const requireAdmin = (req, res, next) => {
  if (!["admin", "accountant"].includes(req.user?.role)) {
    return res.status(403).json({ error: "Chỉ admin/kế toán mới có quyền." });
  }
  next();
};

const requireManagerOrAdmin = (req, res, next) => {
  const role = req.user?.role;
  if (!["admin", "manager", "accountant"].includes(role)) {
    return res.status(403).json({ error: "Không có quyền." });
  }
  next();
};

const EXPENSE_TYPES = ["electricity", "water", "rent", "other"];

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/store-expenses/summary?month=6&year=2026
// Tổng hợp tài chính theo từng chi nhánh (trừ kho)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/summary", verifyToken, requireAdmin, async (req, res) => {
  try {
    const month = parseInt(req.query.month || new Date().getMonth() + 1);
    const year  = parseInt(req.query.year  || new Date().getFullYear());

    // Tách 3 loại: chi nhánh / công ty / kho
    const stores = await prisma.store.findMany({
      where:   { isActive: true, isWarehouse: false, isCompany: false },
      select:  { id: true, name: true },
      orderBy: { id: "asc" },
    });

    const companyStores = await prisma.store.findMany({
      where:   { isActive: true, isCompany: true },
      select:  { id: true, name: true },
      orderBy: { id: "asc" },
    });

    const calcStore = async (store) => {
      const [revenue, goodsCost, staffCost, expenses] = await Promise.all([
        calcRevenue(store.id, month, year),
        calcGoodsCost(store.id, month, year),
        calcStaffCost(store.id, month, year),
        prisma.storeExpense.findMany({
          where: { store_id: store.id, month, year },
          select: { id: true, type: true, amount: true, note: true, receipt_url: true },
        }),
      ]);

      const operatingCost = expenses.reduce((s, e) => s + (e.amount || 0), 0);
      const totalCost     = goodsCost + staffCost.total + operatingCost;
      const profit        = revenue.total - totalCost;

      return {
        storeId:        store.id,
        storeName:      store.name,
        revenue:        revenue.total,
        productRevenue: revenue.productRevenue,
        serviceRevenue: revenue.serviceRevenue,
        goodsCost,
        staffCost:      staffCost.total,
        staffIsEstimate: staffCost.isEstimate,
        operatingCost,
        totalCost,
        expenses,
        profit,
      };
    };

    const results        = await Promise.all(stores.map(calcStore));
    const companyResults = await Promise.all(companyStores.map(calcStore));

    res.json({ month, year, stores: results, companies: companyResults });
  } catch (err) {
    console.error("[GET /admin/store-expenses/summary]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/store-expenses/warehouse-summary?month=6&year=2026
// Báo cáo riêng cho Kho Tổng
// ─────────────────────────────────────────────────────────────────────────────
router.get("/warehouse-summary", verifyToken, requireAdmin, async (req, res) => {
  try {
    const month = parseInt(req.query.month || new Date().getMonth() + 1);
    const year  = parseInt(req.query.year  || new Date().getFullYear());

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth   = new Date(year, month, 0, 23, 59, 59);

    // Tìm tất cả kho (isWarehouse = true)
    const warehouses = await prisma.store.findMany({
      where:  { isActive: true, isWarehouse: true },
      select: { id: true, name: true },
    });

    const results = await Promise.all(warehouses.map(async (wh) => {
      // 1. Tổng PO nhập về kho trong tháng
      const pos = await prisma.purchaseOrder.findMany({
        where: {
          store_id:     wh.id,
          status:       "confirmed",
          confirmed_at: { gte: startOfMonth, lte: endOfMonth },
        },
        select: { id: true, po_number: true, total_cost: true, confirmed_at: true },
      });
      const totalImported = pos.reduce((s, p) => s + (p.total_cost || 0), 0);

      // 2. Tổng xuất cho các chi nhánh trong tháng (StockRequest delivered)
      const stockRequests = await prisma.stockRequest.findMany({
        where: {
          status:       "delivered",
          delivered_at: { gte: startOfMonth, lte: endOfMonth },
          // items phải thuộc inventory của kho này
          items: {
            some: {
              inventoryItem: { store_id: wh.id },
            },
          },
        },
        include: {
          items: {
            include: {
              inventoryItem: { select: { average_cost: true, store_id: true } },
            },
          },
          from_store: { select: { id: true, name: true } },
        },
      });

      // Tính tổng giá trị xuất kho + group theo chi nhánh nhận
      const dispatchByBranch = {};
      let totalDispatched = 0;
      for (const req of stockRequests) {
        let reqCost = 0;
        for (const item of req.items) {
          if (item.inventoryItem?.store_id === wh.id) {
            reqCost += (item.fulfilled_qty || 0) * (item.inventoryItem?.average_cost || 0);
          }
        }
        totalDispatched += reqCost;
        const branchName = req.from_store?.name || `Store #${req.from_store_id}`;
        dispatchByBranch[branchName] = (dispatchByBranch[branchName] || 0) + reqCost;
      }

      // 3. Tồn kho hiện tại = Σ (current_stock × average_cost)
      const inventoryItems = await prisma.inventoryItem.findMany({
        where:  { store_id: wh.id, isActive: true },
        select: { id: true, name: true, sku: true, current_stock: true, average_cost: true, unit: true },
      });
      const stockValue = inventoryItems.reduce(
        (s, i) => s + (i.current_stock || 0) * (i.average_cost || 0), 0
      );
      const totalItems    = inventoryItems.length;
      const lowStockItems = inventoryItems.filter(
        i => i.min_stock_alert > 0 && i.current_stock <= i.min_stock_alert
      ).length;

      // 4. Doanh thu đơn hàng online (đơn delivered thuộc kho tổng)
      const onlineOrders = await prisma.order.findMany({
        where: {
          store_id:   wh.id,
          status:     "delivered",
          created_at: { gte: startOfMonth, lte: endOfMonth },
        },
        select: { total: true, id: true },
      });
      const onlineRevenue    = onlineOrders.reduce((s, o) => s + (o.total || 0), 0);
      const onlineOrderCount = onlineOrders.length;

      // 5. Giá vốn hàng bán online = StockMovement type="sale" của các đơn này
      // (chính xác hơn cogs_amount vì OrderItem không lưu variant_id)
      const onlineOrderIds = onlineOrders.map(o => o.id);
      let onlineCogs = 0;
      if (onlineOrderIds.length > 0) {
        const movements = await prisma.stockMovement.findMany({
          where: {
            reference_type: "order",
            reference_id:   { in: onlineOrderIds },
            type:           "sale",
          },
          select: { qty_change: true, unit_cost: true },
        });
        // qty_change âm (xuất kho) → lấy giá trị tuyệt đối × unit_cost
        onlineCogs = movements.reduce(
          (s, m) => s + Math.abs(m.qty_change) * (m.unit_cost || 0), 0
        );
      }

      // 6. Chi phí nhân sự kho
      const staffCost = await calcStaffCost(wh.id, month, year);

      // 7. Chi phí vận hành kho
      const expenses = await prisma.storeExpense.findMany({
        where:  { store_id: wh.id, month, year },
        select: { id: true, type: true, amount: true, note: true, receipt_url: true },
      });
      const operatingCost = expenses.reduce((s, e) => s + (e.amount || 0), 0);

      const totalCost = onlineCogs + staffCost.total + operatingCost;
      const profit    = onlineRevenue - totalCost;

      return {
        warehouseId:   wh.id,
        warehouseName: wh.name,
        // Doanh thu online
        onlineRevenue,
        onlineOrderCount,
        onlineCogs,
        // Nhập/xuất kho
        totalImported,
        totalDispatched,
        dispatchByBranch,
        purchaseOrders: pos,
        // Tồn kho
        stockValue,
        totalItems,
        lowStockItems,
        // Chi phí
        staffCost:      staffCost.total,
        staffIsEstimate: staffCost.isEstimate,
        operatingCost,
        totalCost,
        profit,
        // Chi tiết vận hành
        expenses,
      };
    }));

    res.json({ month, year, warehouses: results });
  } catch (err) {
    console.error("[GET /admin/store-expenses/warehouse-summary]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/store-expenses/consolidated?fromMonth=&fromYear=&toMonth=&toYear=
// Báo cáo HỢP NHẤT theo khoảng kỳ: cộng dồn P&L từng chi nhánh qua các tháng + tổng
// toàn công ty. Dùng cho xuất Excel/PDF.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/consolidated", verifyToken, requireAdmin, async (req, res) => {
  try {
    const fromM = parseInt(req.query.fromMonth), fromY = parseInt(req.query.fromYear);
    const toM   = parseInt(req.query.toMonth),   toY   = parseInt(req.query.toYear);
    if (!fromM || !fromY || !toM || !toY)
      return res.status(400).json({ error: "Thiếu khoảng thời gian." });

    // Danh sách tháng trong khoảng (cap 24 tháng để tránh quá tải)
    const months = [];
    let y = fromY, m = fromM;
    while ((y < toY || (y === toY && m <= toM)) && months.length < 24) {
      months.push({ m, y });
      m++; if (m > 12) { m = 1; y++; }
    }
    if (months.length === 0)
      return res.status(400).json({ error: "Khoảng thời gian không hợp lệ." });

    // Chi nhánh phục vụ + công ty (loại kho tổng)
    const stores = await prisma.store.findMany({
      where:  { isActive: true, isWarehouse: false },
      select: { id: true, name: true, isCompany: true },
      orderBy: { id: "asc" },
    });

    const perStore = await Promise.all(stores.map(async (s) => {
      const agg = { revenue: 0, goodsCost: 0, staffCost: 0, operatingCost: 0, totalCost: 0, profit: 0 };
      for (const { m, y } of months) {
        const p = await calcMonthlyPnL(s.id, m, y);
        agg.revenue       += p.revenue;
        agg.goodsCost     += p.goodsCost;
        agg.staffCost     += p.staffCost;
        agg.operatingCost += p.operatingCost;
        agg.totalCost     += p.totalCost;
        agg.profit        += p.profit;
      }
      return { storeId: s.id, storeName: s.name, isCompany: s.isCompany, ...agg };
    }));

    const totals = perStore.reduce((t, s) => ({
      revenue:       t.revenue + s.revenue,
      goodsCost:     t.goodsCost + s.goodsCost,
      staffCost:     t.staffCost + s.staffCost,
      operatingCost: t.operatingCost + s.operatingCost,
      totalCost:     t.totalCost + s.totalCost,
      profit:        t.profit + s.profit,
    }), { revenue: 0, goodsCost: 0, staffCost: 0, operatingCost: 0, totalCost: 0, profit: 0 });

    res.json({
      success: true,
      data: {
        from: { month: fromM, year: fromY },
        to:   { month: toM, year: toY },
        monthsCount: months.length,
        stores: perStore,
        totals,
      },
    });
  } catch (err) {
    console.error("[GET /admin/store-expenses/consolidated]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/store-expenses/receivables?month=&year=
// Công nợ & đối chiếu thanh toán:
//  - receivables: TỔNG đơn chưa thu tiền (payment_status=unpaid, chưa hủy) — số dư hiện tại
//  - reconciliation: đối chiếu THU trong tháng — tiền mặt (cash/cod) vs chuyển khoản (bank)
//  - supplierImports: nhập hàng NCC (PO confirmed) trong tháng — chỉ THÔNG TIN
//    (hệ thống CHƯA theo dõi "đã trả tiền NCC" nên không tính được phải-trả thực).
// ─────────────────────────────────────────────────────────────────────────────
router.get("/receivables", verifyToken, requireAdmin, async (req, res) => {
  try {
    const month = parseInt(req.query.month || new Date().getMonth() + 1);
    const year  = parseInt(req.query.year  || new Date().getFullYear());
    const start = new Date(year, month - 1, 1);
    const end   = new Date(year, month, 0, 23, 59, 59);

    // ── Phải thu: đơn chưa thanh toán, chưa hủy (toàn thời gian = số dư hiện tại) ──
    const unpaidWhere = { payment_status: "unpaid", status: { not: "cancelled" } };
    const [arByStore, arByMethod, stores] = await Promise.all([
      prisma.order.groupBy({ by: ["store_id"], where: unpaidWhere, _sum: { total: true }, _count: { id: true } }),
      prisma.order.groupBy({ by: ["payment_method"], where: unpaidWhere, _sum: { total: true }, _count: { id: true } }),
      prisma.store.findMany({ select: { id: true, name: true } }),
    ]);
    const storeName = Object.fromEntries(stores.map((s) => [s.id, s.name]));
    const receivables = {
      total: arByStore.reduce((s, g) => s + (g._sum.total || 0), 0),
      count: arByStore.reduce((s, g) => s + g._count.id, 0),
      byStore: arByStore
        .map((g) => ({ storeId: g.store_id, storeName: storeName[g.store_id] || `#${g.store_id}`,
                       total: g._sum.total || 0, count: g._count.id }))
        .sort((a, b) => b.total - a.total),
      bank: arByMethod.filter((g) => g.payment_method === "bank").reduce((s, g) => s + (g._sum.total || 0), 0),
      cash: arByMethod.filter((g) => g.payment_method !== "bank").reduce((s, g) => s + (g._sum.total || 0), 0),
    };

    // ── Đối chiếu THU trong tháng (đơn đã thanh toán) ──
    const paidWhere = { payment_status: "paid", status: { not: "cancelled" }, created_at: { gte: start, lte: end } };
    const paidByMethod = await prisma.order.groupBy({
      by: ["payment_method"], where: paidWhere, _sum: { total: true }, _count: { id: true },
    });
    const pick = (isBank) => paidByMethod
      .filter((g) => (g.payment_method === "bank") === isBank)
      .reduce((acc, g) => ({ total: acc.total + (g._sum.total || 0), count: acc.count + g._count.id }), { total: 0, count: 0 });
    const reconciliation = { bank: pick(true), cash: pick(false) };
    reconciliation.total = reconciliation.bank.total + reconciliation.cash.total;

    // ── Nhập hàng NCC trong tháng (thông tin) ──
    const poAgg = await prisma.purchaseOrder.aggregate({
      where: { status: "confirmed", confirmed_at: { gte: start, lte: end } },
      _sum: { total_cost: true }, _count: { id: true },
    });
    const supplierImports = { total: poAgg._sum.total_cost || 0, count: poAgg._count.id };

    res.json({ success: true, data: { month, year, receivables, reconciliation, supplierImports } });
  } catch (err) {
    console.error("[GET /admin/store-expenses/receivables]", err);
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
    if (req.user.role === "manager" && req.user.store_id !== parseInt(storeId)) {
      return res.status(403).json({ error: "Chỉ được nhập chi phí cho chi nhánh của mình." });
    }
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
