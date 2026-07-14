const express = require("express");
const prisma = require("../lib/prisma");
const { verifyToken } = require("../middleware/auth");
const { storeContext } = require("../middleware/storeContext");
const { storeWhere, injectStoreId } = require("../lib/storeFilter");
const productsCache = require("../lib/productsCache");

const router = express.Router();

// Khoá cache theo phạm vi lọc của list: admin xem 1 chi nhánh → "store:<id>"; còn lại → "all".
const productsCacheKey = (req) => (req.isAdmin && req.storeId) ? `store:${req.storeId}` : "all";

// ── KHÔNG CẦN HELPER NỮA ─────────────────────────────────────────────────
// - Hàm getProduct() -> Thay bằng prisma.product.findUnique({ include: { variants: true } })
// - Hàm getAllProducts() -> Thay bằng prisma.product.findMany({ include: { variants: true } })
// - Hàm nextId() -> BỎ ĐI. Postgres & Prisma tự động xử lý Auto-increment hoàn hảo!

// ── PUBLIC ────────────────────────────────────────────────────────────────────

// Helper: flatten SellProductComponent vào variant để FE thấy được inventory_item_id + qty_per_unit
// Tối đa 9 ảnh / sản phẩm
const MAX_IMAGES = 9;

// Lọc URL hợp lệ, bỏ trùng, giới hạn 9 ảnh
const sanitizeImages = (arr) =>
  Array.isArray(arr)
    ? [...new Set(arr.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim()))].slice(0, MAX_IMAGES)
    : [];

const flattenProduct = (p) => {
  // Luôn trả mảng images cover-first; sản phẩm cũ (images rỗng) → fallback về [image]
  const gallery = (p.images && p.images.length) ? p.images : (p.image ? [p.image] : []);
  return ({
  ...p,
  images: gallery,
  review_count: p.review_count ?? 0,   // đọc từ cột cache
  rating_avg: p.rating_avg ?? 0,       // đọc từ cột cache
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
};

const VARIANT_INCLUDE = {
  variants: {
    orderBy: { id: "asc" },
    include: { sellComponents: true },
  },
  // rating_avg + review_count đọc thẳng từ cột cache trên Product (không gộp review mỗi request)
};

// GET /api/products
// Products là catalog chung — không lọc theo store.
// Admin muốn lọc theo store thì truyền ?store_id=X (dùng storeWhere chỉ khi isAdmin + storeId có giá trị).
router.get("/", verifyToken, storeContext, async (req, res) => {
  try {
    const key = productsCacheKey(req);
    const cached = productsCache.get(key);
    if (cached) return res.json(cached);           // cache hit → bỏ qua DB + flatten

    const where = (req.isAdmin && req.storeId) ? { store_id: req.storeId } : {};
    const products = await prisma.product.findMany({
      where,
      include: VARIANT_INCLUDE,
      orderBy: { id: "asc" },
    });
    const data = products.map(flattenProduct);
    productsCache.set(key, data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Không thể đọc dữ liệu sản phẩm." });
  }
});

// GET /api/products/:id
router.get("/:id", verifyToken, storeContext, async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: parseInt(req.params.id), ...storeWhere(req) },
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
router.post("/", verifyToken, storeContext, async (req, res) => {
  try {
    const { name, category, image, images, description, variants } = req.body;
    if (!name || !category || !variants || variants.length === 0) {
      return res.status(400).json({ error: "Thiếu thông tin bắt buộc: name, category, variants." });
    }

    // Gallery (cover-first). Client cũ chỉ gửi `image` → đưa vào gallery.
    let gallery = sanitizeImages(images);
    if (!gallery.length && typeof image === "string" && image.trim()) gallery = [image.trim()];
    const cover = gallery[0] || "";

    const newProduct = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name,
          category,
          image: cover,
          images: gallery,
          description: description || "",
          ...injectStoreId(req),
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

    productsCache.invalidate();
    res.status(201).json(flattenProduct(newProduct));
  } catch (err) {
    res.status(500).json({ error: "Không thể tạo sản phẩm.", detail: err.message });
  }
});

// PUT /api/products/:id
router.put("/:id", verifyToken, storeContext, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    // Kiểm tra tồn tại + thuộc đúng store
    const existing = await prisma.product.findUnique({ where: { id, ...storeWhere(req) } });
    if (!existing) return res.status(404).json({ error: "Không tìm thấy sản phẩm." });

    const { name, category, image, images, description, variants } = req.body;

    // ✨ PHÉP THUẬT 3: Dynamic Update (Thay thế cho COALESCE của SQL)
    // Trong Prisma, bạn chỉ cần đưa vào object những trường CẦN UPDATE.
    // Các trường không được đề cập sẽ được giữ nguyên.
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (category !== undefined) updateData.category = category;
    if (description !== undefined) updateData.description = description;

    // Ảnh: `images` là nguồn chính (cover-first → image = images[0]).
    // Client cũ chỉ gửi `image` → đồng bộ cả gallery lẫn cover.
    if (images !== undefined) {
      const gallery = sanitizeImages(images);
      updateData.images = gallery;
      updateData.image = gallery[0] || "";
    } else if (image !== undefined) {
      const cover = (typeof image === "string" && image.trim()) ? image.trim() : "";
      updateData.image = cover;
      updateData.images = cover ? [cover] : [];
    }

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
      productsCache.invalidate();
      return res.json(flattenProduct(updated));
    }

    // Nếu không gửi lên variants, chỉ update thông tin cơ bản
    const updated = await prisma.product.update({
      where: { id },
      data: updateData,
      include: VARIANT_INCLUDE,
    });
    productsCache.invalidate();
    res.json(flattenProduct(updated));
  } catch (err) {
    res.status(500).json({ error: "Không thể cập nhật sản phẩm.", detail: err.message });
  }
});

// DELETE /api/products/:id
router.delete("/:id", verifyToken, storeContext, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const product = await prisma.product.findUnique({ where: { id, ...storeWhere(req) } });
    if (!product) return res.status(404).json({ error: "Không tìm thấy sản phẩm." });

    // CASCADE DELETE: schema.prisma đã có onDelete: Cascade trên Variant
    // → xóa Product là Postgres tự xóa hết Variant + SellProductComponent
    await prisma.product.delete({ where: { id } });
    productsCache.invalidate();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Không thể xóa sản phẩm.", detail: err.message });
  }
});

module.exports = router;