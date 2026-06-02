/**
 * /api/attendance
 * Chấm công (check-in / check-out)
 */
const express  = require("express");
const prisma   = require("../lib/prisma");
const { verifyToken } = require("../middleware/auth");
const { storeContext } = require("../middleware/storeContext");
const { hrStoreWhere } = require("../lib/storeFilter");

const router = express.Router();

const requireManager = (req, res, next) => {
  if (!["admin", "hr-manager", "manager"].includes(req.user?.role)) {
    return res.status(403).json({ error: "Không có quyền." });
  }
  next();
};

// ── Date helpers (timezone-safe) ──────────────────────────────────────────────
// Lấy "hôm nay" theo giờ local của server (TZ=Asia/Ho_Chi_Minh)
// → trả về UTC midnight tương ứng với ngày đó theo giờ VN
const getTodayUTC = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
};

// Parse "YYYY-MM-DD" → UTC midnight (dùng cho query date range từ frontend)
const parseLocalDate = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const parseLocalDateEnd = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
};

// Parse "HH:MM" → phút tính từ 00:00
function parseHHMM(str) {
  const [h, m] = str.split(":").map(Number);
  return h * 60 + m;
}

// Phút trong ngày từ một đối tượng Date (giờ local)
function minutesOfDay(dt) {
  return new Date(dt).getHours() * 60 + new Date(dt).getMinutes();
}

// Tính workHours từ checkIn → checkOut
// Nếu ca có nghỉ trưa (lunchBreakStart/lunchBreakEnd) thì trừ phần giao nhau
function calcWorkHours(checkIn, checkOut, shift = null) {
  if (!checkIn || !checkOut) return 0;
  let diff = (new Date(checkOut) - new Date(checkIn)) / 1000 / 3600;

  // Trừ giờ nghỉ trưa nếu ca có cấu hình
  if (shift?.lunchBreakStart && shift?.lunchBreakEnd) {
    const lbStart = parseHHMM(shift.lunchBreakStart);
    const lbEnd   = parseHHMM(shift.lunchBreakEnd);
    const ciMins  = minutesOfDay(checkIn);
    const coMins  = minutesOfDay(checkOut);

    const overlapStart = Math.max(ciMins, lbStart);
    const overlapEnd   = Math.min(coMins, lbEnd);
    if (overlapEnd > overlapStart) {
      diff -= (overlapEnd - overlapStart) / 60;
    }
  }

  return Math.round(Math.max(0, diff) * 100) / 100;
}

// Tính overtime (số giờ > 8h/ca)
// Trường phái 1: nếu đi trễ thì không có OT dù ở lại thêm
function calcOvertime(workHours, status = "present") {
  if (status === "late") return 0;
  return Math.max(0, Math.round((workHours - 8) * 100) / 100);
}

