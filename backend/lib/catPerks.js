/**
 * lib/catPerks.js — Cấu hình & cấp phát ƯU ĐÃI cho khách mua mèo (Phase 3).
 *
 * Config lưu 1 dòng AppSetting key "cat_perk_config" (JSON) — admin chỉnh trong app
 * (giống bookingHours). issuePerksForSale() được gọi sau khi CatSale hoàn tất để tự phát:
 *   • CustomerMembership: giảm % đồ ăn trong N tháng (upsert theo SĐT).
 *   • BenefitVoucher: ưu đãi dùng 1 lần (gửi mèo / spa / tiêm / khám bảo hành).
 */
const prisma = require("./prisma");

const SETTING_KEY = "cat_perk_config";

const DEFAULTS = {
  enabled: true,
  warrantyDays: 7,          // bảo hành sức khỏe — khám free trong X ngày
  freeBoardingNights: 1,    // số đêm gửi mèo (hotel) miễn phí
  groomingFree: true,       // 1 lần spa/grooming miễn phí
  vaccineDiscountPct: 30,   // % giảm mũi tiêm tiếp theo
  foodDiscountPct: 10,      // % giảm đồ ăn/phụ kiện cho thành viên
  membershipMonths: 6,      // số tháng hiệu lực giảm đồ ăn
  voucherValidDays: 90,     // hạn dùng voucher 1 lần (trừ health = theo bảo hành)
};

const _num = (v, d) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : d;
};

async function getConfig() {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
    if (!row?.value) return { ...DEFAULTS };
    const parsed = JSON.parse(row.value);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

async function updateConfig(patch = {}) {
  const cur = await getConfig();
  const next = {
    enabled: typeof patch.enabled === "boolean" ? patch.enabled : cur.enabled,
    warrantyDays: _num(patch.warrantyDays, cur.warrantyDays),
    freeBoardingNights: _num(patch.freeBoardingNights, cur.freeBoardingNights),
    groomingFree: typeof patch.groomingFree === "boolean" ? patch.groomingFree : cur.groomingFree,
    vaccineDiscountPct: Math.min(100, _num(patch.vaccineDiscountPct, cur.vaccineDiscountPct)),
    foodDiscountPct: Math.min(100, _num(patch.foodDiscountPct, cur.foodDiscountPct)),
    membershipMonths: _num(patch.membershipMonths, cur.membershipMonths),
    voucherValidDays: _num(patch.voucherValidDays, cur.voucherValidDays),
  };
  await prisma.appSetting.upsert({
    where: { key: SETTING_KEY },
    update: { value: JSON.stringify(next) },
    create: { key: SETTING_KEY, value: JSON.stringify(next) },
  });
  return next;
}

const addDays = (n) => new Date(Date.now() + n * 86400000);
const addMonths = (n) => { const d = new Date(); d.setMonth(d.getMonth() + n); return d; };

/**
 * Phát ưu đãi cho 1 giao dịch bán mèo. Không ném lỗi ra ngoài (chỉ log) để không
 * làm hỏng response bán hàng. Trả {membership, vouchers:[...]} đã tạo.
 */
async function issuePerksForSale(sale, cat, cfg) {
  const config = cfg || (await getConfig());
  if (!config.enabled) return { skipped: true };
  const phone = (sale.buyer_phone || "").trim();
  if (!phone) return { skipped: true };

  const out = { vouchers: [] };

  // ── Membership: giảm % đồ ăn trong N tháng (upsert theo SĐT) ──
  if (config.foodDiscountPct > 0 && config.membershipMonths > 0) {
    const discountUntil = addMonths(config.membershipMonths);
    out.membership = await prisma.customerMembership.upsert({
      where: { phone },
      update: {
        name: sale.buyer_name || undefined,
        tier: "cat-owner",
        food_discount_pct: config.foodDiscountPct,
        discount_until: discountUntil,
        points: { increment: 1 },
        source_sale_id: sale.id,
      },
      create: {
        phone,
        name: sale.buyer_name || "",
        tier: "cat-owner",
        food_discount_pct: config.foodDiscountPct,
        discount_until: discountUntil,
        points: 1,
        source_sale_id: sale.id,
      },
    });
  }

  // ── Vouchers dùng 1 lần ──
  const voucherSpecs = [];
  // Bảo hành sức khỏe (theo warranty_until của sale; fallback now + warrantyDays)
  const warrantyUntil = sale.warranty_until || (config.warrantyDays > 0 ? addDays(config.warrantyDays) : null);
  if (warrantyUntil) {
    voucherSpecs.push({
      type: "health_check",
      title: "Khám bảo hành sức khỏe miễn phí",
      value: {},
      valid_until: warrantyUntil,
    });
  }
  if (config.freeBoardingNights > 0) {
    voucherSpecs.push({
      type: "boarding_free_nights",
      title: `Miễn phí ${config.freeBoardingNights} đêm gửi mèo (hotel)`,
      value: { nights: config.freeBoardingNights },
      valid_until: addDays(config.voucherValidDays),
    });
  }
  if (config.groomingFree) {
    voucherSpecs.push({
      type: "grooming_free",
      title: "Miễn phí 1 lần spa/grooming",
      value: { free: true },
      valid_until: addDays(config.voucherValidDays),
    });
  }
  if (config.vaccineDiscountPct > 0) {
    voucherSpecs.push({
      type: "vaccine_discount",
      title: `Giảm ${config.vaccineDiscountPct}% mũi tiêm tiếp theo`,
      value: { pct: config.vaccineDiscountPct },
      valid_until: addDays(config.voucherValidDays),
    });
  }

  for (const v of voucherSpecs) {
    const created = await prisma.benefitVoucher.create({
      data: { phone, source_sale_id: sale.id, status: "active", ...v },
    });
    out.vouchers.push(created);
  }

  return out;
}

module.exports = { getConfig, updateConfig, issuePerksForSale, DEFAULTS, SETTING_KEY };
