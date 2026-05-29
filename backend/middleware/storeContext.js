/**
 * storeContext — phải chạy SAU verifyToken.
 *
 * Gắn hai thuộc tính vào req:
 *   req.isAdmin  — true nếu role là "admin" (xem được mọi store)
 *   req.storeId  — Int | null
 *     · admin không truyền ?store_id → null (không lọc, thấy tất cả)
 *     · admin truyền ?store_id=X    → X   (lọc 1 store cụ thể)
 *     · manager/hr-manager/employee → store_id từ JWT
 *     · stock-manager có store_id   → store_id từ JWT
 *     · stock-manager không có store_id → tự động lấy warehouse store
 */
const prisma = require("../lib/prisma");

const storeContext = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Không có token. Vui lòng đăng nhập." });

    req.isAdmin = user.role === "admin";

    if (req.isAdmin) {
      // Ưu tiên query param, fallback sang body (cho POST/PUT từ mobile app)
      const q = req.query.store_id ?? req.body?.store_id;
      req.storeId = q ? parseInt(q, 10) : null;
    } else if (user.role === "stock-manager" && !user.store_id) {
      // stock-manager không gắn store → tự động dùng kho trung tâm
      const warehouse = await prisma.store.findFirst({
        where: { is_warehouse: true },
        select: { id: true },
      });
      req.storeId = warehouse?.id ?? null;
    } else {
      req.storeId = user.store_id ?? null;
    }

    next();
  } catch (err) {
    console.error("[storeContext]", err);
    res.status(500).json({ error: "Lỗi xác định chi nhánh." });
  }
};

module.exports = { storeContext };
