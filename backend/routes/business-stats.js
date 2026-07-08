/**
 * /api/business-stats — Tổng quan số liệu kinh doanh theo khoảng ngày (Dashboard)
 *
 * GET / ?from=YYYY-MM-DD&to=YYYY-MM-DD
 *   verifyToken → storeContext → requireBranch (admin + manager)
 *
 * Phạm vi: theo store của manager (storeContext.storeId). Admin không chọn chi
 * nhánh → gộp tất cả chi nhánh phục vụ (trừ kho tổng).
 *
 * Định nghĩa số liệu:
 *   · Doanh thu đơn hàng  — Order.status="delivered", lọc theo created_at (chính xác ngày).
 *   · Doanh thu bán mèo   — CatSale.status="completed", lọc theo sold_at (sổ riêng).
 *   · Doanh thu dịch vụ   — Booking.status="completed" & total_price != null, theo created_at.
 *   · Chi phí vận hành/NS/giá vốn — tính theo THÁNG (StoreExpense + lương + hàng nhập kho).
 *     Vì chi phí lưu theo tháng nên cộng dồn các tháng GIAO với khoảng đã chọn →
 *     "lãi ròng" chỉ là ƯỚC TÍNH; chính xác nhất khi chọn trọn 1 hay nhiều tháng.
 *
 * Trả thêm `detail.orders` + `detail.catSales` để client xuất Excel gửi Kế toán.
 */
const express = require("express");
const prisma = require("../lib/prisma");
const { verifyToken } = require("../middleware/auth");
const { storeContext } = require("../middleware/storeContext");
const { requireBranch } = require("../middleware/requireRole");
const { storeWhere } = require("../lib/storeFilter");
const { calcGoodsCost, calcStaffCost } = require("../lib/storeFinance");

const router = express.Router();

const toDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

// Danh sách các tháng (1–12) giao với khoảng [from, to] — cap 36 để khỏi treo.
function monthsInRange(from, to) {
  const months = [];
  let y = from.getFullYear();
  let m = from.getMonth() + 1;
  const ey = to.getFullYear();
  const em = to.getMonth() + 1;
  let guard = 0;
  while ((y < ey || (y === ey && m <= em)) && guard < 36) {
    months.push({ month: m, year: y });
    m++;
    if (m > 12) { m = 1; y++; }
    guard++;
  }
  return months;
}

const sum = (arr, pick) => arr.reduce((s, x) => s + (pick(x) || 0), 0);

