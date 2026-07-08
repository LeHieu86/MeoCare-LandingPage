/**
 * /api/admin/investments
 * Vốn đầu tư ban đầu (CAPEX) theo chi nhánh + báo cáo ĐIỂM HOÀN VỐN.
 *
 * Mô hình: vốn đầu tư KHÔNG trừ vào lợi nhuận tháng. Thay vào đó lợi nhuận ròng
 * tích lũy (doanh thu - chi phí vận hành) "trả lại" dần số vốn — khi trả đủ = hoàn vốn
 * (phương pháp payback). Kèm thêm khấu hao/tháng để tham khảo theo chuẩn kế toán.
 */
const express = require("express");
const prisma  = require("../lib/prisma");
const { verifyToken } = require("../middleware/auth");
const { calcCumulativeProfit, calcMonthlyPnL } = require("../lib/storeFinance");

const router = express.Router();

// Tài chính = admin hoặc kế toán (accountant).
const FINANCE_ROLES = ["admin", "accountant"];
const requireFinance = (req, res, next) =>
  FINANCE_ROLES.includes(req.user?.role)
    ? next()
    : res.status(403).json({ error: "Chỉ admin/kế toán mới xem được vốn đầu tư & hoàn vốn." });

const CATEGORIES = ["room", "camera", "nas", "computer", "equipment", "furniture", "renovation", "other"];

