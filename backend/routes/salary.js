/**
 * /api/salary
 * Bảng lương hàng tháng
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
// POST /api/salary/generate — Tự động tính lương cho 1 tháng
// Body: { month, year, employeeIds?: [] } — nếu không truyền employeeIds thì tính tất cả
// ─────────────────────────────────────────────────────────────────────────────
router.post("/generate", verifyToken, requireManager, async (req, res) => {
  try {
    const { month, year, employeeIds } = req.body;
    if (!month || !year) return res.status(400).json({ error: "Thiếu month hoặc year." });

    const m = parseInt(month);
    const y = parseInt(year);

    // Lấy danh sách nhân viên active (kèm salaryType)
    const whereEmp = { status: "active" };
    if (employeeIds?.length) whereEmp.id = { in: employeeIds.map(Number) };

    const employees = await prisma.employee.findMany({
      where: whereEmp,
      select: { id: true, baseSalary: true, salaryType: true },
    });

    const startOfMonth = new Date(y, m - 1, 1);
    const endOfMonth   = new Date(y, m, 0, 23, 59, 59);

    const results = [];

    for (const emp of employees) {
      const isHourly = emp.salaryType === "hourly"; // part-time

      // Lấy chấm công trong tháng
      const attendances = await prisma.attendance.findMany({
        where: {
          employeeId: emp.id,
          date:       { gte: startOfMonth, lte: endOfMonth },
        },
      });

      const validAtts     = attendances.filter((a) => ["present","late","early_leave"].includes(a.status));
      const overtimeHours = attendances.reduce((s, a) => s + (a.overtimeHours || 0), 0);

      let netSalary, workedDays, totalWorkHours, overtimePay, deduction, standardDays;

      if (isHourly) {
        // ── PART-TIME: lương theo giờ thực làm ──────────────────────────────
        standardDays  = 0;
        workedDays    = 0;
        totalWorkHours = Math.round(attendances.reduce((s, a) => s + (a.workHours || 0), 0) * 100) / 100;
        overtimePay   = Math.round(overtimeHours * emp.baseSalary * 1.5); // 150% OT trên đơn giá giờ
        deduction     = 0; // Không tính khấu trừ ngày công cho part-time
        netSalary     = Math.max(0, Math.round(totalWorkHours * emp.baseSalary + overtimePay));
      } else {
        // ── FULL-TIME: lương theo ngày công ─────────────────────────────────
        standardDays   = 26;
        workedDays     = validAtts.length;
        totalWorkHours = Math.round(attendances.reduce((s, a) => s + (a.workHours || 0), 0) * 100) / 100;
        const unpaidLeave = await prisma.leaveRequest.count({
          where: {
            employeeId: emp.id,
            leaveType:  "unpaid",
            status:     "approved",
            startDate:  { gte: startOfMonth },
            endDate:    { lte: endOfMonth },
          },
        });
        const dailySalary = Math.round(emp.baseSalary / standardDays);
        overtimePay  = Math.round(overtimeHours * (dailySalary / 8) * 1.5); // 150% OT
        deduction    = unpaidLeave * dailySalary;
        netSalary    = Math.max(0, Math.round(workedDays * dailySalary + overtimePay - deduction));
      }

      // Upsert salary record
      const record = await prisma.salaryRecord.upsert({
        where: {
          employeeId_month_year: { employeeId: emp.id, month: m, year: y },
        },
        update: {
          salaryType:     emp.salaryType,
          baseSalary:     emp.baseSalary,
          standardDays,
          workedDays,
          totalWorkHours,
          overtimeHours:  Math.round(overtimeHours * 100) / 100,
          overtimePay,
          deduction,
          netSalary,
          // Giữ nguyên bonus / allowance / note / unpaidLeaveDays nếu admin đã nhập
        },
        create: {
          employeeId:     emp.id,
          month:          m,
          year:           y,
          salaryType:     emp.salaryType,
          baseSalary:     emp.baseSalary,
          standardDays,
          workedDays,
          totalWorkHours,
          overtimeHours:  Math.round(overtimeHours * 100) / 100,
          overtimePay,
          deduction,
          netSalary,
          status: "draft",
        },
        include: {
          employee: { include: { user: { select: { fullName: true } } } },
        },
      });
      results.push(record);
    }

    res.json({ generated: results.length, records: results });
  } catch (err) {
    console.error("[POST /salary/generate]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/salary — Danh sách bảng lương (admin)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/", verifyToken, requireManager, async (req, res) => {
  try {
    const { month, year, employeeId, status } = req.query;
    const where = {};
    if (month)      where.month      = parseInt(month);
    if (year)       where.year       = parseInt(year);
    if (employeeId) where.employeeId = parseInt(employeeId);
    if (status)     where.status     = status;

    const records = await prisma.salaryRecord.findMany({
      where,
      include: {
        employee: { include: { user: { select: { fullName: true, avatar: true } } } }, // bank fields included automatically
      },
      orderBy: [{ year: "desc" }, { month: "desc" }, { employeeId: "asc" }],
    });
    res.json(records);
  } catch (err) {
    console.error("[GET /salary]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/salary/my — Nhân viên xem lương của mình
// ─────────────────────────────────────────────────────────────────────────────
router.get("/my", verifyToken, async (req, res) => {
  try {
    const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });
    if (!employee) return res.status(404).json({ error: "Không tìm thấy hồ sơ nhân viên." });

    const records = await prisma.salaryRecord.findMany({
      where: { employeeId: employee.id },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
    res.json(records);
  } catch (err) {
    console.error("[GET /salary/my]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/salary/:id — Chỉnh sửa thưởng, phụ cấp, khấu trừ (admin)
// ─────────────────────────────────────────────────────────────────────────────
router.put("/:id", verifyToken, requireManager, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { bonus, allowance, deduction, note, workedDays, overtimeHours, overtimePay } = req.body;

    const record = await prisma.salaryRecord.findUnique({ where: { id } });
    if (!record) return res.status(404).json({ error: "Không tìm thấy bản ghi lương." });
    if (record.status === "paid") return res.status(400).json({ error: "Bảng lương đã chi trả, không thể sửa." });

    // Tính lại netSalary
    const b   = bonus         !== undefined ? parseInt(bonus)         : record.bonus;
    const al  = allowance     !== undefined ? parseInt(allowance)     : record.allowance;
    const ded = deduction     !== undefined ? parseInt(deduction)     : record.deduction;
    const wd  = workedDays    !== undefined ? parseFloat(workedDays)  : record.workedDays;
    const oh  = overtimeHours !== undefined ? parseFloat(overtimeHours) : record.overtimeHours;
    const op  = overtimePay   !== undefined ? parseInt(overtimePay)   : record.overtimePay;
    const twh = req.body.totalWorkHours !== undefined ? parseFloat(req.body.totalWorkHours) : record.totalWorkHours;

    let netSalary;
    if (record.salaryType === "hourly") {
      // Part-time: giờ × đơn giá giờ
      netSalary = Math.max(0, Math.round(twh * record.baseSalary + op + b + al - ded));
    } else {
      // Full-time: ngày × lương ngày
      const dailySalary = record.standardDays > 0 ? Math.round(record.baseSalary / record.standardDays) : 0;
      netSalary = Math.max(0, Math.round(wd * dailySalary + op + b + al - ded - (record.unpaidLeaveDays * dailySalary)));
    }

    const updated = await prisma.salaryRecord.update({
      where: { id },
      data: {
        bonus:         b,
        allowance:     al,
        deduction:     ded,
        workedDays:    wd,
        totalWorkHours: twh,
        overtimeHours: oh,
        overtimePay:   op,
        netSalary,
        ...(note !== undefined && { note }),
      },
      include: {
        employee: { include: { user: { select: { fullName: true } } } },
      },
    });
    res.json(updated);
  } catch (err) {
    console.error("[PUT /salary/:id]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/salary/:id/confirm — Admin xác nhận bảng lương
// ─────────────────────────────────────────────────────────────────────────────
router.put("/:id/confirm", verifyToken, requireManager, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updated = await prisma.salaryRecord.update({
      where: { id },
      data:  { status: "confirmed" },
    });
    res.json(updated);
  } catch (err) {
    console.error("[PUT /salary/:id/confirm]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/salary/:id/pay — Đánh dấu đã chi lương
// ─────────────────────────────────────────────────────────────────────────────
router.put("/:id/pay", verifyToken, requireManager, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updated = await prisma.salaryRecord.update({
      where: { id },
      data:  { status: "paid", paidAt: new Date() },
    });
    res.json(updated);
  } catch (err) {
    console.error("[PUT /salary/:id/pay]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

module.exports = router;
