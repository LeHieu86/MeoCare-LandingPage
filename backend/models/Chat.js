const mongoose = require('mongoose');

// ================== SCHEMA HỘI THOẠI ==================
const conversationSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true, index: true }, // Dùng SĐT để map với Postgres
  clientName: { type: String, default: 'Khách lạ' }, // Lấy từ lần đặt hàng đầu tiên
  lastMessage: { type: String, default: '' }, // Câu tin nhắn cuối để hiển thị bên ngoài
  status: { type: String, enum: ['active', 'closed'], default: 'active' }
}, { timestamps: true });

// ================== SCHEMA TIN NHẮN ==================
const messageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  senderType: { type: String, enum: ['client', 'admin'], required: true }, // Ai gửi?
  content: { type: String, required: true }, // Nội dung chữ
  messageType: { type: String, enum: ['text', 'order', 'image'], default: 'text' }, // Loại tin nhắn
  read: { type: Boolean, default: false } // Đã đọc chưa
}, { timestamps: true });

const Conversation = mongoose.model('Conversation', conversationSchema);
const Message = mongoose.model('Message', messageSchema);

module.exports = { Conversation, Message };