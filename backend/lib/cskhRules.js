/**
 * lib/cskhRules.js — LỚP LUẬT (miễn phí) cho bot CSKH.
 * Khớp từ khóa (đã bỏ dấu) cho các câu phổ biến: giá, dịch vụ, địa chỉ, SĐT, chào.
 * Trả lời lấy từ DỮ LIỆU THẬT (Postgres). Không khớp / thiếu dữ liệu → trả null
 * (để lớp AI hoặc nhân viên xử lý). KHÔNG bao giờ bịa.
 */
const prisma = require("./prisma");

// Bỏ dấu + lowercase để khớp được cả khi khách gõ không dấu / sai chính tả nhẹ.
function normalize(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // bỏ dấu thanh
    .replace(/[đĐ]/g, "d")                  // đ/Đ → d
    .trim();
}

// Thứ tự QUAN TRỌNG: intent cụ thể trước, "chào" để cuối (tránh nuốt câu có nội dung).
const INTENTS = [
  { key: "price",   kw: ["gia", "bao nhieu", "bang gia", "chi phi", "gia ca", "phi dich vu", "het bao nhieu"] },
  { key: "service", kw: ["dich vu", "co nhung gi", "lam nhung gi", "cung cap gi", "co dich vu gi", "grooming", "spa", "khach san meo", "giu meo", "trong meo", "tia long", "cat mong", "tam cho meo"] },
  { key: "address", kw: ["dia chi", "o dau", "cho nao", "duong nao", "toa lac", "den dau", "cho minh xin dia chi"] },
  { key: "phone",   kw: ["so dien thoai", "sdt", "hotline", "lien he", "dien thoai", "goi cho"] },
];

function detect(text) {
  const t = normalize(text);
  if (!t) return null;
  for (const intent of INTENTS) {
    if (intent.kw.some((k) => t.includes(k))) return intent.key;
  }
  // "chào"/"hi"/"alo" đơn lẻ → chào hỏi (đặt sau cùng)
  if (/\b(chao|hi|hello|alo)\b/.test(t) || t.includes("co ai khong") || t.includes("co ai o day")) return "greeting";
  return null;
}

async function fetchServices() {
  const [types, pkgs] = await Promise.all([
    prisma.serviceTypeDef.findMany({
      where: { available: true },
      select: { name: true, subtitle: true, priceFrom: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.servicePackage.findMany({
      where: { isActive: true },
      select: { name: true, price: true, duration: true },
      orderBy: { sortOrder: "asc" }, take: 12,
    }),
  ]);
  return { types, pkgs };
}

// Trả { reply } nếu trả lời được CHẮC CHẮN bằng dữ liệu; ngược lại null.
async function tryAnswer({ storeId, text }) {
  const intent = detect(text);
  if (!intent) return null;

  if (intent === "greeting") {
    return { reply: "Dạ MeoCare xin chào anh/chị ạ! 🐾 Em có thể hỗ trợ nhanh về bảng giá, dịch vụ, địa chỉ chi nhánh. Anh/chị cần em giúp gì ạ?" };
  }

  if (intent === "price" || intent === "service") {
    const { types, pkgs } = await fetchServices();
    if (!types.length && !pkgs.length) return null; // không có dữ liệu → để AI/người
    const lines = [];
    if (intent === "service") {
      lines.push("Dạ các dịch vụ của MeoCare ạ:");
      for (const t of types) lines.push(`• ${t.name}${t.subtitle ? ` — ${t.subtitle}` : ""}`);
    } else {
      lines.push("Dạ giá tham khảo ạ:");
      for (const t of types) lines.push(`• ${t.name}: từ ${t.priceFrom}`);
      if (pkgs.length) {
        lines.push("\nMột số gói cụ thể:");
        for (const p of pkgs) lines.push(`• ${p.name}: ${p.price.toLocaleString("vi-VN")}đ${p.duration ? ` (${p.duration})` : ""}`);
      }
    }
    lines.push("\nAnh/chị cần tư vấn kỹ hơn, em mời nhân viên hỗ trợ thêm nhé ạ! 🐾");
    return { reply: lines.join("\n") };
  }

  if ((intent === "address" || intent === "phone") && storeId != null) {
    const store = await prisma.store.findUnique({
      where: { id: storeId }, select: { name: true, address: true, phone: true },
    });
    if (!store) return null;
    if (intent === "address" && store.address) return { reply: `Dạ ${store.name} ở địa chỉ: ${store.address} ạ. 🐾` };
    if (intent === "phone" && store.phone) return { reply: `Dạ anh/chị liên hệ ${store.name} qua số ${store.phone} nhé ạ. 🐾` };
  }

  return null; // không đủ dữ liệu trả lời chắc chắn
}

module.exports = { tryAnswer };
