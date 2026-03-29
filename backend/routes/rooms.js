const express = require("express");
const db = require("../db/database");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

// ================== GET ALL ROOMS (admin) ==================
router.get("/", verifyToken, (req, res) => {
  try {
    const rooms = db.prepare("SELECT * FROM rooms ORDER BY created_at DESC").all();
    res.json(rooms);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== GET AVAILABLE ROOMS (public) ==================
router.get("/available", (req, res) => {
  try {
    const { check_in, check_out } = req.query;

    let rooms;
    if (check_in && check_out) {
      rooms = db.prepare(`
        SELECT * FROM rooms
        WHERE status = 'empty'
          AND id NOT IN (
            SELECT room_id FROM bookings
            WHERE status IN ('pending', 'active')
              AND room_id IS NOT NULL
              AND check_in < ? AND check_out > ?
          )
        ORDER BY id ASC
      `).all(check_out, check_in);
    } else {
      rooms = db.prepare(`
        SELECT * FROM rooms WHERE status = 'empty' ORDER BY id ASC
      `).all();
    }

    res.json(rooms);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== CREATE ROOM (admin) ==================
router.post("/", verifyToken, (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Không có quyền." });
    }

    const { id, name, status = "empty", camera_id = null } = req.body;

    if (!id || !name) {
      return res.status(400).json({ error: "Thiếu thông tin." });
    }

    const exist = db.prepare("SELECT * FROM rooms WHERE id = ?").get(id);
    if (exist) {
      return res.status(400).json({ error: "ID phòng đã tồn tại." });
    }

    db.prepare(`
      INSERT INTO rooms (id, name, status, camera_id, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(id, name, status, camera_id);

    res.json({ message: "Tạo phòng thành công." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== UPDATE ROOM (admin) ==================
router.put("/:id", verifyToken, (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Không có quyền." });
    }

    const { name, status, camera_id = null } = req.body;
    const { id } = req.params;

    db.prepare(`
      UPDATE rooms
      SET name = ?, status = ?, camera_id = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(name, status, camera_id || null, id);

    res.json({ message: "Cập nhật thành công." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== DELETE ROOM (admin) ==================
router.delete("/:id", verifyToken, (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Không có quyền." });
    }

    db.prepare("DELETE FROM rooms WHERE id = ?").run(req.params.id);
    res.json({ message: "Xoá phòng thành công." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

module.exports = router;