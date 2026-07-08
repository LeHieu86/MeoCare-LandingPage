/**
 * Backfill 1 lần: điền voucher_type + voucher_value cho các BOOKING cũ đã chọn ưu đãi
 * (có voucher_id) nhưng chưa có snapshot (tạo trước migration 20260701000002).
 * Nhờ đó ưu đãi tự trừ vào hóa đơn cho cả đơn cũ chưa hoàn tất.
 *
 * An toàn chạy lại nhiều lần (idempotent — chỉ điền đơn còn thiếu voucher_type).
 * Chỉ đụng đơn CHƯA hoàn tất (pending/active) để không sửa lịch sử đơn đã chốt.
 *
 * Chạy: cd backend && node prisma/backfill-booking-voucher.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const bookings = await prisma.booking.findMany({
    where: {
      voucher_id: { not: null },
      voucher_type: null,
      status: { in: ['pending', 'active'] },
    },
    select: { id: true, voucher_id: true },
  });

  let filled = 0, skipped = 0;
  for (const b of bookings) {
    const v = await prisma.benefitVoucher.findUnique({
      where: { id: b.voucher_id },
      select: { type: true, value: true },
    });
    if (!v) { skipped++; continue; }
    await prisma.booking.update({
      where: { id: b.id },
      data: { voucher_type: v.type, voucher_value: v.value },
    });
    filled++;
  }

  console.log(`✅ Backfill xong: điền ${filled} booking, bỏ qua ${skipped} (không tìm thấy voucher).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
