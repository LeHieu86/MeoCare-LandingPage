/**
 * Backfill 1 lần cho thú cưng MUA TỪ SHOP còn thiếu thông tin gốc:
 *   - cat_code (mã định danh = CatListing.code), cat_id (tham chiếu), birth_date (ngày sinh).
 * Dò mã đơn bán (BMEO-YYMMDD-NNN) trong Pet.note → CatSale → CatListing.
 * An toàn chạy lại nhiều lần (idempotent — chỉ điền field đang trống).
 *
 * Chạy: cd backend && node prisma/backfill-pet-birthdate.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Pet shop còn thiếu ÍT NHẤT một trong các field gốc
  const pets = await prisma.pet.findMany({
    where: {
      fromShop: true,
      OR: [{ cat_code: null }, { cat_id: null }, { birth_date: null }],
    },
  });

  let filled = 0, skipped = 0;
  for (const pet of pets) {
    const code = (pet.note || '').match(/BMEO-\d{6}-\d{3}/)?.[0];
    if (!code) { skipped++; continue; }

    const sale = await prisma.catSale.findUnique({
      where: { code },
      include: { cat: { select: { id: true, code: true, birth_date: true } } },
    });
    const cat = sale?.cat;
    if (!cat) { skipped++; continue; }

    const data = {};
    if (pet.cat_code == null) data.cat_code = cat.code;
    if (pet.cat_id == null) data.cat_id = cat.id;
    if (pet.birth_date == null && cat.birth_date) data.birth_date = cat.birth_date;
    // Dọn ghi chú hệ-thống cũ (chứa mã đơn) → note cá nhân thuần; KHÔNG đụng note khách tự sửa.
    if (/^Mua tại MeoCare · BMEO-\d{6}-\d{3}$/.test(pet.note || '')) {
      data.note = 'Bé cưng mua tại MeoCare 🐾';
    }
    if (Object.keys(data).length === 0) { skipped++; continue; }

    await prisma.pet.update({ where: { id: pet.id }, data });
    filled++;
    console.log(`✅ Pet #${pet.id} "${pet.name}" ← ${cat.code}` +
      (data.birth_date ? ` (sinh ${data.birth_date.toISOString().slice(0, 10)})` : ''));
  }

  console.log(`\nXong: cập nhật ${filled} pet, bỏ qua ${skipped}.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
