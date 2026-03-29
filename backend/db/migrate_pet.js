const db = require("./database");

console.log("🚀 Running migration...");

// ================== ROOMS ==================
db.prepare(`
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  name TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT
)
`).run();

// ================== CAMERAS ==================
db.prepare(`
CREATE TABLE IF NOT EXISTS cameras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT,
  name TEXT,
  rtsp_url TEXT,
  created_at TEXT
)
`).run();

// ================== SERVICES ==================
db.prepare(`
CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT,
  customer_id INTEGER,
  start_time TEXT,
  end_time TEXT,
  note TEXT,
  created_at TEXT
)
`).run();

// ================== TOKENS ==================
db.prepare(`
CREATE TABLE IF NOT EXISTS tokens (
  token TEXT PRIMARY KEY,
  room_id TEXT,
  service_id INTEGER,
  expired_at TEXT,
  created_at TEXT
)
`).run();


// ================== USERS ==================
db.prepare(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT,
  role TEXT DEFAULT 'client', -- admin / client
  created_at TEXT
)
`).run();

// ================== BOOKINGS ==================
db.prepare(`
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  room_id TEXT,
  start_time TEXT,
  end_time TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT
)
`).run();

// ================== ACCESS LOGS ==================
db.prepare(`
CREATE TABLE IF NOT EXISTS access_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  camera_id INTEGER,
  access_time TEXT
)
`).run();


// ================== INDEX (tăng tốc) ==================
db.prepare(`
CREATE INDEX IF NOT EXISTS idx_cameras_room
ON cameras(room_id)
`).run();

db.prepare(`
CREATE INDEX IF NOT EXISTS idx_services_room
ON services(room_id)
`).run();

db.prepare(`
CREATE INDEX IF NOT EXISTS idx_bookings_room
ON bookings(room_id)
`).run();

db.prepare(`
CREATE INDEX IF NOT EXISTS idx_tokens_room
ON tokens(room_id)
`).run();


// ================== SEED ADMIN ==================
const admin = db.prepare(`
SELECT * FROM users WHERE username = ?
`).get("admin");

if (!admin) {
  db.prepare(`
  INSERT INTO users (username, password, role, created_at)
  VALUES (?, ?, ?, datetime('now'))
  `).run("admin", "123456", "admin");

  console.log("👑 Admin user created: admin / 123456");
}

console.log("✅ Migration done!");