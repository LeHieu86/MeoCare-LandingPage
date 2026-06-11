const router = require("express").Router();
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const multer = require("multer");
const prisma = require("../lib/prisma");
const { verifyToken } = require("../middleware/auth");
const {
  createBackup,
  restoreBackup,
  listBackups,
  deleteBackup,
  getBackupDir,
  setBackupDir,
} = require("../utils/backup");

// CHỈ admin — backup/restore + chọn ổ = truy cập TOÀN BỘ dữ liệu (owner/quản lý cũng KHÔNG được).
const requireAdmin = (req, res, next) =>
  req.user?.role === "admin"
    ? next()
    : res.status(403).json({ error: "Chỉ admin mới được thao tác sao lưu." });

// df cho 1 đường dẫn → dung lượng (GB)
function dfInfo(p) {
  try {
    const cols = execSync(`df -Pk "${p}"`, { timeout: 3000, encoding: "utf8" })
      .trim().split("\n").pop().trim().split(/\s+/);
    const gb = (kb) => +(parseInt(kb) / 1024 / 1024).toFixed(1);
    return { total_gb: gb(cols[1]), used_gb: gb(cols[2]), free_gb: gb(cols[3]), percent_used: parseInt(cols[4]) || 0 };
  } catch { return { total_gb: 0, used_gb: 0, free_gb: 0, percent_used: 0 }; }
}

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
router.post("/create", verifyToken, requireAdmin, async (req, res) => {
  try {
    const result = await createBackup();
    // Trả JSON cho app desktop (web cũ đã bỏ). File backup đã lưu trên server + đẩy R2.
    res.json({
      success: true,
      filename: result.filename,
      size: result.size,
      createdAt: result.createdAt,
      r2: result.r2,
    });
  } catch (err) {
    console.error("[Backup] Create error:", err.message);
    res.status(500).json({ error: "Tạo backup thất bại: " + err.message });
  }
});

// GET /api/admin/backup/list
router.get("/list", verifyToken, requireAdmin, (_req, res) => {
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
router.get("/download/:filename", verifyToken, requireAdmin, (req, res) => {
  const { filename } = req.params;
  if (!safeFilename(filename)) {
    return res.status(400).json({ error: "Tên file không hợp lệ." });
  }
  const filePath = path.join(getBackupDir(), filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File không tồn tại." });
  }
  res.download(filePath, filename);
});

// POST /api/admin/backup/restore
router.post("/restore", verifyToken, requireAdmin, upload.single("file"), async (req, res) => {
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

// POST /api/admin/backup/restore/:filename
// Restore từ backup ĐÃ CÓ SẴN trên server (dùng cho app desktop — không cần upload file).
router.post("/restore/:filename", verifyToken, requireAdmin, async (req, res) => {
  const { filename } = req.params;
  if (!safeFilename(filename)) {
    return res.status(400).json({ error: "Tên file không hợp lệ." });
  }
  const filePath = path.join(getBackupDir(), filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File không tồn tại." });
  }
  try {
    await restoreBackup(filePath);
    res.json({ success: true, message: "Restore database thành công." });
  } catch (err) {
    console.error("[Backup] Restore-by-name error:", err.message);
    res.status(500).json({ error: "Restore thất bại: " + err.message });
  }
});

// GET /api/admin/backup/disks — liệt kê ổ đã mount (dưới /mnt) + thư mục mặc định, kèm dung lượng
router.get("/disks", verifyToken, requireAdmin, (_req, res) => {
  const candidates = ["/app/backups"];   // mặc định trong container
  try {
    for (const e of fs.readdirSync("/mnt", { withFileTypes: true })) {
      if (e.isDirectory()) candidates.push(path.join("/mnt", e.name, "backups"));
    }
  } catch { /* /mnt trống/không có */ }
  const disks = candidates.map((p) => {
    const probe = fs.existsSync(p) ? p : path.dirname(p);   // df theo ổ (thư mục backups có thể chưa tạo)
    return { path: p, ...dfInfo(probe) };
  });
  res.json({ success: true, current: getBackupDir(), disks });
});

// GET /api/admin/backup/config — ổ đang chọn
router.get("/config", verifyToken, requireAdmin, (_req, res) => {
  res.json({ success: true, backup_dir: getBackupDir() });
});

// POST /api/admin/backup/config { backup_dir } — admin chọn ổ lưu backup (kiểm tra tạo/ghi được)
router.post("/config", verifyToken, requireAdmin, async (req, res) => {
  const dir = (req.body?.backup_dir || "").trim();
  if (!dir || !dir.startsWith("/")) {
    return res.status(400).json({ error: "Đường dẫn không hợp lệ." });
  }
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
  } catch (e) {
    return res.status(400).json({ error: "Không tạo/ghi được vào thư mục này: " + e.message });
  }
  await prisma.appSetting.upsert({
    where: { key: "backup_dir" },
    update: { value: dir },
    create: { key: "backup_dir", value: dir },
  });
  setBackupDir(dir);
  res.json({ success: true, backup_dir: dir });
});

// DELETE /api/admin/backup/:filename
router.delete("/:filename", verifyToken, requireAdmin, (req, res) => {
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
