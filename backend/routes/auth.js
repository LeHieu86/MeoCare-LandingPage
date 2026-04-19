const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../middleware/auth");

// THAY ĐỔI: Xóa dòng const db = require("../db/database"); cũ đi
// và thay bằng dòng này:
const prisma = require("../lib/prisma");

const router = express.Router();

// ================== LOGIN ==================
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Vui lòng nhập đầy đủ thông tin." });
    }

    // THAY ĐỔI: Truy vấn bằng Prisma thay vì db.prepare()
    // Vì username đã được đặt là @unique trong schema, nên ta dùng findUnique
    const user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user) {
      return res.status(401).json({ error: "Tài khoản không tồn tại." });
    }

    // check password (Giữ nguyên)
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: "Sai mật khẩu." });
    }

    // tạo token (Giữ nguyên)
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
        username: user.username,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== VERIFY TOKEN ==================
// Route này không gọi Database nên KHÔNG CẦN THAY ĐỔI gì hết
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