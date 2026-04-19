const express = require("express");
const prisma = require("../lib/prisma"); // Để kiểm tra SĐT khách hàng có tồn tại không
const { Conversation, Message } = require("../models/Chat");

const router = express.Router();

// GET /api/chat/conversations -> Lấy danh sách phòng chat (Dành cho Admin)
router.get("/conversations", async (req, res) => {
  try {
    const conversations = await Conversation.find({})
      .sort({ updatedAt: -1 }) // phòng nào có tin nhắn mới nhất đưa lên đầu
      .select('-__v'); // ẩn version key của Mongoose cho sạch sẽ
    res.json(conversations);
  } catch (err) {
    res.status(500).json({ error: "Lỗi server." });
  }
});

// POST /api/chat/room -> Lấy hoặc Tạo phòng chat dựa trên SĐT
router.post("/room", async (req, res) => {
  try {
    const { phone, name } = req.body;
    if (!phone) return res.status(400).json({ error: "Thiếu số điện thoại" });

    // Tìm hoặc tạo mới Conversation trong MongoDB
    let conversation = await Conversation.findOne({ phone: phone.trim() });
    
    if (!conversation) {
      conversation = await Conversation.create({
        phone: phone.trim(),
        clientName: name || "Khách lạ"
      });
    }

    res.json({
      success: true,
      conversationId: conversation._id,
      phone: conversation.phone,
      clientName: conversation.clientName
    });
  } catch (err) {
    res.status(500).json({ error: "Lỗi server." });
  }
});

// GET /api/chat/history/:conversationId -> Lấy lịch sử tin nhắn
router.get("/history/:conversationId", async (req, res) => {
  try {
    const { conversationId } = req.params;
    const messages = await Message.find({ conversationId })
      .sort({ createdAt: 1 }) // Sắp xếp từ cũ đến mới
      .limit(50); // Giới hạn 50 tin gần nhất để tải nhanh

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "Lỗi server." });
  }
});

module.exports = router;