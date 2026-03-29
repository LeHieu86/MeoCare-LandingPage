const express = require("express");
const db = require("../db/database");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

// ================== GET ALL BOOKINGS (admin) ==================
router.get("/", verifyToken, (req, res) => {
  try {
    const bookings = db.prepare(`
      SELECT b.*, r.name AS room_name
      FROM bookings b
      LEFT JOIN rooms r ON b.room_id = r.id
      ORDER BY b.created_at DESC
    `).all();
    res.json({ data: bookings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== GET CALENDAR (public) ==================
router.get("/calendar", (req, res) => {
  try {
    const { year, month } = req.query;
    if (!year || !month) return res.status(400).json({ error: "Thiếu year hoặc month." });

    const y = parseInt(year);
    const m = parseInt(month).toString().padStart(2, "0");
    const from = `${y}-${m}-01`;
    const to   = `${y}-${m}-31`;

    const bookings = db.prepare(`
      SELECT b.cat_name, b.owner_name, b.check_in, b.check_out, b.status,
             r.name AS room_name
      FROM bookings b
      LEFT JOIN rooms r ON b.room_id = r.id
      WHERE b.check_in BETWEEN ? AND ?
        AND b.status != 'cancelled'
      ORDER BY b.check_in ASC
    `).all(from, to);

    res.json(bookings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== TRACK BY PHONE (public) ==================
router.get("/track", (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ error: "Thiếu số điện thoại." });

    const bookings = db.prepare(`
      SELECT b.*, r.name AS room_name
      FROM bookings b
      LEFT JOIN rooms r ON b.room_id = r.id
      WHERE b.owner_phone = ?
      ORDER BY b.created_at DESC
    `).all(phone.trim());

    res.json(bookings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== GET CAMERAS BY PHONE (public) ==================
router.get("/cameras", (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ error: "Thiếu số điện thoại." });

    // Lấy các booking đang active của SĐT này
    const bookings = db.prepare(`
      SELECT b.room_id
      FROM bookings b
      WHERE b.owner_phone = ?
        AND b.status = 'active'
        AND b.check_in <= date('now')
        AND b.check_out >= date('now')
    `).all(phone.trim());

    if (bookings.length === 0) return res.json([]);

    const roomIds = bookings.map(b => b.room_id).filter(Boolean);
    if (roomIds.length === 0) return res.json([]);

    // Lấy cameras gắn với các phòng đó
    const placeholders = roomIds.map(() => "?").join(",");
    const cameras = db.prepare(`
      SELECT c.id, c.name, c.rtsp_url AS stream_url, c.status, c.room_id,
             r.name AS room_name
      FROM cameras c
      LEFT JOIN rooms r ON c.room_id = r.id
      WHERE c.room_id IN (${placeholders})
    `).all(...roomIds);

    res.json(cameras);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== GET ONE BOOKING (admin) ==================
router.get("/:id", verifyToken, (req, res) => {
  try {
    const booking = db.prepare(`
      SELECT b.*, r.name AS room_name
      FROM bookings b
      LEFT JOIN rooms r ON b.room_id = r.id
      WHERE b.id = ?
    `).get(req.params.id);

    if (!booking) return res.status(404).json({ error: "Không tìm thấy." });
    res.json(booking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== CREATE BOOKING (public) ==================
router.post("/", (req, res) => {
  try {
    const {
      cat_name, cat_breed = "", owner_name, owner_phone,
      service = "day", room_id = null, check_in, check_out, note = "",
    } = req.body;

    if (!cat_name || !owner_name || !owner_phone || !check_in || !check_out) {
      return res.status(400).json({ error: "Thiếu thông tin bắt buộc." });
    }

    if (check_out <= check_in) {
      return res.status(400).json({ error: "Ngày trả phải sau ngày nhận." });
    }

    // Nếu không chọn phòng, tự tìm phòng trống
    let assignedRoom = room_id || null;
    if (!assignedRoom) {
      const available = db.prepare(`
        SELECT id FROM rooms
        WHERE status = 'empty'
          AND id NOT IN (
            SELECT room_id FROM bookings
            WHERE status IN ('pending', 'active')
              AND room_id IS NOT NULL
              AND check_in < ? AND check_out > ?
          )
        LIMIT 1
      `).get(check_out, check_in);

      if (available) assignedRoom = available.id;
    }

    const result = db.prepare(`
      INSERT INTO bookings (cat_name, cat_breed, owner_name, owner_phone,
                            service, room_id, check_in, check_out, note, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(cat_name, cat_breed, owner_name, owner_phone,
           service, assignedRoom, check_in, check_out, note);

    res.json({
      success: true,
      booking_id: result.lastInsertRowid,
      room_id: assignedRoom,
      message: "Đặt lịch thành công. Chúng tôi sẽ liên hệ xác nhận sớm.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== UPDATE STATUS (admin) ==================
router.put("/:id/status", verifyToken, (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Không có quyền." });
    }

    const { status } = req.body;
    const validStatuses = ["pending", "active", "completed", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Trạng thái không hợp lệ." });
    }

    db.prepare(`
      UPDATE bookings SET status = ? WHERE id = ?
    `).run(status, req.params.id);

    // Nếu active thì cập nhật phòng thành occupied, nếu completed/cancelled thì empty
    const booking = db.prepare("SELECT room_id FROM bookings WHERE id = ?").get(req.params.id);
    if (booking?.room_id) {
      const roomStatus = status === "active" ? "occupied" : "empty";
      if (["active", "completed", "cancelled"].includes(status)) {
        db.prepare("UPDATE rooms SET status = ? WHERE id = ?").run(roomStatus, booking.room_id);
      }
    }

    res.json({ success: true, message: "Cập nhật trạng thái thành công." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== DELETE BOOKING (admin) ==================
router.delete("/:id", verifyToken, (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Không có quyền." });
    }

    db.prepare("DELETE FROM bookings WHERE id = ?").run(req.params.id);
    res.json({ success: true, message: "Đã xoá lịch đặt." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

module.exports = router;