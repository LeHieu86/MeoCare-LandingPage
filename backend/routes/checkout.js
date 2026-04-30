const express = require("express");
const { verifyToken } = require("../middleware/auth");
const prisma = require("../lib/prisma");

const router = express.Router();

/* ── GET /api/checkout/profile — Lấy thông tin khách để pre-fill form ── */
router.get("/profile", verifyToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { phone: true, fullName: true },
    });

    if (!user || !user.phone || user.phone === "Null") {
      return res.json({ success: true, profile: null });
    }

    const customer = await prisma.customer.findFirst({
      where: { phone: user.phone },
    });

    /* Nếu có customer → trả cả address đã lưu
       Nếu chưa có customer → trả info cơ bản từ user */
    res.json({
      success: true,
      profile: {
        fullName: customer?.name || user.fullName || "",
        phone: user.phone,
        address: customer?.address || "",
      },
    });
  } catch (err) {
    console.error("Lỗi lấy checkout profile:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

module.exports = router;