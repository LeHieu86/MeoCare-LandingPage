/**
 * /api/admin/customers
 * Quản lý tài khoản KHÁCH HÀNG (role customer/client) — chỉ admin.
 * Hỗ trợ: xem danh sách + thời gian ngưng hoạt động, sửa thông tin, reset mật khẩu.
 * KHÔNG hỗ trợ xóa (giữ lịch sử thú cưng / đơn hàng liên kết).
 */
const express = require("express");
const bcrypt  = require("bcryptjs");
const { verifyToken } = require("../middleware/auth");
const prisma  = require("../lib/prisma");

const router = express.Router();

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Chỉ admin mới có quyền thực hiện." });
  }
  next();
};

// Các role được coi là "khách hàng"
const CUSTOMER_ROLES = ["customer", "client"];

const CUSTOMER_SELECT = {
  id: true, fullName: true, username: true, email: true,
  phone: true, role: true, avatar: true, created_at: true, last_login: true,
  _count: { select: { pets: true } },
};

// Chuẩn hoá object trả về client (đưa số thú cưng ra phẳng)
const shape = (u) => ({
  id: u.id,
  fullName: u.fullName,
  username: u.username,
  email: u.email,
  phone: u.phone,
  role: u.role,
  avatar: u.avatar,
  created_at: u.created_at,
  last_login: u.last_login,
  petCount: u._count?.pets ?? 0,
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/customers — Danh sách tài khoản khách hàng
// Query: search? (tên / username / email / sđt)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/", verifyToken, requireAdmin, async (req, res) => {
  try {
    const { search } = req.query;

    const where = { role: { in: CUSTOMER_ROLES } };
    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { fullName: { contains: q, mode: "insensitive" } },
        { username: { contains: q, mode: "insensitive" } },
        { email:    { contains: q, mode: "insensitive" } },
        { phone:    { contains: q } },
      ];
    }

    const customers = await prisma.user.findMany({
      where,
      select: CUSTOMER_SELECT,
      orderBy: { created_at: "desc" },
    });

    res.json(customers.map(shape));
  } catch (err) {
    console.error("[GET /admin/customers]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/customers/:id — Chi tiết 1 khách hàng (kèm danh sách thú cưng)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/:id", verifyToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const customer = await prisma.user.findUnique({
      where: { id },
      select: {
        ...CUSTOMER_SELECT,
        pets: {
          select: { id: true, name: true, breed: true, gender: true, age: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!customer || !CUSTOMER_ROLES.includes(customer.role)) {
      return res.status(404).json({ error: "Không tìm thấy khách hàng." });
    }

    res.json({ ...shape(customer), pets: customer.pets });
  } catch (err) {
    console.error("[GET /admin/customers/:id]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/admin/customers/:id — Cập nhật thông tin + (tuỳ chọn) reset mật khẩu
// Body: { fullName?, email?, phone?, newPassword? }
// ─────────────────────────────────────────────────────────────────────────────
router.put("/:id", verifyToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { fullName, email, phone, newPassword } = req.body;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing || !CUSTOMER_ROLES.includes(existing.role)) {
      return res.status(404).json({ error: "Không tìm thấy khách hàng." });
    }

    const data = {};

    if (fullName !== undefined) {
      if (!fullName.trim()) {
        return res.status(400).json({ error: "Họ tên không được để trống." });
      }
      data.fullName = fullName.trim();
    }

    if (email !== undefined) {
      const e = email.trim();
      if (e) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
          return res.status(400).json({ error: "Email không hợp lệ." });
        }
        const dup = await prisma.user.findFirst({
          where: { email: e, id: { not: id } },
        });
        if (dup) {
          return res.status(409).json({ error: "Email đã được sử dụng bởi tài khoản khác." });
        }
      }
      data.email = e || undefined;
    }

    if (phone !== undefined) {
      const p = phone.trim();
      if (p && !/^(0[3|5|7|8|9])+([0-9]{8})$/.test(p)) {
        return res.status(400).json({ error: "Số điện thoại không hợp lệ." });
      }
      data.phone = p || null;
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        return res.status(400).json({ error: "Mật khẩu mới phải có ít nhất 6 ký tự." });
      }
      data.password = await bcrypt.hash(newPassword, 10);
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "Không có thông tin nào để cập nhật." });
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: CUSTOMER_SELECT,
    });

    res.json(shape(updated));
  } catch (err) {
    console.error("[PUT /admin/customers/:id]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

module.exports = router;
