/**
 * storeContext — phải chạy SAU verifyToken.
 *
 * Gắn hai thuộc tính vào req:
 *   req.isAdmin    — true nếu role là "admin" hoặc "hr-manager"
 *                    (cả hai đều xem được toàn hệ thống)
 *   req.isHrManager — true nếu role là "hr-manager"
 *   req.storeId    — Int | null
 *     · admin / hr-manager không truyền ?store_id → null (không lọc, thấy tất cả)
 *     · admin / hr-manager truyền ?store_id=X     → X   (lọc 1 store cụ thể)
 *     · manager/employee → store_id từ JWT
 *     · stock-manager có store_id   → store_id từ JWT
 *     · stock-manager không có store_id → tự động lấy warehouse store
 *
 * Lý do hr-manager = global access:
 *   HR quản lý nhân sự toàn công ty, không bị giới hạn theo chi nhánh.
 */
const prisma = require("../lib/prisma");

const storeContext = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Không có token. Vui lòng đăng nhập." });

    req.isHrManager = user.role === "hr-manager";
    req.isAdmin     = user.role === "admin";
    // isGlobalViewer = có thể xem toàn hệ thống (không lọc theo store)
    // admin + hr-manager đều có quyền này
    req.isGlobalViewer = req.isAdmin || req.isHrManager;

    if (req.isGlobalViewer) {
      // Ưu tiên query param, fallback sang body (cho POST/PUT từ mobile app)
      const q = req.query.store_id ?? req.body?.store_id;
      req.storeId = q ? parseInt(q, 10) : null;
    } else if (user.role === "stock-manager" && !user.store_id) {
      // stock-manager không gắn store → tự động dùng kho trung tâm
      const warehouse = await prisma.store.findFirst({
        where: { isWarehouse: true },
        select: { id: true },
      });
      if (!warehouse) {
        return res.status(500).json({ error: "Chưa cấu hình Kho Tổng (isWarehouse = true). Liên hệ admin." });
      }
      req.storeId = warehouse.id;
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
