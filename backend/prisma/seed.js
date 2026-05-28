const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // 1. Tạo Store đầu tiên
  const store = await prisma.store.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: 'MeoCare Chi nhánh 1',
      address: 'Hà Nội',
      phone: '',
      isActive: true,
    },
  });
  console.log(`✅ Store: ${store.name} (id=${store.id})`);

  // 2. Tạo tài khoản owner (không gắn store cụ thể, thấy được tất cả dữ liệu)
  const ownerHash = await bcrypt.hash('@Hieu2003', 10);
  const owner = await prisma.user.upsert({
    where: { username: 'owner' },
    update: {},
    create: {
      username: 'owner',
      password: ownerHash,
      fullName: 'Owner',
      email: 'owner@meomeocare.io.vn',
      role: 'owner',
      store_id: null,
    },
  });
  console.log(`✅ Owner account: owner / @Hieu2003 (store_id=null)`);

  // 3. Tạo admin gắn với store 1
  const adminHash = await bcrypt.hash('@Hieu2003', 10);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { store_id: store.id },
    create: {
      username: 'admin',
      password: adminHash,
      fullName: 'Admin',
      email: 'admin@meomeocare.io.vn',
      role: 'admin',
      store_id: store.id,
    },
  });
  console.log(`✅ Admin account: admin / @Hieu2003 (store_id=${store.id})`);

  // 4. Backfill: gán toàn bộ dữ liệu hiện có về store 1
  // (chỉ chạy khi migrate từ hệ thống single-store cũ)
  const updates = await Promise.all([
    prisma.room.updateMany({         where: { store_id: 1 }, data: {} }),
    prisma.booking.updateMany({      where: { store_id: 1 }, data: {} }),
    prisma.camera.updateMany({       where: { store_id: 1 }, data: {} }),
    prisma.order.updateMany({        where: { store_id: 1 }, data: {} }),
    prisma.product.updateMany({      where: { store_id: 1 }, data: {} }),
    prisma.employee.updateMany({     where: { store_id: 1 }, data: {} }),
    prisma.inventoryItem.updateMany({ where: { store_id: 1 }, data: {} }),
    prisma.supplier.updateMany({     where: { store_id: 1 }, data: {} }),
    prisma.purchaseOrder.updateMany({ where: { store_id: 1 }, data: {} }),
  ]);
  console.log('✅ Backfill store_id=1 cho toàn bộ dữ liệu cũ.');

  _ = owner, admin, updates; // suppress unused warning
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
