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
const { getIO } = require("../socket");

// Tất cả loại phép (thêm wedding, paternity)
const LEAVE_TYPES = ["annual", "sick", "unpaid", "maternity", "paternity", "wedding", "other"];

// Số ngày phép cố định theo loại / năm (không áp dụng cho annual)
const DEFAULT_BALANCE = {
  sick:       6,   // 6 ngày bệnh/năm, cố định
  wedding:    3,
  maternity: 180,
  paternity:  5,
  unpaid:     0,
  other:      0,
};

// ── Tính số ngày phép năm (annual) theo thâm niên + probation ────────────────
// Quy tắc:
//   - Tháng 1 & 2 kể từ startDate: thử việc → 0 ngày
//   - Tháng thứ 3: chính thức → cộng ngược lại 3 ngày (tháng 1+2+3)
//   - Mỗi tháng tiếp theo: +1 ngày, tối đa 12 ngày/năm
//   - Năm tiếp theo (đã qua probation): 12 ngày đầy đủ từ 1/1
//   - Không cộng dồn sang năm sau
function calcAnnualAllocation(employeeStartDate, year) {
  if (!employeeStartDate) return 12;

  const start   = new Date(employeeStartDate);
  const startY  = start.getFullYear();
  const startM  = start.getMonth(); // 0-based

  if (year < startY) return 0; // chưa vào làm

  // Năm sau năm bắt đầu → đã qua probation → đủ 12 ngày
  if (year > startY) return 12;

  // Cùng năm bắt đầu: tính đến 31/12 của năm đó
  // Số tháng hoàn thành kể từ ngày vào (0 = tháng đầu tiên)
  // Ví dụ: vào 01/01 → cuối năm đủ 12 tháng → monthsCompleted = 11 (0-based) → 12 ngày
  const monthsCompleted = 12 - startM; // số tháng trong năm (bao gồm tháng bắt đầu)

  if (monthsCompleted < 3) return 0;  // chưa qua probation trong năm này
  return Math.min(monthsCompleted, 12);
}

// Tính số ngày phép năm tích lũy đến HIỆN TẠI (cho năm hiện tại)
function calcAnnualAllocationToNow(employeeStartDate, year) {
  if (!employeeStartDate) return 12;

  const start  = new Date(employeeStartDate);
  const startY = start.getFullYear();
  const startM = start.getMonth();
  const now    = new Date();

  if (year < startY) return 0;
  if (year > startY) return 12; // năm sau → đã qua probation

  // Cùng năm bắt đầu
  // Tháng hiện tại trong năm (0-based)
  const currentMonth = (now.getFullYear() === year) ? now.getMonth() : 11;
  const monthsWorked = currentMonth - startM + 1; // số tháng đã trải qua (bao gồm tháng hiện tại)

  if (monthsWorked < 3) return 0; // vẫn trong thử việc
  return Math.min(monthsWorked, 12);
}

