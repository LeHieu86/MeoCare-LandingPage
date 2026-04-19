const mongoose = require('mongoose');

const connectMongo = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Chat Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    // KHÔNG gọi process.exit() ở đây, để nếu Mongo bị lỗi thì Web bán hàng vẫn chạy bình thường
  }
};

module.exports = connectMongo;