/**
 * /api/employees
 * Quản lý nhân viên (admin / manager)
 */
const express  = require("express");
const bcrypt   = require("bcryptjs");
const prisma   = require("../lib/prisma");
const { verifyToken } = require("../middleware/auth");
const { storeContext } = require("../middleware/storeContext");
const { storeWhere } = require("../lib/storeFilter");
const { getIO } = require("../socket");

const router = express.Router();

// ── Middleware ────────────────────────────────────────────────
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Chỉ admin mới có quyền thực hiện thao tác này." });
  }
  next();
};

const requireManager = (req, res, next) => {
  const { role } = req.user || {};
  if (!["admin", "hr-manager", "manager"].includes(role)) {
    return res.status(403).json({ error: "Không có quyền thực hiện thao tác này." });
  }
  next();
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/employees — Danh sách nhân viên
// ─────────────────────────────────────────────────────────────────────────────
router.get("/", verifyToken, storeContext, requireManager, async (req, res) => {
  try {
    const { status, department, search, role, employment_type } = req.query;

    const where = { ...storeWhere(req) };
    if (status)          where.status = status;
    if (department)      where.department = department;
    if (employment_type) where.employmentType = employment_type;

    // HR Manager: có thể filter theo role user, loại trừ admin & hr-manager
    // role query → filter vào bảng User (join qua user relation)
    const userRoleFilter = (() => {
      if (role) {
        // Không cho phép lấy admin/hr-manager qua API này
        if (["admin", "hr-manager"].includes(role)) return null;
        return { role };
      }
      // Không truyền role → trả tất cả trừ admin + hr-manager
      return { role: { notIn: ["admin", "hr-manager"] } };
    })();

    // Nếu role filter bị chặn → trả rỗng
    if (userRoleFilter === null) return res.json([]);

    const employees = await prisma.employee.findMany({
      where,
      include: {
        user: {
          select: {
            id: true, username: true, fullName: true, email: true,
            phone: true, avatar: true, role: true,
            store: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { employeeCode: "asc" },
    });

    // Filter by user.role (JS side vì Prisma relation filter khác cú pháp)
    let filtered = employees.filter(e => {
      const uRole = e.user?.role;
      if (!uRole) return false;
      if (["admin", "hr-manager"].includes(uRole)) return false; // luôn ẩn
      if (role && uRole !== role) return false;
      return true;
    });

    // Filter by search
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(e =>
        e.user.fullName.toLowerCase().includes(q) ||
        e.employeeCode.toLowerCase().includes(q) ||
        e.user.phone?.includes(search) ||
        e.user.email?.toLowerCase().includes(q)
      );
    }

    // Flatten: gắn role, full_name, store_name ra top-level cho Flutter dễ đọc
    const result = filtered.map(e => ({
      ...e,
      role:       e.user?.role,
      full_name:  e.user?.fullName,
      store_name: e.user?.store?.name,
      store_id:   e.store_id,
    }));

    res.json(result);
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
    if (!["admin", "hr-manager", "manager"].includes(req.user.role)) {
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
// PUT /api/employees/me/bank — Nhân viên cập nhật thông tin ngân hàng
// ─────────────────────────────────────────────────────────────────────────────
router.put("/me/bank", verifyToken, async (req, res) => {
  try {
    const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });
    if (!employee) return res.status(404).json({ error: "Không tìm thấy hồ sơ nhân viên." });

    const { bankName, bankAccount, bankAccountName, bankBin } = req.body;

    // Validate số tài khoản: chỉ chứa số, 6–20 ký tự
    if (bankAccount && !/^\d{6,20}$/.test(bankAccount.trim())) {
      return res.status(400).json({ error: "Số tài khoản không hợp lệ (6–20 chữ số)." });
    }

    const updated = await prisma.employee.update({
      where: { id: employee.id },
      data: {
        bankName:        bankName?.trim()        || null,
        bankAccount:     bankAccount?.trim()     || null,
        bankAccountName: bankAccountName?.trim() || null,
        bankBin:         bankBin?.trim()         || null,
      },
    });

    res.json({ success: true, employee: updated });
  } catch (err) {
    console.error("[PUT /employees/me/bank]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/employees — Tạo nhân viên mới (tạo cả User account)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/", verifyToken, storeContext, requireManager, async (req, res) => {
  try {
    const {
      // Thông tin tài khoản
      username, password, fullName, email, phone,
      // Thông tin nhân viên
      department, position, startDate, salaryType, employmentType, baseSalary, note,
      // Thông tin cá nhân bổ sung
      cccd, birthDate, gender = "male", avatar,
      // Role (employee | manager)
      role = "employee",
      // store_id: admin có thể truyền thẳng để gán chi nhánh cho manager
      store_id: bodyStoreId,
    } = req.body;

    // employmentType → salaryType mapping (full_time = monthly, part_time = hourly)
    const resolvedSalaryType = employmentType === "part_time" ? "hourly"
                             : employmentType === "full_time"  ? "monthly"
                             : salaryType || "monthly";

    if (!username || !password || !fullName || !email) {
      return res.status(400).json({ error: "Vui lòng nhập đầy đủ: username, password, họ tên, email." });
    }
    const allowedRoles = ["employee", "manager", "hr-manager", "stock-manager"];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: `Role không hợp lệ. Chọn một trong: ${allowedRoles.join(", ")}.` });
    }
    // Manager chi nhánh: chỉ được tạo role "employee"
    const managerRoles = ["manager", "hr-manager", "stock-manager"];
    if (managerRoles.includes(role) && req.user.role !== "admin") {
      return res.status(403).json({ error: "Chỉ admin mới có thể tạo tài khoản quản lý." });
    }
    if (req.user.role === "manager" && role !== "employee") {
      return res.status(403).json({ error: "Manager chi nhánh chỉ được tạo nhân viên với role employee." });
    }

    // Chạy song song: kiểm tra trùng + lấy các mã MMC hiện có + hash password
    const [existUsername, existEmail, mmcCodes, hashed] = await Promise.all([
      prisma.user.findUnique({ where: { username }, select: { id: true } }),
      prisma.user.findUnique({ where: { email },    select: { id: true } }),
      prisma.employee.findMany({
        where: { employeeCode: { startsWith: "MMC" } },
        select: { employeeCode: true },
      }),
      bcrypt.hash(password, 8), // cost 8 đủ bảo mật, nhanh hơn 10 ~4x
    ]);
    if (existUsername) return res.status(409).json({ error: "Username đã được sử dụng." });
    if (existEmail)    return res.status(409).json({ error: "Email đã được sử dụng." });

    // Tạo mã nhân viên tự động: MMC + số tăng dần (tối thiểu 3 chữ số, không giới hạn khi vượt 999).
    // Lấy số lớn nhất trong các mã MMC hiện có + 1 → an toàn khi có nhân viên bị xoá.
    const maxMmc = mmcCodes.reduce((max, { employeeCode }) => {
      const n = parseInt(employeeCode.slice(3), 10);
      return Number.isFinite(n) && n > max ? n : max;
    }, 0);
    const employeeCode = `MMC${String(maxMmc + 1).padStart(3, "0")}`;

    // Admin có thể truyền store_id trong body để gán chi nhánh cho manager/employee
    // Fallback về store_id từ context (admin đang xem chi nhánh nào)
    const storeId = bodyStoreId
      ? parseInt(bodyStoreId, 10)
      : (req.storeId ?? (() => { throw Object.assign(new Error("Vui lòng chọn chi nhánh cho nhân viên này."), { statusCode: 400 }); })());

    // Transaction: tạo User + Employee cùng lúc
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { store_id: storeId, username, password: hashed, fullName, email, phone: phone || "Null", role,
                avatar: avatar || null },
      });
      const employee = await tx.employee.create({
        data: {
          store_id: storeId,
          userId: user.id,
          employeeCode,
          department: department || "general",
          position: position || "Nhân viên",
          startDate: startDate ? new Date(startDate) : new Date(),
          cccd: cccd || null,
          birthDate: birthDate ? new Date(birthDate) : null,
          gender: gender || "male",
          salaryType: resolvedSalaryType,
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

    // Thông báo realtime cho HR
    try {
      const io = getIO();
      if (io) {
        const store = await prisma.store.findUnique({ where: { id: storeId }, select: { name: true } });
        io.to("hr-room").emit("employee:new", {
          id: `emp_${result.id}_${Date.now()}`,
          event: "employee:new",
          title: "👤 Nhân viên mới",
          body: `${fullName} vừa được thêm vào ${store?.name ?? "chi nhánh"}`,
          time: new Date().toISOString(),
        });
        io.to("admin-room").emit("employee:new", {
          id: `emp_${result.id}_${Date.now()}`,
          event: "employee:new",
          title: "👤 Nhân viên mới",
          body: `${fullName} vừa được thêm vào ${store?.name ?? "chi nhánh"}`,
          time: new Date().toISOString(),
        });
      }
    } catch { /* không critical */ }

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
      salaryType, employmentType, baseSalary, status, note,
      role, password,
      store_id: bodyStoreId,
      cccd, birthDate, gender, address,
      contractType,
      bankName, bankAccount, bankAccountName, bankBin,
    } = req.body;

    // employmentType → salaryType mapping (hỗ trợ cả hyphen và underscore)
    const normalizedEmpType = employmentType === "part_time" ? "part-time"
                            : employmentType === "full_time"  ? "full-time"
                            : employmentType; // "part-time" | "full-time" giữ nguyên
    const resolvedSalaryType = normalizedEmpType === "part-time" ? "hourly"
                             : normalizedEmpType === "full-time"  ? "monthly"
                             : salaryType;

    const employee = await prisma.employee.findUnique({ where: { id }, include: { user: true } });
    if (!employee) return res.status(404).json({ error: "Không tìm thấy nhân viên." });

    // Chỉ admin mới được đổi role sang các role quản lý
    const managerRoles = ["manager", "hr-manager", "stock-manager"];
    if (role !== undefined && managerRoles.includes(role) && req.user.role !== "admin") {
      return res.status(403).json({ error: "Chỉ admin mới có thể gán quyền quản lý." });
    }

    await prisma.$transaction(async (tx) => {
      // Cập nhật User
      const userUpdate = {};
      if (fullName !== undefined) userUpdate.fullName = fullName;
      if (email !== undefined)    userUpdate.email    = email;
      if (phone !== undefined)    userUpdate.phone    = phone;
      if (avatar !== undefined)   userUpdate.avatar   = avatar;
      if (role !== undefined && ["employee","manager","hr-manager","stock-manager"].includes(role)) userUpdate.role = role;
      if (bodyStoreId !== undefined) userUpdate.store_id = bodyStoreId ? parseInt(bodyStoreId, 10) : null;
      if (password) userUpdate.password = await bcrypt.hash(password, 10);

      if (Object.keys(userUpdate).length > 0) {
        await tx.user.update({ where: { id: employee.userId }, data: userUpdate });
      }

      // Cập nhật Employee
      const empUpdate = {};
      if (department          !== undefined) empUpdate.department    = department;
      if (position            !== undefined) empUpdate.position      = position;
      if (startDate           !== undefined) empUpdate.startDate     = new Date(startDate);
      if (endDate             !== undefined) empUpdate.endDate       = endDate ? new Date(endDate) : null;
      if (normalizedEmpType   !== undefined) empUpdate.employmentType = normalizedEmpType;
      if (resolvedSalaryType  !== undefined) empUpdate.salaryType     = resolvedSalaryType;
      if (baseSalary          !== undefined) empUpdate.baseSalary    = parseInt(baseSalary);
      if (status              !== undefined) empUpdate.status        = status;
      if (note                !== undefined) empUpdate.note          = note;
      if (cccd                !== undefined) empUpdate.cccd          = cccd || null;
      if (birthDate           !== undefined) empUpdate.birthDate     = birthDate ? new Date(birthDate) : null;
      if (gender              !== undefined) empUpdate.gender        = gender || null;
      if (address             !== undefined) empUpdate.address       = address || null;
      if (contractType        !== undefined) empUpdate.contractType  = contractType;
      if (bankName            !== undefined) empUpdate.bankName        = bankName || null;
      if (bankAccount         !== undefined) empUpdate.bankAccount     = bankAccount || null;
      if (bankAccountName     !== undefined) empUpdate.bankAccountName = bankAccountName || null;
      if (bankBin             !== undefined) empUpdate.bankBin         = bankBin || null;

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
router.delete("/:id", verifyToken, requireAdmin, async (req, res) => {
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

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/employees/:id/default-shift — HR gán ca mặc định cho full-time
// ─────────────────────────────────────────────────────────────────────────────
router.put("/:id/default-shift", verifyToken, async (req, res) => {
  try {
    if (!["admin", "hr-manager"].includes(req.user.role))
      return res.status(403).json({ error: "Chỉ HR Manager mới có quyền." });

    const { shift_id } = req.body; // null = xóa ca mặc định
    const emp = await prisma.employee.update({
      where: { id: parseInt(req.params.id) },
      data:  { defaultShiftId: shift_id ? parseInt(shift_id) : null },
      include: { defaultShift: { select: { id: true, name: true, startTime: true, endTime: true } } },
    });
    res.json({ success: true, employee: emp });
  } catch (err) {
    console.error("[PUT /employees/:id/default-shift]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

module.exports = router;
