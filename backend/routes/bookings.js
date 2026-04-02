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
// Trả về từng ngày trong tháng: { date, day, total_rooms, booked, available }
router.get("/calendar", (req, res) => {
  try {
    const { year, month } = req.query;
    if (!year || !month) return res.status(400).json({ error: "Thiếu year hoặc month." });

    const y = parseInt(year);
    const m = parseInt(month);
    const monthStr = m.toString().padStart(2, "0");
    const daysInMonth = new Date(y, m, 0).getDate();
    const from = `${y}-${monthStr}-01`;
    const to   = `${y}-${monthStr}-${daysInMonth.toString().padStart(2, "0")}`;

    // Tổng số phòng
    const totalRooms = db.prepare(`SELECT COUNT(*) as cnt FROM rooms`).get().cnt;

    // Lấy toàn bộ booking overlap với tháng này
    const bookings = db.prepare(`
      SELECT room_id, check_in, check_out
      FROM bookings
      WHERE status IN ('pending', 'active')
        AND room_id IS NOT NULL
        AND check_in <= ? AND check_out > ?
    `).all(to, from);

    // Tính từng ngày
    const result = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${y}-${monthStr}-${day.toString().padStart(2, "0")}`;
      const date = new Date(dateStr);

      const bookedRooms = new Set();
      for (const b of bookings) {
        const ci = new Date(b.check_in);
        const co = new Date(b.check_out);
        if (date >= ci && date <= co) {
          bookedRooms.add(b.room_id);
        }
      }

      const booked = bookedRooms.size;
      result.push({
        date: dateStr,
        day,
        total_rooms: totalRooms,
        booked,
        available: Math.max(0, totalRooms - booked),
      });
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== CHECK AVAILABILITY (public) ==================
// Kiểm tra khoảng check_in → check_out còn phòng không
router.get("/check-availability", (req, res) => {
  try {
    const { check_in, check_out } = req.query;
    if (!check_in || !check_out) {
      return res.status(400).json({ error: "Thiếu check_in hoặc check_out." });
    }

    const totalRooms = db.prepare(`SELECT COUNT(*) as cnt FROM rooms`).get().cnt;

    const bookedRoomIds = db.prepare(`
      SELECT DISTINCT room_id FROM bookings
      WHERE status IN ('pending', 'active')
        AND room_id IS NOT NULL
        AND check_in <= ? AND check_out >= ?
    `).all(check_out, check_in).map(r => r.room_id);

    const booked = bookedRoomIds.length;
    const available = Math.max(0, totalRooms - booked);

    let availableRooms = [];
    if (available > 0) {
      if (bookedRoomIds.length > 0) {
        const ph = bookedRoomIds.map(() => "?").join(",");
        availableRooms = db.prepare(
          `SELECT id, name FROM rooms WHERE id NOT IN (${ph}) ORDER BY id ASC`
        ).all(...bookedRoomIds);
      } else {
        availableRooms = db.prepare(`SELECT id, name FROM rooms ORDER BY id ASC`).all();
      }
    }

    res.json({ check_in, check_out, total_rooms: totalRooms, booked, available, available_rooms: availableRooms });
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

    const bookings = db.prepare(`
      SELECT b.room_id FROM bookings b
      WHERE b.owner_phone = ?
        AND b.status = 'active'
        AND b.check_in <= date('now')
        AND b.check_out >= date('now')
    `).all(phone.trim());

    if (bookings.length === 0) return res.json([]);

    const roomIds = bookings.map(b => b.room_id).filter(Boolean);
    if (roomIds.length === 0) return res.json([]);

    const ph = roomIds.map(() => "?").join(",");
    
    // Lấy thông tin camera
    const cameras = db.prepare(`
      SELECT c.id, c.name, c.status, c.room_id,
             r.name AS room_name
      FROM cameras c
      LEFT JOIN rooms r ON c.room_id = r.id
      WHERE c.room_id IN (${ph})
    `).all(...roomIds);

    // ✅ XỬ LÝ LINK TRƯỚC KHI TRẢ VỀ CHO CLIENT
    const processedCameras = cameras.map(c => {
      return {
        id: c.id,
        name: c.name,
        room_name: c.room_name,
        status: c.status,
        // Ghép tên ẩn danh cam_{id} vào link Go2RTC
        stream_url: `http://localhost:1984/stream.html?src=cam_${c.id}&media=mse`
      };
    });

    res.json(processedCameras);
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

    // Kiểm tra còn phòng không
    const bookedRoomIds = db.prepare(`
      SELECT DISTINCT room_id FROM bookings
      WHERE status IN ('pending', 'active')
        AND room_id IS NOT NULL
        AND check_in <= ? AND check_out >= ?
    `).all(check_out, check_in).map(r => r.room_id);

    const totalRooms = db.prepare(`SELECT COUNT(*) as cnt FROM rooms`).get().cnt;
    if (bookedRoomIds.length >= totalRooms) {
      return res.status(400).json({ error: "Không còn phòng trống trong khoảng thời gian này." });
    }

    // Tự tìm phòng nếu không chọn
    let assignedRoom = room_id || null;
    if (!assignedRoom) {
      let available;
      if (bookedRoomIds.length > 0) {
        const ph = bookedRoomIds.map(() => "?").join(",");
        available = db.prepare(`SELECT id FROM rooms WHERE id NOT IN (${ph}) LIMIT 1`).get(...bookedRoomIds);
      } else {
        available = db.prepare(`SELECT id FROM rooms LIMIT 1`).get();
      }
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
    if (req.user.role !== "admin") return res.status(403).json({ error: "Không có quyền." });

    const { status } = req.body;
    const validStatuses = ["pending", "active", "completed", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Trạng thái không hợp lệ." });
    }

    db.prepare(`UPDATE bookings SET status = ? WHERE id = ?`).run(status, req.params.id);

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
    if (req.user.role !== "admin") return res.status(403).json({ error: "Không có quyền." });
    db.prepare("DELETE FROM bookings WHERE id = ?").run(req.params.id);
    res.json({ success: true, message: "Đã xoá lịch đặt." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

module.exports = router;