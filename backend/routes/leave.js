/**
 * /api/leave
 * Quản lý nghỉ phép
 */
const express  = require("express");
const prisma   = require("../lib/prisma");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

const LEAVE_TYPES = ["annual", "sick", "unpaid", "maternity", "other"];

const requireManager = (req, res, next) => {
  if (!["admin", "manager", "owner"].includes(req.user?.role)) {
    return res.status(403).json({ error: "Không có quyền." });
  }
  next();
};

// Tính số ngày nghỉ (không kể thứ 7, CN nếu muốn — ở đây tính tất cả ngày)
function calcDays(startDate, endDate) {
  const diff = (new Date(endDate) - new Date(startDate)) / 1000 / 3600 / 24;
  return Math.max(1, Math.round(diff) + 1);
}

// ── POST /api/leave — Nhân viên gửi đơn nghỉ phép ────────────
router.post("/", verifyToken, async (req, res) => {
  try {
    const { leaveType, startDate, endDate, reason } = req.body;
    if (!leaveType || !startDate || !endDate || !reason) {
      return res.status(400).json({ error: "Vui lòng nhập đầy đủ thông tin đơn nghỉ." });
    }
    if (!LEAVE_TYPES.includes(leaveType)) {
      return res.status(400).json({ error: "Loại nghỉ phép không hợp lệ." });
    }

    const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });
    if (!employee) return res.status(404).json({ error: "Không tìm thấy hồ sơ nhân viên." });

    const totalDays = calcDays(startDate, endDate);

    const leave = await prisma.leaveRequest.create({
      data: {
        employeeId: employee.id,
        leaveType,
        startDate:  new Date(startDate),
        endDate:    new Date(endDate),
        totalDays,
        reason,
      },
      include: {
        employee: { include: { user: { select: { fullName: true } } } },
      },
    });
    res.status(201).json(leave);
  } catch (err) {
    console.error("[POST /leave]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ── GET /api/leave/my — Nhân viên xem đơn của mình ──────────
router.get("/my", verifyToken, async (req, res) => {
  try {
    const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });
    if (!employee) return res.status(404).json({ error: "Không tìm thấy hồ sơ nhân viên." });

    const leaves = await prisma.leaveRequest.findMany({
      where: { employeeId: employee.id },
      orderBy: { createdAt: "desc" },
    });
    res.json(leaves);
  } catch (err) {
    console.error("[GET /leave/my]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ── GET /api/leave — Admin/Manager xem tất cả đơn ───────────
router.get("/", verifyToken, requireManager, async (req, res) => {
  try {
    const { status, employeeId } = req.query;
    const where = {};
    if (status)     where.status = status;
    if (employeeId) where.employeeId = parseInt(employeeId);

    const leaves = await prisma.leaveRequest.findMany({
      where,
      include: {
        employee: { include: { user: { select: { fullName: true, avatar: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(leaves);
  } catch (err) {
    console.error("[GET /leave]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ── PUT /api/leave/:id/approve — Duyệt đơn nghỉ ─────────────
router.put("/:id/approve", verifyToken, requireManager, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const leave = await prisma.leaveRequest.findUnique({ where: { id } });
    if (!leave) return res.status(404).json({ error: "Không tìm thấy đơn nghỉ." });
    if (leave.status !== "pending") return res.status(400).json({ error: "Đơn đã được xử lý rồi." });

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: { status: "approved", approvedById: req.user.id, approvedAt: new Date() },
    });

    // Tạo bản ghi attendance "on_leave" cho những ngày nghỉ
    const employee = await prisma.employee.findUnique({ where: { id: leave.employeeId } });
    const dates = [];
    const cur = new Date(leave.startDate);
    const end = new Date(leave.endDate);
    while (cur <= end) {
      dates.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    // Bulk upsert attendance records
    for (const d of dates) {
      const dayStart = new Date(d);
      dayStart.setHours(0, 0, 0, 0);
      await prisma.attendance.upsert({
        where: {
          // Nếu không có unique index riêng, tìm bản ghi tồn tại
          // Dùng findFirst + update/create
          id: (await prisma.attendance.findFirst({
            where: { employeeId: employee.id, date: dayStart },
          }))?.id ?? -1,
        },
        update: { status: "on_leave", note: `Nghỉ phép: ${leave.reason}` },
        create: {
          employeeId: employee.id,
          date:       dayStart,
          status:     "on_leave",
          note:       `Nghỉ phép: ${leave.reason}`,
        },
      });
    }

    res.json(updated);
  } catch (err) {
    console.error("[PUT /leave/:id/approve]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ── PUT /api/leave/:id/reject — Từ chối đơn nghỉ ────────────
router.put("/:id/reject", verifyToken, requireManager, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { rejectReason } = req.body;

    const leave = await prisma.leaveRequest.findUnique({ where: { id } });
    if (!leave) return res.status(404).json({ error: "Không tìm thấy đơn nghỉ." });
    if (leave.status !== "pending") return res.status(400).json({ error: "Đơn đã được xử lý rồi." });

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: { status: "rejected", approvedById: req.user.id, approvedAt: new Date(), rejectReason },
    });
    res.json(updated);
  } catch (err) {
    console.error("[PUT /leave/:id/reject]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ── DELETE /api/leave/:id — Nhân viên hủy đơn (chỉ khi pending) ─
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { employee: true },
    });
    if (!leave) return res.status(404).json({ error: "Không tìm thấy đơn nghỉ." });

    // Chỉ được hủy đơn của mình, khi status = pending
    if (!["admin","manager","owner"].includes(req.user.role) && leave.employee.userId !== req.user.id) {
      return res.status(403).json({ error: "Bạn không thể hủy đơn của người khác." });
    }
    if (leave.status !== "pending") {
      return res.status(400).json({ error: "Chỉ có thể hủy đơn đang chờ duyệt." });
    }

    await prisma.leaveRequest.delete({ where: { id } });
    res.json({ message: "Đã hủy đơn nghỉ." });
  } catch (err) {
    console.error("[DELETE /leave/:id]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

module.exports = router;
