const express = require("express");
const prisma = require("../lib/prisma");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

// ================== GET ALL BOOKINGS (admin) ==================
router.get("/", verifyToken, async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      include: { room: { select: { name: true } } },
      orderBy: { created_at: "desc" }
    });

    const formattedData = bookings.map(b => ({
      ...b,
      room_name: b.room ? b.room.name : null,
      room: undefined 
    }));

    res.json({ data: formattedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== GET CALENDAR (public) ==================
router.get("/calendar", async (req, res) => {
  try {
    const { year, month } = req.query;
    if (!year || !month) return res.status(400).json({ error: "Thiếu year hoặc month." });

    const y = parseInt(year);
    const m = parseInt(month);
    const monthStr = m.toString().padStart(2, "0");
    const daysInMonth = new Date(y, m, 0).getDate();
    const from = `${y}-${monthStr}-01`;
    const to   = `${y}-${monthStr}-${daysInMonth.toString().padStart(2, "0")}`;

    const totalRooms = await prisma.room.count();

    // ✅ Dùng chuỗi String thuần túy để so sánh (Tránh 100% lỗi Timezone)
    const bookings = await prisma.booking.findMany({
      where: {
        status: { in: ["pending", "active"] },
        check_in: { lte: to },
        check_out: { gt: from }
      },
      select: { check_in: true, check_out: true }
    });

    const result = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${y}-${monthStr}-${day.toString().padStart(2, "0")}`;

      let bookedCount = 0;
      for (const b of bookings) {
        // ✅ So sánh chuỗi YYYY-MM-DD trực tiếp (VD: "2026-04-15" >= "2026-04-10")
        if (dateStr >= b.check_in && dateStr < b.check_out) {
          bookedCount++;
        }
      }

      const available = Math.max(0, totalRooms - bookedCount);

      result.push({
        date: dateStr,
        day,
        total_rooms: totalRooms,
        booked: bookedCount,
        available: available
      });
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== CHECK AVAILABILITY (public) ==================
router.get("/check-availability", async (req, res) => {
  try {
    const { check_in, check_out } = req.query;
    if (!check_in || !check_out) {
      return res.status(400).json({ error: "Thiếu check_in hoặc check_out." });
    }

    const totalRooms = await prisma.room.count();

    // ✅ Dùng chuỗi String thuần túy
    const bookedCount = await prisma.booking.count({
      where: {
        status: { in: ["pending", "active"] },
        check_in: { lt: check_out },
        check_out: { gt: check_in }
      }
    });

    const available = totalRooms - bookedCount;

    let availableRooms = [];
    if (available > 0) {
       availableRooms = await prisma.room.findMany({
         where: { status: "empty" },
         select: { id: true, name: true },
         orderBy: { id: "asc" }
       });
    }

    res.json({ 
      check_in, 
      check_out, 
      total_rooms: totalRooms, 
      booked: bookedCount,
      available: available,
      available_rooms: availableRooms
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== TRACK BY PHONE (public) ==================
router.get("/track", async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ error: "Thiếu số điện thoại." });

    const bookings = await prisma.booking.findMany({
      where: { owner_phone: phone.trim() },
      include: { room: { select: { name: true } } },
      orderBy: { created_at: "desc" }
    });

    const formattedData = bookings.map(b => ({
      ...b,
      room_name: b.room ? b.room.name : null,
      room: undefined
    }));

    res.json(formattedData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== GET CAMERAS BY PHONE (public) ==================
router.get("/cameras", async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ error: "Thiếu số điện thoại." });

    // Lấy ngày hôm nay dưới dạng chuỗi YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];

    const bookings = await prisma.booking.findMany({
      where: {
        owner_phone: phone.trim(),
        status: "active",
        check_in: { lte: today },
        check_out: { gte: today }
      },
      select: { room_id: true }
    });

    if (bookings.length === 0) return res.json([]);

    const roomIds = bookings.map(b => b.room_id).filter(Boolean);
    if (roomIds.length === 0) return res.json([]);

    const cameras = await prisma.camera.findMany({
      where: { room_id: { in: roomIds } },
      include: { room: { select: { name: true } } }
    });

    const processedCameras = cameras.map(c => {
      return {
        id: c.id,
        name: c.name,
        room_name: c.room ? c.room.name : null,
        status: c.status,
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
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { room: { select: { name: true } } }
    });

    if (!booking) return res.status(404).json({ error: "Không tìm thấy." });
    
    res.json({
      ...booking,
      room_name: booking.room ? booking.room.name : null,
      room: undefined
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== CREATE BOOKING (public) ==================
router.post("/", async (req, res) => {
  try {
    const {
      cat_name, cat_breed, owner_name, owner_phone,
      service, room_id, check_in, check_out, note,
      signature, contract_status
    } = req.body;

    if (!cat_name || !owner_name || !owner_phone || !check_in || !check_out) {
      return res.status(400).json({ error: "Thiếu thông tin bắt buộc." });
    }
    if (check_out <= check_in) {
      return res.status(400).json({ error: "Ngày trả phải sau ngày nhận." });
    }

    // ✅ Dùng chuỗi String thuần túy để kiểm tra
    const bookedRooms = await prisma.booking.findMany({
      where: {
        status: { in: ["pending", "active"] },
        room_id: { not: null },
        check_in: { lte: check_out },
        check_out: { gte: check_in }
      },
      select: { room_id: true }
    });
    const bookedRoomIds = bookedRooms.map(r => r.room_id);

    const totalRooms = await prisma.room.count();
    if (bookedRoomIds.length >= totalRooms) {
      return res.status(400).json({ error: "Không còn phòng trống trong khoảng thời gian này." });
    }

    let assignedRoom = room_id || null;
    if (!assignedRoom) {
      const availableRoom = await prisma.room.findFirst({
        where: bookedRoomIds.length > 0 ? { id: { notIn: bookedRoomIds } } : {},
      });
      if (availableRoom) assignedRoom = availableRoom.id;
    }

    const finalContractStatus = signature ? 'signed' : 'unsigned';

    // ✅ Lưu CHUỖI thẳng vào DB, KHÔNG bọc new Date() nữa
    const newBooking = await prisma.booking.create({
      data: {
        cat_name: cat_name || '',
        cat_breed: cat_breed || '',
        owner_name: owner_name || '',
        owner_phone: owner_phone || '',
        service: service || "day",
        room_id: assignedRoom,
        check_in: check_in,
        check_out: check_out,
        note: note || '',
        status: 'pending',
        signature: signature || null,
        contract_status: finalContractStatus
      }
    });

    res.json({
      success: true,
      booking_id: newBooking.id,
      room_id: assignedRoom,
      message: "Đặt lịch thành công. Chúng tôi đã nhận được hợp đồng ký sẵn.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== UPDATE STATUS (admin) ==================
router.put("/:id/status", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Không có quyền." });

    const { status, room_id } = req.body;
    const validStatuses = ["pending", "active", "completed", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Trạng thái không hợp lệ." });
    }

    const booking = await prisma.booking.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!booking) return res.status(404).json({ error: "Không tìm thấy đơn hàng." });

    let targetRoomId = booking.room_id;

    if (status === "active") {
      if (room_id) targetRoomId = parseInt(room_id);

      if (!targetRoomId) {
        return res.status(400).json({ error: "Vui lòng chọn phòng để nhận mèo!" });
      }

      if (booking.room_id && booking.room_id !== targetRoomId) {
        await prisma.room.update({ where: { id: booking.room_id }, data: { status: "empty" } });
      }
      await prisma.room.update({ where: { id: targetRoomId }, data: { status: "occupied" } });
    } else if (["completed", "cancelled"].includes(status)) {
      if (booking.room_id) {
        await prisma.room.update({ where: { id: booking.room_id }, data: { status: "empty" } });
      }
    }

    await prisma.booking.update({
      where: { id: parseInt(req.params.id) },
      data: { status, room_id: targetRoomId }
    });

    res.json({ success: true, message: "Cập nhật trạng thái thành công." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== DELETE BOOKING (admin) ==================
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Không có quyền." });
    await prisma.booking.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true, message: "Đã xoá lịch đặt." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== CLIENT SIGN CONTRACT & ACTIVATE (public) ==================
router.post("/:id/activate", async (req, res) => {
  try {
    const { signature } = req.body;
    if (!signature) return res.status(400).json({ error: "Thiếu chữ ký." });

    const booking = await prisma.booking.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!booking) return res.status(404).json({ error: "Không tìm thấy đơn đặt lịch." });

    if (booking.status !== 'pending') {
      return res.status(400).json({ error: "Đơn hàng này không ở trạng thái chờ ký." });
    }

    await prisma.booking.update({
      where: { id: parseInt(req.params.id) },
      data: { contract_status: 'signed', signature, status: 'active' }
    });

    if (booking.room_id) {
      await prisma.room.update({ where: { id: booking.room_id }, data: { status: "occupied" } });
    }

    res.json({ success: true, message: "Ký hợp đồng và kích hoạt dịch vụ thành công!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server khi lưu hợp đồng." });
  }
});

module.exports = router;