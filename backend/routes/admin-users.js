/**
 * /api/admin/users
 * Quản lý tài khoản hệ thống — chỉ admin
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

const USER_SELECT = {
  id: true, fullName: true, username: true, email: true,
  phone: true, role: true, avatar: true, created_at: true,
  store: { select: { id: true, name: true } },
};

// Các role được phép tạo/quản lý qua trang này
const ALLOWED_ROLES = ["admin", "manager", "hr-manager", "stock-manager", "employee"];

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/users — Danh sách tài khoản (trừ customer)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/", verifyToken, requireAdmin, async (req, res) => {
  try {
    const { role, search } = req.query;

    const where = {
      role: { in: ALLOWED_ROLES },
    };
    if (role && ALLOWED_ROLES.includes(role)) where.role = role;
    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { username: { contains: search } },
        { email:    { contains: search } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: USER_SELECT,
      orderBy: [{ role: "asc" }, { created_at: "desc" }],
    });

    res.json(users);
  } catch (err) {
    console.error("[GET /admin/users]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/users — Tạo tài khoản mới
// Body: { fullName, username, email, phone?, password, role, storeId? }
// ─────────────────────────────────────────────────────────────────────────────
router.post("/", verifyToken, requireAdmin, async (req, res) => {
  try {
    const { fullName, username, email, phone, password, role, storeId } = req.body;

    if (!fullName || !username || !email || !password || !role) {
      return res.status(400).json({ error: "Thiếu thông tin bắt buộc." });
    }
    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ error: "Role không hợp lệ." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Mật khẩu phải có ít nhất 6 ký tự." });
    }

    // Kiểm tra trùng username / email
    const dup = await prisma.user.findFirst({
      where: { OR: [{ username }, { email }] },
    });
    if (dup) {
      const field = dup.username === username ? "Tên đăng nhập" : "Email";
      return res.status(409).json({ error: `${field} đã được sử dụng.` });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        fullName: fullName.trim(),
        username: username.trim(),
        email:    email.trim(),
        phone:    phone?.trim() || null,
        password: hashed,
        role,
        store_id: storeId ? parseInt(storeId) : null,
      },
      select: USER_SELECT,
    });

    res.status(201).json(user);
  } catch (err) {
    console.error("[POST /admin/users]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/admin/users/:id — Cập nhật tài khoản
// Body: { fullName?, role?, storeId?, newPassword? }
// ─────────────────────────────────────────────────────────────────────────────
router.put("/:id", verifyToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const isSelf = id === req.user.id;

    const { fullName, role, storeId, newPassword, phone, email } = req.body;

    // Admin không thể tự đổi role của mình (tránh tự hạ quyền)
    if (isSelf && role && role !== req.user.role) {
      return res.status(400).json({ error: "Không thể tự thay đổi role của mình." });
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing || !ALLOWED_ROLES.includes(existing.role)) {
      return res.status(404).json({ error: "Không tìm thấy tài khoản." });
    }

    const data = {};
    if (fullName)   data.fullName = fullName.trim();
    if (phone !== undefined) data.phone = phone?.trim() || null;
    if (email)      data.email   = email.trim();
    if (role && ALLOWED_ROLES.includes(role)) data.role = role;
    if (storeId !== undefined) data.store_id = storeId ? parseInt(storeId) : null;
    if (newPassword) {
      if (newPassword.length < 6) {
        return res.status(400).json({ error: "Mật khẩu phải có ít nhất 6 ký tự." });
      }
      data.password = await bcrypt.hash(newPassword, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: USER_SELECT,
    });

    res.json(user);
  } catch (err) {
    console.error("[PUT /admin/users/:id]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/admin/users/:id — Xóa tài khoản
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/:id", verifyToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (id === req.user.id) {
      return res.status(400).json({ error: "Không thể tự xóa tài khoản của mình." });
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing || !ALLOWED_ROLES.includes(existing.role)) {
      return res.status(404).json({ error: "Không tìm thấy tài khoản." });
    }

    await prisma.user.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error("[DELETE /admin/users/:id]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

module.exports = router;
