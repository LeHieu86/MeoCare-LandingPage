/**
 * lib/address.js — Gom địa chỉ có cấu trúc của User thành 1 chuỗi đầy đủ.
 * Dùng cho prefill form (đặt lịch/đơn hàng) + geocode tính phí ship/đón.
 */
function composeAddress(u) {
  return [u?.addr_house, u?.addr_street, u?.addr_ward, u?.addr_city]
    .map((s) => (s || "").trim())
    .filter(Boolean)
    .join(", ");
}

module.exports = { composeAddress };
