const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// Không cho phép fallback hardcoded — dùng random key với cảnh báo rõ ràng
const JWT_SECRET = process.env.JWT_SECRET || (() => {
  console.warn(
    "[Auth] WARNING: JWT_SECRET không được cấu hình trong .env!\n" +
    "         Đang dùng random key — tất cả session sẽ hết hạn khi server restart.\n" +
    "         Hãy thêm JWT_SECRET=<chuỗi dài ngẫu nhiên> vào file .env."
  );
  return crypto.randomBytes(64).toString("hex");
})();

const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Không có token. Vui lòng đăng nhập." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Token không hợp lệ hoặc đã hết hạn." });
  }
};

// Middleware không bắt buộc auth — gắn req.user nếu token hợp lệ, không lỗi nếu thiếu
const optionalAuth = (req, _res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (token) {
    try { req.user = jwt.verify(token, JWT_SECRET); } catch { /* ignore */ }
  }
  next();
};

module.exports = { verifyToken, optionalAuth, JWT_SECRET };