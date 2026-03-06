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

