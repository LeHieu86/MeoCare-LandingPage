/**
 * /api/shift-assignments
 * Phân ca & Đăng ký ca
 */
const express  = require("express");
const prisma   = require("../lib/prisma");
const { verifyToken } = require("../middleware/auth");
const { storeContext } = require("../middleware/storeContext");
const { hrStoreWhere } = require("../lib/storeFilter");

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
  if (!["admin", "hr-manager", "manager"].includes(req.user?.role)) {
    return res.status(403).json({ error: "Không có quyền." });
  }
  next();
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/shift-assignments — Admin/Manager phân ca cho nhân viên
// ─────────────────────────────────────────────────────────────────────────────
router.post("/", verifyToken, requireManager, storeContext, async (req, res) => {
  try {
    const { shiftId, employeeId, date, note } = req.body;
    if (!shiftId || !employeeId || !date) {
      return res.status(400).json({ error: "Thiếu shiftId, employeeId hoặc date." });
    }

    // Kiểm tra ca có còn chỗ không
    const shift = await prisma.shift.findUnique({ where: { id: parseInt(shiftId) } });
    if (!shift) return res.status(404).json({ error: "Ca làm không tồn tại." });

    // Kiểm tra employee thuộc đúng store (chỉ áp dụng nếu đang lọc theo store)
    const storeFilter = hrStoreWhere(req);
    if (Object.keys(storeFilter).length > 0) {
      const emp = await prisma.employee.findUnique({ where: { id: parseInt(employeeId) } });
      if (!emp || emp.store_id !== req.storeId) {
        return res.status(403).json({ error: "Nhân viên này không thuộc chi nhánh của bạn." });
      }
    }

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
router.post("/batch", verifyToken, requireManager, storeContext, async (req, res) => {
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

    // Fetch tất cả employee 1 lần — lọc theo store nếu cần
    const empWhere = { id: { in: employeeIds.map(Number) } };
    if (req.storeId) empWhere.store_id = req.storeId; // chỉ cho phép NV thuộc store
    const empRecords = await prisma.employee.findMany({
      where: empWhere,
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

/* ─────────────────────────────────────────────────────────────────────────────
   DELETE /api/shift-assignments/:id — Xóa phân ca
   ───────────────────────────────────────────────────────────────────────────── */
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // Nhân viên chỉ được hủy ca mình đăng ký, và chỉ trước ngày đó
    if (!["admin", "hr-manager", "manager"].includes(req.user.role)) {
      const assignment = await prisma.shiftAssignment.findUnique({
        where: { id },
        include: {
          employee: true,
        },
      });

      if (!assignment) {
        return res.status(404).json({
          error: "Không tìm thấy phân ca.",
        });
      }

      if (assignment.employee.userId !== req.user.id) {
        return res.status(403).json({
          error: "Bạn không thể hủy ca của người khác.",
        });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const shiftDate = new Date(assignment.date);
      shiftDate.setHours(0, 0, 0, 0);

      if (shiftDate <= today) {
        return res.status(400).json({
          error: "Không thể hủy ca trong ngày hoặc đã qua.",
        });
      }
    }

    await prisma.shiftAssignment.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: "Đã xóa phân ca.",
    });
  } catch (err) {
    console.error("[DELETE /shift-assignments/:id]", err);

    res.status(500).json({
      error: "Lỗi server.",
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/shift-assignments/generate-week
// Tự động tạo ShiftAssignment cho tuần được chỉ định
// dựa trên default_shift_id của mỗi full-time employee
// Body: { weekFrom: "YYYY-MM-DD" }  (phải là thứ 2)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/generate-week", verifyToken, requireManager, storeContext, async (req, res) => {
  try {
    const { weekFrom } = req.body;
    if (!weekFrom) return res.status(400).json({ error: "Thiếu weekFrom." });

    // Lấy full-time employees có default_shift_id
    const employees = await prisma.employee.findMany({
      where: {
        ...Object.keys(hrStoreWhere(req)).length ? {} : {}, // global for hr
        employmentType: "full-time",
        defaultShiftId: { not: null },
        status: "active",
      },
      select: { id: true, defaultShiftId: true, store_id: true },
    });

    if (employees.length === 0) {
      return res.json({ success: true, created: 0, skipped: 0,
        message: "Không có nhân viên full-time nào có ca mặc định." });
    }

    // Sinh 6 ngày T2-T7 (bỏ CN = weekday 0)
    const weekDates = [];
    const start = parseLocalDate(weekFrom);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      const dow = d.getUTCDay(); // 0=CN, 1=T2...6=T7
      if (dow !== 0) weekDates.push(d); // bỏ CN
    }

    let created = 0, skipped = 0;
    for (const emp of employees) {
      for (const date of weekDates) {
        try {
          await prisma.shiftAssignment.create({
            data: {
              shiftId:     emp.defaultShiftId,
              employeeId:  emp.id,
              date,
              registeredBy: "manager",
              createdById:  req.user.id,
              note:        "Auto-generated từ ca mặc định",
            },
          });
          created++;
        } catch (e) {
          // Unique constraint: đã có rồi → skip
          if (e.code === "P2002") { skipped++; }
          else throw e;
        }
      }
    }

    res.json({
      success: true,
      created,
      skipped,
      message: `Đã tạo ${created} ca, bỏ qua ${skipped} (đã tồn tại).`,
    });
  } catch (err) {
    console.error("[POST /shift-assignments/generate-week]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/shift-assignments/weekly-overview
// Lấy lịch tuần của toàn bộ full-time employees (HR view)
// Query: from, to (YYYY-MM-DD)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/weekly-overview", verifyToken, requireManager, storeContext, async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: "Thiếu from hoặc to." });

    const fromDate = parseLocalDate(from);
    const toDate   = parseLocalDate(to);
    toDate.setUTCDate(toDate.getUTCDate() + 1); // inclusive

    const assignments = await prisma.shiftAssignment.findMany({
      where: {
        date: { gte: fromDate, lt: toDate },
        employee: { employmentType: "full-time", status: "active" },
      },
      include: {
        shift:    { select: { id: true, name: true, startTime: true, endTime: true } },
        employee: {
          select: {
            id: true, employeeCode: true,
            user:  { select: { fullName: true, role: true } },
            store: { select: { name: true } },
          },
        },
        attendance: { select: { id: true, status: true, checkIn: true, checkOut: true } },
      },
      orderBy: [{ date: "asc" }, { employee: { employeeCode: "asc" } }],
    });

    // Flatten
    const result = assignments.map(a => ({
      id:            a.id,
      date:          dateToISO(a.date),
      status:        a.status,
      shift_name:    a.shift?.name,
      shift_start:   a.shift?.startTime,
      shift_end:     a.shift?.endTime,
      employee_id:   a.employeeId,
      employee_name: a.employee?.user?.fullName,
      employee_code: a.employee?.employeeCode,
      role:          a.employee?.user?.role,
      store_name:    a.employee?.store?.name,
      attendance_status: a.attendance?.status,
      check_in:      a.attendance?.checkIn,
      check_out:     a.attendance?.checkOut,
    }));

    res.json(result);
  } catch (err) {
    console.error("[GET /shift-assignments/weekly-overview]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

module.exports = router;