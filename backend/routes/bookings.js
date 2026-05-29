const express = require("express");
const prisma = require("../lib/prisma");
const { verifyToken } = require("../middleware/auth");
const { storeContext } = require("../middleware/storeContext");
const { storeWhere, injectStoreId } = require("../lib/storeFilter");
const { getIO } = require("../socket");

const router = express.Router();

// URL công khai của go2rtc — dùng để tạo stream_url trả về cho client browser
// Ưu tiên env var GO2RTC_PUBLIC_URL (vd: https://go2rtc.meomeocare.io.vn)
// Nếu không set → dùng đường dẫn tương đối /go2rtc (qua nginx proxy)
const GO2RTC_PUBLIC = (process.env.GO2RTC_PUBLIC_URL || "").replace(/\/$/, "") || "/go2rtc";

// ================== GET ALL BOOKINGS (admin) ==================
router.get("/", verifyToken, storeContext, async (req, res) => {
  try {
    const { status, limit } = req.query;
    const where = {
      ...storeWhere(req),
      ...(status ? { status } : {}),
    };

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        room: { select: { name: true } },
      },
      orderBy: { created_at: "desc" },
      ...(limit ? { take: parseInt(limit) } : {}),
    });

    const formattedData = bookings.map(b => ({
      ...b,
      room_name: b.room?.name ?? null,
      room: undefined,
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

    // public route: lọc theo store_id nếu được truyền qua query
    const sf = req.query.store_id ? { store_id: parseInt(req.query.store_id, 10) } : {};

    const totalRooms = await prisma.room.count({ where: sf });

    const bookings = await prisma.booking.findMany({
      where: {
        ...sf,
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

    const sf = req.query.store_id ? { store_id: parseInt(req.query.store_id, 10) } : {};

    const totalRooms = await prisma.room.count({ where: sf });

    const bookedCount = await prisma.booking.count({
      where: {
        ...sf,
        status: { in: ["pending", "active"] },
        check_in: { lt: check_out },
        check_out: { gt: check_in }
      }
    });

    const available = totalRooms - bookedCount;

    res.json({ 
      check_in, 
      check_out, 
      total_rooms: totalRooms, 
      booked: bookedCount,
      available: available,
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

    const processedCameras = cameras.map(c => ({
      id: c.id,
      name: c.name,
      room_name: c.room ? c.room.name : null,
      status: c.status,
      stream_url: `${GO2RTC_PUBLIC}/stream.html?src=cam_${c.id}&media=mse`
    }));

    res.json(processedCameras);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== GET ONE BOOKING (admin) ==================
router.get("/:id", verifyToken, storeContext, async (req, res) => {
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
      service, check_in, check_out, note,
      signature, contract_status,
      // ── Thông tin gói dịch vụ (grooming / medical) ──
      service_type, package_id,
    } = req.body;

    if (!cat_name || !owner_name || !owner_phone || !check_in || !check_out) {
      return res.status(400).json({ error: "Thiếu thông tin bắt buộc." });
    }
    if (check_out <= check_in) {
      return res.status(400).json({ error: "Ngày trả phải sau ngày nhận." });
    }

    const svcType = service_type || "boarding";

    /* ── Với boarding: kiểm tra còn phòng trống không ── */
    // store_id cho booking công khai — client truyền qua body, mặc định 1
    const bookingStoreId = parseInt(req.body.store_id, 10) || 1;

    if (svcType === "boarding") {
      const bookedCount = await prisma.booking.count({
        where: {
          store_id: bookingStoreId,
          service_type: "boarding",
          status: { in: ["pending", "active"] },
          check_in: { lt: check_out },
          check_out: { gt: check_in }
        }
      });
      const totalRooms = await prisma.room.count({ where: { store_id: bookingStoreId } });
      if (bookedCount >= totalRooms) {
        return res.status(400).json({ error: "Không còn phòng trống trong khoảng thời gian này." });
      }
    }

    /* ── Lấy snapshot tên + giá gói nếu có ── */
    let snapshotName  = null;
    let snapshotPrice = null;
    if (package_id) {
      const pkg = await prisma.servicePackage.findUnique({
        where: { id: parseInt(package_id, 10) },
        select: { name: true, price: true }
      });
      if (pkg) {
        snapshotName  = pkg.name;
        snapshotPrice = pkg.price;
      }
    }

    /* ── Tạo booking ── */
    const finalContractStatus = signature ? "signed" : "unsigned";

    const newBooking = await prisma.booking.create({
      data: {
        store_id:         bookingStoreId,
        cat_name:         cat_name     || "",
        cat_breed:        cat_breed    || "",
        owner_name:       owner_name   || "",
        owner_phone:      owner_phone  || "",
        service:          service      || "day",
        service_type:     svcType,
        package_id:       package_id   ? parseInt(package_id, 10) : null,
        package_name:     snapshotName,
        package_price:    snapshotPrice,
        room_id:          null,
        check_in,
        check_out,
        note:             note         || "",
        status:           "pending",
        signature:        signature    || null,
        contract_status:  finalContractStatus,
      }
    });

    // Thông báo realtime cho admin
    try {
      const io = getIO();
      if (io) {
        io.to("admin-room").emit("booking:new", {
          bookingId:  newBooking.id,
          catName:    cat_name,
          ownerName:  owner_name,
          checkIn:    check_in,
          checkOut:   check_out,
        });
      }
    } catch { /* socket emit không critical */ }

    res.json({
      success: true,
      booking_id: newBooking.id,
      message: "Đặt lịch thành công. Phòng sẽ được phân bổ khi bạn đến gửi mèo.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== UPDATE STATUS (admin + manager) ==================
router.put("/:id/status", verifyToken, storeContext, async (req, res) => {
  try {
    const { role } = req.user;
    if (!["admin", "manager"].includes(role)) {
      return res.status(403).json({ error: "Không có quyền." });
    }

    const { status, room_id, cancel_reason } = req.body;
    const validStatuses = ["pending", "active", "completed", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Trạng thái không hợp lệ." });
    }

    // Lấy booking — manager chỉ được thao tác booking thuộc store mình
    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    if (!booking) return res.status(404).json({ error: "Không tìm thấy đơn hàng." });

    // Kiểm tra store ownership cho manager
    if (role === "manager" && req.storeId && booking.store_id !== req.storeId) {
      return res.status(403).json({ error: "Booking không thuộc chi nhánh của bạn." });
    }

    let targetRoomId = booking.room_id;

    if (status === "active") {
      /* ── Nhận mèo: BẮT BUỘC chọn phòng ── */
      if (!room_id) {
        return res.status(400).json({ error: "Vui lòng chọn phòng để nhận mèo!" });
      }

      targetRoomId = room_id;

      /* Kiểm tra phòng tồn tại và thuộc đúng store */
      const room = await prisma.room.findUnique({ where: { id: targetRoomId } });
      if (!room) {
        return res.status(400).json({ error: "Phòng không tồn tại." });
      }
      if (role === "manager" && req.storeId && room.store_id !== req.storeId) {
        return res.status(403).json({ error: "Phòng không thuộc chi nhánh của bạn." });
      }
      if (room.status === "occupied") {
        return res.status(400).json({ error: `Phòng ${room.name} đang có mèo, vui lòng chọn phòng khác.` });
      }

      /* Đánh dấu phòng occupied */
      await prisma.room.update({ where: { id: targetRoomId }, data: { status: "occupied" } });

    } else if (["completed", "cancelled"].includes(status)) {
      /* ── Hoàn thành / Hủy: giải phóng phòng ── */
      if (booking.room_id) {
        await prisma.room.update({ where: { id: booking.room_id }, data: { status: "empty" } });
      }
      if (status === "cancelled") targetRoomId = null;
    }

    await prisma.booking.update({
      where: { id: parseInt(req.params.id) },
      data: {
        status,
        room_id: targetRoomId,
        ...(status === "cancelled" && cancel_reason
          ? { cancel_reason }
          : {}),
      },
    });

    res.json({ success: true, message: "Cập nhật trạng thái thành công." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== DELETE BOOKING (admin) ==================
router.delete("/:id", verifyToken, storeContext, async (req, res) => {
  try {
    if (!["admin"].includes(req.user.role)) return res.status(403).json({ error: "Không có quyền." });
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

    /* Chỉ ký hợp đồng, KHÔNG chuyển active (admin làm khi nhận mèo) */
    await prisma.booking.update({
      where: { id: parseInt(req.params.id) },
      data: { contract_status: 'signed', signature }
    });

    res.json({ success: true, message: "Ký hợp đồng thành công!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server khi lưu hợp đồng." });
  }
});

module.exports = router;