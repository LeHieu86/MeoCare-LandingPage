/**
 * routes/service-packages.js
 *
 * Public:
 *   GET  /api/service-packages?serviceTypeKey=grooming  — gói của 1 loại dịch vụ
 *
 * Admin (JWT + role admin/manager):
 *   GET    /api/admin/service-packages?serviceTypeId=2  — tất cả gói của 1 type
 *   POST   /api/admin/service-packages                  — tạo gói mới
 *   PUT    /api/admin/service-packages/:id              — cập nhật gói
 *   DELETE /api/admin/service-packages/:id              — xóa gói
 *   PATCH  /api/admin/service-packages/reorder          — cập nhật thứ tự hàng loạt
 */

const express = require("express");
const prisma   = require("../lib/prisma");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

const adminOnly = (req, res, next) => {
  if (!req.user || !["admin", "manager", "owner"].includes(req.user.role)) {
    return res.status(403).json({ error: "Không có quyền truy cập" });
  }
  next();
};

/* ══════════════════════════════════════════════════════
   PUBLIC: GET /api/service-packages?serviceTypeKey=grooming
   ══════════════════════════════════════════════════════ */
router.get("/", async (req, res) => {
  try {
    const { serviceTypeKey } = req.query;
    if (!serviceTypeKey) {
      return res.status(400).json({ error: "Thiếu serviceTypeKey" });
    }

    const serviceType = await prisma.serviceTypeDef.findUnique({
      where: { key: serviceTypeKey },
    });
    if (!serviceType) {
      return res.status(404).json({ error: "Không tìm thấy loại dịch vụ" });
    }

    const packages = await prisma.servicePackage.findMany({
      where:   { serviceTypeId: serviceType.id, isActive: true },
      orderBy: { sortOrder: "asc" },
    });

    res.json({ success: true, data: packages });
  } catch (err) {
    console.error("[service-packages GET /]", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

/* ══════════════════════════════════════════════════════
   ADMIN: GET /api/admin/service-packages?serviceTypeId=2
   ══════════════════════════════════════════════════════ */
router.get("/admin", verifyToken, adminOnly, async (req, res) => {
  try {
    const where = {};
    if (req.query.serviceTypeId) {
      where.serviceTypeId = parseInt(req.query.serviceTypeId, 10);
    }

    const packages = await prisma.servicePackage.findMany({
      where,
      orderBy: [{ serviceTypeId: "asc" }, { sortOrder: "asc" }],
      include: { serviceType: { select: { id: true, key: true, name: true } } },
    });

    res.json({ success: true, data: packages });
  } catch (err) {
    console.error("[service-packages GET /admin]", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

/* ══════════════════════════════════════════════════════
   ADMIN: POST /api/admin/service-packages
   ══════════════════════════════════════════════════════ */
router.post("/admin", verifyToken, adminOnly, async (req, res) => {
  try {
    const {
      serviceTypeId, name, description,
      price, duration, includes,
      isPopular, isActive, sortOrder,
    } = req.body;

    if (!serviceTypeId || !name) {
      return res.status(400).json({ error: "serviceTypeId và name là bắt buộc" });
    }

    const pkg = await prisma.servicePackage.create({
      data: {
        serviceTypeId: parseInt(serviceTypeId, 10),
        name:          name.trim(),
        description:   description   || "",
        price:         price         || 0,
        duration:      duration      || null,
        includes:      includes      || [],
        isPopular:     !!isPopular,
        isActive:      isActive !== undefined ? !!isActive : true,
        sortOrder:     sortOrder     || 0,
      },
    });

    res.status(201).json({ success: true, data: pkg });
  } catch (err) {
    console.error("[service-packages POST /admin]", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

/* ══════════════════════════════════════════════════════
   ADMIN: PUT /api/admin/service-packages/:id
   ══════════════════════════════════════════════════════ */
router.put("/admin/:id", verifyToken, adminOnly, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "ID không hợp lệ" });

    const {
      name, description, price, duration,
      includes, isPopular, isActive, sortOrder,
    } = req.body;

    const updated = await prisma.servicePackage.update({
      where: { id },
      data: {
        ...(name        !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description }),
        ...(price       !== undefined && { price }),
        ...(duration    !== undefined && { duration }),
        ...(includes    !== undefined && { includes }),
        ...(isPopular   !== undefined && { isPopular:  !!isPopular }),
        ...(isActive    !== undefined && { isActive:   !!isActive }),
        ...(sortOrder   !== undefined && { sortOrder }),
      },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Không tìm thấy gói" });
    console.error("[service-packages PUT /admin/:id]", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

/* ══════════════════════════════════════════════════════
   ADMIN: DELETE /api/admin/service-packages/:id
   ══════════════════════════════════════════════════════ */
router.delete("/admin/:id", verifyToken, adminOnly, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "ID không hợp lệ" });

    // Soft delete: đánh dấu isActive = false thay vì xóa cứng
    // (giữ lại lịch sử booking đã dùng gói này)
    const updated = await prisma.servicePackage.update({
      where: { id },
      data:  { isActive: false },
    });

    res.json({ success: true, data: updated, message: "Đã ẩn gói dịch vụ" });
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Không tìm thấy gói" });
    console.error("[service-packages DELETE /admin/:id]", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

/* ══════════════════════════════════════════════════════
   ADMIN: PATCH /api/admin/service-packages/reorder
   Body: [{ id, sortOrder }, ...]
   ══════════════════════════════════════════════════════ */
router.patch("/admin/reorder", verifyToken, adminOnly, async (req, res) => {
  try {
    const items = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: "Cần mảng [{id, sortOrder}]" });

    await Promise.all(
      items.map(({ id, sortOrder }) =>
        prisma.servicePackage.update({
          where: { id: parseInt(id, 10) },
          data:  { sortOrder: parseInt(sortOrder, 10) },
        })
      )
    );

    res.json({ success: true });
  } catch (err) {
    console.error("[service-packages PATCH /admin/reorder]", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

module.exports = router;
