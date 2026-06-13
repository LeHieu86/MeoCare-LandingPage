/**
 * /api/admin/finance-reports
 * Báo cáo tháng gửi KẾ TOÁN duyệt. Kế toán = trạm duyệt/thanh khoản.
 *  - Chi nhánh (manager)      gửi báo cáo CHI PHÍ VẬN HÀNH  (type=expense, store_id=chi nhánh)
 *  - HR (hr-manager)          gửi báo cáo LƯƠNG             (type=salary,  store_id=null toàn cty)
 *  - Kho (stock-manager)      gửi báo cáo NHẬP HÀNG         (type=purchase, store_id=kho)
 * Duyệt KHÔNG chặn số liệu P&L — chỉ là lớp kiểm soát chi tiền + ký xác nhận.
 * Riêng type=salary: duyệt = THANH TOÁN (SalaryRecord confirmed → paid).
 */
const express = require("express");
const prisma  = require("../lib/prisma");
const { verifyToken } = require("../middleware/auth");
const { getIO } = require("../socket");

const router = express.Router();

const TYPES = ["expense", "salary", "purchase"];
const FINANCE_ROLES = ["admin", "accountant"];
const TYPE_LABEL = { expense: "Chi phí vận hành", salary: "Lương nhân viên", purchase: "Nhập hàng" };

// Phòng socket của NGUỒN gửi (để báo kết quả duyệt về đúng nơi)
function sourceRoom(report) {
  if (report.type === "expense")  return `store-${report.store_id}`;  // manager chi nhánh
  if (report.type === "salary")   return "hr-room";
  if (report.type === "purchase") return "stock-room";
  return null;
}
function emitTo(rooms, event, payload) {
  const io = getIO();
  if (!io) return;
  for (const r of rooms) if (r) io.to(r).emit(event, { event, ...payload });
}

const requireFinance = (req, res, next) =>
  FINANCE_ROLES.includes(req.user?.role)
    ? next()
    : res.status(403).json({ error: "Chỉ admin/kế toán mới duyệt báo cáo." });

// Ai được GỬI báo cáo loại nào
function canSubmit(type, user, storeId) {
  if (user.role === "admin") return true;
  if (type === "expense")  return user.role === "manager" && user.store_id === storeId;
  if (type === "salary")   return user.role === "hr-manager";
  if (type === "purchase") return user.role === "stock-manager";
  return false;
}

// Tổng tiền + số khoản (snapshot lúc gửi) theo từng nguồn
async function computeTotals(type, storeId, month, year) {
  if (type === "expense") {
    const a = await prisma.storeExpense.aggregate({
      where: { store_id: storeId, month, year }, _sum: { amount: true }, _count: { id: true },
    });
    return { total: a._sum.amount || 0, count: a._count.id };
  }
  if (type === "salary") {
    const a = await prisma.salaryRecord.aggregate({
      where: { month, year, status: { in: ["confirmed", "paid"] } },
      _sum: { netSalary: true }, _count: { id: true },
    });
    return { total: a._sum.netSalary || 0, count: a._count.id };
  }
  if (type === "purchase") {
    const start = new Date(year, month - 1, 1), end = new Date(year, month, 0, 23, 59, 59);
    const a = await prisma.purchaseOrder.aggregate({
      where: { store_id: storeId, status: "confirmed", confirmed_at: { gte: start, lte: end } },
      _sum: { total_cost: true }, _count: { id: true },
    });
    return { total: a._sum.total_cost || 0, count: a._count.id };
  }
  return { total: 0, count: 0 };
}

// Báo cáo hiện có cho (type, store_id, month, year) — store_id null cho salary
const findReport = (type, storeId, month, year) =>
  prisma.financeReport.findFirst({
    where: { type, store_id: storeId ?? null, month, year },
    orderBy: { id: "desc" },
  });

