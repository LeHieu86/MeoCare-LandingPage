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
