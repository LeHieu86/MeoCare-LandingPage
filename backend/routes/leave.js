/**
 * /api/leave
 * Quản lý nghỉ phép — workflow 2 tầng: Manager → HR Manager
 */
const express = require("express");
const prisma  = require("../lib/prisma");
const { verifyToken }  = require("../middleware/auth");
const { storeContext } = require("../middleware/storeContext");
const { hrStoreWhere } = require("../lib/storeFilter");

const router = express.Router();

// Tất cả loại phép (thêm wedding, paternity)
const LEAVE_TYPES = ["annual", "sick", "unpaid", "maternity", "paternity", "wedding", "other"];

// Số ngày phép mặc định theo loại / năm
const DEFAULT_BALANCE = {
  annual:    12,
  sick:       5,
  wedding:    3,
  maternity: 180,
  paternity:  5,
  unpaid:     0,  // không giới hạn nhưng không trả lương
  other:      0,
};

const requireManager = (req, res, next) => {
  if (!["admin", "hr-manager", "manager"].includes(req.user?.role))
    return res.status(403).json({ error: "Không có quyền." });
  next();
};

const requireHR = (req, res, next) => {
  if (!["admin", "hr-manager"].includes(req.user?.role))
    return res.status(403).json({ error: "Chỉ HR Manager mới có quyền." });
  next();
};

function calcDays(startDate, endDate) {
  const diff = (new Date(endDate) - new Date(startDate)) / 1000 / 3600 / 24;
  return Math.max(1, Math.round(diff) + 1);
}

// Lấy hoặc tạo leave balance cho nhân viên
async function getOrCreateBalance(employeeId, year, leaveType) {
  return prisma.leaveBalance.upsert({
    where: { employee_id_year_leave_type: { employee_id: employeeId, year, leave_type: leaveType } },
    update: {},
    create: {
      employee_id: employeeId,
      year,
      leave_type:  leaveType,
      total_days:  DEFAULT_BALANCE[leaveType] ?? 0,
      used_days:   0,
    },
  });
}

