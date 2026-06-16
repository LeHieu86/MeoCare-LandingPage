/**
 * /api/ot-requests
 * Phiếu OT — Manager tạo, HR duyệt, tích hợp lương
 */
const express = require("express");
const prisma  = require("../lib/prisma");
const { verifyToken }  = require("../middleware/auth");
const { storeContext } = require("../middleware/storeContext");
const { getIO } = require("../socket");

const router = express.Router();

const requireManager = (req, res, next) => {
  if (!["admin", "hr-manager", "manager"].includes(req.user?.role))
    return res.status(403).json({ error: "Không có quyền." });
  next();
};

const requireHR = (req, res, next) => {
  if (!["admin", "hr-manager"].includes(req.user?.role))
    return res.status(403).json({ error: "Chỉ HR mới có quyền duyệt." });
  next();
};

/** Tính payMonth/payYear dựa trên ngày OT + deadline 28 */
function calcPayPeriod(dateStr) {
  const d = new Date(dateStr);
  let month = d.getMonth() + 1; // 1-based
  let year  = d.getFullYear();
  // Nếu ngày OT > 28 → carry over sang tháng sau
  if (d.getDate() > 28) {
    month += 1;
    if (month > 12) { month = 1; year += 1; }
  }
  return { payMonth: month, payYear: year };
}

const OT_INCLUDE = {
  employee: { include: { user: { select: { fullName: true, avatar: true } } } },
  store:    { select: { id: true, name: true } },
  createdBy:  { select: { id: true, fullName: true } },
  approvedBy: { select: { id: true, fullName: true } },
};

