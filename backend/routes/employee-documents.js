/**
 * /api/employee-documents
 * Upload / xem / download / xóa hồ sơ tài liệu nhân viên
 * Lưu trữ local tại: uploads/employee-docs/
 */
const express = require("express");
const multer  = require("multer");
const path    = require("path");
const fs      = require("fs");
const prisma  = require("../lib/prisma");
const { verifyToken }  = require("../middleware/auth");

const router = express.Router();

const requireHR = (req, res, next) => {
  if (!["admin", "hr-manager", "manager"].includes(req.user?.role))
    return res.status(403).json({ error: "Không có quyền." });
  next();
};

// ── Multer config ─────────────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, "../uploads/employee-docs");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg", "image/png", "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => {
    const ext  = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_\-.]/g, "_")
      .slice(0, 60);
    cb(null, `${Date.now()}_${base}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Chỉ hỗ trợ PDF, ảnh, hoặc Word."));
  },
});

// ── POST /api/employee-documents/:employeeId — Upload tài liệu ───────────────
router.post("/:employeeId", verifyToken, requireHR,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "Không có file." });

      const empId = parseInt(req.params.employeeId);
      const emp   = await prisma.employee.findUnique({ where: { id: empId } });
      if (!emp) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ error: "Không tìm thấy nhân viên." });
      }

      const { type = "other", name, note } = req.body;
      const doc = await prisma.employeeDocument.create({
        data: {
          employeeId:   empId,
          type,
          name:         name?.trim() || req.file.originalname,
          fileName:     req.file.filename,
          filePath:     `uploads/employee-docs/${req.file.filename}`,
          fileSize:     req.file.size,
          mimeType:     req.file.mimetype,
          note:         note?.trim() || null,
          uploadedById: req.user.id,
        },
      });

      res.status(201).json(doc);
    } catch (err) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      console.error("[POST /employee-documents]", err);
      res.status(500).json({ error: err.message || "Lỗi server." });
    }
  }
);

// ── GET /api/employee-documents/:employeeId — Danh sách tài liệu ─────────────
router.get("/:employeeId", verifyToken, requireHR, async (req, res) => {
  try {
    const empId = parseInt(req.params.employeeId);
    const docs  = await prisma.employeeDocument.findMany({
      where:   { employeeId: empId },
      orderBy: { createdAt: "desc" },
    });
    res.json(docs);
  } catch (err) {
    console.error("[GET /employee-documents]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ── GET /api/employee-documents/file/:id — Stream / download file ────────────
router.get("/file/:id", verifyToken, async (req, res) => {
  try {
    const doc = await prisma.employeeDocument.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    if (!doc) return res.status(404).json({ error: "Không tìm thấy tài liệu." });

    const abs = path.join(__dirname, "..", doc.filePath);
    if (!fs.existsSync(abs)) return res.status(404).json({ error: "File không tồn tại trên server." });

    const inline = ["image/jpeg","image/png","image/webp","application/pdf"].includes(doc.mimeType || "");
    res.setHeader("Content-Type", doc.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition",
      `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(doc.name)}"`);
    fs.createReadStream(abs).pipe(res);
  } catch (err) {
    console.error("[GET /employee-documents/file]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ── DELETE /api/employee-documents/:id — Xóa tài liệu ───────────────────────
router.delete("/:id", verifyToken, requireHR, async (req, res) => {
  try {
    const doc = await prisma.employeeDocument.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    if (!doc) return res.status(404).json({ error: "Không tìm thấy tài liệu." });

    // Xóa file vật lý
    const abs = path.join(__dirname, "..", doc.filePath);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);

    await prisma.employeeDocument.delete({ where: { id: doc.id } });
    res.json({ success: true });
  } catch (err) {
    console.error("[DELETE /employee-documents]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

module.exports = router;
