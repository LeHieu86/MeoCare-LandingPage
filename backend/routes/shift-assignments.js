/**
 * /api/shift-assignments
 * Phân ca & Đăng ký ca
 */
const express  = require("express");
const prisma   = require("../lib/prisma");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

// Parse "YYYY-MM-DD" → UTC midnight, tránh lệch timezone server
const parseLocalDate = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

// Chuyển Date object → "YYYY-MM-DD" (UTC)
const dateToISO = (d) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;

// Sinh mảng UTC-midnight dates cho khoảng [from, to] (cả 2 đầu đều inclusive)
const generateDateRange = (from, to) => {
  const dates = [];
  const cur = parseLocalDate(from);
  const end = parseLocalDate(to);
  while (cur <= end) {
    dates.push(new Date(cur));           // clone trước khi tăng
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
};

const requireManager = (req, res, next) => {
  if (!["admin", "manager", "owner"].includes(req.user?.role)) {
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

    const dateObj = parseLocalDate(date);

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

    const dateObj = parseLocalDate(date);

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
// POST /api/shift-assignments/batch
// Phân ca cho nhiều nhân viên, nhiều ngày cùng lúc
// Body: { shiftId, employeeIds[], dateFrom, dateTo, note }
//   dateFrom === dateTo  → phân 1 ngày (backward compat với date cũ)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/batch", verifyToken, requireManager, async (req, res) => {
  try {
    const { shiftId, employeeIds, dateFrom, dateTo, date, note } = req.body;

    // Backward compat: nếu chỉ truyền date (single-day cũ) thì coi như 1 ngày
    const from = dateFrom || date;
    const to   = dateTo   || date;

    if (!shiftId || !employeeIds?.length || !from) {
      return res.status(400).json({ error: "Thiếu shiftId, employeeIds hoặc dateFrom." });
    }
    if (from > to) {
      return res.status(400).json({ error: "Ngày bắt đầu không được sau ngày kết thúc." });
    }

    const dates = generateDateRange(from, to);
    if (dates.length > 31) {
      return res.status(400).json({ error: "Khoảng thời gian tối đa là 31 ngày." });
    }

    const shift = await prisma.shift.findUnique({ where: { id: parseInt(shiftId) } });
    if (!shift) return res.status(404).json({ error: "Ca làm không tồn tại." });

    // Fetch tất cả employee 1 lần — tránh query lặp lại trong loop
    const empRecords = await prisma.employee.findMany({
      where: { id: { in: employeeIds.map(Number) } },
      include: { user: { select: { fullName: true } } },
    });
    const empMap = Object.fromEntries(empRecords.map(e => [e.id, e]));

    const success = [];
    const failed  = [];

    for (const dateObj of dates) {
      const iso = dateToISO(dateObj);

      // Đếm chỗ đã dùng cho ngày này
      const usedSlots = await prisma.shiftAssignment.count({
        where: { shiftId: parseInt(shiftId), date: dateObj },
      });
      let availableSlots = shift.maxSlots - usedSlots;

      for (const empId of employeeIds) {
        const eid = parseInt(empId);
        const emp = empMap[eid];

        if (!emp) {
          failed.push({ date: iso, employeeId: eid, employeeName: `#${eid}`, reason: "Nhân viên không tồn tại" });
          continue;
        }
        if (emp.status !== "active") {
          failed.push({ date: iso, employeeId: eid, employeeName: emp.user?.fullName, reason: "Nhân viên không hoạt động" });
          continue;
        }
        if (availableSlots <= 0) {
          failed.push({ date: iso, employeeId: eid, employeeName: emp.user?.fullName, reason: `Ca đã đủ ${shift.maxSlots} chỗ` });
          continue;
        }

        try {
          const assignment = await prisma.shiftAssignment.create({
            data: {
              shiftId:      parseInt(shiftId),
              employeeId:   eid,
              date:         dateObj,
              registeredBy: "manager",
              createdById:  req.user.id,
              note,
            },
          });
          success.push({ date: iso, employeeId: eid, employeeName: emp.user?.fullName, assignmentId: assignment.id });
          availableSlots--;
        } catch (err) {
          const reason = err.code === "P2002" ? "Đã được phân ca rồi" : "Lỗi server";
          failed.push({ date: iso, employeeId: eid, employeeName: emp.user?.fullName || `#${eid}`, reason });
        }
      }
    }

    res.status(201).json({
      success,
      failed,
      total:          dates.length * employeeIds.length,
      totalDays:      dates.length,
      totalEmployees: employeeIds.length,
    });
  } catch (err) {
    console.error("[POST /shift-assignments/batch]", err);
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
    if (!["admin", "manager", "owner"].includes(req.user.role)) {
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
