const express = require("express");
const db      = require("../db/database");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────────────
const getProduct = (id) => {
  const product = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
  if (!product) return null;
  product.variants = db.prepare(
    "SELECT name, price FROM variants WHERE product_id = ? ORDER BY id"
  ).all(id);
  return product;
};

const getAllProducts = () => {
  const products = db.prepare("SELECT * FROM products ORDER BY id").all();
  for (const p of products) {
    p.variants = db.prepare(
      "SELECT name, price FROM variants WHERE product_id = ? ORDER BY id"
    ).all(p.id);
  }
  return products;
};

const nextId = () => {
  const row = db.prepare("SELECT MAX(id) as max FROM products").get();
  return (row?.max || 0) + 1;
};

// ── PUBLIC ────────────────────────────────────────────────────────────────────

// GET /api/products
router.get("/", (_req, res) => {
  try {
    res.json(getAllProducts());
  } catch (err) {
    res.status(500).json({ error: "Không thể đọc dữ liệu sản phẩm." });
  }
});

// GET /api/products/:id
router.get("/:id", (req, res) => {
  try {
    const product = getProduct(parseInt(req.params.id));
    if (!product) return res.status(404).json({ error: "Không tìm thấy sản phẩm." });
    res.json(product);
  } catch {
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ── PROTECTED ─────────────────────────────────────────────────────────────────

// POST /api/products
router.post("/", verifyToken, (req, res) => {
  try {
    const { name, category, image, description, variants } = req.body;
    if (!name || !category || !variants || variants.length === 0) {
      return res.status(400).json({ error: "Thiếu thông tin bắt buộc: name, category, variants." });
    }

    const id = nextId();
    db.transaction(() => {
      db.prepare(
        "INSERT INTO products (id, name, category, image, description) VALUES (?, ?, ?, ?, ?)"
      ).run(id, name, category, image || "", description || "");
      for (const v of variants) {
        db.prepare(
          "INSERT INTO variants (product_id, name, price) VALUES (?, ?, ?)"
        ).run(id, v.name, parseInt(v.price) || 0);
      }
    })();

    res.status(201).json(getProduct(id));
  } catch (err) {
    res.status(500).json({ error: "Không thể tạo sản phẩm.", detail: err.message });
  }
});

// PUT /api/products/:id
router.put("/:id", verifyToken, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!getProduct(id)) return res.status(404).json({ error: "Không tìm thấy sản phẩm." });

    const { name, category, image, description, variants } = req.body;
    db.transaction(() => {
      db.prepare(`
        UPDATE products SET
          name        = COALESCE(?, name),
          category    = COALESCE(?, category),
          image       = COALESCE(?, image),
          description = COALESCE(?, description)
        WHERE id = ?
      `).run(name ?? null, category ?? null, image ?? null, description ?? null, id);

      if (variants) {
        db.prepare("DELETE FROM variants WHERE product_id = ?").run(id);
        for (const v of variants) {
          db.prepare(
            "INSERT INTO variants (product_id, name, price) VALUES (?, ?, ?)"
          ).run(id, v.name, parseInt(v.price) || 0);
        }
      }
    })();

    res.json(getProduct(id));
  } catch (err) {
    res.status(500).json({ error: "Không thể cập nhật sản phẩm.", detail: err.message });
  }
});

// DELETE /api/products/:id
router.delete("/:id", verifyToken, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const product = getProduct(id);
    if (!product) return res.status(404).json({ error: "Không tìm thấy sản phẩm." });

    db.transaction(() => {
      db.prepare("DELETE FROM variants WHERE product_id = ?").run(id);
      db.prepare("DELETE FROM products WHERE id = ?").run(id);
    })();

    res.json({ message: "Đã xóa sản phẩm.", product });
  } catch (err) {
    res.status(500).json({ error: "Không thể xóa sản phẩm.", detail: err.message });
  }
});

module.exports = router;