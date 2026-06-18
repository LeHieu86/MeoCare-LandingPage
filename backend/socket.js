const { Server } = require("socket.io");
const { Conversation, Message } = require("./models/Chat");
const prisma = require("./lib/prisma");
const { notifyOwner } = require("./lib/notify");
const aiAssistant = require("./lib/aiAssistant");
const aiConfig = require("./lib/aiConfig");
const cskhRules = require("./lib/cskhRules");
const cskhKb = require("./lib/cskhKb");

let io; // Biến toàn cục

const getIO = () => io;

// ── Customer display (màn phụ quầy): build VietQR từ cấu hình ngân hàng shop ──
const DISPLAY_BANK = {
  bankBin:     process.env.BANK_BIN          || "970422",
  bankName:    process.env.BANK_NAME         || "MB Bank",
  accountNo:   process.env.BANK_ACCOUNT_NO   || "",
  accountName: process.env.BANK_ACCOUNT_NAME || "",
};
function buildDisplayQrUrl({ amount, content }) {
  if (!DISPLAY_BANK.accountNo) return null;
  const params = new URLSearchParams({
    amount: String(amount),
    addInfo: content,
    accountName: DISPLAY_BANK.accountName,
  });
  return `https://img.vietqr.io/image/${DISPLAY_BANK.bankBin}-${DISPLAY_BANK.accountNo}-compact2.png?${params}`;
}

/* ══════════════════════════════════════════════════════════════════════
   Cảnh báo Telegram khi khách CHỜ QUÁ LÂU chưa ai trả lời.
   - Khách nhắn → hẹn kiểm tra sau CHAT_ALERT_DELAY phút.
   - Nếu trong thời gian đó có nhân viên/admin trả lời → HUỶ hẹn (đang trao đổi, đỡ phiền).
   - Tới hẹn mà tin CUỐI vẫn là của khách (chưa ai trả lời) → mới bắn Telegram.
   ══════════════════════════════════════════════════════════════════════ */
const CHAT_ALERT_DELAY_MIN = 5;
const pendingChatAlerts = new Map();   // conversationId -> timer (đang hẹn báo)
const alertedConversations = new Set(); // đã báo rồi, chờ nhân viên trả lời để reset

function scheduleUnansweredChatAlert(conversationId, conv) {
  // Đã có hẹn hoặc đã báo (chưa được trả lời) → không đặt thêm (tránh spam, gộp 1 lần/episode)
  if (pendingChatAlerts.has(conversationId) || alertedConversations.has(conversationId)) return;

  const who = conv?.clientName || conv?.phone || "Khách";
  const storeId = conv?.storeId ?? null;
  const cn = storeId != null ? `CN #${storeId}` : "Hỗ trợ chung";

  const timer = setTimeout(async () => {
    pendingChatAlerts.delete(conversationId);
    try {
      // Kiểm tra LẠI từ DB: tin cuối còn là của khách? (chống cả khi nhân viên trả lời qua kênh khác)
      const last = await Message.findOne({ conversationId }).sort({ createdAt: -1 });
      if (last && last.senderType === "client") {
        alertedConversations.add(conversationId);
        notifyOwner(
          `💬 KHÁCH CHỜ TRẢ LỜI >${CHAT_ALERT_DELAY_MIN}' (${cn})\n` +
          `${who}: ${(last.content || "").substring(0, 80)}`
        );
      }
    } catch (e) {
      console.error("[chat-alert] Lỗi kiểm tra:", e.message);
    }
  }, CHAT_ALERT_DELAY_MIN * 60000);

  pendingChatAlerts.set(conversationId, timer);
}

function cancelUnansweredChatAlert(conversationId) {
  const t = pendingChatAlerts.get(conversationId);
  if (t) { clearTimeout(t); pendingChatAlerts.delete(conversationId); }
  alertedConversations.delete(conversationId); // nhân viên đã trả lời → reset để lần sau báo lại được
}

/* ══════════════════════════════════════════════════════════════════════
   Trợ lý CSKH "phản hồi đầu tiên" (AI). Chỉ trả lời khi CHƯA có nhân viên
   xử lý; câu khó/về mèo cụ thể/khiếu nại → chuyển người. Fail-safe: tắt cờ
   hoặc thiếu key → bỏ qua, chat như cũ.
   ══════════════════════════════════════════════════════════════════════ */
const aiPaused = new Set();                 // conversationId (string) đã chuyển người → AI im tới khi NV trả lời
const AI_HUMAN_RECENT_MS = 10 * 60 * 1000;  // NV thật vừa trả lời trong 10' → AI nhường