// ─── POST /submit — nguồn gửi báo cáo tháng cho kế toán ───────────────────────
router.post("/submit", verifyToken, async (req, res) => {
  try {
    const { type, month, year, note } = req.body;
    const storeId = type === "salary" ? null : (req.body.store_id ?? req.body.storeId ?? null);
    if (!TYPES.includes(type)) return res.status(400).json({ error: "Loại báo cáo không hợp lệ." });
    if (!month || !year)       return res.status(400).json({ error: "Thiếu tháng/năm." });
    if (type !== "salary" && !storeId)
      return res.status(400).json({ error: "Thiếu chi nhánh/kho." });
    if (!canSubmit(type, req.user, storeId))
      return res.status(403).json({ error: "Bạn không có quyền gửi báo cáo này." });

    const existing = await findReport(type, storeId, parseInt(month), parseInt(year));
    if (existing && existing.status === "approved")
      return res.status(400).json({ error: "Báo cáo tháng này đã được kế toán duyệt." });

    const { total, count } = await computeTotals(type, storeId, parseInt(month), parseInt(year));
    const data = {
      type, store_id: storeId, month: parseInt(month), year: parseInt(year),
      status: "submitted", total_amount: total, item_count: count,
      note: note?.trim() || null,
      submitted_by: req.user.id, submitted_at: new Date(),
      reviewed_by: null, reviewed_at: null,
    };

    const report = existing
      ? await prisma.financeReport.update({ where: { id: existing.id }, data })
      : await prisma.financeReport.create({ data });

    // Realtime → báo kế toán có báo cáo mới chờ duyệt
    let scope = "Toàn công ty";
    if (storeId) {
      const s = await prisma.store.findUnique({ where: { id: storeId }, select: { name: true } });
      scope = s?.name || `Chi nhánh #${storeId}`;
    }
    emitTo(["accountant-room"], "finance:report_submitted", {
      reportId: report.id, type, scope, month: report.month, year: report.year, total,
      title: "🧾 Báo cáo chờ duyệt",
      body: `${TYPE_LABEL[type]} · ${scope} · T${report.month}/${report.year}`,
    });

    res.json({ success: true, data: report });
  } catch (err) {
    console.error("[POST /admin/finance-reports/submit]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─── GET /status?type=&storeId=&month=&year= — nguồn xem trạng thái báo cáo ───
router.get("/status", verifyToken, async (req, res) => {
  try {
    const { type, month, year } = req.query;
    const storeId = type === "salary" ? null : (req.query.storeId ? parseInt(req.query.storeId) : null);
    if (!TYPES.includes(type) || !month || !year)
      return res.status(400).json({ error: "Thiếu tham số." });
    const report = await findReport(type, storeId, parseInt(month), parseInt(year));
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET / ?status=&type= — KẾ TOÁN: danh sách báo cáo cần duyệt / lịch sử ────
router.get("/", verifyToken, requireFinance, async (req, res) => {
  try {
    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.type)   where.type   = req.query.type;
    const reports = await prisma.financeReport.findMany({
      where,
      include: { store: { select: { id: true, name: true } } },
      orderBy: [{ submitted_at: "desc" }],
    });
    res.json({ success: true, data: reports });
  } catch (err) {
    console.error("[GET /admin/finance-reports]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─── GET /:id — chi tiết báo cáo (kèm các khoản bên dưới) ─────────────────────
router.get("/:id", verifyToken, requireFinance, async (req, res) => {
  try {
    const report = await prisma.financeReport.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { store: { select: { id: true, name: true } } },
    });
    if (!report) return res.status(404).json({ error: "Không tìm thấy báo cáo." });

    let items = [];
    if (report.type === "expense") {
      items = await prisma.storeExpense.findMany({
        where: { store_id: report.store_id, month: report.month, year: report.year },
        select: { id: true, type: true, amount: true, note: true, receipt_url: true },
      });
    } else if (report.type === "salary") {
      items = await prisma.salaryRecord.findMany({
        where: { month: report.month, year: report.year, status: { in: ["confirmed", "paid"] } },
        select: { id: true, netSalary: true, status: true,
          employee: { select: { id: true, employeeCode: true, position: true } } },
      });
    } else if (report.type === "purchase") {
      const start = new Date(report.year, report.month - 1, 1);
      const end   = new Date(report.year, report.month, 0, 23, 59, 59);
      items = await prisma.purchaseOrder.findMany({
        where: { store_id: report.store_id, status: "confirmed", confirmed_at: { gte: start, lte: end } },
        select: { id: true, po_number: true, total_cost: true, confirmed_at: true },
      });
    }
    res.json({ success: true, data: { ...report, items } });
  } catch (err) {
    console.error("[GET /admin/finance-reports/:id]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─── POST /:id/approve — kế toán duyệt (salary: thanh toán luôn) ──────────────
router.post("/:id/approve", verifyToken, requireFinance, async (req, res) => {
  try {
    const report = await prisma.financeReport.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!report) return res.status(404).json({ error: "Không tìm thấy báo cáo." });
    if (report.status === "approved")
      return res.status(400).json({ error: "Báo cáo đã được duyệt." });

    // Lương: duyệt = thanh toán (confirmed → paid) cho tháng đó
    if (report.type === "salary") {
      await prisma.salaryRecord.updateMany({
        where: { month: report.month, year: report.year, status: "confirmed" },
        data:  { status: "paid", paidAt: new Date() },
      });
    }

    const updated = await prisma.financeReport.update({
      where: { id: report.id },
      data:  { status: "approved", reviewed_by: req.user.id, reviewed_at: new Date() },
    });

    // Realtime → báo nguồn gửi rằng đã được duyệt (lương: đã thanh toán)
    emitTo([sourceRoom(report)], "finance:report_approved", {
      reportId: report.id, type: report.type, month: report.month, year: report.year,
      title: report.type === "salary" ? "✅ Kế toán đã duyệt & thanh toán lương" : "✅ Kế toán đã duyệt báo cáo",
      body: `${TYPE_LABEL[report.type]} · T${report.month}/${report.year}`,
    });

    res.json({ success: true, data: updated,
      message: report.type === "salary" ? "Đã duyệt & thanh toán lương." : "Đã duyệt báo cáo." });
  } catch (err) {
    console.error("[POST /admin/finance-reports/:id/approve]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─── POST /:id/reject { note } — kế toán từ chối (kèm lý do) ──────────────────
router.post("/:id/reject", verifyToken, requireFinance, async (req, res) => {
  try {
    const report = await prisma.financeReport.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!report) return res.status(404).json({ error: "Không tìm thấy báo cáo." });
    if (report.status === "approved")
      return res.status(400).json({ error: "Báo cáo đã duyệt, không thể từ chối." });

    const note = (req.body?.note || "").trim() || null;
    const updated = await prisma.financeReport.update({
      where: { id: report.id },
      data: { status: "rejected", note, reviewed_by: req.user.id, reviewed_at: new Date() },
    });

    // Realtime → báo nguồn gửi bị từ chối (kèm lý do)
    emitTo([sourceRoom(report)], "finance:report_rejected", {
      reportId: report.id, type: report.type, month: report.month, year: report.year, note,
      title: "❌ Kế toán từ chối báo cáo",
      body: `${TYPE_LABEL[report.type]} · T${report.month}/${report.year}${note ? ` — ${note}` : ""}`,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error("[POST /admin/finance-reports/:id/reject]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

module.exports = router;
