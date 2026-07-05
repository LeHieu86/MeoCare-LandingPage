/**
 * lib/catPricing.js — Định giá bán mèo theo cấu hình admin.
 *
 * Admin cấu hình % lợi nhuận (markup) chung + quy tắc làm tròn (lưu 1 dòng AppSetting
 * key "cat_pricing_config", giống catPerks). Manager KHÔNG nhập giá bán: chỉ kê bảng
 * cost_items → cost = tổng; giá bán = computePrice(cost) = cost×(1+markup%), làm tròn LÊN.
 *
 *   markup_percent : % cộng thêm trên giá vốn (150 → bán = vốn × 2.5)
 *   rounding_to    : làm tròn LÊN bội số này cho giá đẹp (0 = không làm tròn)
 */
const prisma = require("./prisma");

const SETTING_KEY = "cat_pricing_config";

const DEFAULTS = {
  markup_percent: 150, // vốn 1.000.000 → bán 2.500.000
  rounding_to: 10000,  // làm tròn lên bội số 10.000
};

const _num = (v, d) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : d;
};

async function getConfig() {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
    if (!row?.value) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(row.value) };
  } catch {
    return { ...DEFAULTS };
  }
}

async function updateConfig(patch = {}) {
  const cur = await getConfig();
  const next = {
    markup_percent: _num(patch.markup_percent, cur.markup_percent),
    rounding_to: _num(patch.rounding_to, cur.rounding_to),
  };
  await prisma.appSetting.upsert({
    where: { key: SETTING_KEY },
    update: { value: JSON.stringify(next) },
    create: { key: SETTING_KEY, value: JSON.stringify(next) },
  });
  return next;
}

/** Tổng các dòng chi phí → giá vốn (đồng). Bỏ qua dòng không hợp lệ. */
function sumCostItems(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((s, it) => {
    const amt = Math.round(Number(it && it.amount));
    return s + (Number.isFinite(amt) && amt > 0 ? amt : 0);
  }, 0);
}

/** Chuẩn hóa cost_items để lưu: chỉ giữ dòng có số tiền > 0. */
function sanitizeCostItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((it) => ({
      label: (it && it.label != null ? String(it.label) : "").trim(),
      category: (it && it.category != null ? String(it.category) : "other").trim() || "other",
      amount: Math.round(Number(it && it.amount)) || 0,
    }))
    .filter((it) => it.amount > 0);
}

/** Giá bán = cost × (1 + markup%), làm tròn LÊN bội số rounding_to. */
function computePrice(cost, cfg = DEFAULTS) {
  const c = Math.max(0, Math.round(Number(cost) || 0));
  const markup = Math.max(0, Number(cfg.markup_percent) || 0);
  const raw = c * (1 + markup / 100);
  const round = Math.max(0, Math.round(Number(cfg.rounding_to) || 0));
  if (round <= 0) return Math.round(raw);
  return Math.ceil(raw / round) * round;
}

module.exports = {
  getConfig,
  updateConfig,
  sumCostItems,
  sanitizeCostItems,
  computePrice,
  DEFAULTS,
  SETTING_KEY,
};
