/**
 * lib/codes.js — Sinh MÃ CHỨNG TỪ thống nhất cho toàn hệ thống.
 *
 * Format: <PREFIX>-<YYMMDD>-<N số ngẫu nhiên>   vd: DV-260618-582137
 *   • PREFIX  → nhìn là biết loại (DV = Dịch Vụ, HD = Hóa Đơn mua sắm).
 *   • YYMMDD  → ngày tạo (dễ tra soát), theo giờ máy chủ.
 *   • số ngẫu nhiên (crypto) → KHÔNG tuần tự, chống đoán/liệt kê mã.
 *
 * Vì mỗi ngày có 10^N mã khả dụng nên va chạm gần như bằng 0 → KHÔNG cần
 * pre-check SELECT (chậm khi dữ liệu nhiều). Nơi gọi chỉ cần: sinh mã → insert;
 * nếu DB báo trùng unique (P2002) thì sinh mã khác thử lại (retry rất hiếm khi chạm).
 */
const crypto = require("crypto");

// Prefix cho từng loại chứng từ. Thêm loại mới ở đây khi cần (bảo hành, kho...).
const CODE_PREFIX = {
  service: "DV", // Dịch Vụ (booking giữ mèo / grooming / medical)
  order:   "HD", // Hóa Đơn mua sắm (Order)
};

const RANDOM_DIGITS = 6; // 10^6 mã/ngày/loại — thừa cho quy mô, va chạm ~0

function ymd(date = new Date()) {
  const y = String(date.getFullYear()).slice(-2);
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function randomDigits(n = RANDOM_DIGITS) {
  // crypto.randomInt → ngẫu nhiên an toàn, không đoán được
  return String(crypto.randomInt(0, 10 ** n)).padStart(n, "0");
}

/** Sinh 1 mã cho loại prefixKey ("service" | "order" | ...). date để backfill theo ngày cũ. */
function makeCode(prefixKey, date = new Date()) {
  const prefix = CODE_PREFIX[prefixKey] || prefixKey;
  return `${prefix}-${ymd(date)}-${randomDigits()}`;
}

/**
 * Helper insert kèm mã duy nhất: gọi tryInsert(code); nếu trùng unique cột `column`
 * (P2002) thì sinh mã khác thử lại tối đa maxTries. Trả về kết quả tryInsert.
 */
async function insertWithCode(prefixKey, column, tryInsert, { maxTries = 6, date } = {}) {
  let lastErr;
  for (let i = 0; i < maxTries; i++) {
    const code = makeCode(prefixKey, date);
    try {
      return await tryInsert(code);
    } catch (e) {
      if (e?.code === "P2002" && (e?.meta?.target || []).includes(column)) {
        lastErr = e;
        continue;
      }
      throw e;
    }
  }
  throw lastErr || new Error("Không sinh được mã duy nhất");
}

module.exports = { CODE_PREFIX, RANDOM_DIGITS, ymd, randomDigits, makeCode, insertWithCode };
