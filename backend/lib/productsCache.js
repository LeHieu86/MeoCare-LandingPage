/**
 * productsCache — cache list sản phẩm trong RAM (catalog ít thay đổi).
 *
 * Vì sao: GET /api/products là endpoint đọc nặng nhất (query 500 sp + variant, flatten mỗi
 * request). Catalog rất ít đổi → cache trong RAM giúp đa số request trả từ bộ nhớ, bỏ qua DB.
 *
 * An toàn dữ liệu cũ: TTL ngắn (mặc định 60s) LÀM MỐC AN TOÀN, đồng thời products.js/reviews.js
 * CHỦ ĐỘNG gọi invalidate() ngay khi có thay đổi (thêm/sửa/xóa sp, review mới) → không trả cũ.
 *
 * Lưu ý: cache theo từng process. Khi chạy nhiều process (PM2 cluster) mỗi worker có cache
 * riêng, lệch nhau tối đa = TTL — chấp nhận được với catalog.
 */
const TTL_MS = parseInt(process.env.PRODUCTS_CACHE_TTL_MS || "60000", 10);
const store = new Map(); // key -> { data, expires }

function get(key) {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.data;
  if (hit) store.delete(key); // hết hạn → dọn
  return null;
}

function set(key, data) {
  store.set(key, { data, expires: Date.now() + TTL_MS });
}

function invalidate() {
  store.clear();
}

module.exports = { get, set, invalidate, TTL_MS };
