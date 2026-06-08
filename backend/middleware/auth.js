const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// JWT_SECRET BẮT BUỘC ở production (fail-closed). Dev: cho phép random key kèm cảnh báo.
const JWT_SECRET = process.env.JWT_SECRET || (() => {
  if (process.env.NODE_ENV === "production") {
    // Thiếu secret ở production → từ chối khởi động, tránh ký token bằng key yếu/đổi mỗi lần restart
    throw new Error(
      "[Auth] FATAL: JWT_SECRET chưa được cấu hình ở production. " +
      "Hãy thêm JWT_SECRET=<chuỗi dài ngẫu nhiên> vào .env rồi khởi động lại."
    );
  }
  console.warn(
    "[Auth] WARNING: JWT_SECRET không được cấu hình trong .env!\n" +
    "         Đang dùng random key (DEV) — tất cả session sẽ hết hạn khi server restart.\n" +
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