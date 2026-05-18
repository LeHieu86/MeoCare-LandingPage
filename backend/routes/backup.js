const router = require("express").Router();
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { verifyToken } = require("../middleware/auth");
const {
  createBackup,
  restoreBackup,
  listBackups,
  deleteBackup,
  BACKUP_DIR,
} = require("../utils/backup");

const upload = multer({
  dest: "/tmp/meocare-restore/",
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.originalname.endsWith(".sql.gz")) {
      return cb(new Error("Chỉ chấp nhận file .sql.gz"));
    }
    cb(null, true);
  },
});

function safeFilename(filename) {
  return (
    filename.endsWith(".sql.gz") &&
    !filename.includes("..") &&
    !filename.includes("/") &&
    !filename.includes("\\")
  );
}

// POST /api/admin/backup/create
router.post("/create", verifyToken, async (req, res) => {
  try {
    const result = await createBackup();
    res.download(result.path, result.filename, (err) => {
      if (err) console.error("[Backup] Download error:", err.message);
    });
  } catch (err) {
    console.error("[Backup] Create error:", err.message);
    res.status(500).json({ error: "Tạo backup thất bại: " + err.message });
  }
});

// GET /api/admin/backup/list
router.get("/list", verifyToken, (_req, res) => {
  try {
    const backups = listBackups().map((b) => ({
      name: b.name,
      size: b.size,
      createdAt: b.createdAt,
    }));
    res.json({ success: true, data: backups });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/backup/download/:filename
router.get("/download/:filename", verifyToken, (req, res) => {
  const { filename } = req.params;
  if (!safeFilename(filename)) {
    return res.status(400).json({ error: "Tên file không hợp lệ." });
  }
  const filePath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File không tồn tại." });
  }
  res.download(filePath, filename);
});

// POST /api/admin/backup/restore
router.post("/restore", verifyToken, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Không có file được upload." });
  try {
    await restoreBackup(req.file.path);
    res.json({ success: true, message: "Restore database thành công." });
  } catch (err) {
    console.error("[Backup] Restore error:", err.message);
    res.status(500).json({ error: "Restore thất bại: " + err.message });
  } finally {
    fs.unlink(req.file.path, () => {});
  }
});

// DELETE /api/admin/backup/:filename
router.delete("/:filename", verifyToken, (req, res) => {
  const { filename } = req.params;
  if (!safeFilename(filename)) {
    return res.status(400).json({ error: "Tên file không hợp lệ." });
  }
  try {
    deleteBackup(filename);
    res.json({ success: true });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

module.exports = router;
