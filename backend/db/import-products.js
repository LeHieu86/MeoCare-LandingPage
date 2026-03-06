const fs = require("fs");
const path = require("path");
const db = require("./database");

const jsonPath = path.join(__dirname, "../data/products.json");

const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

// clear data cũ
db.prepare("DELETE FROM variants").run();
db.prepare("DELETE FROM products").run();

for (const p of data.products) {

  db.prepare(`
    INSERT INTO products (id,name,category,image,description)
    VALUES (?,?,?,?,?)
  `).run(
    p.id,
    p.name,
    p.category,
    p.image,
    p.description
  );

  for (const v of p.variants) {

    db.prepare(`
      INSERT INTO variants (product_id,name,price)
      VALUES (?,?,?)
    `).run(
      p.id,
      v.name,
      v.price
    );

  }

}

console.log("Products imported");