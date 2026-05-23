/**
 * /api/attendance
 * Chấm công (check-in / check-out)
 */
const express  = require("express");
const prisma   = require("../lib/prisma");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

const requireManager = (req, res, next) => {
  if (!["admin", "manager"].includes(req.user?.role)) {
    return res.status(403).json({ error: "Không có quyền." });
  }
  next();
};

// Tính workHours từ checkIn → checkOut
function calcWorkHours(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const diff = (new Date(checkOut) - new Date(checkIn)) / 1000 / 3600;
  return Math.round(diff * 100) / 100;
}

// Tính overtime (số giờ > 8h/ca)
function calcOvertime(workHours) {
  return Math.max(0, Math.round((workHours - 8) * 100) / 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/attendance/check-in — Nhân viên tự check-in
// ─────────────────────────────────────────────────────────────────────────────
router.post("/check-in", verifyToken, async (req, res) => {
  try {
    const { shiftAssignmentId, note } = req.body;

    // Tìm employee của user
    const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });
    if (!employee) return res.status(404).json({ error: "Không tìm thấy hồ sơ nhân viên." });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Kiểm tra đã check-in hôm nay chưa
    const existing = await prisma.attendance.findFirst({
      where: {
        employeeId: employee.id,
        date: today,
        ...(shiftAssignmentId ? { shiftAssignmentId: parseInt(shiftAssignmentId) } : {}),
      },
    });
    if (existing) return res.status(409).json({ error: "Bạn đã check-in rồi." });

    const attendance = await prisma.attendance.create({
      data: {
        employeeId: employee.id,
        shiftAssignmentId: shiftAssignmentId ? parseInt(shiftAssignmentId) : null,
        date:      today,
        checkIn:   new Date(),
        status:    "present",
        note,
      },
    });
    res.status(201).json(attendance);
  } catch (err) {
    console.error("[POST /attendance/check-in]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/attendance/check-out — Nhân viên tự check-out
// ─────────────────────────────────────────────────────────────────────────────
router.post("/check-out", verifyToken, async (req, res) => {
  try {
    const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });
    if (!employee) return res.status(404).json({ error: "Không tìm thấy hồ sơ nhân viên." });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await prisma.attendance.findFirst({
      where: { employeeId: employee.id, date: today, checkOut: null },
      orderBy: { createdAt: "desc" },
    });
    if (!attendance) return res.status(404).json({ error: "Chưa check-in hoặc đã check-out rồi." });

    const checkOut   = new Date();
    const workHours  = calcWorkHours(attendance.checkIn, checkOut);
    const overtime   = calcOvertime(workHours);

    const updated = await prisma.attendance.update({
      where: { id: attendance.id },
      data: { checkOut, workHours, overtimeHours: overtime },
    });

    // Cập nhật status ca làm
    if (attendance.shiftAssignmentId) {
      await prisma.shiftAssignment.update({
        where: { id: attendance.shiftAssignmentId },
        data:  { status: "completed" },
      });
    }

    res.json(updated);
  } catch (err) {
    console.error("[POST /attendance/check-out]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/attendance/today — Nhân viên xem trạng thái hôm nay
// ─────────────────────────────────────────────────────────────────────────────
router.get("/today", verifyToken, async (req, res) => {
  try {
    const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });
    if (!employee) return res.status(404).json({ error: "Không tìm thấy hồ sơ nhân viên." });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const att = await prisma.attendance.findFirst({
      where: { employeeId: employee.id, date: today },
      orderBy: { createdAt: "desc" },
    });
    res.json(att || null);
  } catch (err) {
    console.error("[GET /attendance/today]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/attendance/my — Lịch sử chấm công của nhân viên
// ─────────────────────────────────────────────────────────────────────────────
router.get("/my", verifyToken, async (req, res) => {
  try {
    const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });
    if (!employee) return res.status(404).json({ error: "Không tìm thấy hồ sơ nhân viên." });

    const { from, to } = req.query;
    const where = { employeeId: employee.id };
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to)   where.date.lte = new Date(to + "T23:59:59");
    }

    const records = await prisma.attendance.findMany({
      where,
      include: { shiftAssignment: { include: { shift: true } } },
      orderBy: { date: "desc" },
    });
    res.json(records);
  } catch (err) {
    console.error("[GET /attendance/my]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/attendance — Admin/Manager xem tất cả chấm công
// ─────────────────────────────────────────────────────────────────────────────
router.get("/", verifyToken, requireManager, async (req, res) => {
  try {
    const { from, to, employeeId } = req.query;
    const where = {};
    if (employeeId) where.employeeId = parseInt(employeeId);
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to)   where.date.lte = new Date(to + "T23:59:59");
    }

    const records = await prisma.attendance.findMany({
      where,
      include: {
        employee: { include: { user: { select: { fullName: true, avatar: true } } } },
        shiftAssignment: { include: { shift: true } },
      },
      orderBy: [{ date: "desc" }, { employeeId: "asc" }],
    });
    res.json(records);
  } catch (err) {
    console.error("[GET /attendance]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/attendance/:id — Admin chỉnh sửa thủ công
// ─────────────────────────────────────────────────────────────────────────────
router.put("/:id", verifyToken, requireManager, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { checkIn, checkOut, status, note } = req.body;

    const checkInDt  = checkIn  ? new Date(checkIn)  : undefined;
    const checkOutDt = checkOut ? new Date(checkOut) : undefined;

    const current = await prisma.attendance.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ error: "Không tìm thấy bản ghi chấm công." });

    const resolvedIn  = checkInDt  || current.checkIn;
    const resolvedOut = checkOutDt || current.checkOut;
    const workHours   = calcWorkHours(resolvedIn, resolvedOut);
    const overtime    = calcOvertime(workHours);

    const updated = await prisma.attendance.update({
      where: { id },
      data: {
        ...(checkInDt  !== undefined && { checkIn: checkInDt }),
        ...(checkOutDt !== undefined && { checkOut: checkOutDt }),
        ...(status !== undefined && { status }),
        ...(note   !== undefined && { note }),
        workHours,
        overtimeHours: overtime,
      },
    });
    res.json(updated);
  } catch (err) {
    console.error("[PUT /attendance/:id]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/attendance/manual — Admin nhập chấm công thủ công
// ─────────────────────────────────────────────────────────────────────────────
router.post("/manual", verifyToken, requireManager, async (req, res) => {
  try {
    const { employeeId, shiftAssignmentId, date, checkIn, checkOut, status, note } = req.body;
    if (!employeeId || !date) {
      return res.status(400).json({ error: "Thiếu employeeId hoặc date." });
    }

    const dateObj = new Date(date);
    dateObj.setHours(0, 0, 0, 0);

    const checkInDt  = checkIn  ? new Date(checkIn)  : null;
    const checkOutDt = checkOut ? new Date(checkOut) : null;
    const workHours  = calcWorkHours(checkInDt, checkOutDt);
    const overtime   = calcOvertime(workHours);

    const att = await prisma.attendance.create({
      data: {
        employeeId:       parseInt(employeeId),
        shiftAssignmentId: shiftAssignmentId ? parseInt(shiftAssignmentId) : null,
        date:              dateObj,
        checkIn:           checkInDt,
        checkOut:          checkOutDt,
        workHours,
        overtimeHours:     overtime,
        status:            status || "present",
        note,
      },
    });
    res.status(201).json(att);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Đã có bản ghi chấm công cho ca này." });
    }
    console.error("[POST /attendance/manual]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

module.exports = router;
