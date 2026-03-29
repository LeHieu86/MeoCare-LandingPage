const express = require("express");
const db = require("../db/database");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

// ================== GET CAMERAS ==================
router.get("/", verifyToken, (req, res) => {
  try {
    const { room_id } = req.query;

    let cameras;

    if (room_id) {
      cameras = db
        .prepare("SELECT * FROM cameras WHERE room_id = ?")
        .all(room_id);
    } else {
      cameras = db
        .prepare("SELECT * FROM cameras ORDER BY created_at DESC")
        .all();
    }

    res.json(cameras);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== CREATE CAMERA ==================
router.post("/", verifyToken, (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Không có quyền." });
    }

    const { name, room_id, rtsp_url } = req.body;

    if (!name || !room_id || !rtsp_url) {
      return res.status(400).json({ error: "Thiếu thông tin." });
    }

    db.prepare(`
      INSERT INTO cameras (name, room_id, rtsp_url, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run(name, room_id, rtsp_url);

    res.json({ message: "Thêm camera thành công." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== UPDATE CAMERA ==================
router.put("/:id", verifyToken, (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Không có quyền." });
    }

    const { name, room_id, rtsp_url } = req.body;
    const { id } = req.params;

    db.prepare(`
      UPDATE cameras
      SET name = ?, room_id = ?, rtsp_url = ?
      WHERE id = ?
    `).run(name, room_id, rtsp_url, id);

    res.json({ message: "Cập nhật camera thành công." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== DELETE CAMERA ==================
router.delete("/:id", verifyToken, (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Không có quyền." });
    }

    const { id } = req.params;

    db.prepare("DELETE FROM cameras WHERE id = ?").run(id);

    res.json({ message: "Xoá camera thành công." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

module.exports = router;