/**
 * /api/cats — Catalog bán mèo (Phase 1: trưng bày + quản lý)
 *
 * PUBLIC (không cần đăng nhập — trang showcase cho khách):
 *   GET  /                 — danh sách mèo đang bán (published + available), lọc ?store_id&gender&breed
 *   GET  /:id              — chi tiết 1 con + hồ sơ sức khỏe (ẩn giá vốn/nguồn nhập)
 *
 * ADMIN/MANAGER (verifyToken → storeContext → requireBranch):
 *   GET    /manage/list    — danh sách đầy đủ (mọi trạng thái, kèm giá vốn), lọc theo store
 *   POST   /               — thêm mèo (tự sinh mã MEO-YYMMDD-NNN)
 *   PUT    /:id            — sửa
 *   DELETE /:id            — xóa (cascade hồ sơ sức khỏe)
 *   POST   /:id/health     — thêm 1 hồ sơ sức khỏe
 *   DELETE /:id/health/:hid— xóa 1 hồ sơ sức khỏe
 *
 * Mèo là CÁ THỂ DUY NHẤT → không đụng InventoryItem/Product. "Lai catalog chung":
 * quản lý tập trung, mỗi con gắn 1 chi nhánh (store_id) đang giữ. Bán tại quầy (Phase 2).
 */
const express = require("express");
const prisma = require("../lib/prisma");
const { verifyToken } = require("../middleware/auth");
const { storeContext } = require("../middleware/storeContext");
const { requireBranch } = require("../middleware/requireRole");
const { storeWhere, injectStoreId } = require("../lib/storeFilter");

const router = express.Router();

const MAX_IMAGES = 9;

// Lọc URL hợp lệ, bỏ trùng, giới hạn 9 ảnh (giống products)
const sanitizeImages = (arr) =>
  Array.isArray(arr)
    ? [...new Set(arr.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim()))].slice(0, MAX_IMAGES)
    : [];

// Parse ngày an toàn → Date | null (chấp nhận "" / null / ISO)
const toDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

const STORE_PUBLIC = { select: { id: true, name: true, address: true, phone: true, latitude: true, longitude: true } };

// Bóc trường công khai (KHÔNG lộ cost/source ra web khách)
const toPublic = (c) => ({
  id: c.id,
  code: c.code,
  store_id: c.store_id,
  store: c.store || null,
  name: c.name,
  breed: c.breed,
  color: c.color,
  gender: c.gender,
  birth_date: c.birth_date,
  weight: c.weight,
  price: c.price,
  description: c.description,
  image: (c.images && c.images.length) ? c.images[0] : (c.image || ""),
  images: (c.images && c.images.length) ? c.images : (c.image ? [c.image] : []),
  vaccinated: c.vaccinated,
  dewormed: c.dewormed,
  status: c.status,
  healthRecords: (c.healthRecords || []).map((h) => ({
    id: h.id, type: h.type, name: h.name, date: h.date, vet: h.vet, next_due: h.next_due, note: h.note,
  })),
});