// ── Tạo / đồng bộ balance cho nhân viên ─────────────────────────────────────
// annual: tính tự động theo startDate
// các loại khác: dùng DEFAULT_BALANCE (không overwrite nếu HR đã điều chỉnh)
async function syncBalance(employeeId, year, leaveType) {
  const existing = await prisma.leaveBalance.findUnique({
    where: { employee_id_year_leave_type: { employee_id: employeeId, year, leave_type: leaveType } },
  });

  if (leaveType === "annual") {
    const emp = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { startDate: true },
    });
    const allocation = calcAnnualAllocationToNow(emp?.startDate, year);

    if (!existing) {
      return prisma.leaveBalance.create({
        data: { employee_id: employeeId, year, leave_type: "annual", total_days: allocation, used_days: 0 },
      });
    }
    // Chỉ cập nhật total_days nếu HR chưa điều chỉnh thủ công (adjusted_by == null)
    if (!existing.adjusted_by) {
      return prisma.leaveBalance.update({
        where: { id: existing.id },
        data:  { total_days: allocation },
      });
    }
    return existing;
  }

  // Các loại phép khác: tạo nếu chưa có, không overwrite
  if (!existing) {
    return prisma.leaveBalance.create({
      data: {
        employee_id: employeeId,
        year,
        leave_type:  leaveType,
        total_days:  DEFAULT_BALANCE[leaveType] ?? 0,
        used_days:   0,
      },
    });
  }
  return existing;
}

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
// (đã thay bằng syncBalance ở trên)

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
      const bal  = await syncBalance(employee.id, year, leaveType);
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
    // Thông báo realtime cho HR và Manager
    try {
      const io = getIO();
      if (io) {
        const empInfo = await prisma.employee.findUnique({
          where: { id: employee.id },
          include: { user: { select: { fullName: true } } },
        });
        const payload = {
          id: `leave_${leave.id}_${Date.now()}`,
          event: "leave:new",
          title: "Đơn xin nghỉ phép mới",
          body: `${empInfo?.user?.fullName ?? "Nhân viên"} xin nghỉ ${leave.leaveType} (${leave.startDate?.toString().slice(0,10)} → ${leave.endDate?.toString().slice(0,10)})`,
          time: new Date().toISOString(),
        };
        io.to("hr-room").emit("leave:new", payload);
        io.to("manager-room").emit("leave:new", payload);
      }
    } catch { /* không critical */ }

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

