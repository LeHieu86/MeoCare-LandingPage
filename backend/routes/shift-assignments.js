/**
 * /api/shift-assignments
 * Phân ca & Đăng ký ca
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

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/shift-assignments — Admin/Manager phân ca cho nhân viên
// ─────────────────────────────────────────────────────────────────────────────
router.post("/", verifyToken, requireManager, async (req, res) => {
  try {
    const { shiftId, employeeId, date, note } = req.body;
    if (!shiftId || !employeeId || !date) {
      return res.status(400).json({ error: "Thiếu shiftId, employeeId hoặc date." });
    }

    // Kiểm tra ca có còn chỗ không
    const shift = await prisma.shift.findUnique({ where: { id: parseInt(shiftId) } });
    if (!shift) return res.status(404).json({ error: "Ca làm không tồn tại." });

    const dateObj = new Date(date);
    dateObj.setHours(0, 0, 0, 0);

    const existing = await prisma.shiftAssignment.count({
      where: { shiftId: parseInt(shiftId), date: dateObj },
    });
    if (existing >= shift.maxSlots) {
      return res.status(400).json({ error: `Ca "${shift.name}" đã đủ ${shift.maxSlots} chỗ cho ngày này.` });
    }

    const assignment = await prisma.shiftAssignment.create({
      data: {
        shiftId:     parseInt(shiftId),
        employeeId:  parseInt(employeeId),
        date:        dateObj,
        registeredBy: "manager",
        createdById: req.user.id,
        note,
      },
      include: {
        shift:    true,
        employee: { include: { user: { select: { fullName: true } } } },
      },
    });
    res.status(201).json(assignment);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Nhân viên đã được phân vào ca này ngày này rồi." });
    }
    console.error("[POST /shift-assignments]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/shift-assignments/register — Nhân viên tự đăng ký ca
// ─────────────────────────────────────────────────────────────────────────────
router.post("/register", verifyToken, async (req, res) => {
  try {
    if (!["employee", "manager"].includes(req.user.role)) {
      return res.status(403).json({ error: "Chỉ nhân viên mới có thể đăng ký ca." });
    }

    const { shiftId, date, note } = req.body;
    if (!shiftId || !date) {
      return res.status(400).json({ error: "Thiếu shiftId hoặc date." });
    }

    // Tìm employee record của user đang đăng nhập
    const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });
    if (!employee) return res.status(404).json({ error: "Không tìm thấy hồ sơ nhân viên." });
    if (employee.status !== "active") return res.status(400).json({ error: "Nhân viên không còn hoạt động." });

    const shift = await prisma.shift.findUnique({ where: { id: parseInt(shiftId) } });
    if (!shift) return res.status(404).json({ error: "Ca làm không tồn tại." });

    const dateObj = new Date(date);
    dateObj.setHours(0, 0, 0, 0);

    const existing = await prisma.shiftAssignment.count({
      where: { shiftId: parseInt(shiftId), date: dateObj },
    });
    if (existing >= shift.maxSlots) {
      return res.status(400).json({ error: `Ca "${shift.name}" đã đủ chỗ.` });
    }

    const assignment = await prisma.shiftAssignment.create({
      data: {
        shiftId:      parseInt(shiftId),
        employeeId:   employee.id,
        date:         dateObj,
        registeredBy: "employee",
        createdById:  req.user.id,
        note,
      },
      include: { shift: true },
    });
    res.status(201).json(assignment);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Bạn đã đăng ký ca này ngày này rồi." });
    }
    console.error("[POST /shift-assignments/register]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/shift-assignments/my — Nhân viên xem ca của mình
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

    const assignments = await prisma.shiftAssignment.findMany({
      where,
      include: {
        shift: true,
        attendance: { select: { checkIn: true, checkOut: true, status: true, workHours: true } },
      },
      orderBy: { date: "asc" },
    });
    res.json(assignments);
  } catch (err) {
    console.error("[GET /shift-assignments/my]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/shift-assignments/:id — Cập nhật trạng thái ca (manager)
// ─────────────────────────────────────────────────────────────────────────────
router.put("/:id", verifyToken, requireManager, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status, note } = req.body;
    const updated = await prisma.shiftAssignment.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(note   !== undefined && { note }),
      },
    });
    res.json(updated);
  } catch (err) {
    console.error("[PUT /shift-assignments/:id]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/shift-assignments/:id — Xóa phân ca
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // Nhân viên chỉ được hủy ca mình đăng ký, và chỉ trước ngày đó
    if (!["admin", "manager"].includes(req.user.role)) {
      const assignment = await prisma.shiftAssignment.findUnique({
        where: { id },
        include: { employee: true },
      });
      if (!assignment) return res.status(404).json({ error: "Không tìm thấy phân ca." });
      if (assignment.employee.userId !== req.user.id) {
        return res.status(403).json({ error: "Bạn không thể hủy ca của người khác." });
      }
      const now = new Date();
      if (assignment.date <= now) {
        return res.status(400).json({ error: "Không thể hủy ca đã qua ngày làm việc." });
      }
    }

    await prisma.shiftAssignment.delete({ where: { id } });
    res.json({ message: "Đã hủy phân ca." });
  } catch (err) {
    console.error("[DELETE /shift-assignments/:id]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

module.exports = router;
