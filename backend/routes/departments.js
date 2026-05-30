/**
 * /api/departments  &  /api/positions
 * Quản lý cơ cấu tổ chức: phòng ban + chức vụ
 */
const express = require("express");
const prisma  = require("../lib/prisma");
const { verifyToken } = require("../middleware/auth");
const { storeContext } = require("../middleware/storeContext");
const { storeWhere, injectStoreId } = require("../lib/storeFilter");

const router = express.Router();

const requireHR = (req, res, next) => {
  if (!["admin", "hr-manager"].includes(req.user?.role))
    return res.status(403).json({ error: "Chỉ HR Manager mới có quyền." });
  next();
};

// ══════════════════════════════════════════════════════════════
// DEPARTMENTS
// ══════════════════════════════════════════════════════════════

// GET /api/departments
router.get("/", verifyToken, storeContext, async (req, res) => {
  try {
    const depts = await prisma.department.findMany({
      where: { ...storeWhere(req), is_active: true },
      include: {
        positions: { where: { is_active: true }, orderBy: { level: "asc" } },
        _count: { select: { employees: true } },
      },
      orderBy: { name: "asc" },
    });
    res.json(depts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// POST /api/departments
router.post("/", verifyToken, storeContext, requireHR, async (req, res) => {
  try {
    const { name, code, head_id } = req.body;
    if (!name) return res.status(400).json({ error: "Tên phòng ban không được trống." });

    const data = injectStoreId(req, { name, code: code || null, head_id: head_id || null });
    const dept = await prisma.department.create({ data });
    res.status(201).json(dept);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// PUT /api/departments/:id
router.put("/:id", verifyToken, storeContext, requireHR, async (req, res) => {
  try {
    const { name, code, head_id, is_active } = req.body;
    const dept = await prisma.department.update({
      where: { id: parseInt(req.params.id) },
      data: {
        ...(name      !== undefined && { name }),
        ...(code      !== undefined && { code }),
        ...(head_id   !== undefined && { head_id: head_id || null }),
        ...(is_active !== undefined && { is_active }),
      },
    });
    res.json(dept);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// DELETE /api/departments/:id (soft delete)
router.delete("/:id", verifyToken, storeContext, requireHR, async (req, res) => {
  try {
    await prisma.department.update({
      where: { id: parseInt(req.params.id) },
      data: { is_active: false },
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ══════════════════════════════════════════════════════════════
// POSITIONS  (sub-resource of department)
// ══════════════════════════════════════════════════════════════

// GET /api/departments/:deptId/positions
router.get("/:deptId/positions", verifyToken, storeContext, async (req, res) => {
  try {
    const positions = await prisma.position.findMany({
      where: { department_id: parseInt(req.params.deptId), is_active: true },
      include: { _count: { select: { employees: true } } },
      orderBy: { level: "asc" },
    });
    res.json(positions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// POST /api/departments/:deptId/positions
router.post("/:deptId/positions", verifyToken, storeContext, requireHR, async (req, res) => {
  try {
    const { name, level } = req.body;
    if (!name) return res.status(400).json({ error: "Tên chức vụ không được trống." });

    const pos = await prisma.position.create({
      data: {
        department_id: parseInt(req.params.deptId),
        name,
        level: level || 1,
      },
    });
    res.status(201).json(pos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// PUT /api/departments/:deptId/positions/:id
router.put("/:deptId/positions/:id", verifyToken, storeContext, requireHR, async (req, res) => {
  try {
    const { name, level, is_active } = req.body;
    const pos = await prisma.position.update({
      where: { id: parseInt(req.params.id) },
      data: {
        ...(name      !== undefined && { name }),
        ...(level     !== undefined && { level }),
        ...(is_active !== undefined && { is_active }),
      },
    });
    res.json(pos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// DELETE /api/departments/:deptId/positions/:id (soft)
router.delete("/:deptId/positions/:id", verifyToken, storeContext, requireHR, async (req, res) => {
  try {
    await prisma.position.update({
      where: { id: parseInt(req.params.id) },
      data: { is_active: false },
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

module.exports = router;
