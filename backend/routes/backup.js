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

// Thư mục backup mặc định (bind-mount ./backups của container). Luôn là 1 lựa chọn.
const DEFAULT_BACKUP_DIR = "/app/backups";

// Filesystem ẢO/hệ thống — KHÔNG phải ổ chứa dữ liệu, bỏ khi tự quét.
const PSEUDO_FS = new Set([
  "overlay", "tmpfs", "devtmpfs", "proc", "sysfs", "cgroup", "cgroup2", "mqueue",
  "devpts", "ramfs", "nsfs", "tracefs", "debugfs", "securityfs", "fusectl",
  "configfs", "bpf", "pstore", "binfmt_misc", "autofs", "efivarfs", "hugetlbfs",
  "sunrpc", "rpc_pipefs", "fuse.lxcfs", "fuse.gvfsd-fuse", "squashfs", "none",
]);

// /proc/mounts escape khoảng trắng/tab/backslash bằng mã octal (\040 \011 \134...).
const unescapeMount = (s) => s.replace(/\\(\d{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)));

// p có phải ĐIỂM MOUNT thật không: khác thiết bị (dev) với thư mục cha → là fs riêng
// (ổ đĩa được mount), không phải thư mục rỗng thường (vd /media/cdrom Alpine tạo sẵn).
function isMountpoint(p) {
  try {
    return fs.statSync(p).dev !== fs.statSync(path.dirname(p)).dev;
  } catch { return false; }
}

// Điểm mount hệ thống/nội bộ container — KHÔNG cho lưu backup vào.
function isSystemMount(mp) {
  if (mp === "/") return true;
  for (const p of ["/proc", "/sys", "/dev", "/etc", "/boot", "/snap", "/var/lib", "/run/lock"]) {
    if (mp === p || mp.startsWith(p + "/")) return true;
  }
  // /run/* là hệ thống, TRỪ /run/media (Linux desktop tự mount USB/HDD ở đây).
  if (mp.startsWith("/run/") && !mp.startsWith("/run/media/")) return true;
  // Nội bộ app (code/config) — bỏ, TRỪ thư mục backup mặc định.
  if (mp.startsWith("/app/") && mp !== DEFAULT_BACKUP_DIR) return true;
  return false;
}

// Tự nhận các ổ THẬT đang mount trong tầm nhìn của tiến trình (nguồn: kernel /proc/mounts).
// Không hardcode /mnt → đổi máy chủ, ổ mount ở đâu (/mnt, /media, /srv...) cũng nhận ra,
// miễn là ổ đó được mount vào container (xem ghi chú compose ở /disks).
function detectMountpoints() {
  const found = new Set();
  // 1) Ổ là mount riêng trong namespace container.
  try {
    for (const line of fs.readFileSync("/proc/mounts", "utf8").split("\n")) {
      const parts = line.split(" ");
      if (parts.length < 3) continue;
      const mp = unescapeMount(parts[1]);
      if (PSEUDO_FS.has(parts[2]) || isSystemMount(mp)) continue;
      found.add(mp);
    }
  } catch { /* không đọc được /proc/mounts — bỏ qua */ }
  // 2) Ổ là THƯ MỤC CON của một gốc mount hay dùng. Chỉ nhận thư mục con THỰC SỰ là
  //    điểm mount (ổ đĩa riêng) — bỏ thư mục rỗng placeholder (vd /media/cdrom).
  for (const root of ["/mnt", "/media", "/run/media", "/srv"]) {
    try {
      for (const e of fs.readdirSync(root, { withFileTypes: true })) {
        const sub = path.join(root, e.name);
        if (e.isDirectory() && isMountpoint(sub)) found.add(sub);
      }
    } catch { /* gốc không tồn tại — bỏ qua */ }
  }
  return found;
}

// Dựng danh sách ổ backup: ổ mặc định + ổ tự nhận (không hardcode /mnt) + ổ đang chọn,
// kèm dung lượng và cờ ghi được. Tách khỏi handler để test được.
function buildDiskList() {
  const current = getBackupDir();
  const disks = [];
  const seen = new Set();

  const consider = (backupPath) => {
    if (!backupPath || seen.has(backupPath)) return;
    seen.add(backupPath);
    // df + kiểm tra ghi được theo ổ (thư mục "backups" có thể chưa tạo → probe thư mục cha).
    const probe = fs.existsSync(backupPath) ? backupPath : path.dirname(backupPath);
    let writable = false;
    try { fs.accessSync(probe, fs.constants.W_OK); writable = true; } catch { /* chỉ đọc */ }
    // Chỉ hiện ổ ghi được, HOẶC ổ mặc định/đang chọn (để dropdown luôn khớp value).
    if (writable || backupPath === DEFAULT_BACKUP_DIR || backupPath === current) {
      disks.push({ path: backupPath, writable, ...dfInfo(probe) });
    }
  };

  consider(DEFAULT_BACKUP_DIR);
  for (const mp of detectMountpoints()) {
    // Ổ mặc định (đã có) thì dùng thẳng; ổ khác → gợi ý thư mục con "backups" cho gọn
    // (không đổ backup thẳng ra gốc ổ, và tránh tạo "/app/backups/backups").
    consider(mp === DEFAULT_BACKUP_DIR ? DEFAULT_BACKUP_DIR : path.join(mp, "backups"));
  }
  consider(current); // luôn kèm ổ đang chọn (kể cả admin tự nhập đường dẫn ngoài)

  // Ghi được lên trước, rồi ổ trống nhiều hơn lên trước.
  disks.sort((a, b) => (b.writable - a.writable) || (b.free_gb - a.free_gb));
  return { current, disks };
}

// GET /api/admin/backup/disks — TỰ QUÉT ổ đang mount (không hardcode /mnt) + ổ mặc định
// + ổ đang chọn, kèm dung lượng và cờ ghi được.
// Lưu ý hạ tầng: backend chạy trong Docker → chỉ thấy ổ nào được BIND-MOUNT vào container.
// Muốn ổ host mới hiện ra, mount nó vào compose (vd `/mnt:/mnt`) — cấu hình 1 lần, không sửa code.
router.get("/disks", verifyToken, requireAdmin, (_req, res) => {
  res.json({ success: true, ...buildDiskList() });
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
// Xuất thêm để test (không dùng trong luồng app).
module.exports.__test = { detectMountpoints, isSystemMount, buildDiskList };
