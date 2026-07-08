/**
 * prisma/wipe-data.js — XÓA SẠCH toàn bộ DỮ LIỆU, GIỮ NGUYÊN cấu trúc bảng (schema)
 * và lịch sử migration (_prisma_migrations). Dùng để "làm DB trắng" trước khi chạy thật.
 *
 * ⚠️  KHÔNG HOÀN TÁC. BẮT BUỘC backup trước (nút "Backup DB" hoặc pg_dump).
 *
 * Chạy:
 *   node prisma/wipe-data.js --yes         (native)
 *   docker compose exec backend node prisma/wipe-data.js --yes   (nếu chạy Docker)
 * Thiếu --yes → chỉ in cảnh báo, KHÔNG xóa gì.
 *
 * Sau khi xóa → chạy  node prisma/seed.js  để tạo lại Store id=1 + tài khoản admin/owner.
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function dbLabel() {
  try {
    const u = new URL(process.env.DATABASE_URL);
    return `${u.hostname}:${u.port || 5432}/${u.pathname.replace(/^\//, "")}`;
  } catch {
    return "(không đọc được DATABASE_URL)";
  }
}

// Xóa mọi bảng public trừ _prisma_migrations. TRUNCATE ... CASCADE tự lo thứ tự FK,
// RESTART IDENTITY reset các sequence → ID chạy lại từ 1.
async function wipePostgres() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`
  );
  const tables = rows.map((r) => `"${r.tablename}"`);
  if (tables.length === 0) {
    console.log("Không có bảng nào để xóa.");
    return;
  }
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tables.join(", ")} RESTART IDENTITY CASCADE`
  );
  console.log(`✅ Postgres: đã xóa sạch ${tables.length} bảng (reset ID về 1), GIỮ nguyên schema + migration.`);
}

// Xóa chat (MongoDB) — best-effort, thiếu MONGO_URI/mongoose thì bỏ qua.
async function wipeMongo() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.log("ℹ️  Không có MONGO_URI → bỏ qua chat (Mongo).");
    return;
  }
  let mongoose;
  try {
    mongoose = require("mongoose");
  } catch {
    console.warn("⚠️  Không require được mongoose → bỏ qua Mongo.");
    return;
  }
  try {
    await mongoose.connect(uri);
    await mongoose.connection.dropDatabase();
    console.log("✅ Mongo: đã xóa sạch DB chat.");
  } catch (e) {
    console.warn("⚠️  Xóa Mongo lỗi (bỏ qua):", e.message);
  } finally {
    try { await mongoose.disconnect(); } catch { /* ignore */ }
  }
}

async function main() {
  const confirmed = process.argv.includes("--yes");
  console.log("──────────────────────────────────────────────");
  console.log("  XÓA SẠCH DỮ LIỆU — DB:", dbLabel());
  console.log("──────────────────────────────────────────────");
  if (!confirmed) {
    console.log("⛔ Chưa xóa gì. Đây là thao tác KHÔNG HOÀN TÁC.");
    console.log("   Đã backup chưa? Nếu rồi, chạy lại kèm cờ:  node prisma/wipe-data.js --yes");
    return;
  }
  await wipePostgres();
  await wipeMongo();
  console.log("\n👉 Bước tiếp: chạy  node prisma/seed.js  để tạo lại Store id=1 + admin/owner.");
}

main()
  .catch((e) => { console.error("Lỗi:", e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
