const db = require("./database");

// ================== PRODUCTS ==================
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

// ================== CUSTOMERS ==================
db.prepare(`
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  phone TEXT,
  address TEXT,
  created_at TEXT
)
`).run();

// ================== ORDERS ==================
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

// ================== PET HOTEL ==================

// ROOMS
db.prepare(`
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,            -- A1, A2, A3
  name TEXT,
  status TEXT DEFAULT 'active',   -- active / occupied
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

// SERVICES (dịch vụ giữ mèo)
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

db.prepare(`
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  room_id TEXT,
  start_time TEXT,
  end_time TEXT,
  status TEXT DEFAULT 'active', -- active / done / cancelled
  created_at TEXT
)
`).run();

// TOKENS (link xem camera)
db.prepare(`
CREATE TABLE IF NOT EXISTS tokens (
  token TEXT PRIMARY KEY,
  room_id TEXT,
  service_id INTEGER,
  expired_at TEXT,
  created_at TEXT
)
`).run();

console.log("✅ SQLite DB FULL INIT DONE");

db.prepare(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT,
  role TEXT DEFAULT 'client', -- admin / client
  created_at TEXT
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS access_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  camera_id INTEGER,
  access_time TEXT
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS bookings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  cat_name    TEXT NOT NULL,
  cat_breed   TEXT,
  owner_name  TEXT NOT NULL,
  owner_phone TEXT NOT NULL,
  service     TEXT NOT NULL DEFAULT 'day',
  room_id     TEXT,
  check_in    DATE NOT NULL,
  check_out   DATE NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',
  note        TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
)
`).run();