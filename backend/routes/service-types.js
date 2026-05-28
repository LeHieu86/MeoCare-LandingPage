/**
 * routes/service-types.js
 *
 * Public:
 *   GET  /api/service-types          — danh sách loại dịch vụ (chỉ available=true, đã sort)
 *
 * Admin (yêu cầu JWT, role admin/manager):
 *   GET  /api/admin/service-types    — tất cả loại (kể cả unavailable)
 *   POST /api/admin/service-types    — tạo mới
 *   PUT  /api/admin/service-types/:id — cập nhật
 *   DELETE /api/admin/service-types/:id — xóa (chỉ xóa được khi chưa có booking dùng type này)
 */

const express = require("express");
const prisma   = require("../lib/prisma");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

/* ─── Guard: chỉ admin & manager ─────────────────────────────── */
const adminOnly = (req, res, next) => {
  if (!req.user || !["admin", "manager", "owner"].includes(req.user.role)) {
    return res.status(403).json({ error: "Không có quyền truy cập" });
  }
  next();
};

/* ══════════════════════════════════════════════════════
   PUBLIC: GET /api/service-types
   Trả về danh sách dịch vụ hiển thị cho khách (available=true)
   ══════════════════════════════════════════════════════ */
router.get("/", async (_req, res) => {
  try {
    const types = await prisma.serviceTypeDef.findMany({
      where:   { available: true },
      orderBy: { sortOrder: "asc" },
      include: {
        packages: {
          where:   { isActive: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    res.json({ success: true, data: types });
  } catch (err) {
    console.error("[service-types GET /]", err);
    res.status(500).json({ success: false, error: "Lỗi server" });
  }
});

/* ══════════════════════════════════════════════════════
   ADMIN: GET /api/admin/service-types
   Trả về toàn bộ (kể cả chưa available) cho Admin quản lý
   ══════════════════════════════════════════════════════ */
router.get("/admin", verifyToken, adminOnly, async (_req, res) => {
  try {
    const types = await prisma.serviceTypeDef.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        packages: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    res.json({ success: true, data: types });
  } catch (err) {
    console.error("[service-types GET /admin]", err);
    res.status(500).json({ success: false, error: "Lỗi server" });
  }
});

/* ══════════════════════════════════════════════════════
   ADMIN: POST /api/admin/service-types
   Tạo loại dịch vụ mới
   ══════════════════════════════════════════════════════ */
router.post("/admin", verifyToken, adminOnly, async (req, res) => {
  try {
    const {
      key, icon, name, subtitle, description,
      priceFrom, pricePerDay, priceMultiDay,
      color, accent, bgAccent,
      available, useTimeProgress, stages, sortOrder,
    } = req.body;

    if (!key || !name) {
      return res.status(400).json({ error: "key và name là bắt buộc" });
    }

    // Kiểm tra key trùng
    const exists = await prisma.serviceTypeDef.findUnique({ where: { key } });
    if (exists) {
      return res.status(409).json({ error: `Key "${key}" đã tồn tại` });
    }

    const svc = await prisma.serviceTypeDef.create({
      data: {
        key:             key.trim().toLowerCase(),
        icon:            icon            || "🐾",
        name:            name.trim(),
        subtitle:        subtitle        || "",
        description:     description     || "",
        priceFrom:       priceFrom       || "Liên hệ",
        pricePerDay:     pricePerDay     || 0,
        priceMultiDay:   priceMultiDay   || 0,
        color:           color           || "linear-gradient(135deg, #C7B8EA 0%, #9F8FD9 100%)",
        accent:          accent          || "#9F8FD9",
        bgAccent:        bgAccent        || "linear-gradient(135deg, #C7B8EA 0%, #9F8FD9 100%)",
        available:       !!available,
        useTimeProgress: !!useTimeProgress,
        stages:          stages          || [],
        sortOrder:       sortOrder       || 0,
      },
    });

    res.status(201).json({ success: true, data: svc });
  } catch (err) {
    console.error("[service-types POST /admin]", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

/* ══════════════════════════════════════════════════════
   ADMIN: PUT /api/admin/service-types/:id
   Cập nhật loại dịch vụ
   ══════════════════════════════════════════════════════ */
router.put("/admin/:id", verifyToken, adminOnly, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "ID không hợp lệ" });

    const {
      key, icon, name, subtitle, description,
      priceFrom, pricePerDay, priceMultiDay,
      color, accent, bgAccent,
      available, useTimeProgress, stages, sortOrder,
    } = req.body;

    // Nếu đổi key, kiểm tra trùng
    if (key) {
      const conflict = await prisma.serviceTypeDef.findFirst({
        where: { key: key.trim().toLowerCase(), NOT: { id } },
      });
      if (conflict) {
        return res.status(409).json({ error: `Key "${key}" đã tồn tại` });
      }
    }

    const updated = await prisma.serviceTypeDef.update({
      where: { id },
      data: {
        ...(key            !== undefined && { key:             key.trim().toLowerCase() }),
        ...(icon           !== undefined && { icon }),
        ...(name           !== undefined && { name:            name.trim() }),
        ...(subtitle       !== undefined && { subtitle }),
        ...(description    !== undefined && { description }),
        ...(priceFrom      !== undefined && { priceFrom }),
        ...(pricePerDay    !== undefined && { pricePerDay }),
        ...(priceMultiDay  !== undefined && { priceMultiDay }),
        ...(color          !== undefined && { color }),
        ...(accent         !== undefined && { accent }),
        ...(bgAccent       !== undefined && { bgAccent }),
        ...(available      !== undefined && { available:       !!available }),
        ...(useTimeProgress!== undefined && { useTimeProgress: !!useTimeProgress }),
        ...(stages         !== undefined && { stages }),
        ...(sortOrder      !== undefined && { sortOrder }),
      },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Không tìm thấy loại dịch vụ" });
    }
    console.error("[service-types PUT /admin/:id]", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

/* ══════════════════════════════════════════════════════
   ADMIN: DELETE /api/admin/service-types/:id
   Xóa loại dịch vụ
   ══════════════════════════════════════════════════════ */
router.delete("/admin/:id", verifyToken, adminOnly, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "ID không hợp lệ" });

    await prisma.serviceTypeDef.delete({ where: { id } });
    res.json({ success: true, message: "Đã xóa loại dịch vụ" });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Không tìm thấy loại dịch vụ" });
    }
    console.error("[service-types DELETE /admin/:id]", err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

module.exports = router;
