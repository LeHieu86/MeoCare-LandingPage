const express = require("express");
const { verifyToken } = require("../middleware/auth");
const prisma = require("../lib/prisma");

const router = express.Router();

// ==========================================
// 1. THÊM SẢN PHẨM VÀO GIỎ HÀNG (UPSERT LOGIC)
// ==========================================
router.post("/add", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, variantName, quantity } = req.body;

    if (!productId || !variantName || !quantity) {
      return res.status(400).json({ success: false, error: "Thiếu thông tin sản phẩm" });
    }

    // BƯỚC 1: UPSERT GIỎ HÀNG
    const cart = await prisma.cart.upsert({
      where: { userId: userId },
      update: {},
      create: { userId: userId },
    });

    // BƯỚC 2: KIỂM TRA SẢN PHẨM ĐÃ CÓ TRONG GIỎ HAY CHƯA
    const existingItem = await prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId: parseInt(productId),
        variantName: variantName,
      },
    });

    if (existingItem) {
      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: { increment: parseInt(quantity) } },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: parseInt(productId),
          variantName: variantName,
          quantity: parseInt(quantity),
        },
      });
    }

    res.json({ success: true, message: "Đã thêm vào giỏ hàng" });
  } catch (error) {
    console.error("Lỗi thêm giỏ hàng:", error);
    res.status(500).json({ success: false, error: "Lỗi server" });
  }
});

// ==========================================
// 2. LẤY THÔNG TIN GIỎ HÀNG (REAL-TIME PRICE)
// ==========================================
router.get("/", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const cart = await prisma.cart.findUnique({
      where: { userId: userId },
      include: {
        items: {
          include: {
            product: {
              include: { variants: true },
            },
          },
        },
      },
    });

    if (!cart) {
      return res.json({ success: true, items: [], total: 0 });
    }

    const formattedItems = cart.items.map((item) => {
      const currentVariant = item.product.variants.find(
        (v) => v.name === item.variantName
      );
      const currentPrice = currentVariant ? currentVariant.price : 0;

      return {
        cartItemId: item.id,
        productId: item.productId,
        name: item.product.name,
        image: item.product.image,
        variantName: item.variantName,
        quantity: item.quantity,
        price: currentPrice,
        subtotal: currentPrice * item.quantity,
      };
    });

    const total = formattedItems.reduce((sum, item) => sum + item.subtotal, 0);

    res.json({ success: true, items: formattedItems, total: total });
  } catch (error) {
    console.error("Lỗi lấy giỏ hàng:", error);
    res.status(500).json({ success: false, error: "Lỗi server" });
  }
});

// ==========================================
// 3. XÓA 1 SẢN PHẨM KHỎI GIỎ HÀNG
// ==========================================
router.delete("/item/:cartItemId", verifyToken, async (req, res) => {
  try {
    const { cartItemId } = req.params;
    await prisma.cartItem.delete({
      where: { id: parseInt(cartItemId) },
    });
    res.json({ success: true, message: "Đã xóa khỏi giỏ hàng" });
  } catch (error) {
    res.status(500).json({ success: false, error: "Lỗi server" });
  }
});

// ==========================================
// 4. CẬP NHẬT SỐ LƯỢNG (Dùng cho nút +/-)
// ==========================================
router.put("/item/:cartItemId", verifyToken, async (req, res) => {
  try {
    const { cartItemId } = req.params;
    const { quantity } = req.body;

    if (quantity <= 0) {
      await prisma.cartItem.delete({ where: { id: parseInt(cartItemId) } });
      return res.json({ success: true, message: "Đã xóa khỏi giỏ hàng" });
    }

    await prisma.cartItem.update({
      where: { id: parseInt(cartItemId) },
      data: { quantity: quantity },
    });

    res.json({ success: true, message: "Đã cập nhật số lượng" });
  } catch (error) {
    res.status(500).json({ success: false, error: "Lỗi server" });
  }
});

module.exports = router;