const express = require("express");
const { verifyToken } = require("../middleware/auth");
const prisma = require("../lib/prisma");

const router = express.Router();

/* ══════════════════════════════════════════════════════
   GET /api/service/booking-profile
   ──────────────────────────────────────────────────────
   Trả về thông tin khách + danh sách thú cưng
   để pre-fill form đặt lịch. Cần đăng nhập.
   ══════════════════════════════════════════════════════ */
router.get("/booking-profile", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        phone: true,
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy user" });
    }

    const pets = await prisma.pet.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        breed: true,
        gender: true,
        age: true,
      },
      orderBy: { createdAt: "asc" },
    });

    res.json({
      success: true,
      profile: {
        fullName: user.fullName || "",
        phone: user.phone || "",
      },
      pets,
    });
  } catch (err) {
    console.error("Lỗi lấy booking profile:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

module.exports = router;