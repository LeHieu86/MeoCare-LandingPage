const db = require("./database");

console.log(db);

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

console.log("SQLite DB initialized");

/* Customers */
db.prepare(`
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  phone TEXT,
  address TEXT,
  created_at TEXT
)
`).run();

/* Orders */
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

/* Order Items */
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

console.log("Order tables created!");

