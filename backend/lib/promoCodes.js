/**
 * promoCodes — kiểm tra & tính giảm cho MÃ GIẢM GIÁ khách tự nhập.
 *
 * Tách riêng để checkout đơn hàng (đợt 2) và đặt dịch vụ (đợt 3) dùng CHUNG một logic —
 * không lặp lại luật ở nhiều nơi (tránh lệch nhau).
 */
const prisma = require("./prisma");

const TYPES = ["shipping", "percent", "fixed"];
const SCOPES = ["orders", "services", "both"];

/** Chuẩn hoá mã: bỏ khoảng trắng, viết HOA → so khớp không phân biệt hoa/thường. */
const normalizeCode = (c) => (c || "").trim().toUpperCase().replace(/\s+/g, "");

const fmtVnd = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/**
 * Kiểm tra 1 mã trong 1 ngữ cảnh + tính số tiền giảm.
 * @param ctx { scope:'order'|'service', subtotal, shipping_fee?, phone? }
 * @returns { ok:true, discount, code } | { ok:false, reason }
 */
async function validate(codeStr, ctx = {}) {
  const code = normalizeCode(codeStr);
  if (!code) return { ok: false, reason: "Chưa nhập mã." };

  const pc = await prisma.promoCode.findUnique({ where: { code } });
  if (!pc) return { ok: false, reason: "Mã không tồn tại." };
  if (!pc.active) return { ok: false, reason: "Mã đã ngừng áp dụng." };

  const now = new Date();
  if (pc.starts_at && now < pc.starts_at) return { ok: false, reason: "Mã chưa tới ngày áp dụng." };
  if (pc.ends_at && now > pc.ends_at) return { ok: false, reason: "Mã đã hết hạn." };

  // Phạm vi đơn hàng vs dịch vụ. Mã 'shipping' áp được cả hai: đơn hàng giảm phí ship,
  // dịch vụ giảm PHÍ ĐÓN TẬN NHÀ (caller truyền phí liên quan vào ctx.shipping_fee).
  const scope = ctx.scope === "service" ? "services" : "orders";
  if (pc.applies_to !== "both" && pc.applies_to !== scope) {
    return { ok: false, reason: pc.applies_to === "orders" ? "Mã chỉ áp cho đơn hàng." : "Mã chỉ áp cho dịch vụ." };
  }
  // Mã ship cần có phí giao/đón để giảm; không có (vd khách tự đem mèo tới) → vô nghĩa.
  if (pc.type === "shipping" && !(ctx.shipping_fee > 0)) {
    return { ok: false, reason: scope === "services" ? "Đơn này không có phí đón để giảm." : "Đơn này không có phí ship để giảm." };
  }

  const subtotal = Math.max(0, Math.round(ctx.subtotal || 0));
  if (pc.min_order && subtotal < pc.min_order) {
    return { ok: false, reason: `Đơn tối thiểu ${fmtVnd(pc.min_order)}đ mới dùng được mã.` };
  }

  // Giới hạn tổng lượt
  if (pc.usage_limit != null && pc.used_count >= pc.usage_limit) {
    return { ok: false, reason: "Mã đã hết lượt sử dụng." };
  }
  // Giới hạn mỗi khách (theo SĐT)
  if (pc.per_customer_limit != null && ctx.phone) {
    const used = await prisma.promoRedemption.count({ where: { code_id: pc.id, phone: ctx.phone } });
    if (used >= pc.per_customer_limit) return { ok: false, reason: "Bạn đã dùng mã này rồi." };
  }

  const discount = computeDiscount(pc, subtotal, Math.max(0, Math.round(ctx.shipping_fee || 0)));
  if (discount <= 0) return { ok: false, reason: "Mã không giảm được cho đơn này." };

  return { ok: true, discount, code: pc };
}

/** Số tiền giảm theo loại. Luôn bị chặn không vượt phần liên quan (không âm, không quá đơn/ship). */
function computeDiscount(pc, subtotal, shippingFee) {
  let d = 0;
  if (pc.type === "shipping") {
    d = pc.value === 0 ? shippingFee : Math.min(pc.value, shippingFee); // value 0 = miễn phí toàn bộ ship
  } else if (pc.type === "percent") {
    d = Math.floor((subtotal * pc.value) / 100);
    if (pc.max_discount) d = Math.min(d, pc.max_discount);
  } else if (pc.type === "fixed") {
    d = Math.min(pc.value, subtotal);
  }
  return Math.max(0, d);
}

/**
 * Ghi nhận mã đã dùng — GỌI TRONG transaction lúc tạo đơn/booking để atomic.
 * @param tx prisma client trong transaction
 */
async function redeem(tx, pc, { phone, orderRef, discount }) {
  await tx.promoCode.update({ where: { id: pc.id }, data: { used_count: { increment: 1 } } });
  await tx.promoRedemption.create({
    data: { code_id: pc.id, phone: phone || null, order_ref: orderRef || null, discount: Math.round(discount) },
  });
}

module.exports = { normalizeCode, validate, computeDiscount, redeem, TYPES, SCOPES };
