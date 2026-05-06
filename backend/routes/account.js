const express = require("express");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const path = require("path");
const crypto = require("crypto");
const { verifyToken } = require("../middleware/auth");
const prisma = require("../lib/prisma");

const router = express.Router();

/* ── R2 CONFIG ── */
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

const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) cb(null, true);
    else cb(new Error("Chỉ chấp nhận ảnh JPG, PNG, WebP"));
  },
});

/* ══════════════════════════════════════════════════
   GET /api/account/profile
   ══════════════════════════════════════════════════ */
router.get("/profile", verifyToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        fullName: true,
        username: true,
        email: true,
        phone: true,
        role: true,
        avatar: true,
        created_at: true,
      },
    });

    if (!user) return res.status(404).json({ success: false, message: "Không tìm thấy tài khoản" });
    res.json({ success: true, user });
  } catch (err) {
    console.error("Lỗi lấy profile:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

/* ══════════════════════════════════════════════════
   PUT /api/account/profile
   ══════════════════════════════════════════════════ */
router.put("/profile", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { fullName, email, phone } = req.body;

    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ success: false, message: "Họ tên không được để trống" });
    }

    if (email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ success: false, message: "Email không hợp lệ" });
      }
      const existingEmail = await prisma.user.findFirst({
        where: { email, id: { not: userId } },
      });
      if (existingEmail) {
        return res.status(409).json({ success: false, message: "Email đã được sử dụng bởi tài khoản khác" });
      }
    }

    if (phone && !/^(0[3|5|7|8|9])+([0-9]{8})$/.test(phone.trim())) {
      return res.status(400).json({ success: false, message: "Số điện thoại không hợp lệ" });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        fullName: fullName.trim(),
        email: email?.trim() || undefined,
        phone: phone?.trim() || undefined,
      },
      select: {
        id: true, fullName: true, username: true, email: true,
        phone: true, role: true, avatar: true, created_at: true,
      },
    });

    res.json({ success: true, user: updated, message: "Cập nhật thành công" });
  } catch (err) {
    console.error("Lỗi cập nhật profile:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

/* ══════════════════════════════════════════════════
   PUT /api/account/avatar
   ══════════════════════════════════════════════════ */
router.put("/avatar", verifyToken, uploadAvatar.single("avatar"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Không có file ảnh" });
    }

    const ext = path.extname(req.file.originalname) || ".jpg";
    const hash = crypto.randomBytes(8).toString("hex");
    const key = `avatars/${req.user.id}-${hash}${ext}`;

    await R2.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }));

    const avatarUrl = `${PUBLIC_URL}/${key}`;

    await prisma.user.update({
      where: { id: req.user.id },
      data: { avatar: avatarUrl },
    });

    res.json({ success: true, avatar: avatarUrl });
  } catch (err) {
    console.error("Lỗi upload avatar:", err);
    res.status(500).json({ success: false, message: "Upload thất bại" });
  }
});

/* ══════════════════════════════════════════════════
   PUT /api/account/password
   ══════════════════════════════════════════════════ */
router.put("/password", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: "Vui lòng điền đầy đủ thông tin" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Mật khẩu mới phải có ít nhất 6 ký tự" });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Mật khẩu xác nhận không khớp" });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ success: false, message: "Mật khẩu mới phải khác mật khẩu hiện tại" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });

    if (!user) return res.status(404).json({ success: false, message: "Không tìm thấy tài khoản" });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(401).json({ success: false, message: "Mật khẩu hiện tại không đúng" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: userId }, data: { password: hashedPassword } });

    res.json({ success: true, message: "Đổi mật khẩu thành công" });
  } catch (err) {
    console.error("Lỗi đổi mật khẩu:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

module.exports = router;