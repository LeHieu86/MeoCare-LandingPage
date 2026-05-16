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

// Helper: flatten SellProductComponent vào variant để FE thấy được inventory_item_id + qty_per_unit
const flattenProduct = (p) => ({
  ...p,
  variants: p.variants.map((v) => {
    const comp = v.sellComponents?.[0]; // 1 variant chỉ link 1 inventory item ở UI hiện tại
    return {
      id: v.id,
      product_id: v.product_id,
      name: v.name,
      price: v.price,
      inventory_item_id: comp?.inventory_item_id || null,
      qty_per_unit: comp?.qty || null,
    };
  }),
});

const VARIANT_INCLUDE = {
  variants: {
    orderBy: { id: "asc" },
    include: { sellComponents: true },
  },
};

// GET /api/products
router.get("/", async (_req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: VARIANT_INCLUDE,
      orderBy: { id: "asc" },
    });
    res.json(products.map(flattenProduct));
  } catch (err) {
    res.status(500).json({ error: "Không thể đọc dữ liệu sản phẩm." });
  }
});

// GET /api/products/:id
router.get("/:id", async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: parseInt(req.params.id) },
      include: VARIANT_INCLUDE,
    });
    if (!product) return res.status(404).json({ error: "Không tìm thấy sản phẩm." });
    res.json(flattenProduct(product));
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

    const newProduct = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name,
          category,
          image: image || "",
          description: description || "",
          variants: {
            create: variants.map((v) => ({
              name: v.name,
              price: parseInt(v.price) || 0,
            })),
          },
        },
        include: VARIANT_INCLUDE,
      });

      // Tạo SellProductComponent cho variants có inventory_item_id
      for (let i = 0; i < variants.length; i++) {
        const inv_id = variants[i].inventory_item_id;
        if (!inv_id) continue;
        await tx.sellProductComponent.create({
          data: {
            variant_id: product.variants[i].id,
            inventory_item_id: parseInt(inv_id),
            qty: parseInt(variants[i].qty_per_unit) || 1,
          },
        });
      }

      return tx.product.findUnique({ where: { id: product.id }, include: VARIANT_INCLUDE });
    });

    res.status(201).json(flattenProduct(newProduct));
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
        await tx.product.update({ where: { id }, data: updateData });

        // SellProductComponent có FK Cascade theo variant_id → tự xóa khi deleteMany variants
        await tx.variant.deleteMany({ where: { product_id: id } });

        for (const v of variants) {
          const newVariant = await tx.variant.create({
            data: {
              product_id: id,
              name: v.name,
              price: parseInt(v.price) || 0,
            },
          });
          if (v.inventory_item_id) {
            await tx.sellProductComponent.create({
              data: {
                variant_id: newVariant.id,
                inventory_item_id: parseInt(v.inventory_item_id),
                qty: parseInt(v.qty_per_unit) || 1,
              },
            });
          }
        }
      });

      const updated = await prisma.product.findUnique({ where: { id }, include: VARIANT_INCLUDE });
      return res.json(flattenProduct(updated));
    }

    // Nếu không gửi lên variants, chỉ update thông tin cơ bản
    const updated = await prisma.product.update({
      where: { id },
      data: updateData,
      include: VARIANT_INCLUDE,
    });
    res.json(flattenProduct(updated));
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