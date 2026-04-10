const db = require("./database");

// ================== SAN PHAM ==================
db.prepare(`
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  name TEXT,
  category TEXT,
  image TEXT,
  description TEXT
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER,
  name TEXT,
  price INTEGER
)
`).run();

// ================== KHACH HANG ==================
db.prepare(`
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  phone TEXT,
  address TEXT,
  created_at TEXT
)
`).run();

// ================== DON HANG ==================
db.prepare(`
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no TEXT UNIQUE,
  customer_id INTEGER,
  subtotal INTEGER,
  ship_fee INTEGER,
  discount INTEGER,
  total INTEGER,
  note TEXT,
  signature TEXT,
  created_at TEXT
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER,
  product_id INTEGER,
  variant_name TEXT,
  price INTEGER,
  qty INTEGER,
  subtotal INTEGER
)
`).run();

// ================== PET HOTEL - PHONG ==================
db.prepare(`
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  name TEXT,
  status TEXT DEFAULT 'active',
  camera_id text,
  created_at TEXT,
  updated_at TEXT
)
`).run();

// ================== PET HOTEL - CAMERA ==================
db.prepare(`
CREATE TABLE IF NOT EXISTS cameras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT,
  name TEXT,
  rtsp_url TEXT,
  created_at TEXT,
  status TEXT DEFAULT 'active'
)
`).run();

// ================== PET HOTEL - DICH VU ==================
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

// ================== PET HOTEL - DAT CHO ==================
db.prepare(`
CREATE TABLE IF NOT EXISTS bookings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  cat_name    TEXT NOT NULL DEFAULT '',
  cat_breed   TEXT,
  owner_name  TEXT NOT NULL DEFAULT '',
  owner_phone TEXT NOT NULL DEFAULT '',
  service     TEXT NOT NULL DEFAULT 'day',
  room_id     TEXT,
  check_in    DATE NOT NULL,
  check_out   DATE NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',
  note        TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
)
`).run();

// ================== PET HOTEL - TOKEN CAMERA ==================
db.prepare(`
CREATE TABLE IF NOT EXISTS tokens (
  token TEXT PRIMARY KEY,
  room_id TEXT,
  service_id INTEGER,
  expired_at TEXT,
  created_at TEXT
)
`).run();

// ================== TAI KHOAN ==================
db.prepare(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT,
  role TEXT DEFAULT 'client',
  created_at TEXT
)
`).run();

// ================== LOG TRUY CAP CAMERA ==================
db.prepare(`
CREATE TABLE IF NOT EXISTS access_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  camera_id INTEGER,
  access_time TEXT
)
`).run();

// ================== NAS VIDEO SPLITTER ==================
db.prepare(`
CREATE TABLE IF NOT EXISTS nas_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  nas_root TEXT NOT NULL DEFAULT '/mnt/nas',
  rooms TEXT NOT NULL DEFAULT '[{"name":"PhongA01","camera_id":null}]',
  segment_duration INTEGER NOT NULL DEFAULT 900,
  date_format TEXT NOT NULL DEFAULT '%d-%m-%Y',
  output_format TEXT NOT NULL DEFAULT '.mp4',
  codec TEXT NOT NULL DEFAULT 'copy',
  source_dir TEXT NOT NULL DEFAULT '/home/user/videos/input',
  delete_source INTEGER NOT NULL DEFAULT 0,
  run_mode TEXT NOT NULL DEFAULT 'once',
  log_file TEXT NOT NULL DEFAULT '/tmp/nas_video_splitter.log',
  watch_interval INTEGER NOT NULL DEFAULT 30,
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
)
`).run();

const nasRow = db.prepare('SELECT id FROM nas_config WHERE id = 1').get();
if (!nasRow) {
  db.prepare('INSERT INTO nas_config (id) VALUES (1)').run();
}

// ================== INDEX (TANG TOC TRUY VAN) ==================
db.prepare(`CREATE INDEX IF NOT EXISTS idx_cameras_room ON cameras(room_id)`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_services_room ON services(room_id)`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_bookings_room ON bookings(room_id)`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_tokens_room ON tokens(room_id)`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status)`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id)`).run();

// ================== SEED ADMIN ==================
const admin = db.prepare(`SELECT id FROM users WHERE username = ?`).get("admin");
if (!admin) {
  db.prepare(`
    INSERT INTO users (username, password, role, created_at)
    VALUES (?, ?, ?, datetime('now'))
  `).run("admin", "$2a$10$uphQR0VSVa/.gF3VQp176uACx/Baz1bGMgwCZMwF7RjaLjZfwgs9a", "admin");
  console.log("Admin user created: admin / 123456");
}

console.log("SQLite DB FULL INIT DONE");
