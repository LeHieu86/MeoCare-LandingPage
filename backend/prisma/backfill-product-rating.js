/**
 * backfill-product-rating.js — Nạp sẵn rating_avg + review_count cho các sản phẩm ĐÃ có review.
 * Chạy 1 lần sau khi apply migration 20260714000001_product_rating_cache.
 *
 *   node prisma/backfill-product-rating.js
 *
 * Sản phẩm không có review → giữ mặc định 0 (đã set bởi DEFAULT của cột).
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const groups = await prisma.review.groupBy({
    by: ["productId"],
    _avg: { rating: true },
    _count: true,
  });

  let n = 0;
  for (const g of groups) {
    await prisma.product.update({
      where: { id: g.productId },
      data: {
        review_count: g._count,
        rating_avg: Math.round((g._avg.rating || 0) * 10) / 10,
      },
    });
    n++;
  }
  console.log(`✅ Backfill rating cache cho ${n} sản phẩm có review.`);
}

main()
  .catch((e) => { console.error("❌ Backfill lỗi:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
