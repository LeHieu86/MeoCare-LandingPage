const express   = require("express");
const bcrypt    = require("bcryptjs");
const jwt       = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const { JWT_SECRET } = require("../middleware/auth");
const prisma = require("../lib/prisma");

const router = express.Router();

// ── Rate limiters áp dụng riêng từng endpoint ────────────────────────────────
// Chỉ login & register mới cần bảo vệ brute-force.
// /verify KHÔNG rate-limit vì client gọi nhiều lần khi navigate.

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 10,                   // 10 lần thử / 15 phút / IP — đủ chống brute-force
  message: { error: "Quá nhiều lần thử đăng nhập, vui lòng thử lại sau 15 phút." },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Chỉ đếm lần THẤT BẠI, không đếm login thành công
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 giờ
  max: 5,                    // 5 tài khoản / giờ / IP
  message: { error: "Quá nhiều yêu cầu đăng ký, vui lòng thử lại sau." },
  standardHeaders: true,
  legacyHeaders: false,
});

const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 5,                    // 5 lần / 15 phút / IP — chống dò email
  message: { error: "Quá nhiều yêu cầu đặt lại mật khẩu, vui lòng thử lại sau 15 phút." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ================== REGISTER ==================
router.post("/register", registerLimiter, async (req, res) => {
  try {
    const { fullName, username, email, phone, password } = req.body;

    // Validate bắt buộc
    if (!fullName || !username || !email || !password) {
      return res.status(400).json({
        error: "Vui lòng nhập đầy đủ: họ tên, tên đăng nhập, email và mật khẩu.",
      });
    }

    // Validate độ dài mật khẩu
    if (password.length < 6) {
      return res.status(400).json({
        error: "Mật khẩu phải có ít nhất 6 ký tự.",
      });
    }

    // Validate định dạng email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Email không hợp lệ." });
    }

    // Kiểm tra username đã tồn tại chưa
    const existingUsername = await prisma.user.findUnique({
      where: { username },
    });
    if (existingUsername) {
      return res.status(409).json({ error: "Tên đăng nhập đã được sử dụng." });
    }

    // Kiểm tra email đã tồn tại chưa
    const existingEmail = await prisma.user.findUnique({
      where: { email },
    });
    if (existingEmail) {
      return res.status(409).json({ error: "Email đã được sử dụng." });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Tạo user mới — role mặc định là "customer"
    const newUser = await prisma.user.create({
      data: {
        fullName,
        username,
        email,
        phone: phone || null,
        password: hashedPassword,
        role: "customer",
      },
    });

    // Tạo JWT token luôn sau khi đăng ký
    const token = jwt.sign(
      {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role,
      },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.status(201).json({
      message: "Đăng ký thành công!",
      token,
      user: {
        id: newUser.id,
        fullName: newUser.fullName,
        username: newUser.username,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role,
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== LOGIN ==================
router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { username, password, remember } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Vui lòng nhập đầy đủ thông tin." });
    }

    const identifier = username.trim();
    const isPhone = /^0[3-9]\d{8}$/.test(identifier);

    let user;
    if (isPhone) {
      user = await prisma.user.findFirst({
        where: { phone: identifier },
      });
    } else {
      user = await prisma.user.findUnique({
        where: { username: identifier },
      });
    }

    if (!user) {
      return res.status(401).json({
        error: isPhone
          ? "Không tìm thấy tài khoản với số điện thoại này."
          : "Tài khoản không tồn tại.",
      });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: "Sai mật khẩu." });
    }

    // remember=true → 7 ngày, false → 12 giờ (đủ cho 1 ca dài)
    const expiresIn = remember ? "7d" : "12h";

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        store_id: user.store_id ?? null,
      },
      JWT_SECRET,
      { expiresIn }
    );

    res.json({
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: user.role,
        store_id: user.store_id ?? null,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== FORGOT PASSWORD (tự phục vụ qua xác minh email) ==================
// Không dùng email server: xác minh danh tính bằng (username|phone) + email khớp hồ sơ,
// rồi cho đặt mật khẩu mới ngay. Trả lỗi chung để tránh dò tài khoản.
router.post("/forgot-password", forgotLimiter, async (req, res) => {
  try {
    const { identifier, email, newPassword } = req.body;

    if (!identifier || !email || !newPassword) {
      return res.status(400).json({ error: "Vui lòng nhập đầy đủ thông tin." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Mật khẩu mới phải có ít nhất 6 ký tự." });
    }

    const id = identifier.trim();
    const isPhone = /^0[3-9]\d{8}$/.test(id);

    const user = isPhone
      ? await prisma.user.findFirst({ where: { phone: id } })
      : await prisma.user.findUnique({ where: { username: id } });

    // Lỗi chung — không tiết lộ tài khoản/email nào tồn tại
    const genericErr =
      "Thông tin không khớp. Vui lòng kiểm tra lại tên đăng nhập/số điện thoại và email đã đăng ký.";

    if (!user) {
      return res.status(400).json({ error: genericErr });
    }

    const onFileEmail = (user.email || "").trim().toLowerCase();
    const givenEmail  = email.trim().toLowerCase();
    // Chặn trường hợp email mặc định chưa cập nhật
    if (!onFileEmail || onFileEmail === "chua_cap_nhat@email.com" || onFileEmail !== givenEmail) {
      return res.status(400).json({ error: genericErr });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });

    res.json({ success: true, message: "Đặt lại mật khẩu thành công. Bạn có thể đăng nhập ngay." });
  } catch (err) {
    console.error("Forgot-password error:", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== VERIFY TOKEN ==================
router.post("/verify", (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ valid: false });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    res.json({
      valid: true,
      user: decoded,
    });
  } catch (err) {
    res.status(401).json({ valid: false });
  }
});

module.exports = router;