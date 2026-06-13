/**
 * lib/aiAssistant.js — Trợ lý CSKH "phản hồi đầu tiên" cho chat khách hàng.
 *
 * Triết lý: AI chỉ trả lời câu DỄ (giờ/giá/dịch vụ/chi nhánh) dựa trên DỮ LIỆU THẬT;
 * câu về CON MÈO CỤ THỂ, khiếu nại, đặt lịch, thanh toán, hoặc bất kỳ điều gì không
 * chắc → KHÔNG bịa, trả lời lịch sự rồi escalate cho nhân viên. Fail-safe: thiếu key
 * hoặc lỗi → trả null, chat hoạt động như cũ (người trả lời).
 */
const prisma = require("./prisma");

const MODEL = process.env.AI_CSKH_MODEL || "claude-sonnet-4-6";

let _client = null;
let _sdkMissing = false;
function client() {
  if (!process.env.ANTHROPIC_API_KEY || _sdkMissing) return null;
  if (!_client) {
    try {
      const Anthropic = require("@anthropic-ai/sdk"); // lazy: chưa cài → AI tắt, không crash server
      _client = new Anthropic(); // đọc ANTHROPIC_API_KEY từ env
    } catch (e) {
      _sdkMissing = true;
      console.warn("[ai-cskh] Chưa cài @anthropic-ai/sdk — trợ lý AI tắt. Chạy: npm i @anthropic-ai/sdk");
      return null;
    }
  }
  return _client;
}

// Bật khi có cờ + có key. Thiếu 1 trong 2 → AI tắt, chat như cũ.
function isAvailable() {
  return process.env.AI_CSKH_ENABLED === "true" && !!process.env.ANTHROPIC_API_KEY;
}

// ── Neo dữ liệu: thông tin chi nhánh + dịch vụ + giá (lấy từ Postgres) ──────────
async function buildGrounding(storeId) {
  const lines = [];

  if (storeId != null) {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { name: true, address: true, phone: true },
    });
    if (store) {
      lines.push(`CHI NHÁNH khách đang nhắn: ${store.name}` +
        (store.address ? ` · Địa chỉ: ${store.address}` : "") +
        (store.phone ? ` · SĐT: ${store.phone}` : ""));
    }
  } else {
    lines.push("Kênh HỖ TRỢ CHUNG của hệ thống MeoCare (chưa gắn chi nhánh cụ thể).");
  }

  // Dịch vụ đang mở
  const types = await prisma.serviceTypeDef.findMany({
    where: { available: true },
    select: { name: true, subtitle: true, priceFrom: true },
    orderBy: { sortOrder: "asc" },
  });
  if (types.length) {
    lines.push("\nDỊCH VỤ đang cung cấp (giá tham khảo):");
    for (const t of types) {
      lines.push(`- ${t.name}${t.subtitle ? ` (${t.subtitle})` : ""}: từ ${t.priceFrom}`);
    }
  }

  // Gói dịch vụ cụ thể có giá
  const pkgs = await prisma.servicePackage.findMany({
    where: { isActive: true },
    select: { name: true, price: true, duration: true },
    orderBy: { sortOrder: "asc" },
    take: 30,
  });
  if (pkgs.length) {
    lines.push("\nGÓI DỊCH VỤ (giá VND):");
    for (const p of pkgs) {
      lines.push(`- ${p.name}: ${p.price.toLocaleString("vi-VN")}đ${p.duration ? ` · ${p.duration}` : ""}`);
    }
  }

  return lines.join("\n");
}

