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

// ================== GET CALENDAR (public) - FIX OVERBOOKING ==================
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

    // Tổng số phòng vật lý
    const totalRooms = db.prepare(`SELECT COUNT(*) as cnt FROM rooms`).get().cnt;

    // Lấy TẤT CẢ booking (kể cả room_id = NULL) để đếm số lượng "slot" đã bị chiếm
    // Chỉ cần biết ngày nào đã có bao nhiêu đơn trùng nhau
    const bookings = db.prepare(`
      SELECT check_in, check_out
      FROM bookings
      WHERE status IN ('pending', 'active')
        AND check_in <= ? AND check_out > ?
    `).all(to, from);

    const result = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${y}-${monthStr}-${day.toString().padStart(2, "0")}`;
      const date = new Date(dateStr);

      // Đếm số lượng đơn đang active tại ngày này (bất kể có phòng hay chưa)
      let bookedCount = 0;
      for (const b of bookings) {
        const ci = new Date(b.check_in);
        const co = new Date(b.check_out);
        if (date >= ci && date < co) { // Sửa thành < co để chính xác về ngày (đến ngày check_out là trả phòng)
          bookedCount++;
        }
      }

      // Số phòng còn lại = Tổng phòng - Số đơn đã đặt
      const available = Math.max(0, totalRooms - bookedCount);

      result.push({
        date: dateStr,
        day,
        total_rooms: totalRooms,
        booked: bookedCount, // Trả về số lượng đơn thay vì ID phòng cụ thể
        available: available
      });
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== CHECK AVAILABILITY (public) - FIX OVERBOOKING ==================
router.get("/check-availability", (req, res) => {
  try {
    const { check_in, check_out } = req.query;
    if (!check_in || !check_out) {
      return res.status(400).json({ error: "Thiếu check_in hoặc check_out." });
    }

    const totalRooms = db.prepare(`SELECT COUNT(*) as cnt FROM rooms`).get().cnt;

    // Đếm số lượng đơn trùng thời gian (kể cả pending, kể cả chưa có phòng)
    const bookedCount = db.prepare(`
      SELECT COUNT(*) as cnt FROM bookings
      WHERE status IN ('pending', 'active')
        AND check_in < ? AND check_out > ?
    `).get(check_out, check_in).cnt;

    const available = totalRooms - bookedCount;

    // Nếu còn chỗ, mới trả về danh sách phòng để khách tham khảo (hoặc chỉ cần return available > 0)
    // Ở đây ta giữ logic trả về danh sách phòng để nếu Client cần hiển thị danh sách phòng đẹp
    // Nhưng danh sách này chỉ mang tính tham khảo, thực tế phải chờ Admin gán.
    
    let availableRooms = [];
    if (available > 0) {
       // Lấy danh sách phòng đang trống trạng thái 'empty' để hiển thị
       availableRooms = db.prepare(`SELECT id, name FROM rooms WHERE status = 'empty' ORDER BY id ASC`).all();
    }

    res.json({ 
      check_in, 
      check_out, 
      total_rooms: totalRooms, 
      booked: bookedCount,
      available: available, // Số lượng slot còn lại
      available_rooms: availableRooms // Danh sách phòng tham khảo
    });
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

// ================== CREATE BOOKING (public) - UPDATED ==================
router.post("/", (req, res) => {
  try {
    const {
      cat_name, cat_breed = "", owner_name, owner_phone,
      service = "day", room_id = null, check_in, check_out, note = "",
      signature, // Thêm dòng này để nhận chữ ký từ client
      contract_status // Thêm dòng này
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

    // CẬP NHẬT CÂU LỆNH INSERT
    // Nếu có signature -> contract_status = 'signed'. Nếu không -> 'unsigned' (hoặc pending tùy logic)
    // Tuy nhiên với flow mới (bắt buộc ký ở client), ta mặc định là signed nếu có data
    const finalStatus = 'pending'; // Luôn là pending chờ admin duyệt vật lý
    const finalContractStatus = signature ? 'signed' : 'unsigned';

    const result = db.prepare(`
      INSERT INTO bookings (cat_name, cat_breed, owner_name, owner_phone,
                            service, room_id, check_in, check_out, note, 
                            status, signature, contract_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(cat_name, cat_breed, owner_name, owner_phone,
           service, assignedRoom, check_in, check_out, note,
           finalStatus, signature, finalContractStatus);

    res.json({
      success: true,
      booking_id: result.lastInsertRowid,
      room_id: assignedRoom,
      message: "Đặt lịch thành công. Chúng tôi đã nhận được hợp đồng ký sẵn.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== UPDATE STATUS (admin) - UPDATED ==================
router.put("/:id/status", verifyToken, (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Không có quyền." });

    const { status, room_id } = req.body;
    const validStatuses = ["pending", "active", "completed", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Trạng thái không hợp lệ." });
    }

    // Lấy thông tin booking hiện tại
    const booking = db.prepare("SELECT * FROM bookings WHERE id = ?").get(req.params.id);
    if (!booking) return res.status(404).json({ error: "Không tìm thấy đơn hàng." });

    let targetRoomId = booking.room_id; // Mặc định giữ nguyên phòng cũ (nếu đã có)

    // XỬ LÝ KHI CHUYỂN SANG ĐANG PHỤC VỤ (NHẬN MÈO)
    if (status === "active") {
      // 1. Ưu tiên dùng phòng Admin chọn trong Modal (nếu có)
      if (room_id) {
        targetRoomId = parseInt(room_id);
      }

      // 2. KIỂM TRA BẮT BUỘC: Nếu không có phòng nào (Admin không chọn + Booking cũ không có) -> Báo lỗi
      // Đã bỏ tính năng tự động chọn phòng ở đây
      if (!targetRoomId) {
        return res.status(400).json({ error: "Vui lòng chọn phòng để nhận mèo!" });
      }

      // 3. Cập nhật trạng thái phòng
      // Nếu đổi phòng khác phòng cũ -> Giải phóng phòng cũ
      if (booking.room_id && booking.room_id !== targetRoomId) {
        db.prepare("UPDATE rooms SET status = 'empty' WHERE id = ?").run(booking.room_id);
      }
      // Đánh dấu phòng mới là "Đang có người" (occupied)
      db.prepare("UPDATE rooms SET status = 'occupied' WHERE id = ?").run(targetRoomId);
    } 
    
    // XỬ LÝ KHI HOÀN THÀNH HOẶC HỦY -> GIẢI PHÓNG PHÒNG
    else if (["completed", "cancelled"].includes(status)) {
      if (booking.room_id) {
        db.prepare("UPDATE rooms SET status = 'empty' WHERE id = ?").run(booking.room_id);
      }
    }

    // Cập nhật trạng thái booking và phòng (nếu thay đổi)
    db.prepare(`UPDATE bookings SET status = ?, room_id = ? WHERE id = ?`).run(status, targetRoomId, req.params.id);

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

// ================== CLIENT SIGN CONTRACT & ACTIVATE (public) ==================
// Route này cho Khách hàng tự ký hợp đồng -> Tự động chuyển trạng thái sang 'active'
router.post("/:id/activate", (req, res) => {
  try {
    const { signature } = req.body;
    if (!signature) return res.status(400).json({ error: "Thiếu chữ ký." });

    // Kiểm tra booking có tồn tại không
    const booking = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(req.params.id);
    if (!booking) return res.status(404).json({ error: "Không tìm thấy đơn đặt lịch." });

    // Chỉ cho phép ký nếu đang ở trạng thái chờ (pending)
    if (booking.status !== 'pending') {
      return res.status(400).json({ error: "Đơn hàng này không ở trạng thái chờ ký." });
    }

    // Lưu chữ ký vào DB và đổi trạng thái sang 'active'
    db.prepare(`
      UPDATE bookings 
      SET contract_status = 'signed', 
          signature = ?, 
          status = 'active' 
      WHERE id = ?
    `).run(signature, req.params.id);

    // Đổi trạng thái phòng thành 'occupied' (đang có mèo)
    if (booking.room_id) {
      db.prepare("UPDATE rooms SET status = 'occupied' WHERE id = ?").run(booking.room_id);
    }

    res.json({ success: true, message: "Ký hợp đồng và kích hoạt dịch vụ thành công!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server khi lưu hợp đồng." });
  }
});

module.exports = router;