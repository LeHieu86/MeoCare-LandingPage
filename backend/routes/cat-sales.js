/**
 * /api/cat-sales — Bán mèo tại quầy (POS) + Sổ doanh thu riêng (Phase 2)
 *
 * ADMIN/MANAGER (verifyToken → storeContext → requireBranch):
 *   POST   /              — ghi nhận bán 1 con (chốt mèo sold, snapshot giá vốn, tạo Pet fromShop)
 *   GET    /              — sổ doanh thu: lọc ngày + summary (doanh thu/giá vốn/lãi, TM/CK)
 *   GET    /:id           — chi tiết 1 giao dịch
 *   PUT    /:id/cancel    — hủy bán (trả mèo về "đang bán")
 *
 * KHÔNG sinh Order → doanh thu mèo tách biệt P&L sản phẩm ("sổ doanh thu riêng").
 * Danh tính khách theo buyer_phone (cầu nối ưu đãi Phase 3).
 */
const express = require("express");
const prisma = require("../lib/prisma");
const { verifyToken } = require("../middleware/auth");
const { storeContext } = require("../middleware/storeContext");
const { requireBranch } = require("../middleware/requireRole");
const { storeWhere } = require("../lib/storeFilter");
const idempotency = require("../middleware/idempotency");
const { getIO } = require("../socket");
const { notifyOwner } = require("../lib/notify");
const catPerks = require("../lib/catPerks");

const router = express.Router();

const toDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

// Tuổi (năm) từ birth_date — cho Pet.age (Int)
const ageYears = (birth) => {
  if (!birth) return 0;
  const b = new Date(birth);
  if (isNaN(b.getTime())) return 0;
  const now = new Date();
  let y = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) y -= 1;
  return y < 0 ? 0 : y;
};