/* ── Chặn lạm dụng (chống spam đốt tiền AI) ──────────────────────────────────
   3 lớp: cooldown mỗi hội thoại, trần/giờ mỗi hội thoại, và TRẦN/NGÀY toàn hệ
   thống (backstop tuyệt đối — kể cả khi đối thủ xoay nhiều số/hội thoại).
   Hết trần → AI im, chat về luồng người như cũ. (Đếm trong RAM; reset khi restart.) */
const AI_MIN_GAP_MS         = (parseInt(process.env.AI_MIN_GAP_SEC || "8", 10)) * 1000;
const AI_MAX_PER_CONV_HOUR  = parseInt(process.env.AI_MAX_PER_CONV_HOUR || "15", 10);
// Trần/ngày lấy động từ cấu hình (admin chỉnh được); env chỉ là mặc định ban đầu.

const aiLastReplyAt = new Map();   // cid -> ts lần AI gọi gần nhất (cooldown)
const aiConvHourly  = new Map();   // cid -> { windowStart, count }
let   aiDay         = { day: null, count: 0 }; // trần toàn hệ thống theo ngày

function aiRateAllow(cid) {
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  if (aiDay.day !== today) aiDay = { day: today, count: 0 };
  if (aiDay.count >= aiConfig.maxPerDay()) return false;           // trần ngày toàn hệ thống (admin chỉnh)
  if (now - (aiLastReplyAt.get(cid) || 0) < AI_MIN_GAP_MS) return false; // cooldown
  let h = aiConvHourly.get(cid);
  if (!h || now - h.windowStart > 3600000) h = { windowStart: now, count: 0 };
  if (h.count >= AI_MAX_PER_CONV_HOUR) { aiConvHourly.set(cid, h); return false; } // trần/giờ/hội thoại
  return true;
}

function aiRateRecord(cid) {
  const now = Date.now();
  aiLastReplyAt.set(cid, now);
  let h = aiConvHourly.get(cid);
  if (!h || now - h.windowStart > 3600000) h = { windowStart: now, count: 0 };
  h.count++; aiConvHourly.set(cid, h);
  aiDay.count++;
}

// Lưu tin bot + phát cho khách; nếu escalate thì báo nhân viên + Telegram (kèm câu hỏi).
async function postBotReply(conversationId, cid, conv, text, { escalate = false, question = "" } = {}) {
  const botMsg = await Message.create({
    conversationId, senderType: "admin", content: text, isBot: true, read: true,
  });
  await Conversation.findByIdAndUpdate(conversationId, {
    lastMessage: text.substring(0, 200), lastSenderType: "admin",
  });
  io.to(cid).emit("receiveMessage", botMsg);

  if (escalate) {
    aiPaused.add(cid); // chuyển người → bot im tới khi nhân viên trả lời
    const storeId = conv?.storeId ?? null;
    const who = conv?.clientName || conv?.phone || "Khách";
    const cn = storeId != null ? `CN #${storeId}` : "Hỗ trợ chung";
    const preview = "🤖 Trợ lý đã chuyển — cần nhân viên hỗ trợ";
    io.to(`chat-store-${storeId ?? "general"}`).emit("chat:newMessage", { conversationId: cid, storeId, preview });
    io.to("admin-room").emit("chat:newMessage", { conversationId: cid, storeId, preview });
    try {
      notifyOwner(
        `🤖➡️ Trợ lý CSKH chuyển cho nhân viên (${cn})\n` +
        `Khách ${who} hỏi (ngoài phạm vi):\n"${(question || "").substring(0, 150)}"`
      );
    } catch { /* không critical */ }
  }
}

