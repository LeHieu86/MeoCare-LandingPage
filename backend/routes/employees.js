/**
 * /api/employees
 * Quản lý nhân viên (admin / manager)
 */
const express  = require("express");
const bcrypt   = require("bcryptjs");
const prisma   = require("../lib/prisma");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

// ── Middleware kiểm tra quyền admin hoặc manager ──────────────
const requireManager = (req, res, next) => {
  const { role } = req.user || {};
  if (!["admin", "manager"].includes(role)) {
    return res.status(403).json({ error: "Không có quyền thực hiện thao tác này." });
  }
  next();
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/employees — Danh sách nhân viên
// ─────────────────────────────────────────────────────────────────────────────
router.get("/", verifyToken, requireManager, async (req, res) => {
  try {
    const { status, department, search } = req.query;

    const where = {};
    if (status)     where.status = status;
    if (department) where.department = department;

    const employees = await prisma.employee.findMany({
      where,
      include: {
        user: {
          select: { id: true, username: true, fullName: true, email: true, phone: true, avatar: true, role: true },
        },
      },
      orderBy: { employeeCode: "asc" },
    });

    // Filter by search (fullName / phone / employeeCode)
    const filtered = search
      ? employees.filter(
          (e) =>
            e.user.fullName.toLowerCase().includes(search.toLowerCase()) ||
            e.employeeCode.toLowerCase().includes(search.toLowerCase()) ||
            e.user.phone?.includes(search) ||
            e.user.email?.toLowerCase().includes(search.toLowerCase())
        )
      : employees;

    res.json(filtered);
  } catch (err) {
    console.error("[GET /employees]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/employees/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    // Nhân viên chỉ được xem profile của chính mình
    if (!["admin", "manager"].includes(req.user.role)) {
      const emp = await prisma.employee.findFirst({ where: { userId: req.user.id } });
      if (!emp || emp.id !== id) return res.status(403).json({ error: "Không có quyền." });
    }

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, username: true, fullName: true, email: true, phone: true, avatar: true, role: true },
        },
      },
    });
    if (!employee) return res.status(404).json({ error: "Không tìm thấy nhân viên." });
    res.json(employee);
  } catch (err) {
    console.error("[GET /employees/:id]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/employees/me/profile — Nhân viên xem profile của mình
// ─────────────────────────────────────────────────────────────────────────────
router.get("/me/profile", verifyToken, async (req, res) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { userId: req.user.id },
      include: {
        user: {
          select: { id: true, username: true, fullName: true, email: true, phone: true, avatar: true, role: true },
        },
      },
    });
    if (!employee) return res.status(404).json({ error: "Không tìm thấy hồ sơ nhân viên." });
    res.json(employee);
  } catch (err) {
    console.error("[GET /employees/me/profile]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/employees — Tạo nhân viên mới (tạo cả User account)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/", verifyToken, requireManager, async (req, res) => {
  try {
    const {
      // Thông tin tài khoản
      username, password, fullName, email, phone,
      // Thông tin nhân viên
      department, position, startDate, salaryType, baseSalary, note,
      // Role (employee | manager)
      role = "employee",
    } = req.body;

    if (!username || !password || !fullName || !email) {
      return res.status(400).json({ error: "Vui lòng nhập đầy đủ: username, password, họ tên, email." });
    }
    if (!["employee", "manager"].includes(role)) {
      return res.status(400).json({ error: "Role không hợp lệ. Chọn employee hoặc manager." });
    }
    // Chỉ admin mới được tạo manager
    if (role === "manager" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Chỉ admin mới có thể tạo tài khoản manager." });
    }

    // Kiểm tra trùng
    const [existUsername, existEmail] = await Promise.all([
      prisma.user.findUnique({ where: { username } }),
      prisma.user.findUnique({ where: { email } }),
    ]);
    if (existUsername) return res.status(409).json({ error: "Username đã được sử dụng." });
    if (existEmail)    return res.status(409).json({ error: "Email đã được sử dụng." });

    // Tạo mã nhân viên tự động
    const lastEmp = await prisma.employee.findFirst({ orderBy: { id: "desc" } });
    const nextNum = lastEmp ? parseInt(lastEmp.employeeCode.replace(/\D/g, "")) + 1 : 1;
    const employeeCode = `NV${String(nextNum).padStart(3, "0")}`;

    const hashed = await bcrypt.hash(password, 10);

    // Transaction: tạo User + Employee cùng lúc
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { username, password: hashed, fullName, email, phone: phone || "Null", role },
      });
      const employee = await tx.employee.create({
        data: {
          userId: user.id,
          employeeCode,
          department: department || "general",
          position: position || "Nhân viên",
          startDate: startDate ? new Date(startDate) : new Date(),
          salaryType: salaryType || "monthly",
          baseSalary: parseInt(baseSalary) || 0,
          note,
        },
        include: {
          user: {
            select: { id: true, username: true, fullName: true, email: true, phone: true, role: true },
          },
        },
      });
      return employee;
    });

    res.status(201).json(result);
  } catch (err) {
    console.error("[POST /employees]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/employees/:id — Cập nhật nhân viên
// ─────────────────────────────────────────────────────────────────────────────
router.put("/:id", verifyToken, requireManager, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const {
      fullName, email, phone, avatar,
      department, position, startDate, endDate,
      salaryType, baseSalary, status, note,
      role, password,
    } = req.body;

    const employee = await prisma.employee.findUnique({ where: { id }, include: { user: true } });
    if (!employee) return res.status(404).json({ error: "Không tìm thấy nhân viên." });

    // Chỉ admin mới được đổi role sang manager
    if (role === "manager" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Chỉ admin mới có thể gán quyền manager." });
    }

    await prisma.$transaction(async (tx) => {
      // Cập nhật User
      const userUpdate = {};
      if (fullName !== undefined) userUpdate.fullName = fullName;
      if (email !== undefined)    userUpdate.email    = email;
      if (phone !== undefined)    userUpdate.phone    = phone;
      if (avatar !== undefined)   userUpdate.avatar   = avatar;
      if (role !== undefined && ["employee","manager"].includes(role)) userUpdate.role = role;
      if (password) userUpdate.password = await bcrypt.hash(password, 10);

      if (Object.keys(userUpdate).length > 0) {
        await tx.user.update({ where: { id: employee.userId }, data: userUpdate });
      }

      // Cập nhật Employee
      const empUpdate = {};
      if (department !== undefined) empUpdate.department = department;
      if (position   !== undefined) empUpdate.position   = position;
      if (startDate  !== undefined) empUpdate.startDate  = new Date(startDate);
      if (endDate    !== undefined) empUpdate.endDate    = endDate ? new Date(endDate) : null;
      if (salaryType !== undefined) empUpdate.salaryType = salaryType;
      if (baseSalary !== undefined) empUpdate.baseSalary = parseInt(baseSalary);
      if (status     !== undefined) empUpdate.status     = status;
      if (note       !== undefined) empUpdate.note       = note;

      if (Object.keys(empUpdate).length > 0) {
        await tx.employee.update({ where: { id }, data: empUpdate });
      }
    });

    const updated = await prisma.employee.findUnique({
      where: { id },
      include: { user: { select: { id: true, username: true, fullName: true, email: true, phone: true, role: true, avatar: true } } },
    });
    res.json(updated);
  } catch (err) {
    console.error("[PUT /employees/:id]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/employees/:id — Vô hiệu hóa (không xóa cứng)
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/:id", verifyToken, requireManager, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.employee.update({
      where: { id },
      data: { status: "terminated", endDate: new Date() },
    });
    res.json({ message: "Đã vô hiệu hóa nhân viên." });
  } catch (err) {
    console.error("[DELETE /employees/:id]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

module.exports = router;
