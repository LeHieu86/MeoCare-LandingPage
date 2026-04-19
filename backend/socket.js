const { Server } = require("socket.io");
const { Message } = require("./models/Chat");

let io; // Biến toàn cục

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

        // Cập nhật lastMessage cho Conversation (Để Admin panel hiện dòng preview)
        // Để ở bước sau khi viết Admin Panel cho dễ, tạm thời bỏ qua.

        // Phát tin nhắn này cho MỌI NGƯỜI đang ở trong phòng đó (kể cả Admin và Client)
        io.to(conversationId).emit("receiveMessage", newMessage);

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