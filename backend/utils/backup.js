const { exec } = require("child_process");
const { promisify } = require("util");
const fs = require("fs");
const path = require("path");

const execAsync = promisify(exec);

const BACKUP_DIR = process.env.BACKUP_DIR || "/app/backups";

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
  return { filename, path: filePath, size: stat.size, createdAt: stat.mtime };
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
  for (const name of fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith(".sql.gz"))) {
    const filePath = path.join(BACKUP_DIR, name);
    if (fs.statSync(filePath).mtime.getTime() < cutoff) {
      fs.unlinkSync(filePath);
      deleted++;
    }
  }
  return deleted;
}

module.exports = { createBackup, restoreBackup, listBackups, deleteBackup, cleanOldBackups, BACKUP_DIR };