// Sinh mã BMEO-YYMMDD-NNN
const genSaleCode = async () => {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const prefix = `BMEO-${yy}${mm}${dd}-`;
  const count = await prisma.catSale.count({ where: { code: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
};

// ── POST / — ghi nhận bán ─────────────────────────────────────────────────────
router.post("/", verifyToken, storeContext, requireBranch,
  idempotency({ scope: "POST /api/cat-sales" }), async (req, res) => {
  try {
    const b = req.body;
    const catId = parseInt(b.cat_id, 10);
    if (!catId) return res.status(400).json({ error: "Thiếu cat_id." });
    if (!b.buyer_phone || !String(b.buyer_phone).trim())
      return res.status(400).json({ error: "Thiếu số điện thoại khách." });

    const method = b.payment_method === "bank" ? "bank" : "cash";
    const warrantyDays = parseInt(b.warranty_days, 10) || 0;
    const warrantyUntil = warrantyDays > 0
      ? new Date(Date.now() + warrantyDays * 86400000)
      : null;

    const out = await prisma.$transaction(async (tx) => {
      // Mèo phải tồn tại, đúng store scope, và đang bán
      const cat = await tx.catListing.findFirst({ where: { id: catId, ...storeWhere(req) } });
      if (!cat) { const e = new Error("Không tìm thấy bé mèo."); e.statusCode = 404; throw e; }
      if (cat.status !== "available") {
        const e = new Error("Bé mèo này không còn ở trạng thái đang bán."); e.statusCode = 409; throw e;
      }

      const price = (b.price != null && b.price !== "") ? (parseInt(b.price, 10) || 0) : cat.price;
      const phone = String(b.buyer_phone).trim();
      const name  = (b.buyer_name || "").trim() || "Khách lẻ";

      // CRM: upsert Customer theo SĐT (giống đơn POS)
      const existingCus = await tx.customer.findFirst({ where: { phone } });
      if (existingCus) {
        await tx.customer.update({ where: { id: existingCus.id }, data: { name: name || existingCus.name } });
      } else {
        await tx.customer.create({ data: { name, phone, address: (b.buyer_address || "").trim() || null } });
      }

      const code = await genSaleCode();
      const sale = await tx.catSale.create({
        data: {
          code,
          cat_id: cat.id,
          store_id: cat.store_id,                 // bán tại chi nhánh đang giữ mèo
          sold_by: req.user?.id || null,
          buyer_name: name,
          buyer_phone: phone,
          buyer_address: (b.buyer_address || "").trim() || null,
          price,
          cost: cat.cost || 0,
          payment_method: method,
          payment_status: b.payment_status === "unpaid" ? "unpaid" : "paid",
          contract_signed: !!b.contract_signed,
          warranty_until: warrantyUntil,
          note: b.note ? String(b.note) : null,
        },
      });

      // Chốt mèo: sold (showcase tự ẩn vì query lọc status=available)
      await tx.catListing.update({ where: { id: cat.id }, data: { status: "sold", sold_at: new Date() } });

      return { sale, cat };
    });

    // ── Sau giao dịch (không chặn response) ──
    const { sale, cat } = out;

    // Tạo Pet(fromShop) cho tài khoản khách nếu SĐT khớp 1 User
    try {
      const user = await prisma.user.findFirst({
        where: { phone: sale.buyer_phone, role: { in: ["customer", "client"] } },
        select: { id: true },
      });
      if (user) {
        await prisma.pet.create({
          data: {
            userId: user.id,
            name: cat.name,
            gender: cat.gender === "female" ? "female" : "male",
            breed: cat.breed || "",
            age: ageYears(cat.birth_date),
            fromShop: true,
            avatar: cat.image || null,
            note: `Mua tại MeoCare · ${sale.code}`,
          },
        });
      }
    } catch (e) { console.warn("[cat-sales] tạo Pet fromShop lỗi:", e.message); }

    // Phát ví ưu đãi (membership + voucher) theo config — không chặn response
    try {
      await catPerks.issuePerksForSale(sale, cat);
    } catch (e) { console.warn("[cat-sales] phát ưu đãi lỗi:", e.message); }

    try {
      const io = getIO();
      if (io) {
        const payload = { saleId: sale.id, storeId: sale.store_id, catName: cat.name, price: sale.price };
        io.to("admin-room").emit("catSale:new", payload);
        io.to(`store-${sale.store_id}`).emit("catSale:new", payload);
      }
    } catch { /* socket không critical */ }

    notifyOwner(
      `🐾 BÁN MÈO (CN #${sale.store_id})\n` +
      `Bé: ${cat.name}${cat.breed ? ` (${cat.breed})` : ""}\n` +
      `Khách: ${sale.buyer_name} — ${sale.buyer_phone}\n` +
      `Giá: ${sale.price.toLocaleString("vi-VN")}đ · ${sale.payment_method === "bank" ? "Chuyển khoản" : "Tiền mặt"}\n` +
      `Mã: ${sale.code}`
    );

    res.status(201).json({ success: true, sale });
  } catch (err) {
    console.error("[POST /cat-sales]", err);
    res.status(err.statusCode || 500).json({ error: err.message || "Ghi nhận bán thất bại." });
  }
});

// ── GET / — sổ doanh thu + summary ────────────────────────────────────────────
router.get("/", verifyToken, storeContext, requireBranch, async (req, res) => {
  try {
    const where = { ...storeWhere(req) };
    const from = toDate(req.query.from);
    const to = toDate(req.query.to);
    if (from || to) {
      where.sold_at = {};
      if (from) where.sold_at.gte = from;
      if (to) { const end = new Date(to); end.setHours(23, 59, 59, 999); where.sold_at.lte = end; }
    }
    if (req.query.status && ["completed", "cancelled"].includes(req.query.status)) {
      where.status = req.query.status;
    }

    const sales = await prisma.catSale.findMany({
      where,
      include: {
        cat: { select: { id: true, name: true, breed: true, image: true, code: true } },
        store: { select: { id: true, name: true } },
      },
      orderBy: { sold_at: "desc" },
    });

    // Summary chỉ tính giao dịch completed
    const done = sales.filter((s) => s.status === "completed");
    const revenue = done.reduce((s, x) => s + x.price, 0);
    const cost = done.reduce((s, x) => s + x.cost, 0);
    const cashRevenue = done.filter((s) => s.payment_method === "cash").reduce((s, x) => s + x.price, 0);
    const bankRevenue = done.filter((s) => s.payment_method === "bank").reduce((s, x) => s + x.price, 0);

    res.json({
      success: true,
      sales,
      summary: {
        count: done.length,
        revenue,
        cost,
        profit: revenue - cost,
        cashRevenue,
        bankRevenue,
        cancelledCount: sales.length - done.length,
      },
    });
  } catch (err) {
    console.error("[GET /cat-sales]", err);
    res.status(500).json({ error: "Không tải được sổ bán mèo." });
  }
});

// ── GET /:id — chi tiết ───────────────────────────────────────────────────────
router.get("/:id", verifyToken, storeContext, requireBranch, async (req, res) => {
  try {
    const sale = await prisma.catSale.findFirst({
      where: { id: parseInt(req.params.id, 10), ...storeWhere(req) },
      include: {
        cat: { include: { healthRecords: { orderBy: { date: "desc" } } } },
        store: { select: { id: true, name: true, address: true, phone: true } },
      },
    });
    if (!sale) return res.status(404).json({ error: "Không tìm thấy giao dịch." });
    res.json({ success: true, sale });
  } catch (err) {
    console.error("[GET /cat-sales/:id]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ── PUT /:id/cancel — hủy bán (trả mèo về đang bán) ───────────────────────────
router.put("/:id/cancel", verifyToken, storeContext, requireBranch, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const sale = await prisma.catSale.findFirst({ where: { id, ...storeWhere(req) } });
    if (!sale) return res.status(404).json({ error: "Không tìm thấy giao dịch." });
    if (sale.status === "cancelled") return res.status(409).json({ error: "Giao dịch đã hủy trước đó." });

    await prisma.$transaction(async (tx) => {
      await tx.catSale.update({
        where: { id },
        data: { status: "cancelled", cancelled_at: new Date(), cancel_reason: (req.body.reason || "").trim() || null },
      });
      // Trả mèo về đang bán
      await tx.catListing.update({ where: { id: sale.cat_id }, data: { status: "available", sold_at: null } });
    });

    try {
      const io = getIO();
      if (io) io.to(`store-${sale.store_id}`).emit("catSale:cancelled", { saleId: id, storeId: sale.store_id });
    } catch { /* không critical */ }

    res.json({ success: true });
  } catch (err) {
    console.error("[PUT /cat-sales/:id/cancel]", err);
    res.status(500).json({ error: "Không thể hủy giao dịch." });
  }
});

module.exports = router;
