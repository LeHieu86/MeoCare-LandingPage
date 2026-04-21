const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../middleware/auth");
const prisma = require("../lib/prisma");

const router = express.Router();

// ================== REGISTER ==================
router.post("/register", async (req, res) => {
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
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Vui lòng nhập đầy đủ thông tin." });
    }

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return res.status(401).json({ error: "Tài khoản không tồn tại." });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: "Sai mật khẩu." });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: "8h" }
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
      },
    });
  } catch (err) {
    console.error("Login error:", err);
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