// Detect status: late / early_leave / present
// startTime/endTime: "HH:MM" string từ shift template
// Ưu tiên dùng grace period từ shift config, mặc định 10 phút
function detectStatus(checkInTime, checkOutTime, shift, lateMinutes = null) {
  if (!shift) return "present";

  const lateGrace  = lateMinutes  ?? shift.lateGraceMinutes  ?? 10;
  const earlyGrace = shift.earlyGraceMinutes ?? 10;

  let status = "present";

  // Đi trễ: checkIn muộn hơn startTime + grace period
  if (checkInTime && shift.startTime) {
    const [sh, sm] = shift.startTime.split(":").map(Number);
    const shiftStart = new Date(checkInTime);
    shiftStart.setHours(sh, sm, 0, 0);
    const diffMin = (new Date(checkInTime) - shiftStart) / 60000;
    if (diffMin > lateGrace) status = "late";
  }

  // Về sớm: checkOut sớm hơn endTime - grace period
  if (checkOutTime && shift.endTime && status !== "late") {
    const [eh, em] = shift.endTime.split(":").map(Number);
    const shiftEnd = new Date(checkOutTime);
    shiftEnd.setHours(eh, em, 0, 0);
    const diffMin = (shiftEnd - new Date(checkOutTime)) / 60000;
    if (diffMin > earlyGrace) status = "early_leave";
  }

  return status;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/attendance/check-in — Nhân viên tự check-in
// ─────────────────────────────────────────────────────────────────────────────
router.post("/check-in", verifyToken, async (req, res) => {
  try {
    const { shiftAssignmentId, note } = req.body;

    const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });
    if (!employee) return res.status(404).json({ error: "Không tìm thấy hồ sơ nhân viên." });

    const today   = getTodayUTC();
    const now     = new Date();

    // Kiểm tra đã check-in hôm nay chưa (cho ca này hoặc bất kỳ ca nào)
    const existing = await prisma.attendance.findFirst({
      where: {
        employeeId: employee.id,
        date: today,
        ...(shiftAssignmentId ? { shiftAssignmentId: parseInt(shiftAssignmentId) } : {}),
      },
    });
    if (existing) return res.status(409).json({ error: "Bạn đã check-in rồi." });

    // Tự động tìm ca làm hôm nay nếu không truyền shiftAssignmentId
    let resolvedAssignmentId = shiftAssignmentId ? parseInt(shiftAssignmentId) : null;
    let shift = null;

    if (!resolvedAssignmentId) {
      const todayAssignment = await prisma.shiftAssignment.findFirst({
        where: {
          employeeId: employee.id,
          date: today,
          status: { in: ["scheduled"] },
        },
        include: { shift: true },
        orderBy: { createdAt: "desc" },
      });
      if (todayAssignment) {
        resolvedAssignmentId = todayAssignment.id;
        shift = todayAssignment.shift;
      }
    } else {
      const assignment = await prisma.shiftAssignment.findUnique({
        where: { id: resolvedAssignmentId },
        include: { shift: true },
      });
      shift = assignment?.shift || null;
    }

    // Auto-detect status (đi trễ?)
    const status = detectStatus(now, null, shift);

    const attendance = await prisma.attendance.create({
      data: {
        employeeId:        employee.id,
        shiftAssignmentId: resolvedAssignmentId,
        date:              today,
        checkIn:           now,
        status,
        note,
      },
      include: {
        shiftAssignment: { include: { shift: true } },
      },
    });

    // Cập nhật trạng thái ca làm → "active" (đang làm)
    if (resolvedAssignmentId) {
      await prisma.shiftAssignment.update({
        where: { id: resolvedAssignmentId },
        data:  { status: "scheduled" }, // giữ scheduled, completed khi check-out
      }).catch(() => {});
    }

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

    const today = getTodayUTC();

    const attendance = await prisma.attendance.findFirst({
      where: { employeeId: employee.id, date: today, checkOut: null },
      include: { shiftAssignment: { include: { shift: true } } },
      orderBy: { createdAt: "desc" },
    });
    if (!attendance) return res.status(404).json({ error: "Chưa check-in hoặc đã check-out rồi." });

    const checkOut  = new Date();
    const shift     = attendance.shiftAssignment?.shift || null;
    const workHours = calcWorkHours(attendance.checkIn, checkOut, shift);
    // Detect status trước để biết có trễ không
    const status = detectStatus(attendance.checkIn, checkOut, shift);
    const overtime  = calcOvertime(workHours, status);

    const updated = await prisma.attendance.update({
      where: { id: attendance.id },
      data:  { checkOut, workHours, overtimeHours: overtime, status },
      include: {
        employee: { include: { user: { select: { fullName: true } } } },
        shiftAssignment: { include: { shift: true } },
      },
    });

    // Cập nhật ca làm → completed
    if (attendance.shiftAssignmentId) {
      await prisma.shiftAssignment.update({
        where: { id: attendance.shiftAssignmentId },
        data:  { status: "completed" },
      }).catch(() => {});
    }

    res.json(updated);
  } catch (err) {
    console.error("[POST /attendance/check-out]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper: tìm các ca đã phân nhưng không có chấm công → trả về record "absent" ảo
// Điều kiện:
//   1. ShiftAssignment.date < hôm nay (ca đã qua)
//   2. Không có Attendance liên kết (attendance: null)
//   3. Không bị cancelled
//   4. Nhân viên không có LeaveRequest approved bao phủ ngày đó
// ─────────────────────────────────────────────────────────────────────────────
async function buildVirtualAbsents({ employeeId, storeId, isGlobal, fromDate, toDate }) {
  const today = getTodayUTC();
  const now   = new Date();

  // Giới hạn khoảng truy vấn:
  //   - Ngày trước hôm nay: luôn tính absent nếu không check-in
  //   - Hôm nay: chỉ tính absent nếu giờ kết thúc ca đã qua (xử lý sau khi query)
  const dateFilter = {
    lte: today,                                               // ≤ hôm nay
    ...(fromDate && { gte: fromDate }),
    ...(toDate   && { lte: toDate <= today ? toDate : today }),
  };

  // Lọc store nếu không phải global viewer
  const storeFilter = (!isGlobal && storeId)
    ? { employee: { store_id: storeId } }
    : {};

  const empFilter = employeeId ? { employeeId } : {};

  const missed = await prisma.shiftAssignment.findMany({
    where: {
      ...storeFilter,
      ...empFilter,
      date:       dateFilter,
      status:     { notIn: ["cancelled"] },
      attendance: null,                     // chưa có bản ghi chấm công
    },
    include: {
      shift: true,
      employee: {
        include: {
          user: {
            select: {
              fullName: true,
              avatar:   true,
              store:    { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  if (missed.length === 0) return [];

  // Loại bỏ các ca mà nhân viên đang có LeaveRequest approved bao phủ ngày đó
  const empIds   = [...new Set(missed.map((sa) => sa.employeeId))];
  const leaves   = await prisma.leaveRequest.findMany({
    where: {
      employeeId: { in: empIds },
      status:     "approved",
      startDate:  { lte: toDate ?? today },
      endDate:    { gte: fromDate ?? new Date(0) },
    },
    select: { employeeId: true, startDate: true, endDate: true },
  });

  // Set nhanh: "empId_YYYY-MM-DD"
  const leaveSet = new Set();
  for (const lv of leaves) {
    const cur = new Date(lv.startDate);
    while (cur <= lv.endDate) {
      leaveSet.add(`${lv.employeeId}_${cur.toISOString().slice(0, 10)}`);
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  }

  return missed
    .filter((sa) => {
      // Loại bỏ ca đang nghỉ phép
      const key = `${sa.employeeId}_${sa.date.toISOString().slice(0, 10)}`;
      if (leaveSet.has(key)) return false;

      // Ca hôm nay: chỉ tính absent nếu giờ kết thúc ca đã qua
      const isToday = sa.date.getTime() === today.getTime();
      if (isToday && sa.shift?.endTime) {
        const [eh, em] = sa.shift.endTime.split(":").map(Number);
        const shiftEnd = new Date(now);
        shiftEnd.setHours(eh, em, 0, 0);
        if (now < shiftEnd) return false; // ca chưa kết thúc → chưa tính absent
      }

      return true;
    })
    .map((sa) => ({
      id:                `absent_${sa.id}`,   // ID ảo — frontend nhận dạng qua prefix
      employeeId:        sa.employeeId,
      shiftAssignmentId: sa.id,
      date:              sa.date,
      checkIn:           null,
      checkOut:          null,
      workHours:         0,
      overtimeHours:     0,
      status:            "absent",
      note:              null,
      isVirtual:         true,                 // flag để frontend phân biệt
      createdAt:         sa.date,
      updatedAt:         sa.updatedAt,
      employee:          sa.employee,
      shiftAssignment:   sa,
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/attendance/today — Nhân viên xem trạng thái hôm nay
// ─────────────────────────────────────────────────────────────────────────────
router.get("/today", verifyToken, async (req, res) => {
  try {
    const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });
    if (!employee) return res.status(404).json({ error: "Không tìm thấy hồ sơ nhân viên." });

    const today = getTodayUTC();

    const att = await prisma.attendance.findFirst({
      where: { employeeId: employee.id, date: today },
      include: { shiftAssignment: { include: { shift: true } } },
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
      if (from) where.date.gte = parseLocalDate(from);
      if (to)   where.date.lte = parseLocalDateEnd(to);
    }

    const records = await prisma.attendance.findMany({
      where,
      include: { shiftAssignment: { include: { shift: true } } },
      orderBy: { date: "desc" },
    });

    // Gộp các ca vắng mặt ảo (có ca nhưng không check-in)
    const fromDate = from ? parseLocalDate(from) : undefined;
    const toDate   = to   ? parseLocalDateEnd(to) : undefined;
    const virtuals = await buildVirtualAbsents({
      employeeId: employee.id,
      isGlobal:   false,
      fromDate,
      toDate,
    });

    const merged = [...records, ...virtuals]
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json(merged);
  } catch (err) {
    console.error("[GET /attendance/my]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/attendance — Admin/Manager xem tất cả chấm công
// ─────────────────────────────────────────────────────────────────────────────
router.get("/", verifyToken, requireManager, storeContext, async (req, res) => {
  try {
    // `date` = single-day query (Flutter), `from`/`to` = range query (web)
    const { from: _from, to: _to, date, employeeId } = req.query;
    const from = _from || date;
    const to   = _to   || date;

    const where = { ...hrStoreWhere(req) };
    if (employeeId) where.employeeId = parseInt(employeeId);
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = parseLocalDate(from);
      if (to)   where.date.lte = parseLocalDateEnd(to);
    }

    const records = await prisma.attendance.findMany({
      where,
      include: {
        employee: {
          include: {
            user: {
              select: {
                fullName: true, avatar: true,
                store: { select: { id: true, name: true } },
              },
            },
          },
        },
        shiftAssignment: { include: { shift: true } },
      },
      orderBy: [{ date: "desc" }, { employeeId: "asc" }],
    });

    // Gộp các ca vắng mặt ảo (có ca nhưng không check-in)
    const fromDate = from ? parseLocalDate(from) : undefined;
    const toDate   = to   ? parseLocalDateEnd(to) : undefined;
    const isGlobal = (req.isGlobalViewer || req.isAdmin) && req.storeId === null;
    const virtuals = await buildVirtualAbsents({
      employeeId: employeeId ? parseInt(employeeId) : undefined,
      storeId:    req.storeId,
      isGlobal,
      fromDate,
      toDate,
    });

    const merged = [...records, ...virtuals]
      .sort((a, b) => new Date(b.date) - new Date(a.date) || a.employeeId - b.employeeId);

    res.json(merged);
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

    const current = await prisma.attendance.findUnique({
      where: { id },
      include: { shiftAssignment: { include: { shift: true } } },
    });
    if (!current) return res.status(404).json({ error: "Không tìm thấy bản ghi chấm công." });

    const checkInDt  = checkIn  ? new Date(checkIn)  : undefined;
    const checkOutDt = checkOut ? new Date(checkOut) : undefined;

    const resolvedIn  = checkInDt  ?? current.checkIn;
    const resolvedOut = checkOutDt ?? current.checkOut;
    const currentShift = current.shiftAssignment?.shift || null;
    const workHours   = calcWorkHours(resolvedIn, resolvedOut, currentShift);
    // Nếu admin không truyền status → auto-detect từ giờ mới
    const resolvedStatus = status
      ?? detectStatus(resolvedIn, resolvedOut, currentShift);
    const overtime    = calcOvertime(workHours, resolvedStatus);

    const updated = await prisma.attendance.update({
      where: { id },
      data: {
        ...(checkInDt  !== undefined && { checkIn: checkInDt }),
        ...(checkOutDt !== undefined && { checkOut: checkOutDt }),
        status: resolvedStatus,
        ...(note !== undefined && { note }),
        workHours,
        overtimeHours: overtime,
      },
      include: {
        employee: { include: { user: { select: { fullName: true } } } },
        shiftAssignment: { include: { shift: true } },
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
    const {
      employeeId,
      shiftAssignmentId,
      date,
      checkIn,
      checkOut,
      status,
      note,
    } = req.body;

    if (!employeeId || !date) {
      return res.status(400).json({
        error: "Thiếu employeeId hoặc date.",
      });
    }

    const dateObj = parseLocalDate(date);

    const checkInDt = checkIn ? new Date(checkIn) : null;
    const checkOutDt = checkOut ? new Date(checkOut) : null;

    // Lấy shift để auto-detect status và tính workHours
    let shift = null;

    if (shiftAssignmentId) {
      const sa = await prisma.shiftAssignment.findUnique({
        where: { id: parseInt(shiftAssignmentId) },
        include: { shift: true },
      });

      shift = sa?.shift || null;
    }

    const workHours = calcWorkHours(checkInDt, checkOutDt, shift);
    const resolvedStatus =
      status ?? detectStatus(checkInDt, checkOutDt, shift);
    const overtime = calcOvertime(workHours, resolvedStatus);

    const att = await prisma.attendance.create({
      data: {
        employeeId: parseInt(employeeId),
        shiftAssignmentId: shiftAssignmentId
          ? parseInt(shiftAssignmentId)
          : null,
        date: dateObj,
        checkIn: checkInDt,
        checkOut: checkOutDt,
        workHours,
        overtimeHours: overtime,
        status: resolvedStatus,
        note,
      },
      include: {
        employee: {
          include: {
            user: {
              select: {
                fullName: true,
              },
            },
          },
        },
        shiftAssignment: {
          include: {
            shift: true,
          },
        },
      },
    });

    res.status(201).json(att);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({
        error: "Đã có bản ghi chấm công cho ngày/ca này.",
      });
    }

    console.error("[POST /attendance/manual]", err);

    res.status(500).json({
      error: "Lỗi server.",
    });
  }
});

module.exports = router;