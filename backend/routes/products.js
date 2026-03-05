const express = require("express");
const fs = require("fs");
const path = require("path");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();
const DB_PATH = path.join(__dirname, "../data/products.json");

// ── Helpers ───────────────────────────────────────────────────────────────────
const readDB = () => {
  const raw = fs.readFileSync(DB_PATH, "utf8");
  return JSON.parse(raw);
};

const writeDB = (data) => {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf8");
};

const nextId = (products) =>
  products.length === 0 ? 1 : Math.max(...products.map((p) => p.id)) + 1;

// ── PUBLIC ────────────────────────────────────────────────────────────────────

// GET /api/products  — list all (public)
router.get("/", (_req, res) => {
  try {
    const { products } = readDB();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: "Không thể đọc dữ liệu sản phẩm." });
  }
});

// GET /api/products/:id  — single product (public)
router.get("/:id", (req, res) => {
  try {
    const { products } = readDB();
    const product = products.find((p) => p.id === parseInt(req.params.id));
    if (!product) return res.status(404).json({ error: "Không tìm thấy sản phẩm." });
    res.json(product);
  } catch {
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ── PROTECTED (admin only) ────────────────────────────────────────────────────

// POST /api/products  — create
router.post("/", verifyToken, (req, res) => {
  try {
    const { name, category, image, description, variants } = req.body;

    if (!name || !category || !variants || variants.length === 0) {
      return res.status(400).json({ error: "Thiếu thông tin bắt buộc: name, category, variants." });
    }

    const db = readDB();
    const newProduct = {
      id: nextId(db.products),
      name,
      category,
      image: image || "",
      description: description || "",
      variants: variants.map((v) => ({
        name: v.name,
        price: parseInt(v.price) || 0,
      })),
    };

    db.products.push(newProduct);
    writeDB(db);

    res.status(201).json(newProduct);
  } catch (err) {
    res.status(500).json({ error: "Không thể tạo sản phẩm." });
  }
});

// PUT /api/products/:id  — update
router.put("/:id", verifyToken, (req, res) => {
  try {
    const db = readDB();
    const idx = db.products.findIndex((p) => p.id === parseInt(req.params.id));

    if (idx === -1) return res.status(404).json({ error: "Không tìm thấy sản phẩm." });

    const { name, category, image, description, variants } = req.body;
    const updated = {
      ...db.products[idx],
      ...(name !== undefined && { name }),
      ...(category !== undefined && { category }),
      ...(image !== undefined && { image }),
      ...(description !== undefined && { description }),
      ...(variants !== undefined && {
        variants: variants.map((v) => ({
          name: v.name,
          price: parseInt(v.price) || 0,
        })),
      }),
    };

    db.products[idx] = updated;
    writeDB(db);

    res.json(updated);
  } catch {
    res.status(500).json({ error: "Không thể cập nhật sản phẩm." });
  }
});

// DELETE /api/products/:id  — delete
router.delete("/:id", verifyToken, (req, res) => {
  try {
    const db = readDB();
    const idx = db.products.findIndex((p) => p.id === parseInt(req.params.id));

    if (idx === -1) return res.status(404).json({ error: "Không tìm thấy sản phẩm." });

    const deleted = db.products.splice(idx, 1)[0];
    writeDB(db);

    res.json({ message: "Đã xóa sản phẩm.", product: deleted });
  } catch {
    res.status(500).json({ error: "Không thể xóa sản phẩm." });
  }
});

module.exports = router;