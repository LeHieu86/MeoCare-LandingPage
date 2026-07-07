const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const prisma = new PrismaClient();

/**
 * Tạo tài khoản hệ thống AN TOÀN:
 * - Mật khẩu lấy từ env (SEED_*_PASSWORD). Nếu thiếu → sinh NGẪU NHIÊN và in ra log 1 lần
 *   (để đăng nhập lần đầu rồi đổi). KHÔNG hardcode mật khẩu trong mã nguồn.
 * - Nếu user đã tồn tại → GIỮ NGUYÊN mật khẩu (không bao giờ reset khi re-seed),
 *   chỉ cập nhật store_id nếu cần.
 */
async function ensureUser({ username, role, storeId, fullName, email, envKey }) {
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    if (storeId !== undefined && existing.store_id !== storeId) {
      await prisma.user.update({ where: { username }, data: { store_id: storeId } });
    }
    console.log(`ℹ️  Tài khoản "${username}" đã tồn tại — giữ nguyên mật khẩu.`);
    return;
  }

  const envPass = process.env[envKey];
  const password = envPass || crypto.randomBytes(9).toString('base64url'); // ~12 ký tự
  await prisma.user.create({
    data: {
      username,
      password: await bcrypt.hash(password, 10),
      fullName,
      email,
      role,
      store_id: storeId ?? null,
    },
  });

  if (envPass) {
    console.log(`✅ Tạo "${username}" (mật khẩu từ ${envKey}).`);
  } else {
    console.warn(
      `⚠️  Tạo "${username}" với MẬT KHẨU NGẪU NHIÊN: ${password}\n` +
      `    → Đăng nhập rồi ĐỔI ngay, hoặc đặt ${envKey} trong .env trước khi seed ở production.`
    );
  }
}

async function main() {
  // 1. Store đầu tiên
  const store = await prisma.store.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, name: 'MeoCare Chi nhánh 1', address: 'Hà Nội', phone: '', isActive: true },
  });
  console.log(`✅ Store: ${store.name} (id=${store.id})`);

  // 2. Owner (không gắn store — thấy toàn hệ thống)
  await ensureUser({
    username: 'owner', role: 'owner', storeId: null,
    fullName: 'Owner', email: 'owner@meomeocare.io.vn', envKey: 'SEED_OWNER_PASSWORD',
  });

  // 3. Admin (gắn store 1) — username 'administrator', mật khẩu lấy từ SEED_ADMIN_PASSWORD.
  await ensureUser({
    username: 'administrator', role: 'admin', storeId: store.id,
    fullName: 'Administrator', email: 'admin@meomeocare.io.vn', envKey: 'SEED_ADMIN_PASSWORD',
  });

  // 4. Backfill: gán dữ liệu cũ về store 1 (chỉ có tác dụng khi migrate từ hệ single-store)
  await Promise.all([
    prisma.room.updateMany({          where: { store_id: 1 }, data: {} }),
    prisma.booking.updateMany({       where: { store_id: 1 }, data: {} }),
    prisma.camera.updateMany({        where: { store_id: 1 }, data: {} }),
    prisma.order.updateMany({         where: { store_id: 1 }, data: {} }),
    prisma.product.updateMany({       where: { store_id: 1 }, data: {} }),
    prisma.employee.updateMany({      where: { store_id: 1 }, data: {} }),
    prisma.inventoryItem.updateMany({ where: { store_id: 1 }, data: {} }),
    prisma.supplier.updateMany({      where: { store_id: 1 }, data: {} }),
    prisma.purchaseOrder.updateMany({ where: { store_id: 1 }, data: {} }),
  ]);
  console.log('✅ Backfill store_id=1 cho dữ liệu cũ.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
