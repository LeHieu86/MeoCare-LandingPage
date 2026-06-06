/**
 * /api/stores — Quản lý chi nhánh
 *
 * GET    /           — admin: tất cả; manager/hr-manager: chỉ store của mình
 * GET    /:id        — lấy 1 store (admin + manager store đó)
 * POST   /           — tạo store mới (admin only)
 * PUT    /:id        — sửa store (admin only)
 * DELETE /:id        — xóa store (admin only, phải không còn dữ liệu)
 */
const express = require("express");
const router  = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { verifyToken } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/requireRole");

// ── GET / — danh sách store ──────────────────────────────────────────────────
router.get("/", verifyToken, async (req, res) => {
  try {
    const { role, store_id } = req.user;

    // admin + hr-manager → xem tất cả chi nhánh (HR cần filter toàn hệ thống)
    // manager / employee → chỉ store của mình
    const where = ["admin", "hr-manager"].includes(role)
      ? {}
      : { id: store_id ?? -1 };

    const stores = await prisma.store.findMany({
      where,
      orderBy: { id: "asc" },
      include: {
        _count: {
          select: {
            employees: true,
            bookings:  true,
            rooms:     true,
          },
        },
      },
    });

    res.json(stores);
  } catch (err) {
    console.error("GET /stores:", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ── GET /public — danh sách chi nhánh cho khách chọn (không cần auth) ───────
// Loại trừ: kho trung tâm (isWarehouse) + trụ sở công ty (isCompany)
router.get("/public", async (req, res) => {
  try {
    const stores = await prisma.store.findMany({
      where: { isActive: true, isWarehouse: false, isCompany: false },
      select: { id: true, name: true, address: true, phone: true, latitude: true, longitude: true },
      orderBy: { id: "asc" },
    });
    res.json({ success: true, stores });
  } catch (err) {
    console.error("GET /stores/public:", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ── GET /:id — chi tiết 1 store ──────────────────────────────────────────────
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const id    = parseInt(req.params.id, 10);
    const { role, store_id } = req.user;

    // branch user chỉ được xem store của họ
    if (role !== "admin" && store_id !== id) {
      return res.status(403).json({ error: "Không có quyền." });
    }

    const store = await prisma.store.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            employees:      true,
            bookings:       true,
            rooms:          true,
            cameras:        true,
            orders:         true,
            products:       true,
            inventoryItems: true,
          },
        },
      },
    });

    if (!store) return res.status(404).json({ error: "Không tìm thấy chi nhánh." });
    res.json(store);
  } catch (err) {
    console.error("GET /stores/:id:", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ── POST / — tạo store mới ───────────────────────────────────────────────────
router.post("/", verifyToken, requireAdmin, async (req, res) => {
  try {
    const { name, address, phone, isActive = true, latitude, longitude } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: "Tên chi nhánh không được để trống." });
    }

    const store = await prisma.store.create({
      data: {
        name:      name.trim(),
        address:   address?.trim() || null,
        phone:     phone?.trim()   || null,
        isActive:  Boolean(isActive),
        latitude:  latitude  != null ? parseFloat(latitude)  : null,
        longitude: longitude != null ? parseFloat(longitude) : null,
      },
    });

    res.status(201).json({ success: true, store });
  } catch (err) {
    console.error("POST /stores:", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ── PUT /:id — cập nhật store ────────────────────────────────────────────────
router.put("/:id", verifyToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    const existing = await prisma.store.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Không tìm thấy chi nhánh." });

    const { name, address, phone, isActive, is_warehouse, is_company, latitude, longitude } = req.body;

    const data = {};
    if (name        !== undefined) data.name        = name.trim();
    if (address     !== undefined) data.address     = address?.trim() || null;
    if (phone       !== undefined) data.phone       = phone?.trim()   || null;
    if (isActive    !== undefined) data.isActive    = Boolean(isActive);
    if (is_warehouse !== undefined) data.isWarehouse = Boolean(is_warehouse);
    if (is_company   !== undefined) data.isCompany   = Boolean(is_company);
    if (latitude    !== undefined) data.latitude    = latitude  === null ? null : parseFloat(latitude);
    if (longitude   !== undefined) data.longitude   = longitude === null ? null : parseFloat(longitude);

    if (!data.name && existing.name) delete data.name; // giữ name cũ nếu không truyền

    let store;
    // Nếu set làm kho trung tâm → unset tất cả store khác trước
    if (data.isWarehouse === true) {
      await prisma.$transaction([
        prisma.store.updateMany({
          where: { id: { not: id } },
          data:  { isWarehouse: false },
        }),
        prisma.store.update({ where: { id }, data }),
      ]);
    } else {
      await prisma.store.update({ where: { id }, data });
    }

    store = await prisma.store.findUnique({ where: { id } });
    res.json({ success: true, store });
  } catch (err) {
    console.error("PUT /stores/:id:", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ── DELETE /:id — xóa store (chỉ khi không còn dữ liệu) ────────────────────
router.delete("/:id", verifyToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    const existing = await prisma.store.findUnique({
      where: { id },
      include: {
        _count: {
          select: { employees: true, bookings: true, orders: true },
        },
      },
    });

    if (!existing) return res.status(404).json({ error: "Không tìm thấy chi nhánh." });

    const { employees, bookings, orders } = existing._count;
    if (employees > 0 || bookings > 0 || orders > 0) {
      return res.status(409).json({
        error: `Không thể xóa chi nhánh còn dữ liệu (${employees} NV, ${bookings} booking, ${orders} đơn hàng).`,
      });
    }

    await prisma.store.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /stores/:id:", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

module.exports = router;
