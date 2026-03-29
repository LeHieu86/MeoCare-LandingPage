const express = require("express");
const db = require("../db/database");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

// ================== GET ALL ROOMS ==================
router.get("/", verifyToken, (req, res) => {
  try {
    const rooms = db.prepare("SELECT * FROM rooms ORDER BY created_at DESC").all();
    res.json(rooms);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== CREATE ROOM ==================
router.post("/", verifyToken, (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Không có quyền." });
    }

    const { id, name } = req.body;

    if (!id || !name) {
      return res.status(400).json({ error: "Thiếu thông tin." });
    }

    const exist = db.prepare("SELECT * FROM rooms WHERE id = ?").get(id);
    if (exist) {
      return res.status(400).json({ error: "ID phòng đã tồn tại." });
    }

    db.prepare(`
      INSERT INTO rooms (id, name, status, created_at)
      VALUES (?, ?, 'active', datetime('now'))
    `).run(id, name);

    res.json({ message: "Tạo phòng thành công." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== UPDATE ROOM ==================
router.put("/:id", verifyToken, (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Không có quyền." });
    }

    const { name, status } = req.body;
    const { id } = req.params;

    db.prepare(`
      UPDATE rooms
      SET name = ?, status = ?
      WHERE id = ?
    `).run(name, status, id);

    res.json({ message: "Cập nhật thành công." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== DELETE ROOM ==================
router.delete("/:id", verifyToken, (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Không có quyền." });
    }

    const { id } = req.params;

    db.prepare("DELETE FROM rooms WHERE id = ?").run(id);

    res.json({ message: "Xoá phòng thành công." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

module.exports = router;