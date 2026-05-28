/**
 * storeContext — phải chạy SAU verifyToken.
 *
 * Gắn hai thuộc tính vào req:
 *   req.isAdmin  — true nếu role là "admin" (xem được mọi store)
 *   req.storeId  — Int | null
 *     · admin không truyền ?store_id → null (không lọc, thấy tất cả)
 *     · admin truyền ?store_id=X    → X   (lọc 1 store cụ thể)
 *     · manager/hr-manager/stock-manager/employee → store_id từ JWT
 */
const storeContext = (req, res, next) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: "Không có token. Vui lòng đăng nhập." });

  req.isAdmin = user.role === "admin";

  if (req.isAdmin) {
    const q = req.query.store_id;
    req.storeId = q ? parseInt(q, 10) : null;
  } else {
    req.storeId = user.store_id ?? null;
  }

  next();
};

module.exports = { storeContext };
