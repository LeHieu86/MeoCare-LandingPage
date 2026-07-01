/**
 * voucherBenefit.js — Ánh xạ DỊCH VỤ ↔ loại voucher (ưu đãi mua mèo) + tính tiền giảm.
 *
 * Mục đích: mỗi dịch vụ chỉ hiện voucher áp được cho nó → khách không chọn nhầm.
 *   • boarding (giữ mèo)   → boarding_free_nights
 *   • grooming (spa)       → grooming_free
 *   • medical  (y tế)      → vaccine_discount, health_check
 * (membership giảm % đồ ăn và voucher 'other' là dành cho đơn MUA SẮM, không cho dịch vụ.)
 */

export const SERVICE_VOUCHER_TYPES = {
    boarding: ["boarding_free_nights"],
    grooming: ["grooming_free"],
    medical:  ["vaccine_discount", "health_check"],
};

// Loại voucher hợp lệ cho 1 dịch vụ — ưu tiên khớp key, fallback theo pricingType.
export const applicableVoucherTypes = (svc) => {
    const key = (svc?.key || "").toLowerCase();
    if (SERVICE_VOUCHER_TYPES[key]) return SERVICE_VOUCHER_TYPES[key];
    switch (svc?.pricingType) {
        case "per_day":   return SERVICE_VOUCHER_TYPES.boarding;
        case "package":   return SERVICE_VOUCHER_TYPES.grooming;
        case "procedure": return SERVICE_VOUCHER_TYPES.medical;
        default:          return [];
    }
};

// Lọc ví voucher của khách → chỉ giữ voucher áp được cho dịch vụ đang đặt.
export const filterVouchersForService = (vouchers, svc) => {
    const types = applicableVoucherTypes(svc);
    return (vouchers || []).filter((v) => types.includes(v.type));
};

// Gộp voucher TRÙNG (cùng type + title + value) → 1 mục có count.
// Khách mua N con mèo sẽ có N voucher giống hệt → dropdown hiện "... ×N" thay vì N dòng.
// id đại diện = voucher đầu tiên trong nhóm (id THẬT) để lưu vào booking bình thường.
export const groupVouchers = (vouchers) => {
    const groups = [];
    const index = new Map();
    for (const v of (vouchers || [])) {
        const key = `${v.type}|${v.title}|${JSON.stringify(v.value || {})}`;
        if (index.has(key)) {
            groups[index.get(key)].count += 1;
        } else {
            index.set(key, groups.length);
            groups.push({ id: v.id, type: v.type, title: v.title, value: v.value, count: 1 });
        }
    }
    return groups;
};

// Tiền giảm cho voucher GÓI (grooming/medical) trên 1 giá gói cố định.
//   grooming_free / health_check → miễn phí gói (giảm = giá gói)
//   vaccine_discount             → giảm theo %
export const packageVoucherDiscount = (voucher, packagePrice) => {
    if (!voucher) return 0;
    const price = Number(packagePrice) || 0;
    switch (voucher.type) {
        case "grooming_free":
        case "health_check":
            return price;
        case "vaccine_discount": {
            const pct = Number(voucher.value?.pct) || 0;
            return Math.min(price, Math.round((price * pct) / 100));
        }
        default:
            return 0;
    }
};