router.get("/", verifyToken, storeContext, requireBranch, async (req, res) => {
  try {
    // ── Khoảng ngày: mặc định tháng hiện tại ──────────────────────────────────
    const now = new Date();
    const from = toDate(req.query.from) || new Date(now.getFullYear(), now.getMonth(), 1);
    const to = toDate(req.query.to) || now;
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    if (from > to) {
      return res.status(400).json({ error: "Khoảng thời gian không hợp lệ." });
    }

    const sw = storeWhere(req);

    // ── 1) Đơn hàng đã giao trong kỳ (chính xác theo ngày) ────────────────────
    const orders = await prisma.order.findMany({
      where: { ...sw, status: "delivered", created_at: { gte: from, lte: to } },
      select: {
        id: true, invoice_no: true, total: true,
        payment_method: true, payment_status: true,
        created_at: true,
        customer: { select: { name: true, phone: true } },
        store: { select: { name: true } },
      },
      orderBy: { created_at: "desc" },
    });
    const orderRevenue = sum(orders, (o) => o.total);
    const orderBank = sum(orders.filter((o) => o.payment_method === "bank"), (o) => o.total);
    const orderCash = orderRevenue - orderBank;

    // ── 2) Bán mèo trong kỳ (sổ riêng, theo sold_at) ──────────────────────────
    const catSales = await prisma.catSale.findMany({
      where: { ...sw, status: "completed", sold_at: { gte: from, lte: to } },
      include: {
        cat: { select: { name: true, code: true, breed: true } },
        store: { select: { name: true } },
      },
      orderBy: { sold_at: "desc" },
    });
    const catRevenue = sum(catSales, (x) => x.price);
    const catCost = sum(catSales, (x) => x.cost);
    const catBank = sum(catSales.filter((x) => x.payment_method === "bank"), (x) => x.price);
    const catCash = catRevenue - catBank;

    // ── 3) Dịch vụ / booking hoàn thành trong kỳ ──────────────────────────────
    const bookings = await prisma.booking.findMany({
      where: { ...sw, status: "completed", total_price: { not: null }, created_at: { gte: from, lte: to } },
      select: { total_price: true },
    });
    const serviceRevenue = sum(bookings, (b) => b.total_price);
    const serviceCount = bookings.length;

    // ── 4) Chi phí theo THÁNG (cộng dồn tháng giao với khoảng) ────────────────
    const months = monthsInRange(from, to);
    let storeIds;
    if (req.storeId) {
      storeIds = [req.storeId];
    } else {
      const stores = await prisma.store.findMany({
        where: { isActive: true, isWarehouse: false },
        select: { id: true },
      });
      storeIds = stores.map((s) => s.id);
    }

    let operatingCost = 0;
    let staffCost = 0;
    let goodsCost = 0;
    let staffIsEstimate = false;
    for (const sid of storeIds) {
      for (const { month, year } of months) {
        const [g, s, eAgg] = await Promise.all([
          calcGoodsCost(sid, month, year),
          calcStaffCost(sid, month, year),
          prisma.storeExpense.aggregate({ where: { store_id: sid, month, year }, _sum: { amount: true } }),
        ]);
        goodsCost += g;
        staffCost += s.total;
        if (s.isEstimate) staffIsEstimate = true;
        operatingCost += eAgg._sum.amount || 0;
      }
    }

    // ── Tổng hợp ──────────────────────────────────────────────────────────────
    const totalRevenue = orderRevenue + serviceRevenue + catRevenue;
    const estimatedCost = catCost + goodsCost + staffCost + operatingCost;
    const estimatedProfit = totalRevenue - estimatedCost;

    // Tách TM/CK chỉ gồm nguồn có ghi nhận phương thức (đơn hàng + bán mèo).
    const cashRevenue = orderCash + catCash;
    const bankRevenue = orderBank + catBank;

    // Tên chi nhánh (khi lọc 1 store)
    let storeName = null;
    if (req.storeId) {
      const st = await prisma.store.findUnique({ where: { id: req.storeId }, select: { name: true } });
      storeName = st?.name || null;
    }

    res.json({
      success: true,
      period: { from, to },
      store: req.storeId ? { id: req.storeId, name: storeName } : null,
      summary: {
        totalRevenue,
        orderRevenue,
        orderCount: orders.length,
        serviceRevenue,
        serviceCount,
        catRevenue,
        catCost,
        catProfit: catRevenue - catCost,
        catCount: catSales.length,
        goodsCost,
        staffCost,
        operatingCost,
        estimatedCost,
        estimatedProfit,
        cashRevenue,
        bankRevenue,
        staffIsEstimate,
      },
      // Tháng dùng cho phần chi phí (để client ghi chú minh bạch khi xuất Excel)
      costMonths: months,
      detail: {
        orders: orders.map((o) => ({
          invoice_no: o.invoice_no,
          customer_name: o.customer?.name || "",
          customer_phone: o.customer?.phone || "",
          total: o.total || 0,
          payment_method: o.payment_method,
          payment_status: o.payment_status,
          store_name: o.store?.name || "",
          created_at: o.created_at,
        })),
        catSales: catSales.map((s) => ({
          code: s.code,
          cat_name: s.cat?.name || "",
          cat_code: s.cat?.code || "",
          breed: s.cat?.breed || "",
          buyer_name: s.buyer_name || "",
          buyer_phone: s.buyer_phone || "",
          price: s.price || 0,
          cost: s.cost || 0,
          profit: (s.price || 0) - (s.cost || 0),
          payment_method: s.payment_method,
          store_name: s.store?.name || "",
          sold_at: s.sold_at,
        })),
      },
    });
  } catch (err) {
    console.error("[GET /business-stats]", err);
    res.status(500).json({ error: "Không tải được số liệu kinh doanh." });
  }
});

module.exports = router;