// ── POST / — Manager tạo phiếu OT ──────────────────────────────────────────
router.post("/", verifyToken, requireManager, storeContext, async (req, res) => {
  try {
    const { employeeId, date, hours, reason, otType } = req.body;
    if (!employeeId || !date || !hours || !reason)
      return res.status(400).json({ error: "Thiếu thông tin bắt buộc." });

    if (hours <= 0 || hours > 12)
      return res.status(400).json({ error: "Số giờ OT phải từ 0.5 đến 12." });

    // Kiểm tra nhân viên thuộc store
    const emp = await prisma.employee.findFirst({
      where: { id: Number(employeeId), ...(req.storeId ? { store_id: req.storeId } : {}) },
      include: { user: { select: { fullName: true } } },
    });
    if (!emp) return res.status(404).json({ error: "Không tìm thấy nhân viên." });

    const { payMonth, payYear } = calcPayPeriod(date);

    const ot = await prisma.oTRequest.create({
      data: {
        employeeId:  Number(employeeId),
        storeId:     emp.store_id,
        createdById: req.user.id,
        date:        new Date(date),
        hours:       parseFloat(hours),
        reason,
        otType:      otType || "planned",
        payMonth,
        payYear,
      },
      include: OT_INCLUDE,
    });

    // Socket → hr-room
    try {
      const io = getIO();
      if (io) {
        const payload = {
          id:    `ot_${ot.id}_${Date.now()}`,
          event: "ot:new",
          title: "Phiếu OT mới",
          body:  `${emp.user?.fullName ?? "NV"} — ${hours}h ngày ${new Date(date).toLocaleDateString("vi-VN")} — ${reason}`,
          data:  ot,
          time:  new Date().toISOString(),
        };
        io.to("hr-room").emit("ot:new", payload);
      }
    } catch { /* non-critical */ }

    res.status(201).json(ot);
  } catch (err) {
    console.error("[POST /ot-requests]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ── GET / — Danh sách phiếu OT (HR / Manager) ─────────────────────────────
router.get("/", verifyToken, requireManager, storeContext, async (req, res) => {
  try {
    const { status, month, year, employeeId } = req.query;
    const where = {};

    // Store filter cho manager (HR xem tất cả)
    if (req.storeId) where.storeId = req.storeId;

    if (status)     where.status     = status;
    if (month)      where.payMonth   = parseInt(month);
    if (year)       where.payYear    = parseInt(year);
    if (employeeId) where.employeeId = parseInt(employeeId);

    const list = await prisma.oTRequest.findMany({
      where,
      include: OT_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    res.json(list);
  } catch (err) {
    console.error("[GET /ot-requests]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ── GET /my — Nhân viên xem phiếu OT của mình ─────────────────────────────
router.get("/my", verifyToken, async (req, res) => {
  try {
    const emp = await prisma.employee.findUnique({ where: { userId: req.user.id } });
    if (!emp) return res.status(404).json({ error: "Không tìm thấy hồ sơ nhân viên." });

    const list = await prisma.oTRequest.findMany({
      where: { employeeId: emp.id },
      include: OT_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    res.json(list);
  } catch (err) {
    console.error("[GET /ot-requests/my]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ── PUT /:id/approve — HR duyệt ────────────────────────────────────────────
router.put("/:id/approve", verifyToken, requireHR, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.oTRequest.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Không tìm thấy phiếu OT." });
    if (existing.status !== "pending")
      return res.status(400).json({ error: "Phiếu đã được xử lý." });

    const updated = await prisma.oTRequest.update({
      where: { id },
      data: {
        status:       "approved",
        approvedById: req.user.id,
        approvedAt:   new Date(),
      },
      include: OT_INCLUDE,
    });

    // Socket → employee + manager
    try {
      const io = getIO();
      if (io) {
        const payload = {
          id:    `ot_approved_${id}_${Date.now()}`,
          event: "ot:approved",
          title: "Phiếu OT đã duyệt",
          body:  `OT ${updated.hours}h ngày ${updated.date?.toLocaleDateString("vi-VN")} đã được duyệt`,
          data:  updated,
          time:  new Date().toISOString(),
        };
        io.to("manager-room").emit("ot:approved", payload);
        io.to("employee-room").emit("ot:approved", payload);
      }
    } catch { /* non-critical */ }

    res.json(updated);
  } catch (err) {
    console.error("[PUT /ot-requests/:id/approve]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ── PUT /:id/reject — HR từ chối ───────────────────────────────────────────
router.put("/:id/reject", verifyToken, requireHR, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { rejectedReason } = req.body;

    const existing = await prisma.oTRequest.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Không tìm thấy phiếu OT." });
    if (existing.status !== "pending")
      return res.status(400).json({ error: "Phiếu đã được xử lý." });

    const updated = await prisma.oTRequest.update({
      where: { id },
      data: {
        status:         "rejected",
        approvedById:   req.user.id,
        approvedAt:     new Date(),
        rejectedReason: rejectedReason || null,
      },
      include: OT_INCLUDE,
    });

    // Socket → employee + manager
    try {
      const io = getIO();
      if (io) {
        const payload = {
          id:    `ot_rejected_${id}_${Date.now()}`,
          event: "ot:rejected",
          title: "Phiếu OT bị từ chối",
          body:  `OT ${updated.hours}h ngày ${updated.date?.toLocaleDateString("vi-VN")} bị từ chối${rejectedReason ? ': ' + rejectedReason : ''}`,
          data:  updated,
          time:  new Date().toISOString(),
        };
        io.to("manager-room").emit("ot:rejected", payload);
        io.to("employee-room").emit("ot:rejected", payload);
      }
    } catch { /* non-critical */ }

    res.json(updated);
  } catch (err) {
    console.error("[PUT /ot-requests/:id/reject]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ── DELETE /:id — Xóa phiếu (chỉ pending) ──────────────────────────────────
router.delete("/:id", verifyToken, requireManager, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.oTRequest.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Không tìm thấy phiếu OT." });
    if (existing.status !== "pending")
      return res.status(400).json({ error: "Chỉ xóa được phiếu đang chờ duyệt." });

    await prisma.oTRequest.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error("[DELETE /ot-requests/:id]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

module.exports = router;
