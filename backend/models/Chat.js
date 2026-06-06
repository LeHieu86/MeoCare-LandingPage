const mongoose = require('mongoose');

// ================== SCHEMA HỘI THOẠI ==================
// Mỗi hội thoại là 1 cặp (khách hàng, chi nhánh).
//   storeId = Int  → chi nhánh cụ thể khách đang nhắn
//   storeId = null → kênh "Hỗ trợ chung" (CSKH/admin), cho khách chưa dùng dịch vụ
const conversationSchema = new mongoose.Schema({
  phone: { type: String, required: true, index: true }, // Map với khách bên Postgres
  storeId: { type: Number, default: null, index: true }, // null = kênh Hỗ trợ chung
  clientName: { type: String, default: 'Khách lạ' },
  lastMessage: { type: String, default: '' }, // Tin cuối để hiển thị danh sách
  lastSenderType: { type: String, enum: ['client', 'admin', null], default: null },
  clientLastSeenAt: { type: Date, default: null }, // lần cuối KHÁCH xem hội thoại này (để đếm tin chưa đọc của khách)
  status: { type: String, enum: ['active', 'closed'], default: 'active' }
}, { timestamps: true });

// Mỗi khách chỉ có DUY NHẤT 1 hội thoại cho mỗi chi nhánh (và 1 kênh chung).
conversationSchema.index({ phone: 1, storeId: 1 }, { unique: true });

// ================== SCHEMA TIN NHẮN ==================
const messageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  // 'client' = khách; 'admin' = nhân viên chi nhánh / admin trả lời
  senderType: { type: String, enum: ['client', 'admin'], required: true },
  content: { type: String, required: true },
  messageType: { type: String, enum: ['text', 'order', 'image'], default: 'text' },
  read: { type: Boolean, default: false } // tin của khách đã được nhân viên đọc chưa
}, { timestamps: true });

const Conversation = mongoose.model('Conversation', conversationSchema);
const Message = mongoose.model('Message', messageSchema);

module.exports = { Conversation, Message };
