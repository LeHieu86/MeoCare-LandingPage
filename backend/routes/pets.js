const express = require("express");
const prisma = require("../lib/prisma");

const router = express.Router();

// MIDDLEWARE GIẢ LẬP — Tạm thời như cart.js, sau này thay bằng JWT thật
const mockAuth = (req, res, next) => {
  req.user = { id: 1 };
  next();
};

// Helper: validate payload
const validatePet = (body) => {
  const { name, gender, breed, age } = body;
  if (!name || typeof name !== "string" || !name.trim()) {
    return "Tên thú cưng không được để trống";
  }
  if (gender && !["male", "female"].includes(gender)) {
    return "Giới tính không hợp lệ";
  }
  if (!breed || typeof breed !== "string" || !breed.trim()) {
    return "Giống loài không được để trống";
  }
  const ageNum = Number(age);
  if (Number.isNaN(ageNum) || ageNum < 0 || ageNum > 30) {
    return "Tuổi không hợp lệ (0 - 30)";
  }
  return null;
};

// ==========================================
// 1. LẤY DANH SÁCH THÚ CƯNG CỦA USER
// ==========================================
router.get("/", mockAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const pets = await prisma.pet.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
    res.json({ success: true, pets });
  } catch (err) {
    console.error("Lỗi lấy danh sách thú cưng:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

// ==========================================
// 2. THÊM THÚ CƯNG MỚI
// ==========================================
router.post("/", mockAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const error = validatePet(req.body);
    if (error) return res.status(400).json({ success: false, message: error });

    const { name, gender, breed, age, fromShop } = req.body;
    const pet = await prisma.pet.create({
      data: {
        userId,
        name: name.trim(),
        gender: gender || "male",
        breed: breed.trim(),
        age: Number(age),
        fromShop: !!fromShop,
      },
    });

    res.json({ success: true, pet });
  } catch (err) {
    console.error("Lỗi thêm thú cưng:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

// ==========================================
// 3. CẬP NHẬT THÔNG TIN THÚ CƯNG
// ==========================================
router.put("/:id", mockAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const petId = parseInt(req.params.id);
    if (Number.isNaN(petId)) {
      return res.status(400).json({ success: false, message: "ID không hợp lệ" });
    }

    const error = validatePet(req.body);
    if (error) return res.status(400).json({ success: false, message: error });

    // Đảm bảo pet thuộc về user (chống user A sửa pet của user B)
    const existing = await prisma.pet.findUnique({ where: { id: petId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Không tìm thấy thú cưng" });
    }
    if (existing.userId !== userId) {
      return res.status(403).json({ success: false, message: "Không có quyền chỉnh sửa" });
    }

    const { name, gender, breed, age, fromShop } = req.body;
    const pet = await prisma.pet.update({
      where: { id: petId },
      data: {
        name: name.trim(),
        gender: gender || "male",
        breed: breed.trim(),
        age: Number(age),
        fromShop: !!fromShop,
      },
    });

    res.json({ success: true, pet });
  } catch (err) {
    console.error("Lỗi cập nhật thú cưng:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

// ==========================================
// 4. XÓA THÚ CƯNG
// ==========================================
router.delete("/:id", mockAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const petId = parseInt(req.params.id);
    if (Number.isNaN(petId)) {
      return res.status(400).json({ success: false, message: "ID không hợp lệ" });
    }

    const existing = await prisma.pet.findUnique({ where: { id: petId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Không tìm thấy thú cưng" });
    }
    if (existing.userId !== userId) {
      return res.status(403).json({ success: false, message: "Không có quyền xóa" });
    }

    await prisma.pet.delete({ where: { id: petId } });
    res.json({ success: true, message: "Đã xóa thú cưng" });
  } catch (err) {
    console.error("Lỗi xóa thú cưng:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

module.exports = router;
