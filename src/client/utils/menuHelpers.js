export const fmt = (n) => n.toLocaleString("vi-VN") + "đ";

export const estimateWeight = (items) => {
  let total = 0;
  for (const item of items) {
    const cat = item.category || "";
    const name = (item.variantName || "").toLowerCase();
    let w = 400;
    if (cat === "food")    w = 2200;
    if (cat === "hygiene") w = 6500;
    if (cat === "combo")   w = 3000;
    if (cat === "pate") {
      const match = name.match(/(\d+)\s*(hộp|gói)/);
      const qty = match ? parseInt(match[1]) : 1;
      w = name.includes("50g") ? qty * 60 : qty * 190;
    }
    total += w;
  }
  return Math.max(total, 200);
};

export const getSubsidyLabel = (total) => {
  if (total >= 350000) return { amount: 30000, label: "Đơn ≥ 350k → hỗ trợ 30k" };
  if (total >= 250000) return { amount: 20000, label: "Đơn ≥ 250k → hỗ trợ 20k" };
  if (total >= 150000) return { amount: 10000, label: "Đơn ≥ 150k → hỗ trợ 10k" };
  return { amount: 0, label: "Đơn dưới 150k — không hỗ trợ ship" };
};

export const buildReceiptText = ({ customer, address, items, orderTotal, shipFee, subsidy, finalFee }) => {
  const line = "─────────────────────────────";
  const itemLines = items.map((i, idx) =>
    `  ${idx + 1}. ${i.productName}\n     ${i.variantName} — ${fmt(i.price)}`
  ).join("\n");
  const shipSection = [
    `Phí ship GHN:   ${fmt(shipFee)}`,
    subsidy > 0 ? `Hỗ trợ ship:   -${fmt(subsidy)}` : null,
    `Phí ship sau HT: ${fmt(finalFee)}`,
  ].filter(Boolean).join("\n  ");
  return [
    `🧾 ĐƠN HÀNG MEO CARE 🐾`, line,
    `👤 KHÁCH HÀNG`,
    `  Tên: ${customer.name}`,
    `  SĐT: ${customer.phone}`, line,
    `📦 SẢN PHẨM`, itemLines, line,
    `📍 ĐỊA CHỈ GIAO`,
    `  ${address.street}`,
    `  ${address.wardName}, ${address.districtName}`,
    `  ${address.provinceName}`, line,
    `💰 THANH TOÁN`,
    `  Tiền hàng:     ${fmt(orderTotal)}`,
    `  ${shipSection}`, line,
    `  TỔNG CỘNG: ${fmt(orderTotal + finalFee)}`, line,
    `Cảm ơn bạn đã tin tưởng Meo Care! 🐱`,
  ].join("\n");
};

export const parseGroups = (variants) => {
  const groups = {};
  for (const v of variants) {
    const match = v.name.match(/^(.+?)\s*-\s*(\d+.*)$/);
    if (match) {
      const flavor = match[1].trim();
      const qty    = match[2].trim();
      if (!groups[flavor]) groups[flavor] = [];
      groups[flavor].push({ qty, price: v.price, fullName: v.name });
    } else {
      if (!groups["__flat__"]) groups["__flat__"] = [];
      groups["__flat__"].push({ qty: v.name, price: v.price, fullName: v.name });
    }
  }
  return groups;
};