// ─── GET /assets/all — SỔ TÀI SẢN CỐ ĐỊNH toàn công ty + khấu hao ────────────
// Gom CAPEX mọi chi nhánh, tính khấu hao theo đường thẳng (straight-line):
//   khấu hao/tháng = nguyên giá / tuổi thọ; đã khấu hao = khấu hao/tháng × số tháng
//   từ ngày mua (capped ở nguyên giá); giá trị còn lại = nguyên giá − đã khấu hao.
router.get("/assets/all", verifyToken, requireFinance, async (req, res) => {
  try {
    const items = await prisma.capitalInvestment.findMany({
      include: { store: { select: { id: true, name: true } } },
      orderBy: [{ store_id: "asc" }, { category: "asc" }, { id: "asc" }],
    });
    const now = new Date();
    const monthsSince = (d) =>
      Math.max(0, (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth()));

    let totalCost = 0, totalMonthlyDep = 0, totalAccumulated = 0;
    const assets = items.map((i) => {
      const cost = i.quantity * i.unit_price;
      const life = i.useful_life_months || 0;
      const monthlyDep = life > 0 ? Math.round(cost / life) : 0;
      const start = new Date(i.purchase_date || i.created_at);
      const elapsed = monthsSince(start);
      const accumulated = life > 0 ? Math.min(cost, monthlyDep * elapsed) : 0;
      totalCost += cost;
      totalMonthlyDep += monthlyDep;
      totalAccumulated += accumulated;
      return {
        id: i.id, store_id: i.store_id, storeName: i.store?.name || `#${i.store_id}`,
        category: i.category, name: i.name, quantity: i.quantity, unit_price: i.unit_price,
        useful_life_months: i.useful_life_months, purchase_date: i.purchase_date,
        cost, monthlyDep, monthsElapsed: elapsed, accumulatedDep: accumulated,
        bookValue: cost - accumulated,
      };
    });

    res.json({
      success: true,
      data: {
        assets,
        totalCost,
        totalMonthlyDep,
        totalAccumulated,
        totalBookValue: totalCost - totalAccumulated,
      },
    });
  } catch (err) {
    console.error("[GET /admin/investments/assets/all]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─── GET /:storeId — danh sách hạng mục đầu tư của 1 chi nhánh ────────────────
router.get("/:storeId", verifyToken, requireFinance, async (req, res) => {
  try {
    const storeId = parseInt(req.params.storeId, 10);
    const items = await prisma.capitalInvestment.findMany({
      where:   { store_id: storeId },
      orderBy: [{ category: "asc" }, { id: "asc" }],
    });
    res.json({ success: true, data: items });
  } catch (err) {
    console.error("[GET /admin/investments/:storeId]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─── GET /:storeId/detail — báo cáo vốn + hoàn vốn ───────────────────────────
router.get("/:storeId/detail", verifyToken, requireFinance, async (req, res) => {
  try {
    const storeId = parseInt(req.params.storeId, 10);
    const store = await prisma.store.findUnique({
      where:  { id: storeId },
      select: { id: true, name: true, openedAt: true, createdAt: true },
    });
    if (!store) return res.status(404).json({ error: "Không tìm thấy chi nhánh." });

    const investments = await prisma.capitalInvestment.findMany({
      where: { store_id: storeId },
      orderBy: [{ category: "asc" }, { id: "asc" }],
    });

    // Tổng vốn + khấu hao/tháng (chỉ hạng mục có khai báo tuổi thọ)
    const totalCapex = investments.reduce((s, i) => s + i.quantity * i.unit_price, 0);
    const depreciationPerMonth = Math.round(
      investments.reduce(
        (s, i) => (i.useful_life_months && i.useful_life_months > 0
          ? s + (i.quantity * i.unit_price) / i.useful_life_months
          : s),
        0,
      ),
    );

    // Mốc cộng dồn lợi nhuận: ngày khai trương > (fallback) ngày tạo chi nhánh
    const fromDate = store.openedAt || store.createdAt;
    const cum = await calcCumulativeProfit(storeId, fromDate);

    // P&L tháng hiện tại
    const now = new Date();
    const currentMonth = await calcMonthlyPnL(storeId, now.getMonth() + 1, now.getFullYear());

    // Chỉ số hoàn vốn (payback)
    const recoveredPct = totalCapex > 0
      ? Math.min(100, Math.max(0, (cum.cumulative / totalCapex) * 100))
      : null;
    const isRecovered = totalCapex > 0 && cum.cumulative >= totalCapex;
    const remaining   = Math.max(0, totalCapex - cum.cumulative);
    // Số tháng còn lại dự kiến — dựa trên lợi nhuận TB các tháng gần đây (>0 mới ước tính được)
    const monthsToRecover = (!isRecovered && totalCapex > 0 && cum.avgRecentProfit > 0)
      ? Math.ceil(remaining / cum.avgRecentProfit)
      : null;

    res.json({
      success: true,
      data: {
        store: { id: store.id, name: store.name, openedAt: store.openedAt },
        usedOpeningDate: !!store.openedAt,   // false = đang fallback ngày tạo (nên nhắc admin set)
        investments,
        totalCapex,
        depreciationPerMonth,
        // Hoàn vốn
        cumulativeProfit: cum.cumulative,
        monthsTracked:    cum.monthsTracked,
        avgMonthlyProfit: cum.avgMonthlyProfit,
        avgRecentProfit:  cum.avgRecentProfit,
        recoveredPct,
        isRecovered,
        remaining,
        monthsToRecover,
        // Tham khảo
        currentMonth,
        monthlyTrend: cum.monthly.slice(-12),   // 12 tháng gần nhất cho biểu đồ
      },
    });
  } catch (err) {
    console.error("[GET /admin/investments/:storeId/detail]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─── PATCH /:storeId/opening-date — đặt ngày khai trương (mốc tính hoàn vốn) ──
// Tách riêng để kế toán đặt được mà KHÔNG cần full quyền sửa chi nhánh.
router.patch("/:storeId/opening-date", verifyToken, requireFinance, async (req, res) => {
  try {
    const storeId = parseInt(req.params.storeId, 10);
    const { opened_at } = req.body;
    await prisma.store.update({
      where: { id: storeId },
      data:  { openedAt: opened_at ? new Date(opened_at) : null },
    });
    res.json({ success: true });
  } catch (err) {
    console.error("[PATCH /admin/investments/:storeId/opening-date]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─── POST /:storeId — thêm hạng mục đầu tư ───────────────────────────────────
router.post("/:storeId", verifyToken, requireFinance, async (req, res) => {
  try {
    const storeId = parseInt(req.params.storeId, 10);
    const { category, name, quantity, unit_price, useful_life_months, purchase_date, note, receipt_url } = req.body;

    if (!name?.trim())                return res.status(400).json({ error: "Thiếu tên hạng mục." });
    if (!CATEGORIES.includes(category)) return res.status(400).json({ error: "Loại đầu tư không hợp lệ." });
    if (unit_price === undefined || unit_price === null || isNaN(parseInt(unit_price)))
      return res.status(400).json({ error: "Đơn giá không hợp lệ." });

    const item = await prisma.capitalInvestment.create({
      data: {
        store_id:           storeId,
        category,
        name:               name.trim(),
        quantity:           Math.max(1, parseInt(quantity) || 1),
        unit_price:         parseInt(unit_price),
        useful_life_months: useful_life_months ? parseInt(useful_life_months) : null,
        purchase_date:      purchase_date ? new Date(purchase_date) : null,
        note:               note?.trim() || null,
        receipt_url:        receipt_url?.trim() || null,
      },
    });
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    console.error("[POST /admin/investments/:storeId]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─── PUT /item/:id — sửa hạng mục ────────────────────────────────────────────
router.put("/item/:id", verifyToken, requireFinance, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { category, name, quantity, unit_price, useful_life_months, purchase_date, note, receipt_url } = req.body;

    const data = {};
    if (category !== undefined) {
      if (!CATEGORIES.includes(category)) return res.status(400).json({ error: "Loại đầu tư không hợp lệ." });
      data.category = category;
    }
    if (name       !== undefined) data.name       = name.trim();
    if (quantity   !== undefined) data.quantity   = Math.max(1, parseInt(quantity) || 1);
    if (unit_price !== undefined) data.unit_price = parseInt(unit_price);
    if (useful_life_months !== undefined)
      data.useful_life_months = useful_life_months ? parseInt(useful_life_months) : null;
    if (purchase_date !== undefined) data.purchase_date = purchase_date ? new Date(purchase_date) : null;
    if (note        !== undefined) data.note        = note?.trim() || null;
    if (receipt_url !== undefined) data.receipt_url = receipt_url?.trim() || null;

    const item = await prisma.capitalInvestment.update({ where: { id }, data });
    res.json({ success: true, data: item });
  } catch (err) {
    console.error("[PUT /admin/investments/item/:id]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─── DELETE /item/:id ────────────────────────────────────────────────────────
router.delete("/item/:id", verifyToken, requireFinance, async (req, res) => {
  try {
    await prisma.capitalInvestment.delete({ where: { id: parseInt(req.params.id, 10) } });
    res.json({ success: true });
  } catch (err) {
    console.error("[DELETE /admin/investments/item/:id]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

module.exports = router;
