/**
 * /api/shifts
 * Quản lý ca làm việc
 */
const express  = require("express");
const prisma   = require("../lib/prisma");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

const requireManager = (req, res, next) => {
  if (!["admin", "hr-manager", "manager"].includes(req.user?.role)) {
    return res.status(403).json({ error: "Không có quyền." });
  }
  next();
};

// ── GET /api/shifts ───────────────────────────────────────────
router.get("/", verifyToken, async (req, res) => {
  try {
    const shifts = await prisma.shift.findMany({
      where: req.query.active === "1" ? { isActive: true } : {},
      orderBy: { startTime: "asc" },
    });
    res.json(shifts);
  } catch (err) {
    console.error("[GET /shifts]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ── POST /api/shifts ──────────────────────────────────────────
router.post("/", verifyToken, requireManager, async (req, res) => {
  try {
    const { name, startTime, endTime, maxSlots, note,
            lunchBreakStart, lunchBreakEnd, lateGraceMinutes, earlyGraceMinutes } = req.body;
    if (!name || !startTime || !endTime) {
      return res.status(400).json({ error: "Vui lòng nhập tên ca, giờ bắt đầu và giờ kết thúc." });
    }
    const shift = await prisma.shift.create({
      data: {
        name, startTime, endTime,
        maxSlots:         parseInt(maxSlots) || 10,
        note,
        lunchBreakStart:  lunchBreakStart  || null,
        lunchBreakEnd:    lunchBreakEnd    || null,
        lateGraceMinutes:  lateGraceMinutes  !== undefined ? parseInt(lateGraceMinutes)  : 10,
        earlyGraceMinutes: earlyGraceMinutes !== undefined ? parseInt(earlyGraceMinutes) : 10,
      },
    });
    res.status(201).json(shift);
  } catch (err) {
    console.error("[POST /shifts]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ── PUT /api/shifts/:id ───────────────────────────────────────
router.put("/:id", verifyToken, requireManager, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, startTime, endTime, maxSlots, isActive, note,
            lunchBreakStart, lunchBreakEnd, lateGraceMinutes, earlyGraceMinutes } = req.body;
    const shift = await prisma.shift.update({
      where: { id },
      data: {
        ...(name             !== undefined && { name }),
        ...(startTime        !== undefined && { startTime }),
        ...(endTime          !== undefined && { endTime }),
        ...(maxSlots         !== undefined && { maxSlots: parseInt(maxSlots) }),
        ...(isActive         !== undefined && { isActive: Boolean(isActive) }),
        ...(note             !== undefined && { note }),
        ...(lunchBreakStart  !== undefined && { lunchBreakStart: lunchBreakStart || null }),
        ...(lunchBreakEnd    !== undefined && { lunchBreakEnd:   lunchBreakEnd   || null }),
        ...(lateGraceMinutes  !== undefined && { lateGraceMinutes:  parseInt(lateGraceMinutes)  }),
        ...(earlyGraceMinutes !== undefined && { earlyGraceMinutes: parseInt(earlyGraceMinutes) }),
      },
    });
    res.json(shift);
  } catch (err) {
    console.error("[PUT /shifts/:id]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ── DELETE /api/shifts/:id ────────────────────────────────────
router.delete("/:id", verifyToken, requireManager, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    // Soft delete — vô hiệu hóa thay vì xóa
    await prisma.shift.update({ where: { id }, data: { isActive: false } });
    res.json({ message: "Đã vô hiệu hóa ca làm." });
  } catch (err) {
    console.error("[DELETE /shifts/:id]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ── Hàm parse "YYYY-MM-DD" → UTC midnight (tránh lệch timezone) ──────────────
const parseLocalDate = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));          // UTC midnight, không phụ thuộc TZ server
};
const parseLocalDateEnd = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999)); // cuối ngày UTC
};

// ── GET /api/shifts/schedule?from=YYYY-MM-DD&to=YYYY-MM-DD ──
// Lịch phân ca kèm danh sách nhân viên được phân trong khoảng thời gian
router.get("/schedule", verifyToken, async (req, res) => {
  try {
    const { from, to } = req.query;
    const where = {};
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = parseLocalDate(from);
      if (to)   where.date.lte = parseLocalDateEnd(to);
    }

    const assignments = await prisma.shiftAssignment.findMany({
      where,
      include: {
        shift:    true,
        employee: { include: { user: { select: { fullName: true, avatar: true } } } },
        attendance: { select: { checkIn: true, checkOut: true, status: true, workHours: true } },
      },
      orderBy: [{ date: "asc" }, { shiftId: "asc" }],
    });
    res.json(assignments);
  } catch (err) {
    console.error("[GET /shifts/schedule]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

module.exports = router;
