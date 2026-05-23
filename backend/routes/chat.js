const express = require("express");
const prisma = require("../lib/prisma"); // Để kiểm tra SĐT khách hàng có tồn tại không
const { Conversation, Message } = require("../models/Chat");

const router = express.Router();

// GET /api/chat/conversations -> Lấy danh sách phòng chat (Dành cho Admin)
// Enrich với tên thật + avatar từ PostgreSQL
router.get("/conversations", async (req, res) => {
  try {
    const conversations = await Conversation.find({})
      .sort({ updatedAt: -1 })
      .select("-__v");

    // Lấy thông tin khách hàng từ PostgreSQL theo SĐT
    const phones = conversations.map((c) => c.phone).filter(Boolean);
    const pgUsers = phones.length
      ? await prisma.user.findMany({
          where: { phone: { in: phones } },
          select: { phone: true, fullName: true, email: true, avatar: true },
        })
      : [];

    const pgMap = {};
    pgUsers.forEach((u) => { pgMap[u.phone] = u; });

    // Đếm tin nhắn chưa đọc theo conversation
    const unreadCounts = await Message.aggregate([
      { $match: { senderType: "client", read: false } },
      { $group: { _id: "$conversationId", count: { $sum: 1 } } },
    ]);
    const unreadMap = {};
    unreadCounts.forEach((r) => { unreadMap[r._id.toString()] = r.count; });

    const enriched = conversations.map((conv) => {
      const pg  = pgMap[conv.phone];
      const obj = conv.toObject();
      return {
        ...obj,
        clientName: pg?.fullName && pg.fullName !== "Null"
          ? pg.fullName
          : obj.clientName,
        email:   pg?.email  || null,
        avatar:  pg?.avatar || null,
        unread:  unreadMap[obj._id.toString()] || 0,
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error("[chat/conversations]", err);
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
      .sort({ createdAt: 1 })
      .limit(50);

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "Lỗi server." });
  }
});

// PUT /api/chat/read/:conversationId -> Đánh dấu tất cả tin từ client là đã đọc
router.put("/read/:conversationId", async (req, res) => {
  try {
    await Message.updateMany(
      { conversationId: req.params.conversationId, senderType: "client", read: false },
      { $set: { read: true } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Lỗi server." });
  }
});

module.exports = router;