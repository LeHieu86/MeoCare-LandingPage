const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../middleware/auth");

const router = express.Router();

// ── Credentials (in production, store in DB / env) ───────────────────────────
// Hash of "Hieu2003" — generated via bcrypt.hashSync("meocare@2024", 10)
const ADMIN = {
  username: "admin",
  // To regenerate: node -e "const b=require('bcryptjs');console.log(b.hashSync('meocare@2024',10))"
  passwordHash: bcrypt.hashSync("@Hieu2003", 10),
};

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Vui lòng nhập đầy đủ thông tin." });
  }

  if (username !== ADMIN.username) {
    return res.status(401).json({ error: "Tên đăng nhập hoặc mật khẩu không đúng." });
  }

  const match = await bcrypt.compare(password, ADMIN.passwordHash);
  if (!match) {
    return res.status(401).json({ error: "Tên đăng nhập hoặc mật khẩu không đúng." });
  }

  const token = jwt.sign(
    { username: ADMIN.username, role: "admin" },
    JWT_SECRET,
    { expiresIn: "8h" }
  );

  res.json({ token, message: "Đăng nhập thành công!" });
});

// POST /api/auth/verify  — check if token is still valid
router.post("/verify", (req, res) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ valid: false });

  try {
    const { JWT_SECRET: secret } = require("../middleware/auth");
    require("jsonwebtoken").verify(token, secret);
    res.json({ valid: true });
  } catch {
    res.status(401).json({ valid: false });
  }
});

module.exports = router;