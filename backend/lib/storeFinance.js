/**
 * lib/storeFinance.js
 * Helper tính tài chính 1 chi nhánh — DÙNG CHUNG cho store-expenses.js (báo cáo tháng)
 * và investments.js (điểm hoàn vốn). Gom về 1 chỗ để định nghĩa doanh thu/chi phí
 * KHÔNG bị lệch giữa các báo cáo.
 */
const prisma = require("./prisma");

// ─── Chi phí nhân sự cho 1 store trong tháng ─────────────────────────────────
async function calcStaffCost(storeId, month, year) {
  const employees = await prisma.employee.findMany({
    where: { store_id: storeId, status: "active" },
    select: { id: true, baseSalary: true, salaryType: true, employmentType: true },
  });

  let confirmed = 0;
  let estimated = 0;

  for (const emp of employees) {
    // Ưu tiên SalaryRecord đã confirmed/paid
    const record = await prisma.salaryRecord.findFirst({
      where: { employeeId: emp.id, month, year, status: { in: ["confirmed", "paid"] } },
      select: { netSalary: true },
    });

    if (record) {
      confirmed += record.netSalary;
    } else if (emp.employmentType === "full-time") {
      estimated += emp.baseSalary;
    } else {
      // Part-time: tính theo số ca thực tế trong tháng
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth   = new Date(year, month, 0, 23, 59, 59);
      const shiftCount = await prisma.shiftAssignment.count({
        where: {
          employeeId: emp.id,
          date: { gte: startOfMonth, lte: endOfMonth },
          status: { in: ["scheduled", "completed"] },
        },
      });
      if (shiftCount > 0) {
        const perShift = emp.salaryType === "hourly"
          ? emp.baseSalary * 8
          : Math.round(emp.baseSalary / 26 / 3);
        estimated += shiftCount * perShift;
      } else {
        estimated += emp.baseSalary;
      }
    }
  }

  return { total: confirmed + estimated, confirmed, estimated, isEstimate: estimated > 0 };
}

// ─── Giá vốn hàng hóa nhận từ kho cho 1 chi nhánh trong tháng ─────────────────
async function calcGoodsCost(storeId, month, year) {
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth   = new Date(year, month, 0, 23, 59, 59);

  const stockRequests = await prisma.stockRequest.findMany({
    where: { from_store_id: storeId, status: "delivered", delivered_at: { gte: startOfMonth, lte: endOfMonth } },
    include: { items: { include: { inventoryItem: { select: { average_cost: true } } } } },
  });

  let total = 0;
  for (const req of stockRequests) {
    for (const item of req.items) {
      const qty = item.fulfilled_qty > 0 ? item.fulfilled_qty : item.quantity;
      total += qty * (item.inventoryItem?.average_cost || 0);
    }
  }
  return total;
}

// ─── Doanh thu cho 1 chi nhánh trong tháng (sản phẩm + dịch vụ) ───────────────
async function calcRevenue(storeId, month, year) {
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth   = new Date(year, month, 0, 23, 59, 59);

  const orders = await prisma.order.findMany({
    where: { store_id: storeId, status: "delivered", created_at: { gte: startOfMonth, lte: endOfMonth } },
    select: { total: true },
  });
  const productRevenue = orders.reduce((s, o) => s + (o.total || 0), 0);

  // FIX: booking hoàn tất là status "completed" (không phải "confirmed" — status đó không tồn tại
  // cho Booking; vòng đời là pending → active → completed). Trước đây lọc sai ⇒ serviceRevenue luôn = 0.
  const bookings = await prisma.booking.findMany({
    where: { store_id: storeId, status: "completed", total_price: { not: null }, created_at: { gte: startOfMonth, lte: endOfMonth } },
    select: { total_price: true },
  });
  const serviceRevenue = bookings.reduce((s, b) => s + (b.total_price || 0), 0);

  return { total: productRevenue + serviceRevenue, productRevenue, serviceRevenue };
}

// ─── P&L 1 chi nhánh trong 1 tháng (gộp đủ doanh thu - chi phí) ───────────────
async function calcMonthlyPnL(storeId, month, year) {
  const [revenue, goodsCost, staffCost, expenseAgg] = await Promise.all([
    calcRevenue(storeId, month, year),
    calcGoodsCost(storeId, month, year),
    calcStaffCost(storeId, month, year),
    prisma.storeExpense.aggregate({ where: { store_id: storeId, month, year }, _sum: { amount: true } }),
  ]);
  const operatingCost = expenseAgg._sum.amount || 0;
  const totalCost     = goodsCost + staffCost.total + operatingCost;
  return {
    month, year,
    revenue: revenue.total,
    productRevenue: revenue.productRevenue,
    serviceRevenue: revenue.serviceRevenue,
    goodsCost,
    staffCost: staffCost.total,
    staffIsEstimate: staffCost.isEstimate,
    operatingCost,
    totalCost,
    profit: revenue.total - totalCost,
  };
}

// ─── Lợi nhuận TÍCH LŨY từ ngày khai trương → nay (cộng dồn từng tháng) ───────
// Dùng cho điểm hoàn vốn. fromDate = ngày khai trương (Store.openedAt) hoặc fallback.
// Lặp theo tháng — bounded để không treo nếu fromDate quá xa.
async function calcCumulativeProfit(storeId, fromDate) {
  const now  = new Date();
  let y = fromDate.getFullYear();
  let m = fromDate.getMonth() + 1;            // 1–12
  const endY = now.getFullYear();
  const endM = now.getMonth() + 1;

  let cumulative = 0;
  const monthly  = [];
  let guard = 0;
  while ((y < endY || (y === endY && m <= endM)) && guard < 240) {
    const pnl = await calcMonthlyPnL(storeId, m, y);
    cumulative += pnl.profit;
    monthly.push({ month: m, year: y, profit: pnl.profit, revenue: pnl.revenue, totalCost: pnl.totalCost });
    m++; if (m > 12) { m = 1; y++; }
    guard++;
  }

  // Trung bình tháng gần đây (tối đa 6 tháng cuối) — để dự phóng số tháng còn lại,
  // tránh dùng cả những tháng đầu chưa có khách kéo TB xuống quá thấp.
  const recent = monthly.slice(-6);
  const avgRecentProfit = recent.length
    ? Math.round(recent.reduce((s, x) => s + x.profit, 0) / recent.length)
    : 0;
  const avgMonthlyProfit = monthly.length
    ? Math.round(cumulative / monthly.length)
    : 0;

  return { cumulative, monthsTracked: monthly.length, monthly, avgRecentProfit, avgMonthlyProfit };
}

module.exports = {
  calcStaffCost, calcGoodsCost, calcRevenue,
  calcMonthlyPnL, calcCumulativeProfit,
};
