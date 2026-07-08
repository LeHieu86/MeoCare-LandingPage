const express = require("express");
const { verifyToken } = require("../middleware/auth");
const prisma = require("../lib/prisma");
const { composeAddress } = require("../lib/address");

const router = express.Router();

/* ── GET /api/checkout/profile — Lấy thông tin khách để pre-fill form ── */
router.get("/profile", verifyToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        phone: true, fullName: true,
        addr_house: true, addr_street: true, addr_ward: true, addr_city: true,
      },
    });

    if (!user || !user.phone || user.phone === "Null") {
      return res.json({ success: true, profile: null });
    }

    const customer = await prisma.customer.findFirst({
      where: { phone: user.phone },
    });

    /* Ưu tiên địa chỉ có cấu trúc ở hồ sơ; fallback địa chỉ đã lưu ở customer */
    res.json({
      success: true,
      profile: {
        fullName: customer?.name || user.fullName || "",
        phone: user.phone,
        address: composeAddress(user) || customer?.address || "",
      },
    });
  } catch (err) {
    console.error("Lỗi lấy checkout profile:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

module.exports = router;