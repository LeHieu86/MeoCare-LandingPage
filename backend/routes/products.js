const express = require("express");
// THAY ĐỔI: Import Prisma
const prisma = require("../lib/prisma");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

// ── KHÔNG CẦN HELPER NỮA ─────────────────────────────────────────────────
// - Hàm getProduct() -> Thay bằng prisma.product.findUnique({ include: { variants: true } })
// - Hàm getAllProducts() -> Thay bằng prisma.product.findMany({ include: { variants: true } })
// - Hàm nextId() -> BỎ ĐI. Postgres & Prisma tự động xử lý Auto-increment hoàn hảo!

// ── PUBLIC ────────────────────────────────────────────────────────────────────

// GET /api/products
router.get("/", async (_req, res) => {
  try {
    // ✨ PHÉP THUẬT 1: include thay vì vòng lặp for
    const products = await prisma.product.findMany({
      include: { 
        variants: { 
          orderBy: { id: "asc" } // Đảm bảo biến thể luôn sắp xếp như cũ
        } 
      },
      orderBy: { id: "asc" }
    });
    
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: "Không thể đọc dữ liệu sản phẩm." });
  }
});

// GET /api/products/:id
router.get("/:id", async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { variants: { orderBy: { id: "asc" } } }
    });
    
    if (!product) return res.status(404).json({ error: "Không tìm thấy sản phẩm." });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ── PROTECTED ─────────────────────────────────────────────────────────────────

// POST /api/products
router.post("/", verifyToken, async (req, res) => {
  try {
    const { name, category, image, description, variants } = req.body;
    if (!name || !category || !variants || variants.length === 0) {
      return res.status(400).json({ error: "Thiếu thông tin bắt buộc: name, category, variants." });
    }

    // ✨ PHÉP THUẬT 2: Nested Create (Tạo cha và con cùng lúc)
    // KHÔNG CẦN DÙNG TRANSACTION Ở ĐÂY! Prisma tự động bao bọc câu lệnh này trong 1 transaction ngầm.
    // Nó sẽ tạo Product, lấy ID tự động, và truyền ID đó vào tất cả các Variant cùng lúc.
    const newProduct = await prisma.product.create({
      data: {
        name,
        category,
        image: image || "",
        description: description || "",
        variants: {
          create: variants.map(v => ({
            name: v.name,
            price: parseInt(v.price) || 0
          }))
        }
      },
      include: { variants: { orderBy: { id: "asc" } } } // Trả về luôn cái object vừa tạo (có kèm variants)
    });

    res.status(201).json(newProduct);
  } catch (err) {
    res.status(500).json({ error: "Không thể tạo sản phẩm.", detail: err.message });
  }
});

// PUT /api/products/:id
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    // Kiểm tra tồn tại
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Không tìm thấy sản phẩm." });

    const { name, category, image, description, variants } = req.body;

    // ✨ PHÉP THUẬT 3: Dynamic Update (Thay thế cho COALESCE của SQL)
    // Trong Prisma, bạn chỉ cần đưa vào object những trường CẦN UPDATE. 
    // Các trường không được đề cập sẽ được giữ nguyên.
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (category !== undefined) updateData.category = category;
    if (image !== undefined) updateData.image = image;
    if (description !== undefined) updateData.description = description;

    // Chỉ cập nhật variants nếu client gửi lên mảng variants mới
    if (variants) {
      await prisma.$transaction(async (tx) => {
        // 1. Cập nhật thông tin sản phẩm cha
        await tx.product.update({ where: { id }, data: updateData });

        // 2. Xóa toàn bộ biến thể cũ
        await tx.variant.deleteMany({ where: { product_id: id } });

        // 3. Tạo lại biến thể mới (Giống hệt logic cũ nhưng gọn hơn)
        if (variants.length > 0) {
          await tx.variant.createMany({
            data: variants.map(v => ({
              product_id: id,
              name: v.name,
              price: parseInt(v.price) || 0
            }))
          });
        }
      });

      // Lấy lại dữ liệu mới nhất để trả về cho Frontend
      const updated = await prisma.product.findUnique({
        where: { id },
        include: { variants: { orderBy: { id: "asc" } } }
      });
      return res.json(updated);
    }

    // Nếu không gửi lên variants, chỉ update thông tin cơ bản
    const updated = await prisma.product.update({
      where: { id },
      data: updateData,
      include: { variants: { orderBy: { id: "asc" } } }
    });
    
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Không thể cập nhật sản phẩm.", detail: err.message });
  }
});

// DELETE /api/products/:id
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return res.status(404).json({ error: "Không tìm thấy sản phẩm." });

    // ✨ PHÉP THUẬT 4: CASCADE DELETE (Xóa thác mục)
    // Nhìn vào file schema.prisma của bạn, ở model Variant đã có:
    // product Product @relation(fields: [product_id], references: [id], onDelete: Cascade)
    // Điều này có nghĩa là: Chỉ cần gọi delete Product, Postgres sẽ TỰ ĐỘNG xóa hết các Variant của nó!
    // KHÔNG CẦN transaction, KHÔNG CẦN xóa variants thủ công!
    await prisma.product.delete({ where: { id } });

    res.json({ message: "Đã xóa sản phẩm.", product });
  } catch (err) {
    res.status(500).json({ error: "Không thể xóa sản phẩm.", detail: err.message });
  }
});

module.exports = router;