/**
 * storeFilter — helpers dùng chung cho mọi route cần lọc theo store.
 *
 * Cách dùng trong route:
 *
 *   const { storeWhere, injectStoreId } = require("../lib/storeFilter");
 *
 *   // Đọc danh sách — tự động lọc theo store
 *   const bookings = await prisma.booking.findMany({
 *     where: { ...storeWhere(req), status: "pending" }
 *   });
 *
 *   // Tạo mới — lấy store_id để ghi vào record
 *   const data = { ...req.body, ...injectStoreId(req) };
 *   await prisma.booking.create({ data });
 *
 * Middleware chain yêu cầu: verifyToken → storeContext → route handler
 */

/**
 * Trả về fragment where để lọc theo store.
 * - owner không truyền ?store_id  → {} (không lọc, thấy tất cả)
 * - owner truyền   ?store_id=2   → { store_id: 2 }
 * - user thường                  → { store_id: req.storeId }
 *
 * @param {import("express").Request} req
 * @param {string} [field="store_id"]
 */
const storeWhere = (req, field = "store_id") => {
  if (req.isOwner && req.storeId === null) return {};
  if (req.storeId === null || req.storeId === undefined) return {};
  return { [field]: req.storeId };
};

/**
 * Trả về { store_id: N } để merge vào data khi create/update.
 * Throws nếu user không có store_id (không nên xảy ra với logic login đúng).
 *
 * Owner phải truyền store_id qua req.body hoặc req.query,
 * đã được storeContext đặt vào req.storeId rồi.
 *
 * @param {import("express").Request} req
 */
const injectStoreId = (req) => {
  if (req.storeId === null || req.storeId === undefined) {
    throw Object.assign(
      new Error("Không xác định được chi nhánh. Owner cần truyền store_id."),
      { statusCode: 400 }
    );
  }
  return { store_id: req.storeId };
};

module.exports = { storeWhere, injectStoreId };
