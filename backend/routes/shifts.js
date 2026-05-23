/**
 * /api/shifts
 * Quản lý ca làm việc
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
    const { name, startTime, endTime, maxSlots, note } = req.body;
    if (!name || !startTime || !endTime) {
      return res.status(400).json({ error: "Vui lòng nhập tên ca, giờ bắt đầu và giờ kết thúc." });
    }
    const shift = await prisma.shift.create({
      data: { name, startTime, endTime, maxSlots: parseInt(maxSlots) || 10, note },
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
    const { name, startTime, endTime, maxSlots, isActive, note } = req.body;
    const shift = await prisma.shift.update({
      where: { id },
      data: {
        ...(name      !== undefined && { name }),
        ...(startTime !== undefined && { startTime }),
        ...(endTime   !== undefined && { endTime }),
        ...(maxSlots  !== undefined && { maxSlots: parseInt(maxSlots) }),
        ...(isActive  !== undefined && { isActive: Boolean(isActive) }),
        ...(note      !== undefined && { note }),
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

// ── GET /api/shifts/schedule?from=YYYY-MM-DD&to=YYYY-MM-DD ──
// Lịch phân ca kèm danh sách nhân viên được phân trong khoảng thời gian
router.get("/schedule", verifyToken, async (req, res) => {
  try {
    const { from, to } = req.query;
    const where = {};
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to)   where.date.lte = new Date(to + "T23:59:59");
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
