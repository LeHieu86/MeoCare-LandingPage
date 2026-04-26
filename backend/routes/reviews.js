const express = require("express");
const prisma = require("../lib/prisma");

const router = express.Router();

// GET /api/reviews/:productId — công khai, ai cũng xem được
router.get("/:productId", async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    if (Number.isNaN(productId)) {
      return res.status(400).json({ success: false, message: "ID không hợp lệ" });
    }

    const reviews = await prisma.review.findMany({
      where: { productId },
      orderBy: { createdAt: "desc" },
    });

    const total = reviews.length;
    const avg = total > 0
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / total) * 10) / 10
      : 0;

    const breakdown = [5, 4, 3, 2, 1].map(star => ({
      star,
      count: reviews.filter(r => r.rating === star).length,
    }));

    res.json({ success: true, reviews, avg, total, breakdown });
  } catch (err) {
    console.error("Lỗi lấy đánh giá:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

// POST /api/reviews/:productId — chỉ khi có đơn hàng delivered
router.post("/:productId", async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    if (Number.isNaN(productId)) {
      return res.status(400).json({ success: false, message: "ID không hợp lệ" });
    }

    const { username, rating, comment, orderId, phone } = req.body;

    // 1. Bắt buộc có orderId và phone
    if (!orderId || !phone) {
      return res.status(400).json({
        success: false,
        message: "Cần xác nhận đơn hàng trước khi đánh giá",
      });
    }

    const ratingNum = Number(rating);
    if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ success: false, message: "Số sao không hợp lệ" });
    }
    if (!comment || !comment.trim()) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập nội dung đánh giá" });
    }

    // 2. Tìm customer theo phone
    const customer = await prisma.customer.findFirst({ where: { phone } });
    if (!customer) {
      return res.status(403).json({ success: false, message: "Không tìm thấy thông tin khách hàng" });
    }

    // 3. Kiểm tra đơn hàng thuộc customer và đã delivered
    const order = await prisma.order.findFirst({
      where: { id: parseInt(orderId), customer_id: customer.id },
    });
    if (!order) {
      return res.status(403).json({ success: false, message: "Đơn hàng không hợp lệ" });
    }
    if (order.status !== "delivered") {
      return res.status(400).json({
        success: false,
        message: "Vui lòng xác nhận đã nhận hàng trước khi đánh giá",
      });
    }

    // 4. Kiểm tra sản phẩm có trong đơn hàng
    const orderItem = await prisma.orderItem.findFirst({
      where: {
        order_id: parseInt(orderId),
        variant: { product_id: productId },
      },
    });
    if (!orderItem) {
      return res.status(400).json({
        success: false,
        message: "Sản phẩm này không có trong đơn hàng",
      });
    }

    // 5. Kiểm tra chưa đánh giá sản phẩm này trong đơn này
    const existing = await prisma.review.findFirst({
      where: { productId, orderId: parseInt(orderId) },
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Bạn đã đánh giá sản phẩm này trong đơn hàng này rồi",
      });
    }

    // 6. Tạo review
    const review = await prisma.review.create({
      data: {
        productId,
        orderId: parseInt(orderId),
        username: username?.trim() || customer.name || "Khách hàng",
        rating: ratingNum,
        comment: comment.trim(),
      },
    });

    res.json({ success: true, review });
  } catch (err) {
    console.error("Lỗi tạo đánh giá:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

module.exports = router;
