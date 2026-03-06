const Database = require("better-sqlite3");
const path = require("path");

// Lưu file DB ở backend/data/meocare.db — cùng chỗ với products.json cũ
const DB_PATH = path.join(__dirname, "../data/meocare.db");

const db = new Database(DB_PATH, {
  // verbose: console.log, // bỏ comment nếu muốn log từng câu SQL
});

// WAL mode: tốt hơn cho concurrent reads
db.pragma("journal_mode = WAL");

module.exports = db;