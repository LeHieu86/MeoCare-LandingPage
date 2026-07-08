/**
 * lib/cskhKb.js — KHO TRI THỨC (FAQ) do admin tự cấu hình cho bot CSKH.
 *
 * Một bản ghi = { storeId, question, answer, keywords }. storeId=null → áp dụng MỌI
 * chi nhánh (chung); có giá trị → riêng chi nhánh đó.
 *
 * Bot dùng 2 lớp:
 *   (1) match() — LỚP LUẬT (free $0): khớp keywords (đã bỏ dấu) → trả answer ngay.
 *   (2) groundingText() — chèn Q/A vào dữ liệu neo của AI → AI trả đúng cả khi khách
 *       diễn đạt khác (paraphrase), thay vì escalate.
 *
 * Cache trong RAM (giống aiConfig): nạp các bản enabled, tự refresh 30s + refresh ngay
 * khi admin sửa (route gọi refresh()). Hot-path đọc cache, không chạm DB mỗi tin nhắn.
 */
const prisma = require("./prisma");

let _faqs = []; // chỉ chứa bản enabled

// Bỏ dấu + lowercase — khớp cả khi khách gõ không dấu / sai chính tả nhẹ (giống cskhRules).
function normalize(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .trim();
}

async function refresh() {
  try {
    _faqs = await prisma.cskhFaq.findMany({
      where: { enabled: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: { id: true, storeId: true, question: true, answer: true, keywords: true },
    });
  } catch {
    /* DB chưa sẵn sàng → giữ cache hiện tại */
  }
}

// Bản áp dụng cho chi nhánh này: riêng CN trước, rồi tới bản chung (storeId=null).
function forStore(storeId) {
  const own = [];
  const global = [];
  for (const f of _faqs) {
    if (f.storeId == null) global.push(f);
    else if (f.storeId === storeId) own.push(f);
  }
  return [...own, ...global];
}

// LỚP LUẬT (free): khớp keyword → { answer, faqId }; không khớp → null.
function match(storeId, text) {
  const t = normalize(text);
  if (!t) return null;
  for (const f of forStore(storeId)) {
    const kws = (f.keywords || "")
      .split(",")
      .map((k) => normalize(k))
      .filter((k) => k.length >= 2);
    if (kws.some((k) => t.includes(k))) {
      return { answer: f.answer, faqId: f.id };
    }
  }
  return null;
}

// Khối FAQ để neo vào grounding AI. "" nếu không có bản nào.
function groundingText(storeId) {
  const items = forStore(storeId).slice(0, 40);
  if (!items.length) return "";
  const lines = ["CÂU HỎI THƯỜNG GẶP (cửa hàng cấu hình — ưu tiên dùng để trả lời):"];
  for (const f of items) {
    lines.push(`- HỎI: ${f.question}\n  ĐÁP: ${f.answer}`);
  }
  return lines.join("\n");
}

// Nạp lần đầu + tự làm mới định kỳ (không chặn require).
refresh();
setInterval(refresh, 30000).unref?.();

module.exports = { refresh, match, groundingText };
