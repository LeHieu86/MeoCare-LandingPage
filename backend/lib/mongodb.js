const mongoose = require('mongoose');

const connectMongo = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Chat Connected: ${conn.connection.host}`);

    // Đồng bộ index theo schema mới (đa chi nhánh): bỏ unique cũ trên `phone`,
    // tạo unique kép (phone, storeId). syncIndexes tự drop index thừa + tạo index thiếu.
    try {
      const { Conversation, Message } = require('../models/Chat');
      await Conversation.syncIndexes();
      await Message.syncIndexes();
      console.log('✅ Mongo chat indexes synced (multi-branch)');
    } catch (idxErr) {
      console.error('⚠️ Sync chat indexes failed:', idxErr.message);
    }
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    // KHÔNG gọi process.exit() ở đây, để nếu Mongo bị lỗi thì Web bán hàng vẫn chạy bình thường
  }
};

module.exports = connectMongo;