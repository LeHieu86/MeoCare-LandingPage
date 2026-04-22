const express = require("express");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const router = express.Router();

// ✅ MIDDLEWARE GIẢ LẬP KIỂM TRA ĐĂNG NHẬP
// (Tạm thời dùng cái này để test, sau này thay bằng middleware JWT thật của bạn)
const mockAuth = (req, res, next) => {
  // Tạm giả lập user id = 1 (Bạn có thể đổi id này thành id user bạn vừa tạo trong DB để test)
  req.user = { id: 1 }; 
  next();
};

// ==========================================
// 1. THÊM SẢN PHẨM VÀO GIỎ HÀNG (UPSERT LOGIC)
// ==========================================
router.post("/add", mockAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, variantName, quantity } = req.body;

    if (!productId || !variantName || !quantity) {
      return res.status(400).json({ success: false, error: "Thiếu thông tin sản phẩm" });
    }

    // BƯỚC 1: UPSET GIỎ HÀNG (Chưa có -> Tạo mới, Có rồi -> Bỏ qua)
    const cart = await prisma.cart.upsert({
      where: { userId: userId },
      update: {},
      create: { userId: userId }
    });

    // BƯỚC 2: KIỂM TRA SẢN PHẨM ĐÃ CÓ TRONG GIỎ HAY CHƯA
    const existingItem = await prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId: parseInt(productId),
        variantName: variantName
      }
    });

    if (existingItem) {
      // Nếu có rồi -> Cộng thêm số lượng mới vào số lượng cũ
      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: { increment: parseInt(quantity) } }
      });
    } else {
      // Nếu chưa có -> Tạo mới
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: parseInt(productId),
          variantName: variantName,
          quantity: parseInt(quantity)
        }
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
router.get("/", mockAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const cart = await prisma.cart.findUnique({
      where: { userId: userId },
      include: {
        items: {
          include: {
            product: {
              include: { variants: true } // ✅ Lấy luôn danh sách variants để check giá
            }
          }
        }
      }
    });

    if (!cart) {
      return res.json({ success: true, items: [], total: 0 });
    }

    // BƯỚC 3: TÍNH TOÁN GIÁ REAL-TIME DỰA TRÊN BẢNG PRODUCT
    const formattedItems = cart.items.map(item => {
      // Tìm cái variant có tên trùng với tên đã lưu trong giỏ hàng
      const currentVariant = item.product.variants.find(v => v.name === item.variantName);
      
      // Lấy giá hiện tại. Nếu shop lỡ xóa cái variant này thì fallback về 0
      const currentPrice = currentVariant ? currentVariant.price : 0;

      return {
        cartItemId: item.id,         // Cần thiết để xóa/sửa số lượng sau này
        productId: item.productId,
        name: item.product.name,
        image: item.product.image,
        variantName: item.variantName,
        quantity: item.quantity,
        price: currentPrice,         // ✅ GIÁ MỚI NHẤT TỪ DB
        subtotal: currentPrice * item.quantity
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
router.delete("/item/:cartItemId", mockAuth, async (req, res) => {
  try {
    const { cartItemId } = req.params;
    await prisma.cartItem.delete({
      where: { id: parseInt(cartItemId) }
    });
    res.json({ success: true, message: "Đã xóa khỏi giỏ hàng" });
  } catch (error) {
    res.status(500).json({ success: false, error: "Lỗi server" });
  }
});

// ==========================================
// 4. CẬP NHẬT SỐ LƯỢNG (Dùng cho nút +/- )
// ==========================================
router.put("/item/:cartItemId", mockAuth, async (req, res) => {
  try {
    const { cartItemId } = req.params;
    const { quantity } = req.body;

    if (quantity <= 0) {
      // Nếu số lượng <= 0, tự động xóa sản phẩm đó khỏi giỏ
      await prisma.cartItem.delete({ where: { id: parseInt(cartItemId) } });
      return res.json({ success: true, message: "Đã xóa khỏi giỏ hàng" });
    }

    await prisma.cartItem.update({
      where: { id: parseInt(cartItemId) },
      data: { quantity: quantity }
    });

    res.json({ success: true, message: "Đã cập nhật số lượng" });
  } catch (error) {
    res.status(500).json({ success: false, error: "Lỗi server" });
  }
});

module.exports = router;