const SYSTEM_RULES = `Bạn là "Trợ lý MeoCare" — trợ lý chăm sóc khách hàng của chuỗi dịch vụ thú cưng (khách sạn mèo, spa/grooming, dịch vụ thú y). Trả lời bằng tiếng Việt, NGẮN GỌN, lịch sự, ấm áp (xưng "em", gọi khách "anh/chị").

CHỈ trả lời dựa trên DỮ LIỆU được cung cấp bên dưới (giờ, giá, dịch vụ, chi nhánh). TUYỆT ĐỐI không bịa giá, không bịa tình trạng phòng, không hứa hẹn.

PHẢI đặt escalate=true (và reply là câu chuyển tiếp lịch sự, KHÔNG tự trả lời nội dung) khi khách:
- Hỏi về TÌNH TRẠNG CON MÈO CỤ THỂ đang gửi ("bé nhà em sao rồi", "mèo em ăn chưa", gửi ảnh hỏi...).
- Muốn ĐẶT LỊCH / hủy / đổi lịch, hỏi còn phòng trống không (cần nhân viên xác nhận).
- Khiếu nại, phàn nàn, đòi hoàn tiền, sự cố.
- Hỏi điều KHÔNG có trong dữ liệu, hoặc bạn KHÔNG CHẮC.

Khi escalate, reply mẫu: "Dạ phần này em xin phép chuyển anh/chị tới nhân viên chi nhánh để được hỗ trợ chính xác nhất ạ. Anh/chị vui lòng chờ trong giây lát nhé! 🐾".

Khi tự trả lời được (escalate=false): trả lời trực tiếp, gọn, có thể gợi ý liên hệ nếu cần.

Luôn trả về JSON đúng schema: { reply: string, escalate: boolean }.`;

// Ép Claude trả về đúng cấu trúc bằng 1 tool bắt buộc (tương thích mọi bản SDK).
const REPLY_TOOL = {
  name: "tra_loi_khach",
  description: "Soạn câu trả lời cho khách và quyết định có cần chuyển cho nhân viên không.",
  input_schema: {
    type: "object",
    properties: {
      reply: { type: "string", description: "Câu trả lời gửi cho khách (tiếng Việt)." },
      escalate: { type: "boolean", description: "true nếu cần chuyển cho nhân viên." },
    },
    required: ["reply", "escalate"],
  },
};

// history: [{ senderType: 'client'|'admin', content }] theo thứ tự thời gian tăng dần.
// Trả về { reply, escalate } hoặc null nếu không khả dụng/lỗi.
async function generateReply({ storeId, history }) {
  const c = client();
  if (!c) return null;
  try {
    const grounding = await buildGrounding(storeId);

    // Map lịch sử → messages (client=user, admin/bot=assistant); bỏ assistant dẫn đầu
    const msgs = history
      .map((m) => ({
        role: m.senderType === "client" ? "user" : "assistant",
        content: m.content || "",
      }))
      .filter((m) => m.content.trim().length > 0);
    while (msgs.length && msgs[0].role === "assistant") msgs.shift();
    if (!msgs.length) return null;

    const resp = await c.messages.create({
      model: MODEL,
      max_tokens: 600,
      // cache_control: phần luật + dữ liệu neo ổn định trong 5' → các tin liên tiếp
      // cùng chi nhánh đọc lại từ cache (~0.1× giá input), giảm mạnh chi phí.
      system: [{
        type: "text",
        text: `${SYSTEM_RULES}\n\n=== DỮ LIỆU NEO ===\n${grounding}`,
        cache_control: { type: "ephemeral" },
      }],
      tools: [REPLY_TOOL],
      tool_choice: { type: "tool", name: REPLY_TOOL.name },
      messages: msgs,
    });

    const toolUse = (resp.content || []).find((b) => b.type === "tool_use");
    const parsed = toolUse?.input;
    if (!parsed || typeof parsed.reply !== "string" || typeof parsed.escalate !== "boolean") return null;
    return { reply: parsed.reply.trim(), escalate: !!parsed.escalate };
  } catch (e) {
    console.error("[ai-cskh] generateReply lỗi:", e.message);
    return null; // fail-safe
  }
}

module.exports = { isAvailable, generateReply, MODEL };
