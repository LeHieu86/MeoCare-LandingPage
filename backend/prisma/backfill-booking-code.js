/**
 * Backfill 1 lần: cấp MÃ (code) cho các booking CŨ chưa có (tạo trước migration
 * 20260701000003). Mã ngẫu nhiên DV-YYMMDD-NNNNNN theo NGÀY TẠO của đơn (created_at).
 *
 * An toàn chạy lại nhiều lần (idempotent — chỉ cấp cho đơn còn code = null).
 * Chạy trong container (nơi DATABASE_URL trỏ postgres-core):
 *   cd backend && node prisma/backfill-booking-code.js
 */
const { PrismaClient } = require('@prisma/client');
const { makeCode } = require('../lib/codes');
const prisma = new PrismaClient();

async function main() {
  const bookings = await prisma.booking.findMany({
    where: { code: null },
    select: { id: true, created_at: true },
    orderBy: { id: 'asc' },
  });

  let filled = 0;
  for (const b of bookings) {
    // Sinh mã theo ngày tạo; trùng thì thử lại (rất hiếm khi chạm)
    for (let t = 0; t < 8; t++) {
      const code = makeCode('service', b.created_at || new Date());
      try {
        await prisma.booking.update({ where: { id: b.id }, data: { code } });
        filled++;
        break;
      } catch (e) {
        if (e?.code === 'P2002' && (e?.meta?.target || []).includes('code')) continue;
        throw e;
      }
    }
  }
  console.log(`✅ Backfill: đã cấp mã cho ${filled} booking cũ.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
