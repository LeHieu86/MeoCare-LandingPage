const { Server } = require("socket.io");
const { Conversation, Message } = require("./models/Chat");

let io; // Biến toàn cục

const getIO = () => io;

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

    // 1a-chat. Nhân viên chi nhánh tham gia "phòng thông báo chat" của chi nhánh mình
    //          để nhận báo có tin nhắn mới từ khách (đa chi nhánh).
    socket.on("joinStoreChatRoom", ({ storeId }) => {
      const room = `chat-store-${storeId ?? "general"}`;
      socket.join(room);
      console.log(`💬 ${socket.id} joined ${room}`);
    });

    // 1b. Tham gia room thông báo theo role
    socket.on("joinAdminRoom", () => {
      socket.join("admin-room");
      console.log(`🛡️ ${socket.id} joined admin-room`);
    });

    // 1c. Universal: client gửi role → tự join đúng room
    socket.on("joinNotifRoom", ({ role, token }) => {
      const roomMap = {
        "admin":         "admin-room",
        "hr-manager":    "hr-room",
        "manager":       "manager-room",
        "stock-manager": "stock-room",
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

        // Nếu khách gửi → báo cho nhân viên CHI NHÁNH liên quan + admin (xem toàn bộ)
        if (senderType === "client") {
          const payload = {
            conversationId,
            storeId,
            preview: (content || "").substring(0, 60),
          };
          io.to(`chat-store-${storeId ?? "general"}`).emit("chat:newMessage", payload);
          io.to("admin-room").emit("chat:newMessage", payload);
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