const db = require("./database");

console.log("🚀 Running migration...");

// ROOMS
db.prepare(`
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  name TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT
)
`).run();

// CAMERAS
db.prepare(`
CREATE TABLE IF NOT EXISTS cameras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT,
  name TEXT,
  rtsp_url TEXT,
  created_at TEXT
)
`).run();

// SERVICES
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

// TOKENS
db.prepare(`
CREATE TABLE IF NOT EXISTS tokens (
  token TEXT PRIMARY KEY,
  room_id TEXT,
  service_id INTEGER,
  expired_at TEXT,
  created_at TEXT
)
`).run();

console.log("✅ Migration done!");