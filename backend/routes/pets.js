const express = require("express");
const multer = require("multer");
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const path = require("path");
const crypto = require("crypto");
const { verifyToken } = require("../middleware/auth");
const prisma = require("../lib/prisma");

const router = express.Router();

/* ══════════════════════════════════════════
   R2 SETUP
   ══════════════════════════════════════════ */
const R2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const BUCKET = process.env.R2_BUCKET_NAME;
const PUBLIC_URL = process.env.R2_PUBLIC_URL;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error("Chỉ chấp nhận file ảnh (jpg, png, webp)"));
  },
});

const urlToKey = (url) => (url ? url.replace(`${PUBLIC_URL}/`, "") : null);

// Helper: validate payload
const validatePet = (body) => {
  const { name, gender, breed, age } = body;
  if (!name || typeof name !== "string" || !name.trim()) return "Tên thú cưng không được để trống";
  if (gender && !["male", "female"].includes(gender)) return "Giới tính không hợp lệ";
  if (!breed || typeof breed !== "string" || !breed.trim()) return "Giống loài không được để trống";
  const ageNum = Number(age);
  if (Number.isNaN(ageNum) || ageNum < 0 || ageNum > 30) return "Tuổi không hợp lệ (0 - 30)";
  return null;
};

/* ══════════════════════════════════════════
   POST /pets/upload-avatar — Upload ảnh lên R2
   ══════════════════════════════════════════ */
router.post("/upload-avatar", verifyToken, (req, res) => {
  upload.single("avatar")(req, res, async (err) => {
    // Bắt lỗi multer trước khi vào handler (file quá lớn, sai định dạng...)
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE")
        return res.status(400).json({ success: false, message: "Ảnh quá lớn, tối đa 5MB" });
      return res.status(400).json({ success: false, message: err.message || "File không hợp lệ" });
    }

    try {
      if (!req.file)
        return res.status(400).json({ success: false, message: "Không có file ảnh" });

      const ext = path.extname(req.file.originalname) || ".jpg";
      const hash = crypto.randomBytes(8).toString("hex");
      const key = `pet-images/${hash}${ext}`;

      await R2.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      }));

      res.json({ success: true, url: `${PUBLIC_URL}/${key}`, key });
    } catch (uploadErr) {
      console.error("Upload pet avatar error:", uploadErr);
      res.status(500).json({ success: false, message: "Upload thất bại, vui lòng thử lại" });
    }
  });
});

/* ══════════════════════════════════════════
   GET /pets
   ══════════════════════════════════════════ */
router.get("/", verifyToken, async (req, res) => {
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

/* ══════════════════════════════════════════
   POST /pets
   ══════════════════════════════════════════ */
router.post("/", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const error = validatePet(req.body);
    if (error) return res.status(400).json({ success: false, message: error });

    const { name, gender, breed, age, note, avatar } = req.body;
    const pet = await prisma.pet.create({
      data: {
        userId,
        name: name.trim(),
        gender: gender || "male",
        breed: breed.trim(),
        age: Number(age),
        fromShop: false,   // khách tự thêm → luôn false; store thêm hộ → BE riêng set true
        note: note?.trim() || null,
        avatar: avatar || null,
      },
    });

    res.json({ success: true, pet });
  } catch (err) {
    console.error("Lỗi thêm thú cưng:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

/* ══════════════════════════════════════════
   PUT /pets/:id
   ══════════════════════════════════════════ */
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const petId = parseInt(req.params.id);
    if (Number.isNaN(petId)) return res.status(400).json({ success: false, message: "ID không hợp lệ" });

    const error = validatePet(req.body);
    if (error) return res.status(400).json({ success: false, message: error });

    const existing = await prisma.pet.findUnique({ where: { id: petId } });
    if (!existing) return res.status(404).json({ success: false, message: "Không tìm thấy thú cưng" });
    if (existing.userId !== userId) return res.status(403).json({ success: false, message: "Không có quyền chỉnh sửa" });

    const { name, gender, breed, age, note, avatar } = req.body;

    // Xóa R2 file cũ nếu avatar bị thay thế
    if (avatar !== undefined && avatar !== existing.avatar && existing.avatar) {
      const oldKey = urlToKey(existing.avatar);
      if (oldKey) await R2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: oldKey })).catch(() => {});
    }

    const pet = await prisma.pet.update({
      where: { id: petId },
      data: {
        name: name.trim(),
        gender: gender || "male",
        breed: breed.trim(),
        age: Number(age),
        note: note?.trim() || null,
        ...(avatar !== undefined ? { avatar: avatar || null } : {}),
      },
    });

    res.json({ success: true, pet });
  } catch (err) {
    console.error("Lỗi cập nhật thú cưng:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

/* ══════════════════════════════════════════
   DELETE /pets/:id
   ══════════════════════════════════════════ */
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const petId = parseInt(req.params.id);
    if (Number.isNaN(petId)) return res.status(400).json({ success: false, message: "ID không hợp lệ" });

    const existing = await prisma.pet.findUnique({ where: { id: petId } });
    if (!existing) return res.status(404).json({ success: false, message: "Không tìm thấy thú cưng" });
    if (existing.userId !== userId) return res.status(403).json({ success: false, message: "Không có quyền xóa" });

    if (existing.avatar) {
      const key = urlToKey(existing.avatar);
      if (key) await R2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key })).catch(() => {});
    }

    await prisma.pet.delete({ where: { id: petId } });
    res.json({ success: true, message: "Đã xóa thú cưng" });
  } catch (err) {
    console.error("Lỗi xóa thú cưng:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

module.exports = router;