// Sinh mã MEO-YYMMDD-NNN (NNN = số mèo tạo trong ngày + 1)
const genCode = async () => {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const prefix = `MEO-${yy}${mm}${dd}-`;
  const count = await prisma.catListing.count({ where: { code: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
};

// ── PUBLIC ──────────────────────────────────────────────────────────────────

// GET /api/cats — showcase: chỉ mèo đang bán & cho hiện
router.get("/", async (req, res) => {
  try {
    const where = { published: true, status: "available" };
    if (req.query.store_id) where.store_id = parseInt(req.query.store_id, 10);
    if (req.query.gender) where.gender = req.query.gender;
    if (req.query.breed) where.breed = { contains: req.query.breed, mode: "insensitive" };

    const cats = await prisma.catListing.findMany({
      where,
      include: { store: STORE_PUBLIC, healthRecords: { orderBy: { date: "desc" } } },
      orderBy: { created_at: "desc" },
    });
    res.json({ success: true, cats: cats.map(toPublic) });
  } catch (err) {
    console.error("GET /cats:", err);
    res.status(500).json({ error: "Không tải được danh sách mèo." });
  }
});

// GET /api/cats/:id — chi tiết public
router.get("/:id(\\d+)", async (req, res) => {
  try {
    const cat = await prisma.catListing.findFirst({
      where: { id: parseInt(req.params.id, 10), published: true },
      include: { store: STORE_PUBLIC, healthRecords: { orderBy: { date: "desc" } } },
    });
    if (!cat) return res.status(404).json({ error: "Không tìm thấy bé mèo này." });
    res.json({ success: true, cat: toPublic(cat) });
  } catch (err) {
    console.error("GET /cats/:id:", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ── ADMIN / MANAGER ─────────────────────────────────────────────────────────

// GET /api/cats/manage/list — danh sách đầy đủ cho app quản lý (kèm giá vốn)
router.get("/manage/list", verifyToken, storeContext, requireBranch, async (req, res) => {
  try {
    // Tự sửa lệch: bé có giao dịch bán "completed" nhưng status chưa "sold"
    // (vd bị chỉnh tay nhầm trước đây) → đồng bộ về "sold" để khớp Sổ bán mèo + ẩn khỏi web.
    const mismatched = await prisma.catListing.findMany({
      where: { ...storeWhere(req), status: { not: "sold" }, sale: { status: "completed" } },
      select: { id: true },
    });
    if (mismatched.length) {
      await prisma.catListing.updateMany({
        where: { id: { in: mismatched.map((c) => c.id) } },
        data: { status: "sold" },
      });
    }

    const where = { ...storeWhere(req) };
    if (req.query.status) where.status = req.query.status;
    const cats = await prisma.catListing.findMany({
      where,
      include: { store: { select: { id: true, name: true } }, healthRecords: { orderBy: { date: "desc" } } },
      orderBy: { created_at: "desc" },
    });
    res.json({ success: true, cats });
  } catch (err) {
    console.error("GET /cats/manage/list:", err);
    res.status(500).json({ error: "Không tải được danh sách mèo." });
  }
});

// POST /api/cats — thêm mèo
router.post("/", verifyToken, storeContext, requireBranch, async (req, res) => {
  try {
    const {
      name, breed, color, gender, birth_date, weight, price, cost, source,
      description, image, images, vaccinated, dewormed, status, published, healthRecords,
    } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Thiếu tên bé mèo." });
    }

    let gallery = sanitizeImages(images);
    if (!gallery.length && typeof image === "string" && image.trim()) gallery = [image.trim()];

    const code = await genCode();
    const cat = await prisma.catListing.create({
      data: {
        code,
        ...injectStoreId(req),
        name: String(name).trim(),
        breed: (breed || "").trim(),
        color: (color || "").trim(),
        gender: gender === "female" ? "female" : "male",
        birth_date: toDate(birth_date),
        weight: weight != null && weight !== "" ? parseFloat(weight) : null,
        price: parseInt(price, 10) || 0,
        cost: parseInt(cost, 10) || 0,
        source: source ? String(source).trim() : null,
        description: description ? String(description) : null,
        image: gallery[0] || "",
        images: gallery,
        vaccinated: !!vaccinated,
        dewormed: !!dewormed,
        status: ["available", "sold", "unavailable"].includes(status) ? status : "available",
        published: published === undefined ? true : !!published,
        healthRecords: Array.isArray(healthRecords) && healthRecords.length
          ? {
              create: healthRecords
                .filter((h) => h && h.name && h.date)
                .map((h) => ({
                  type: ["vaccine", "deworm", "checkup", "other"].includes(h.type) ? h.type : "other",
                  name: String(h.name).trim(),
                  date: toDate(h.date) || new Date(),
                  vet: h.vet ? String(h.vet).trim() : null,
                  next_due: toDate(h.next_due),
                  note: h.note ? String(h.note) : null,
                })),
            }
          : undefined,
      },
      include: { healthRecords: true },
    });
    res.status(201).json({ success: true, cat });
  } catch (err) {
    console.error("POST /cats:", err);
    res.status(err.statusCode || 500).json({ error: err.message || "Không thể thêm mèo." });
  }
});

// PUT /api/cats/:id — sửa
router.put("/:id", verifyToken, storeContext, requireBranch, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await prisma.catListing.findFirst({
      where: { id, ...storeWhere(req) },
      include: { sale: true },
    });
    if (!existing) return res.status(404).json({ error: "Không tìm thấy mèo." });

    // KHÓA: bé đã bán (có giao dịch completed) → không cho sửa, tránh lệch với Sổ bán mèo.
    if (existing.sale && existing.sale.status === "completed") {
      return res.status(409).json({
        error: `Bé đã bán (mã ${existing.sale.code}) — không thể sửa thông tin. ` +
               `Nếu cần, hãy hủy giao dịch ở Sổ bán mèo trước.`,
      });
    }

    const b = req.body;
    const data = {};
    if (b.name !== undefined) data.name = String(b.name).trim();
    if (b.breed !== undefined) data.breed = (b.breed || "").trim();
    if (b.color !== undefined) data.color = (b.color || "").trim();
    if (b.gender !== undefined) data.gender = b.gender === "female" ? "female" : "male";
    if (b.birth_date !== undefined) data.birth_date = toDate(b.birth_date);
    if (b.weight !== undefined) data.weight = b.weight === "" || b.weight == null ? null : parseFloat(b.weight);
    if (b.price !== undefined) data.price = parseInt(b.price, 10) || 0;
    if (b.cost !== undefined) data.cost = parseInt(b.cost, 10) || 0;
    if (b.source !== undefined) data.source = b.source ? String(b.source).trim() : null;
    if (b.description !== undefined) data.description = b.description ? String(b.description) : null;
    if (b.images !== undefined) {
      const gallery = sanitizeImages(b.images);
      data.images = gallery;
      data.image = gallery[0] || "";
    } else if (b.image !== undefined) {
      const cover = (typeof b.image === "string" && b.image.trim()) ? b.image.trim() : "";
      data.image = cover;
      data.images = cover ? [cover] : [];
    }
    if (b.vaccinated !== undefined) data.vaccinated = !!b.vaccinated;
    if (b.dewormed !== undefined) data.dewormed = !!b.dewormed;
    if (b.published !== undefined) data.published = !!b.published;
    if (b.status !== undefined && ["available", "sold", "unavailable"].includes(b.status)) {
      data.status = b.status;
      // Đánh dấu mốc bán khi chuyển sang sold (Phase 2 sẽ ghi qua CatSale; ở đây cho admin chỉnh tay)
      if (b.status === "sold" && existing.status !== "sold") data.sold_at = new Date();
      if (b.status !== "sold") data.sold_at = null;
    }

    const cat = await prisma.catListing.update({ where: { id }, data, include: { healthRecords: true } });
    res.json({ success: true, cat });
  } catch (err) {
    console.error("PUT /cats/:id:", err);
    res.status(500).json({ error: "Không thể cập nhật mèo." });
  }
});

// DELETE /api/cats/:id
router.delete("/:id", verifyToken, storeContext, requireBranch, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await prisma.catListing.findFirst({
      where: { id, ...storeWhere(req) },
      include: { sale: true },
    });
    if (!existing) return res.status(404).json({ error: "Không tìm thấy mèo." });
    if (existing.sale) {
      return res.status(409).json({
        error: `Bé đã có giao dịch bán (mã ${existing.sale.code}) — không thể xóa. ` +
               `Hãy hủy giao dịch ở Sổ bán mèo trước nếu cần.`,
      });
    }
    await prisma.catListing.delete({ where: { id } }); // cascade health records
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /cats/:id:", err);
    res.status(500).json({ error: "Không thể xóa mèo." });
  }
});

// POST /api/cats/:id/health — thêm hồ sơ sức khỏe
router.post("/:id/health", verifyToken, storeContext, requireBranch, async (req, res) => {
  try {
    const cat_id = parseInt(req.params.id, 10);
    const cat = await prisma.catListing.findFirst({ where: { id: cat_id, ...storeWhere(req) } });
    if (!cat) return res.status(404).json({ error: "Không tìm thấy mèo." });

    const { type, name, date, vet, next_due, note } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ error: "Thiếu tên mục sức khỏe." });

    const record = await prisma.catHealthRecord.create({
      data: {
        cat_id,
        type: ["vaccine", "deworm", "checkup", "other"].includes(type) ? type : "other",
        name: String(name).trim(),
        date: toDate(date) || new Date(),
        vet: vet ? String(vet).trim() : null,
        next_due: toDate(next_due),
        note: note ? String(note) : null,
      },
    });
    res.status(201).json({ success: true, record });
  } catch (err) {
    console.error("POST /cats/:id/health:", err);
    res.status(500).json({ error: "Không thể thêm hồ sơ sức khỏe." });
  }
});

// DELETE /api/cats/:id/health/:hid
router.delete("/:id/health/:hid", verifyToken, storeContext, requireBranch, async (req, res) => {
  try {
    const cat_id = parseInt(req.params.id, 10);
    const hid = parseInt(req.params.hid, 10);
    const cat = await prisma.catListing.findFirst({ where: { id: cat_id, ...storeWhere(req) } });
    if (!cat) return res.status(404).json({ error: "Không tìm thấy mèo." });
    await prisma.catHealthRecord.deleteMany({ where: { id: hid, cat_id } });
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /cats/:id/health/:hid:", err);
    res.status(500).json({ error: "Không thể xóa hồ sơ sức khỏe." });
  }
});

module.exports = router;
