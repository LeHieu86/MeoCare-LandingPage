const express = require("express");
const multer = require("multer");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const path = require("path");
const crypto = require("crypto");

const router = express.Router();

/* ══════════════════════════════════════════════════
   CẤU HÌNH CLOUDFLARE R2
   ══════════════════════════════════════════════════ */
const R2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME;
const PUBLIC_URL = process.env.R2_PUBLIC_URL; // VD: https://pub-xxxxx.r2.dev hoặc custom domain

/* ══════════════════════════════════════════════════
   MULTER — Giới hạn 5MB, chỉ nhận ảnh
   ══════════════════════════════════════════════════ */
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận file ảnh (jpg, png, webp, gif)"));
    }
  },
});

/* ══════════════════════════════════════════════════
   POST /api/upload — Upload ảnh lên R2
   ══════════════════════════════════════════════════ */
router.post("/", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Không có file ảnh" });
    }

    /* Tạo tên file unique: products/abc123def.webp */
    const ext = path.extname(req.file.originalname) || ".jpg";
    const hash = crypto.randomBytes(8).toString("hex");
    const key = `products/${hash}${ext}`;

    /* Upload lên R2 */
    await R2.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      })
    );

    /* Trả về URL public */
    const url = `${PUBLIC_URL}/${key}`;

    res.json({
      success: true,
      url,
      key,
      size: req.file.size,
    });
  } catch (err) {
    console.error("Upload error:", err);

    if (err.message?.includes("Chỉ chấp nhận")) {
      return res.status(400).json({ success: false, message: err.message });
    }

    res.status(500).json({ success: false, message: "Upload thất bại" });
  }
});

/* Middleware xử lý lỗi multer (file quá lớn) */
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ success: false, message: "File quá lớn (tối đa 5MB)" });
    }
  }
  next(err);
});

module.exports = router;