const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "meocare_super_secret_2024";

const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Không có token. Vui lòng đăng nhập." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // ✅ đổi chỗ này
    next();
  } catch {
    return res.status(403).json({ error: "Token không hợp lệ hoặc đã hết hạn." });
  }
};

module.exports = { verifyToken, JWT_SECRET };