async function maybeAiRespond(conversationId, conv) {
  if (!aiConfig.botEnabled()) return; // công tắc tổng của bot CSKH (admin chỉnh)
  const cid = String(conversationId);
  if (aiPaused.has(cid)) return;            // đã chuyển người, chờ nhân viên

  // Nhân viên THẬT vừa trả lời gần đây → đang có người xử lý, bot nhường
  const lastHuman = await Message.findOne({
    conversationId, senderType: "admin", isBot: { $ne: true },
  }).sort({ createdAt: -1 });
  if (lastHuman && (Date.now() - new Date(lastHuman.createdAt).getTime()) < AI_HUMAN_RECENT_MS) return;

  // Cooldown: tránh bot trả lời dồn dập (áp cho cả lớp luật lẫn AI)
  const now = Date.now();
  if (now - (aiLastReplyAt.get(cid) || 0) < AI_MIN_GAP_MS) return;

  const recent = await Message.find({ conversationId }).sort({ createdAt: -1 }).limit(12).lean();
  recent.reverse();
  const history = recent.map((m) => ({ senderType: m.senderType, content: m.content }));
  const lastClientMsg = [...history].reverse().find((m) => m.senderType === "client")?.content || "";

  // LỚP 1 — LUẬT (miễn phí): câu phổ biến (giá/dịch vụ/địa chỉ/SĐT/chào) trả lời ngay
  try {
    const rule = await cskhRules.tryAnswer({ storeId: conv?.storeId ?? null, text: lastClientMsg });
    if (rule && rule.reply) {
      aiLastReplyAt.set(cid, now);
      await postBotReply(conversationId, cid, conv, rule.reply, { escalate: false });
      return;
    }
  } catch (e) { console.error("[cskh-rules]", e.message); }

  // LỚP 1b — KHO TRI THỨC admin cấu hình (miễn phí): khớp keyword FAQ → trả ngay
  try {
    const kb = cskhKb.match(conv?.storeId ?? null, lastClientMsg);
    if (kb && kb.answer) {
      aiLastReplyAt.set(cid, now);
      await postBotReply(conversationId, cid, conv, kb.answer, { escalate: false });
      return;
    }
  } catch (e) { console.error("[cskh-kb]", e.message); }

  // LỚP 2 — AI (chỉ khi có key + còn hạn mức): câu lạ/ngoài luật mới gọi → tiết kiệm
  if (!aiAssistant.isAvailable()) return; // không bật AI → để luồng người (đã báo staff khi khách gửi)
  if (!aiRateAllow(cid)) return;          // hết trần chi phí → im, để luồng người
  aiRateRecord(cid);
  const out = await aiAssistant.generateReply({ storeId: conv?.storeId ?? null, history });
  if (!out || !out.reply) return;
  await postBotReply(conversationId, cid, conv, out.reply, { escalate: out.escalate, question: lastClientMsg });
}