// ── POST /api/leave — Nhân viên gửi đơn ──────────────────────
router.post("/", verifyToken, async (req, res) => {
  try {
    const { leaveType, startDate, endDate, reason } = req.body;
    if (!leaveType || !startDate || !endDate || !reason)
      return res.status(400).json({ error: "Vui lòng nhập đầy đủ thông tin." });
    if (!LEAVE_TYPES.includes(leaveType))
      return res.status(400).json({ error: "Loại nghỉ phép không hợp lệ." });

    const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });
    if (!employee) return res.status(404).json({ error: "Không tìm thấy hồ sơ nhân viên." });

    // Part-time không được phép nghỉ có lương (annual, sick, wedding...)
    if (employee.employment_type === "part-time" && !["unpaid", "other"].includes(leaveType))
      return res.status(400).json({ error: "Nhân viên part-time chỉ được đăng ký nghỉ không lương." });

    const totalDays = calcDays(startDate, endDate);

    // Kiểm tra số ngày phép còn lại
    if (!["unpaid", "other"].includes(leaveType)) {
      const year = new Date(startDate).getFullYear();
      const bal  = await getOrCreateBalance(employee.id, year, leaveType);
      const remaining = bal.total_days - bal.used_days;
      if (remaining < totalDays)
        return res.status(400).json({
          error: `Không đủ ngày phép. Còn lại: ${remaining} ngày, yêu cầu: ${totalDays} ngày.`
        });
    }

    const leave = await prisma.leaveRequest.create({
      data: {
        employeeId: employee.id,
        leaveType,
        startDate: new Date(startDate),
        endDate:   new Date(endDate),
        totalDays,
        reason,
        status: "pending",
      },
      include: { employee: { include: { user: { select: { fullName: true } } } } },
    });
    res.status(201).json(leave);
  } catch (err) {
    console.error("[POST /leave]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ── GET /api/leave/my — Nhân viên xem đơn + số ngày còn lại ──
router.get("/my", verifyToken, async (req, res) => {
  try {
    const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });
    if (!employee) return res.status(404).json({ error: "Không tìm thấy hồ sơ nhân viên." });

    const [leaves, balances] = await Promise.all([
      prisma.leaveRequest.findMany({
        where: { employeeId: employee.id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.leaveBalance.findMany({
        where: { employee_id: employee.id, year: new Date().getFullYear() },
      }),
    ]);
    res.json({ leaves, balances });
  } catch (err) {
    console.error("[GET /leave/my]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ── GET /api/leave/balances/:employeeId — HR xem số ngày phép NV
router.get("/balances/:employeeId", verifyToken, requireHR, async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const empId = parseInt(req.params.employeeId);

    // Tạo balance cho tất cả loại phép nếu chưa có
    const types = ["annual", "sick", "wedding", "maternity", "paternity"];
    for (const t of types) {
      await getOrCreateBalance(empId, year, t);
    }

    const balances = await prisma.leaveBalance.findMany({
      where: { employee_id: empId, year },
    });
    res.json(balances);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ── PUT /api/leave/balances/:id — HR chỉnh số ngày phép ──────
router.put("/balances/:id", verifyToken, requireHR, async (req, res) => {
  try {
    const { total_days } = req.body;
    const bal = await prisma.leaveBalance.update({
      where: { id: parseInt(req.params.id) },
      data: { total_days: parseFloat(total_days) },
    });
    res.json(bal);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ── GET /api/leave — Manager/HR xem danh sách đơn ────────────
router.get("/", verifyToken, requireManager, storeContext, async (req, res) => {
  try {
    const { status, employeeId, leave_type } = req.query;
    const where = { ...hrStoreWhere(req) };
    if (status)      where.status     = status;
    if (employeeId)  where.employeeId = parseInt(employeeId);
    if (leave_type)  where.leaveType  = leave_type;

    // Manager chỉ thấy đơn đã qua bước manager (hoặc pending để duyệt tầng 1)
    // HR thấy tất cả
    const role = req.user.role;
    if (role === "manager") {
      // Manager thấy: pending (chờ duyệt tầng 1) + đơn do mình đã xử lý
      where.OR = [
        { status: "pending", managerStatus: null },
        { managerApprovedBy: req.user.id },
      ];
    }

    const leaves = await prisma.leaveRequest.findMany({
      where,
      include: {
        employee: {
          include: {
            user:  { select: { fullName: true, avatar: true } },
            store: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Flatten response
    const data = leaves.map(l => ({
      ...l,
      employee_name: l.employee?.user?.fullName,
      store_name:    l.employee?.store?.name,
      role:          l.employee?.user ? null : null, // role từ user
    }));
    res.json(data);
  } catch (err) {
    console.error("[GET /leave]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ── PUT /api/leave/:id/status — Duyệt/từ chối theo tầng ──────
// body: { action: "approve"|"reject", note: string, tier: "manager"|"hr" }
router.put("/:id/status", verifyToken, requireManager, storeContext, async (req, res) => {
  try {
    const id     = parseInt(req.params.id);
    const { action, note, tier } = req.body;
    const role = req.user.role;

    if (!["approve", "reject"].includes(action))
      return res.status(400).json({ error: "action phải là approve hoặc reject." });

    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { employee: true },
    });
    if (!leave) return res.status(404).json({ error: "Không tìm thấy đơn nghỉ." });
    if (leave.status === "approved" || leave.status === "rejected")
      return res.status(400).json({ error: "Đơn đã được xử lý xong rồi." });

    let updateData = {};

    // Tầng 1: Manager duyệt
    if (["manager", "admin"].includes(role) && (tier === "manager" || !tier)) {
      if (action === "approve") {
        updateData = {
          managerStatus:     "approved",
          managerApprovedBy: req.user.id,
          managerApprovedAt: new Date(),
          managerNote:       note || null,
          status:            "manager_approved", // chờ HR duyệt tiếp
        };
      } else {
        updateData = {
          managerStatus:     "rejected",
          managerApprovedBy: req.user.id,
          managerApprovedAt: new Date(),
          managerNote:       note || null,
          status:            "rejected",
          rejectReason:      note || "Manager từ chối",
        };
      }
    }
    // Tầng 2: HR duyệt (final)
    else if (["hr-manager", "admin"].includes(role)) {
      if (action === "approve") {
        updateData = {
          hrStatus:     "approved",
          hrApprovedBy: req.user.id,
          hrApprovedAt: new Date(),
          hrNote:       note || null,
          status:       "approved",
          approvedById: req.user.id,
          approvedAt:   new Date(),
        };

        // Trừ số ngày phép trong balance
        const year = new Date(leave.startDate).getFullYear();
        if (!["unpaid", "other"].includes(leave.leaveType)) {
          await prisma.leaveBalance.updateMany({
            where: {
              employee_id: leave.employeeId,
              year,
              leave_type: leave.leaveType,
            },
            data: { used_days: { increment: leave.totalDays } },
          });
        }

        // Tạo attendance on_leave
        const cur = new Date(leave.startDate);
        const end = new Date(leave.endDate);
        while (cur <= end) {
          const dayStart = new Date(cur);
          dayStart.setHours(0, 0, 0, 0);
          const existing = await prisma.attendance.findFirst({
            where: { employeeId: leave.employeeId, date: dayStart },
          });
          if (existing) {
            await prisma.attendance.update({
              where: { id: existing.id },
              data: { status: "on_leave", note: `Nghỉ phép: ${leave.reason}` },
            });
          } else {
            await prisma.attendance.create({
              data: {
                employeeId: leave.employeeId,
                date:       dayStart,
                status:     "on_leave",
                note:       `Nghỉ phép: ${leave.reason}`,
              },
            });
          }
          cur.setDate(cur.getDate() + 1);
        }
      } else {
        updateData = {
          hrStatus:    "rejected",
          hrApprovedBy: req.user.id,
          hrApprovedAt: new Date(),
          hrNote:      note || null,
          status:      "rejected",
          rejectReason: note || "HR từ chối",
        };
      }
    } else {
      return res.status(403).json({ error: "Không có quyền duyệt tầng này." });
    }

    const updated = await prisma.leaveRequest.update({ where: { id }, data: updateData });
    res.json(updated);
  } catch (err) {
    console.error("[PUT /leave/:id/status]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// Legacy endpoints (backward compat)
router.put("/:id/approve", verifyToken, requireManager, storeContext, async (req, res) => {
  req.body.action = "approve";
  req.body.tier   = ["hr-manager", "admin"].includes(req.user.role) ? "hr" : "manager";
  return router.handle(Object.assign(req, { url: `/${req.params.id}/status`, method: "PUT" }), res, () => {});
});

router.put("/:id/reject", verifyToken, requireManager, storeContext, async (req, res) => {
  req.body.action      = "reject";
  req.body.note        = req.body.rejectReason;
  const id = parseInt(req.params.id);
  try {
    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: { status: "rejected", rejectReason: req.body.rejectReason, approvedById: req.user.id, approvedAt: new Date() },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Lỗi server." });
  }
});

/* ── DELETE /api/leave/:id — Nhân viên hủy đơn pending ──── */
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const id    = parseInt(req.params.id);
    const leave = await prisma.leaveRequest.findUnique({
      where: { id }, include: { employee: true },
    });
    if (!leave) return res.status(404).json({ error: "Không tìm thấy đơn nghỉ." });

    if (!["admin", "hr-manager", "manager"].includes(req.user.role) &&
        leave.employee.userId !== req.user.id)
      return res.status(403).json({ error: "Bạn không thể hủy đơn của người khác." });

    if (leave.status !== "pending")
      return res.status(400).json({ error: "Chỉ có thể hủy đơn đang chờ duyệt." });

    await prisma.leaveRequest.delete({ where: { id } });
    res.json({ success: true, message: "Đã hủy đơn nghỉ phép." });
  } catch (err) {
    console.error("[DELETE /leave/:id]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

module.exports = router;
