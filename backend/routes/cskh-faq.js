/**
 * /api/admin/cskh-faq — Admin quản lý KHO TRI THỨC bot CSKH (câu hỏi/đáp tự cấu hình).
 * Bot dùng FAQ ở 2 lớp: khớp keywords (free) + neo vào grounding AI (xem lib/cskhKb.js).
 * Mọi thay đổi gọi cskhKb.refresh() → áp dụng NGAY, không cần restart.
 */
const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const { verifyToken } = require("../middleware/auth");
const cskhKb = require("../lib/cskhKb");

const requireAdmin = (req, res, next) =>
  req.user?.role === "admin"
    ? next()
    : res.status(403).json({ error: "Chỉ admin mới quản lý kho tri thức bot." });

// Chuẩn hóa + kiểm tra payload. Trả { data } hoặc { error }.
function parseBody(body) {
  const question = (body.question || "").trim();
  const answer = (body.answer || "").trim();
  if (!question) return { error: "Thiếu câu hỏi/chủ đề." };
  if (!answer) return { error: "Thiếu câu trả lời." };

  let storeId = null;
  if (body.storeId !== undefined && body.storeId !== null && body.storeId !== "") {
    storeId = parseInt(body.storeId, 10);
    if (Number.isNaN(storeId)) return { error: "storeId không hợp lệ." };
  }
  return {
    data: {
      question,
      answer,
      keywords: typeof body.keywords === "string" ? body.keywords.trim() : "",
      storeId,
      enabled: body.enabled === undefined ? true : !!body.enabled,
      sortOrder: parseInt(body.sortOrder, 10) || 0,
    },
  };
}

// GET — danh sách FAQ (admin quản lý). ?storeId= để lọc (null/"global" = bản chung).
router.get("/", verifyToken, requireAdmin, async (req, res) => {
  try {
    const where = {};
    if (req.query.storeId === "global" || req.query.storeId === "null") where.storeId = null;
    else if (req.query.storeId !== undefined) {
      const sid = parseInt(req.query.storeId, 10);
      if (!Number.isNaN(sid)) where.storeId = sid;
    }
    const data = await prisma.cskhFaq.findMany({
      where,
      orderBy: [{ storeId: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
    });
    res.json({ success: true, data });
  } catch (err) {
    console.error("[GET /admin/cskh-faq]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// POST — tạo FAQ mới
router.post("/", verifyToken, requireAdmin, async (req, res) => {
  const parsed = parseBody(req.body || {});
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  try {
    const created = await prisma.cskhFaq.create({ data: parsed.data });
    await cskhKb.refresh();
    res.json({ success: true, data: created });
  } catch (err) {
    console.error("[POST /admin/cskh-faq]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// PUT /:id — cập nhật FAQ
router.put("/:id", verifyToken, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: "id không hợp lệ." });
  const parsed = parseBody(req.body || {});
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  try {
    const updated = await prisma.cskhFaq.update({ where: { id }, data: parsed.data });
    await cskhKb.refresh();
    res.json({ success: true, data: updated });
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Không tìm thấy FAQ." });
    console.error("[PUT /admin/cskh-faq]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// DELETE /:id — xóa FAQ
router.delete("/:id", verifyToken, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: "id không hợp lệ." });
  try {
    await prisma.cskhFaq.delete({ where: { id } });
    await cskhKb.refresh();
    res.json({ success: true });
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Không tìm thấy FAQ." });
    console.error("[DELETE /admin/cskh-faq]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

module.exports = router;