// ── GET /api/leave/balances — HR xem tất cả nhân viên ────────
router.get("/balances", verifyToken, requireHR, storeContext, async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();

    // Lấy danh sách nhân viên full-time active
    const whereEmp = { status: "active", employmentType: "full-time" };
    if (req.storeId) whereEmp.store_id = req.storeId;

    const employees = await prisma.employee.findMany({
      where: whereEmp,
      select: {
        id: true, employeeCode: true, startDate: true,
        user:  { select: { fullName: true } },
        store: { select: { name: true } },
      },
      orderBy: { employeeCode: "asc" },
    });

    // Sync + lấy balance cho từng nhân viên
    const result = await Promise.all(employees.map(async (emp) => {
      const [annual, sick] = await Promise.all([
        syncBalance(emp.id, year, "annual"),
        syncBalance(emp.id, year, "sick"),
      ]);
      return {
        employee_id:   emp.id,
        employee_code: emp.employeeCode,
        employee_name: emp.user?.fullName,
        store_name:    emp.store?.name,
        start_date:    emp.startDate,
        annual,
        sick,
      };
    }));

    res.json(result);
  } catch (err) {
    console.error("[GET /leave/balances]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ── GET /api/leave/balances/:employeeId — HR xem 1 nhân viên ─
router.get("/balances/:employeeId", verifyToken, requireHR, async (req, res) => {
  try {
    const year  = parseInt(req.query.year) || new Date().getFullYear();
    const empId = parseInt(req.params.employeeId);
    const types = ["annual", "sick", "wedding", "maternity", "paternity"];
    for (const t of types) await syncBalance(empId, year, t);
    const balances = await prisma.leaveBalance.findMany({ where: { employee_id: empId, year } });
    res.json(balances);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ── PUT /api/leave/balances/:id/adjust — HR điều chỉnh thủ công
router.put("/balances/:id/adjust", verifyToken, requireHR, async (req, res) => {
  try {
    const { total_days, note } = req.body;
    if (total_days === undefined)
      return res.status(400).json({ error: "Thiếu total_days." });
    const bal = await prisma.leaveBalance.update({
      where: { id: parseInt(req.params.id) },
      data: {
        total_days:   parseFloat(total_days),
        note:         note || null,
        adjusted_by:  req.user.id,
      },
    });
    res.json(bal);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ── PUT /api/leave/balances/:id (legacy) — giữ tương thích ───
router.put("/balances/:id", verifyToken, requireHR, async (req, res) => {
  req.url = `/${req.params.id}/adjust`;
  return router.handle(req, res, () => {});
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

        // Tạo attendance on_leave — link shiftAssignmentId nếu có
        const cur = new Date(leave.startDate);
        const end = new Date(leave.endDate);
        while (cur <= end) {
          const dayStart = new Date(cur);
          dayStart.setHours(0, 0, 0, 0);

          // Tìm shift assignment của ngày này (nếu có)
          const shiftAssign = await prisma.shiftAssignment.findFirst({
            where: {
              employeeId: leave.employeeId,
              date:       dayStart,
              status:     { notIn: ["cancelled"] },
            },
          });

          const existing = await prisma.attendance.findFirst({
            where: { employeeId: leave.employeeId, date: dayStart },
          });

          if (existing) {
            // Cập nhật attendance hiện có → on_leave
            await prisma.attendance.update({
              where: { id: existing.id },
              data: {
                status: "on_leave",
                note:   `Nghỉ phép: ${leave.reason}`,
                // Link shiftAssignment nếu chưa có
                ...(shiftAssign && !existing.shiftAssignmentId
                  ? { shiftAssignmentId: shiftAssign.id }
                  : {}),
              },
            });
          } else {
            // Tạo mới — link shiftAssignment nếu nó chưa có attendance
            const saHasAtt = shiftAssign?.id
              ? await prisma.attendance.findFirst({ where: { shiftAssignmentId: shiftAssign.id } })
              : null;
            await prisma.attendance.create({
              data: {
                employeeId:        leave.employeeId,
                date:              dayStart,
                status:            "on_leave",
                note:              `Nghỉ phép: ${leave.reason}`,
                shiftAssignmentId: (shiftAssign && !saHasAtt) ? shiftAssign.id : null,
              },
            });
          }

          // Cập nhật trạng thái shift assignment → on_leave
          if (shiftAssign) {
            await prisma.shiftAssignment.update({
              where: { id: shiftAssign.id },
              data:  { status: "on_leave" },
            }).catch(() => {});
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

    // ── Socket emit — mỗi bên chỉ nhận thông báo từ bên kia ──────────────────
    try {
      const io = getIO();
      if (io) {
        const empName  = leave.employee?.user?.fullName ?? "Nhân viên";
        const dateRange = `${new Date(leave.startDate).toLocaleDateString("vi-VN")} – ${new Date(leave.endDate).toLocaleDateString("vi-VN")}`;

        // Manager duyệt tầng 1 → chỉ HR nhận
        if (["manager","admin"].includes(role) && (tier === "manager" || !tier)) {
          const event = action === "approve" ? "leave:manager_approved" : "leave:rejected";
          const title = action === "approve" ? "Manager đã duyệt đơn nghỉ" : "Manager từ chối đơn nghỉ";
          const body  = `${empName} — ${leave.leaveType} (${dateRange})${note ? " — " + note : ""}`;
          io.to("hr-room").emit(event, {
            id: `leave_${id}_${Date.now()}`, event, title, body, data: updated, time: new Date().toISOString(),
          });
        }
        // HR duyệt/từ chối final → Manager + Employee nhận
        else if (["hr-manager","admin"].includes(role)) {
          const event = action === "approve" ? "leave:approved" : "leave:rejected";
          const title = action === "approve" ? "HR đã duyệt đơn nghỉ phép" : "HR từ chối đơn nghỉ phép";
          const body  = `${empName} — ${leave.leaveType} (${dateRange})${note ? " — " + note : ""}`;
          const payload = { id: `leave_${id}_${Date.now()}`, event, title, body, data: updated, time: new Date().toISOString() };
          io.to("manager-room").emit(event, payload);
          io.to("employee-room").emit(event, payload); // website nhân viên reload lịch
        }
      }
    } catch { /* non-critical */ }

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
  req.body.action = "reject";
  req.body.note   = req.body.rejectReason;
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

/* ── DELETE /api/leave/:id ──────────────────────────────────── */
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
    res.json({ success: true });
  } catch (err) {
    console.error("[DELETE /leave/:id]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

module.exports = router;
