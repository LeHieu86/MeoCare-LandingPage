/**
 * /api/admin/cskh-config — Admin xem & chỉnh cấu hình bot CSKH (lưu AppSetting).
 * KHÔNG đụng ANTHROPIC_API_KEY (key giữ trong .env, chỉ báo có/chưa).
 */
const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const aiConfig = require("../lib/aiConfig");

const requireAdmin = (req, res, next) =>
  req.user?.role === "admin"
    ? next()
    : res.status(403).json({ error: "Chỉ admin mới chỉnh cấu hình bot." });

// GET — trạng thái cấu hình hiện tại
router.get("/", verifyToken, requireAdmin, (_req, res) => {
  res.json({ success: true, data: aiConfig.snapshot() });
});

// POST — cập nhật { botEnabled?, aiEnabled?, model?, maxPerDay? }
router.post("/", verifyToken, requireAdmin, async (req, res) => {
  try {
    const data = await aiConfig.update(req.body || {});
    res.json({ success: true, data });
  } catch (err) {
    console.error("[POST /admin/cskh-config]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

module.exports = router;
