/**
 * /api/stores — Quản lý chi nhánh
 *
 * GET    /           — owner: tất cả; admin/manager: chỉ store của mình
 * GET    /:id        — lấy 1 store (owner + admin/manager store đó)
 * POST   /           — tạo store mới (owner only)
 * PUT    /:id        — sửa store (owner only)
 * DELETE /:id        — xóa store (owner only, phải không còn dữ liệu)
 */
const express = require("express");
const router  = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { verifyToken } = require("../middleware/auth");

// ── Guard: chỉ owner mới được thao tác ghi ───────────────────────────────────
const requireOwner = (req, res, next) => {
  if (req.user?.role !== "owner") {
    return res.status(403).json({ error: "Chỉ chủ hệ thống mới có quyền quản lý chi nhánh." });
  }
  next();
};

// ── GET / — danh sách store ──────────────────────────────────────────────────
router.get("/", verifyToken, async (req, res) => {
  try {
    const { role, store_id } = req.user;

    // owner → xem tất cả; còn lại → chỉ store của mình
    const where = role === "owner"
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

// ── GET /:id — chi tiết 1 store ──────────────────────────────────────────────
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const id    = parseInt(req.params.id, 10);
    const { role, store_id } = req.user;

    // branch user chỉ được xem store của họ
    if (role !== "owner" && store_id !== id) {
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
router.post("/", verifyToken, requireOwner, async (req, res) => {
  try {
    const { name, address, phone, isActive = true } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: "Tên chi nhánh không được để trống." });
    }

    const store = await prisma.store.create({
      data: {
        name:     name.trim(),
        address:  address?.trim() || null,
        phone:    phone?.trim()   || null,
        isActive: Boolean(isActive),
      },
    });

    res.status(201).json({ success: true, store });
  } catch (err) {
    console.error("POST /stores:", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ── PUT /:id — cập nhật store ────────────────────────────────────────────────
router.put("/:id", verifyToken, requireOwner, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, address, phone, isActive } = req.body;

    const existing = await prisma.store.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Không tìm thấy chi nhánh." });

    const data = {};
    if (name     !== undefined) data.name     = name.trim();
    if (address  !== undefined) data.address  = address?.trim() || null;
    if (phone    !== undefined) data.phone    = phone?.trim()   || null;
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    if (!data.name && existing.name) delete data.name; // giữ name cũ nếu không truyền

    const store = await prisma.store.update({ where: { id }, data });
    res.json({ success: true, store });
  } catch (err) {
    console.error("PUT /stores/:id:", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ── DELETE /:id — xóa store (chỉ khi không còn dữ liệu) ────────────────────
router.delete("/:id", verifyToken, requireOwner, async (req, res) => {
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