const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: [
        "http://localhost:5173",
        "https://meomeocare.io.vn",
        "https://www.meomeocare.io.vn",
      ],
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  io.on("connection", (socket) => {
    console.log(`⚡ Socket connected: ${socket.id}`);

    // 1. Client hoặc Admin tham gia vào 1 phòng chat cụ thể
    socket.on("joinRoom", ({ conversationId }) => {
      socket.join(conversationId);
      console.log(`👤 ${socket.id} joined room: ${conversationId}`);
    });

    // ── Customer display (màn phụ quầy) ──────────────────────────────────────
    // Màn phụ (trang /customer-display) join phòng theo chi nhánh.
    socket.on("joinDisplayRoom", ({ storeId }) => {
      socket.join(`customer-display-${storeId ?? 1}`);
    });
    // POS bắn → relay tới màn phụ của chi nhánh, tự gắn qrUrl từ cấu hình bank shop.
    socket.on("display:show-qr", (data) => {
      const storeId = data?.storeId ?? 1;
      const amount  = parseInt(data?.amount) || 0;
      const content = (data?.content || data?.invoiceNo || "MEOCARE").toString();
      io.to(`customer-display-${storeId}`).emit("display:qr", {
        qrUrl:     amount > 0 ? buildDisplayQrUrl({ amount, content }) : null,
        amount,
        items:     Array.isArray(data?.items) ? data.items : [],
        invoiceNo: data?.invoiceNo ?? null,
        bankName:  DISPLAY_BANK.bankName,
        accountName: DISPLAY_BANK.accountName,
      });
    });
    socket.on("display:clear", (data) => {
      io.to(`customer-display-${data?.storeId ?? 1}`).emit("display:clear", {});
    });

    // 1a-chat. Nhân viên chi nhánh tham gia "phòng thông báo chat" của chi nhánh mình
    //          để nhận báo có tin nhắn mới từ khách (đa chi nhánh).
    socket.on("joinStoreChatRoom", ({ storeId }) => {
      const room = `chat-store-${storeId ?? "general"}`;
      socket.join(room);
      console.log(`💬 ${socket.id} joined ${room}`);
    });

    // 1a-store. Nhân viên/quản lý chi nhánh tham gia phòng chung của chi nhánh
    //           để nhận thông báo nghiệp vụ (đặt lịch mới, ...) đúng chi nhánh mình.
    socket.on("joinStoreRoom", ({ storeId }) => {
      if (storeId != null) {
        socket.join(`store-${storeId}`);
        console.log(`🏢 ${socket.id} joined store-${storeId}`);
      }
    });

    // 1b. Tham gia room thông báo theo role
    socket.on("joinAdminRoom", () => {
      socket.join("admin-room");
      console.log(`🛡️ ${socket.id} joined admin-room`);
    });

    // 1c. Universal: client gửi role → tự join đúng room
    socket.on("joinNotifRoom", ({ role }) => {
      const roomMap = {
        "admin":         "admin-room",
        "hr-manager":    "hr-room",
        "manager":       "manager-room",
        "stock-manager": "stock-room",
        "accountant":    "accountant-room",
        "employee":      "employee-room",
      };
      const room = roomMap[role];
      if (room) {
        socket.join(room);
        // Admin & manager cũng cần nhận thông báo chung
        if (role === "admin") socket.join("manager-room");
        console.log(`🔔 ${socket.id} (${role}) joined ${room}`);
      }
    });

    // 1d. Khách hàng theo dõi trạng thái đơn cụ thể
    socket.on("joinOrderRoom", ({ orderId }) => {
      if (orderId) {
        socket.join(`order-${orderId}`);
        console.log(`📦 ${socket.id} joined order-${orderId}`);
      }
    });

    // 1e. Khách hàng join room cá nhân để nhận mọi thông báo đơn hàng
    socket.on("joinCustomerRoom", ({ userId }) => {
      if (userId) {
        socket.join(`customer-${userId}`);
        console.log(`🛍️ ${socket.id} joined customer-${userId}`);
      }
    });

    // 2. Xử lý gửi tin nhắn
    socket.on("sendMessage", async (data) => {
      try {
        const { conversationId, content, senderType, messageType } = data;

        // Lưu tin nhắn vào MongoDB
        const newMessage = await Message.create({
          conversationId,
          senderType, // 'client' hoặc 'admin'
          content,
          messageType: messageType || "text",
          read: false
        });

        // Cập nhật tin cuối + đẩy hội thoại lên đầu danh sách. Đồng thời lấy storeId
        // để định tuyến thông báo đến đúng chi nhánh.
        const conv = await Conversation.findByIdAndUpdate(
          conversationId,
          { lastMessage: (content || "").substring(0, 200), lastSenderType: senderType },
          { new: true, timestamps: true }
        );
        const storeId = conv?.storeId ?? null;

        // Phát tin nhắn này cho MỌI NGƯỜI đang ở trong phòng đó (kể cả Admin và Client)
        io.to(conversationId).emit("receiveMessage", newMessage);

        const preview = (content || "").substring(0, 60);
        if (senderType === "client") {
          // Khách gửi → báo cho nhân viên CHI NHÁNH liên quan + admin (xem toàn bộ)
          const payload = { conversationId, storeId, preview };
          io.to(`chat-store-${storeId ?? "general"}`).emit("chat:newMessage", payload);
          io.to("admin-room").emit("chat:newMessage", payload);

          // Hẹn báo Telegram nếu sau 5' vẫn chưa ai trả lời (đang trao đổi thì không báo)
          scheduleUnansweredChatAlert(conversationId, conv);

          // Trợ lý CSKH thử phản hồi đầu tiên (không chặn luồng; lỗi → bỏ qua)
          maybeAiRespond(conversationId, conv).catch((e) => console.error("[ai-cskh]", e.message));
        } else {
          // Nhân viên/admin trả lời → huỷ hẹn báo (cuộc trò chuyện đang diễn ra)
          cancelUnansweredChatAlert(conversationId);
          aiPaused.delete(String(conversationId)); // nhân viên đã vào → cho AI hoạt động lại lần sau

          // Báo cho KHÁCH (chuông + badge bên web khách)
          try {
            if (conv?.phone) {
              const customer = await prisma.user.findFirst({
                where: { phone: conv.phone },
                select: { id: true },
              });
              if (customer) {
                io.to(`customer-${customer.id}`).emit("chat:newMessage", {
                  conversationId, storeId, preview, fromStaff: true,
                });
              }
            }
          } catch { /* tra cứu khách lỗi — không critical */ }
        }

      } catch (err) {
        console.error("Lỗi gửi tin nhắn:", err);
        socket.emit("chatError", { message: "Gửi tin nhắn thất bại" });
      }
    });

    // 3. Đánh dấu đã đọc (Khi Admin mở phòng chat lên)
    socket.on("markAsRead", async ({ conversationId }) => {
      try {
        // Đánh dấu tất cả tin nhắn của khách trong phòng này là 'đã đọc'
        await Message.updateMany(
          { conversationId, senderType: "client", read: false },
          { $set: { read: true } }
        );
        // Báo cho client biết là admin đã đọc (để đổi icon xanh)
        io.to(conversationId).emit("messagesRead", { conversationId });
      } catch (err) {
        console.error("Lỗi đánh dấu đã đọc:", err);
      }
    });

    socket.on("disconnect", () => {
      console.log(`❌ Socket disconnected: ${socket.id}`);
    });
  });

  return io; // Export ra để dùng ở nơi khác nếu cần
};

module.exports = initializeSocket;
module.exports.getIO = getIO;