const { exec } = require("child_process");
const { promisify } = require("util");
const fs = require("fs");
const path = require("path");
const {
  S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand,
} = require("@aws-sdk/client-s3");

const execAsync = promisify(exec);

const BACKUP_DIR = process.env.BACKUP_DIR || "/app/backups";
const R2_BACKUP_PREFIX = process.env.R2_BACKUP_PREFIX || "backups/";

// ── R2 offsite (tái dùng cấu hình R2_* như upload ảnh) ────────────────────────
// Nếu thiếu cấu hình R2 → bỏ qua offsite (chỉ giữ bản local), KHÔNG làm hỏng backup.
function r2Client() {
  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID ||
      !process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_BUCKET_NAME) {
    return null;
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

async function uploadToR2(filePath, filename) {
  const client = r2Client();
  if (!client) {
    console.warn("[Backup] ⚠ R2 chưa cấu hình → backup chỉ nằm LOCAL (rủi ro mất khi hỏng ổ đĩa).");
    return false;
  }
  const Body = fs.readFileSync(filePath); // backup nhỏ với quy mô startup → đọc buffer là đủ
  await client.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: `${R2_BACKUP_PREFIX}${filename}`,
    Body,
    ContentType: "application/gzip",
  }));
  return true;
}

// Dump MongoDB (chat) — chỉ chạy nếu image có sẵn `mongodump`. Thiếu thì bỏ qua (log).
async function dumpMongo(ts) {
  const uri = process.env.MONGO_URI;
  if (!uri) return null;
  try {
    await execAsync("command -v mongodump", { shell: "/bin/sh" });
  } catch {
    console.warn("[Backup] ⚠ mongodump không có trong image → BỎ QUA backup chat. " +
      "Thêm mongodb-database-tools vào Dockerfile.backend nếu muốn backup Mongo.");
    return null;
  }
  const filename = `mongo-${ts}.archive.gz`;
  const filePath = path.join(BACKUP_DIR, filename);
  await execAsync(`mongodump --uri="${uri}" --archive="${filePath}" --gzip`, { shell: "/bin/sh" });
  const stat = fs.statSync(filePath);
  return { filename, path: filePath, size: stat.size };
}

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function parseDbUrl(url) {
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: u.port || "5432",
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, ""),
    };
  } catch {
    return null;
  }
}

function getDbConfig() {
  const parsed = parseDbUrl(process.env.DATABASE_URL || "");
  if (parsed && parsed.host) return parsed;
  return {
    host: process.env.DB_HOST || "postgres-core",
    port: process.env.DB_PORT || "5432",
    user: process.env.POSTGRES_USER || process.env.DB_USER || "postgres",
    password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || "",
    database: process.env.POSTGRES_DB || process.env.DB_NAME || "meocare",
  };
}

async function createBackup() {
  ensureBackupDir();
  const db = getDbConfig();

  const ts = new Date()
    .toISOString()
    .replace(/T/, "-")
    .replace(/:/g, "-")
    .slice(0, 19);
  const filename = `backup-${ts}.sql.gz`;
  const filePath = path.join(BACKUP_DIR, filename);

  const env = { ...process.env, PGPASSWORD: db.password };
  const cmd = `pg_dump -h ${db.host} -p ${db.port} -U ${db.user} -d ${db.database} --no-owner --no-acl | gzip > "${filePath}"`;

  await execAsync(cmd, { env, shell: "/bin/sh" });
  const stat = fs.statSync(filePath);

  // Đẩy bản Postgres lên R2 (offsite) — quan trọng nhất
  let r2Postgres = false;
  try { r2Postgres = await uploadToR2(filePath, filename); }
  catch (e) { console.error("[Backup] Upload Postgres lên R2 lỗi:", e.message); }

  // Backup Mongo (chat) nếu image có mongodump → cũng đẩy lên R2
  let mongo = null;
  try {
    const m = await dumpMongo(ts);
    if (m) {
      let r2Mongo = false;
      try { r2Mongo = await uploadToR2(m.path, m.filename); }
      catch (e) { console.error("[Backup] Upload Mongo lên R2 lỗi:", e.message); }
      mongo = { filename: m.filename, size: m.size, r2: r2Mongo };
    }
  } catch (e) { console.error("[Backup] Dump Mongo lỗi:", e.message); }

  return {
    filename, path: filePath, size: stat.size, createdAt: stat.mtime,
    r2: r2Postgres, mongo,
  };
}

async function restoreBackup(filePath) {
  const db = getDbConfig();
  const env = { ...process.env, PGPASSWORD: db.password };
  const cmd = `gunzip -c "${filePath}" | psql -h ${db.host} -p ${db.port} -U ${db.user} -d ${db.database}`;
  await execAsync(cmd, { env, shell: "/bin/sh" });
}

function listBackups() {
  ensureBackupDir();
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith(".sql.gz"))
    .map((name) => {
      const stat = fs.statSync(path.join(BACKUP_DIR, name));
      return { name, size: stat.size, createdAt: stat.mtime };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function deleteBackup(filename) {
  const filePath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(filePath)) throw new Error("File không tồn tại");
  fs.unlinkSync(filePath);
}

function cleanOldBackups(days = 30) {
  ensureBackupDir();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  let deleted = 0;
  const isBackup = (f) => f.endsWith(".sql.gz") || f.endsWith(".archive.gz");
  for (const name of fs.readdirSync(BACKUP_DIR).filter(isBackup)) {
    const filePath = path.join(BACKUP_DIR, name);
    if (fs.statSync(filePath).mtime.getTime() < cutoff) {
      fs.unlinkSync(filePath);
      deleted++;
    }
  }
  // Dọn bản cũ trên R2 (không chặn luồng nếu lỗi)
  pruneR2Backups(days).catch((e) => console.error("[Backup] Prune R2 lỗi:", e.message));
  return deleted;
}

// Xoá các object backup trên R2 cũ hơn `days` ngày
async function pruneR2Backups(days = 30) {
  const client = r2Client();
  if (!client) return;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const list = await client.send(new ListObjectsV2Command({
    Bucket: process.env.R2_BUCKET_NAME,
    Prefix: R2_BACKUP_PREFIX,
  }));
  const old = (list.Contents || []).filter((o) => o.LastModified && o.LastModified.getTime() < cutoff);
  if (old.length === 0) return;
  await client.send(new DeleteObjectsCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Delete: { Objects: old.map((o) => ({ Key: o.Key })) },
  }));
  console.log(`[Backup] R2: đã xoá ${old.length} bản backup cũ.`);
}

module.exports = {
  createBackup, restoreBackup, listBackups, deleteBackup, cleanOldBackups,
  uploadToR2, pruneR2Backups, BACKUP_DIR,
};
