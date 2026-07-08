const express = require("express");
const prisma = require("../lib/prisma");
const { verifyToken } = require("../middleware/auth");
const { storeContext } = require("../middleware/storeContext");
const { storeWhere } = require("../lib/storeFilter");
const { getIO } = require("../socket");
const idempotency = require("../middleware/idempotency");
const { notifyOwner } = require("../lib/notify");
const { insertWithCode } = require("../lib/codes");

const router = express.Router();

// URL công khai của go2rtc — dùng để tạo stream_url trả về cho client browser
// Ưu tiên env var GO2RTC_PUBLIC_URL (vd: https://go2rtc.meomeocare.io.vn)
// Nếu không set → dùng đường dẫn tương đối /go2rtc (qua nginx proxy)
const GO2RTC_PUBLIC = (process.env.GO2RTC_PUBLIC_URL || "").replace(/\/$/, "") || "/go2rtc";

/* ── Helper: kiểm tra giờ nhận/trả có nằm trong khung cấu hình (bookingHours) không ──
   cfg.days["0".."6"] = { open, start, end } (0=CN..6=T7). Trả về null nếu hợp lệ,
   hoặc chuỗi lỗi (tiếng Việt) nếu sai. */
const timeToMin = (t) => {
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + m;
};
function validatePickupTime(dateStr, timeStr, cfg, label) {
  if (!timeStr) return `Vui lòng chọn giờ ${label} mèo.`;
  if (!/^\d{1,2}:\d{2}$/.test(timeStr)) return `Giờ ${label} mèo không hợp lệ.`;
  // Parse weekday theo giờ địa phương (tránh lệch do UTC)
  const day = new Date(`${dateStr}T00:00:00`).getDay();
  const d = cfg?.days?.[String(day)];
  if (!d || !d.open) return `Ngày ${label} mèo hiện không nhận giao/trả. Vui lòng chọn ngày khác.`;
  const t = timeToMin(timeStr);
  if (t < timeToMin(d.start) || t > timeToMin(d.end)) {
    return `Giờ ${label} mèo phải trong khung ${d.start}–${d.end}.`;
  }
  return null;
}

/* ── Helper: dựng snapshot "suất ăn thêm" từ cấu hình foodOptions của dịch vụ ──
   Giá do SERVER tự tính (không tin client): neo theo đơn giá /100g × TỔNG GRAM/ngày.
   input = { food_enabled, food_meals, food_grams_per_meal }.
   Trả về: null (khách không chọn / dịch vụ tắt suất ăn)
         | { error }              (khẩu phần ngoài khung cho phép)
         | { data: {food_*...} }  (snapshot để ghi vào booking) */
function buildFoodSnapshot(foodCfg, input) {
  if (!foodCfg || foodCfg.enabled === false) return null;
  if (!input || !input.food_enabled) return null;

  const meals = parseInt(input.food_meals, 10);
  const gramsPerMeal = parseInt(input.food_grams_per_meal, 10);
  if (!Number.isFinite(meals) || meals <= 0) return null;
  if (!Number.isFinite(gramsPerMeal) || gramsPerMeal <= 0) return null;

  const gramsPerDay = meals * gramsPerMeal;
  const minG = Number(foodCfg.minGramsPerDay) || 0;
  const maxG = Number(foodCfg.maxGramsPerDay) || 100000;
  if (gramsPerDay < minG || gramsPerDay > maxG) {
    return { error: `Khẩu phần suất ăn phải trong khoảng ${minG}–${maxG}g/ngày.` };
  }

  const pricePer100g = Number(foodCfg.pricePer100g) || 0;
  const pricePerDay = Math.round((gramsPerDay / 100) * pricePer100g);
  const baseLabel = foodCfg.label || "Suất ăn thêm";

  // Vị pate khách chọn — chỉ giữ tên có trong thực đơn config (chống dữ liệu rác). Giá KHÔNG đổi theo vị.
  const validNames = (foodCfg.dishes || []).map((d) => d.name);
  const dishes = Array.isArray(input.food_dishes)
    ? input.food_dishes.filter((n) => validNames.includes(n)).slice(0, 10)
    : [];

  return {
    data: {
      food_meals:          meals,
      food_grams_per_meal: gramsPerMeal,
      food_grams_per_day:  gramsPerDay,
      food_price_per_day:  pricePerDay,
      food_label:          `${baseLabel} (${meals} cữ × ${gramsPerMeal}g = ${gramsPerDay}g/ngày)`,
      food_dishes:         dishes,
    },
  };
}

/* ── Helper: snapshot "giao nhận lúc gửi" (tự đem / đón tận nhà) ──
   Phí đón tính SERVER từ pickupOptions + khoảng cách (km) client geocode gửi lên. */
function buildPickupSnapshot(cfg, input) {
  const method = input?.pickup_method === "home" ? "home" : "self";
  if (method !== "home") return { pickup_method: "self" };

  const address = (input.pickup_address || "").toString().trim() || null;
  let distance = null;
  let fee = null;
  const km = Number(input.pickup_distance_km);
  if (cfg && cfg.enabled !== false && Number.isFinite(km) && km >= 0) {
    const capped = cfg.maxKm ? Math.min(km, Number(cfg.maxKm)) : km;
    distance = Math.round(capped * 10) / 10;
    const base = Number(cfg.baseFee) || 0;
    const perKm = Number(cfg.perKm) || 0;
    const freeKm = Number(cfg.freeKm) || 0;
    fee = base + Math.round(perKm * Math.max(0, capped - freeKm));
  }
  return { pickup_method: "home", pickup_address: address, pickup_distance_km: distance, pickup_fee: fee };
}

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
        store: { select: { name: true, address: true, phone: true } },
      },
      orderBy: { created_at: "desc" },
      ...(limit ? { take: parseInt(limit) } : {}),
    });

    const formattedData = bookings.map(b => ({
      ...b,
      room_name: b.room?.name ?? null,
      store_name: b.store?.name ?? null,
      store_address: b.store?.address ?? null,
      store_phone: b.store?.phone ?? null,
      room: undefined,
      store: undefined,
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

// ===== TRACK — chỉ lịch sử đặt lịch của CHÍNH user đăng nhập =====
// Bảo mật: SĐT lấy từ TOKEN, KHÔNG nhận ?phone= tùy ý → chống xem trộm lịch sử khách khác.
router.get("/track", verifyToken, async (req, res) => {
  try {
    const me = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { phone: true },
    });
    const phone = (me?.phone || "").trim();
    if (!phone) return res.json([]);

    const bookings = await prisma.booking.findMany({
      where: { owner_phone: phone },
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

// ===== GET CAMERAS — chỉ camera của booking thuộc CHÍNH user đăng nhập =====
// Bảo mật: SĐT lấy từ TOKEN (tra DB theo id), KHÔNG nhận ?phone= tùy ý nữa.
// → người lạ không thể gõ SĐT bất kỳ để xem camera phòng mèo của khách khác.
router.get("/cameras", verifyToken, async (req, res) => {
  try {
    const me = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { phone: true },
    });
    const phone = (me?.phone || "").trim();
    if (!phone) return res.json([]);   // tài khoản chưa có SĐT → không có booking

    const today = new Date().toISOString().split('T')[0];

    // Cho xem camera CHỪNG NÀO mèo còn ở tiệm: status = "active" + đã tới ngày nhận.
    // KHÔNG chặn theo check_out — khách có thể nhận trễ 1-2 ngày (đã tính phí trễ) vẫn xem
    // được; chỉ khi nhân viên xác nhận HOÀN THÀNH (status đổi khỏi "active") mới cắt camera.
    const bookings = await prisma.booking.findMany({
      where: {
        owner_phone: phone,
        status: "active",
        check_in: { lte: today }
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
      stream_url: `${GO2RTC_PUBLIC}/stream.html?src=cam_${c.stream_key}&media=mse`
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
router.post("/", idempotency({ scope: "POST /api/bookings" }), async (req, res) => {
  try {
    const {
      cat_name, cat_breed, owner_name, owner_phone,
      service, check_in, check_out, note,
      signature,
      check_in_time, check_out_time,
      // ── Thông tin gói dịch vụ (grooming / medical) ──
      service_type, package_id,
      // ── Suất ăn thêm (khách chọn trên web) ──
      food_enabled, food_meals, food_grams_per_meal, food_dishes,
      // ── Giao nhận lúc gửi ──
      pickup_method, pickup_address, pickup_distance_km,
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

    // Snapshot suất ăn + giao nhận — chỉ áp cho boarding, tính lại bên trong khối dưới
    let foodSnap = null;
    let pickupSnap = null;

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

      /* ── Kiểm tra giờ nhận/trả theo khung cấu hình của dịch vụ giữ mèo ──
         Ưu tiên khớp theo key="boarding"; nếu không có thì lấy dịch vụ per_day. */
      const boardingDef =
        (await prisma.serviceTypeDef.findFirst({
          where: { key: "boarding" },
          select: { bookingHours: true, foodOptions: true, pickupOptions: true },
        })) ||
        (await prisma.serviceTypeDef.findFirst({
          where: { pricingType: "per_day" },
          orderBy: { sortOrder: "asc" },
          select: { bookingHours: true, foodOptions: true, pickupOptions: true },
        }));
      const cfg = boardingDef?.bookingHours;
      if (cfg && cfg.enabled) {
        const errIn = validatePickupTime(check_in, check_in_time, cfg, "nhận");
        if (errIn) return res.status(400).json({ error: errIn });
        const errOut = validatePickupTime(check_out, check_out_time, cfg, "trả");
        if (errOut) return res.status(400).json({ error: errOut });
      }

      /* ── Suất ăn thêm: server tự tính giá từ foodOptions, không tin client ── */
      const food = buildFoodSnapshot(boardingDef?.foodOptions, {
        food_enabled, food_meals, food_grams_per_meal, food_dishes,
      });
      if (food?.error) return res.status(400).json({ error: food.error });
      foodSnap = food?.data || null;

      /* ── Giao nhận: phí đón tận nhà server tự tính từ pickupOptions + km client gửi ── */
      pickupSnap = buildPickupSnapshot(boardingDef?.pickupOptions, {
        pickup_method, pickup_address, pickup_distance_km,
      });
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

    /* ── Ưu đãi khách chọn (web): chỉ GHI NHẬN để nhân viên áp + redeem lúc hoàn thành ── */
    let voucherId = null;
    let voucherLabel = null;
    let voucherType = null;
    let voucherValue = null;
    if (req.body.voucher_id) {
      const v = await prisma.benefitVoucher.findUnique({ where: { id: parseInt(req.body.voucher_id, 10) } });
      const now = new Date();
      if (v && v.phone === (owner_phone || "").trim() && v.status === "active" &&
          (!v.valid_until || v.valid_until > now)) {
        voucherId = v.id;
        voucherLabel = v.title;
        voucherType = v.type;          // snapshot để client tự tính tiền giảm vào hóa đơn
        voucherValue = v.value;
      }
    }

    /* ── Tạo booking ── */
    const finalContractStatus = signature ? "signed" : "unsigned";

    const bookingData = {
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
      check_in_time:    check_in_time  || null,
      check_out_time:   check_out_time || null,
      note:             note         || "",
      status:           "pending",
      signature:        signature    || null,
      contract_status:  finalContractStatus,
      voucher_id:       voucherId,
      voucher_label:    voucherLabel,
      voucher_type:     voucherType,
      voucher_value:    voucherValue,
      ...(foodSnap || {}),
      ...(pickupSnap || {}),
    };
    // Mã ngẫu nhiên DV-YYMMDD-NNNNNN (không tuần tự); retry nếu trùng (rất hiếm)
    const newBooking = await insertWithCode("service", "code", (code) =>
      prisma.booking.create({ data: { ...bookingData, code } })
    );

    // Thông báo realtime: admin (xem tất cả) + nhân viên CHI NHÁNH liên quan
    try {
      const io = getIO();
      if (io) {
        const payload = {
          bookingId:  newBooking.id,
          storeId:    bookingStoreId,
          catName:    cat_name,
          ownerName:  owner_name,
          checkIn:    check_in,
          checkOut:   check_out,
        };
        io.to("admin-room").emit("booking:new", payload);
        io.to(`store-${bookingStoreId}`).emit("booking:new", payload);
      }
    } catch { /* socket emit không critical */ }

    // Thông báo ra ngoài (Telegram) cho chủ tiệm — không chặn response
    const inT  = check_in_time  ? ` ${check_in_time}`  : "";
    const outT = check_out_time ? ` ${check_out_time}` : "";
    const foodLine = foodSnap
      ? `\n🍽 Suất ăn: ${foodSnap.food_label} (~${foodSnap.food_price_per_day.toLocaleString("vi-VN")}đ/ngày)` +
        (foodSnap.food_dishes?.length ? ` · ${foodSnap.food_dishes.join(", ")}` : "")
      : "";
    const pickupLine = pickupSnap?.pickup_method === "home"
      ? `\n🚚 Đón tận nhà: ${pickupSnap.pickup_address || "?"}` +
        (pickupSnap.pickup_fee != null ? ` (~${pickupSnap.pickup_fee.toLocaleString("vi-VN")}đ)` : " (báo phí sau)")
      : "";
    notifyOwner(
      `🐱 ĐẶT LỊCH GIỮ MÈO MỚI (CN #${bookingStoreId})\n` +
      `Mèo: ${cat_name || "?"}\n` +
      `Chủ: ${owner_name || "?"} — ${owner_phone || "?"}\n` +
      `Nhận: ${check_in}${inT}\n` +
      `Trả: ${check_out}${outT}` +
      foodLine +
      pickupLine
    );

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

    const {
      status, room_id, cancel_reason, total_price,
      // ── Nhân viên chỉnh lại suất ăn thực tế lúc nhận mèo (khách chọn web = tạm tính) ──
      food_enabled, food_meals, food_grams_per_meal,
    } = req.body;
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

    /* ── Nhân viên chỉnh lại suất ăn thực tế (chỉ khi payload có gửi food_*) ──
       food_enabled=false → xoá suất ăn; có gram → tính lại giá từ config (không tin client). */
    let foodUpdate; // undefined = không đụng tới suất ăn hiện có
    if (food_enabled !== undefined || food_meals !== undefined || food_grams_per_meal !== undefined) {
      const boardingDef =
        (await prisma.serviceTypeDef.findFirst({
          where: { key: "boarding" },
          select: { foodOptions: true },
        })) ||
        (await prisma.serviceTypeDef.findFirst({
          where: { pricingType: "per_day" },
          orderBy: { sortOrder: "asc" },
          select: { foodOptions: true },
        }));
      const food = buildFoodSnapshot(boardingDef?.foodOptions, {
        food_enabled, food_meals, food_grams_per_meal,
      });
      if (food?.error) return res.status(400).json({ error: food.error });
      foodUpdate = food?.data || {
        food_meals: null, food_grams_per_meal: null, food_grams_per_day: null,
        food_price_per_day: null, food_label: null,
      };
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
        ...(status === "cancelled" && cancel_reason ? { cancel_reason } : {}),
        // Ghi nhận tổng tiền thực thu khi hoàn thành (dùng cho báo cáo tài chính)
        ...(status === "completed" && total_price !== undefined
          ? { total_price: parseInt(total_price) }
          : {}),
        // Suất ăn nhân viên chỉnh lại (nếu payload có gửi)
        ...(foodUpdate || {}),
      },
    });

    /* ── Hoàn tất đơn → tự đánh dấu voucher khách đã chọn là "đã dùng" ──
       Ưu đãi đã được trừ vào bảng giá phía client; đến khi hoàn tất thì tiêu voucher
       (idempotent: chỉ tiêu nếu còn active; nếu nhân viên đã bấm Dùng thủ công thì bỏ qua). */
    if (status === "completed" && booking.voucher_id) {
      try {
        const now = new Date();
        const usable = (x) =>
          x && x.status === "active" &&
          (x.used_count || 0) < (x.max_uses || 1) &&
          (!x.valid_until || x.valid_until >= now);

        let v = await prisma.benefitVoucher.findUnique({ where: { id: booking.voucher_id } });
        // Nếu voucher đã chọn không còn dùng được (vd do gộp ×N cùng 1 id đã tiêu ở đơn khác),
        // tiêu 1 voucher GIỐNG HỆT còn hiệu lực của khách → mỗi lần hoàn thành tiêu đúng 1 phiếu.
        if (v && !usable(v)) {
          const alt = await prisma.benefitVoucher.findFirst({
            where: { phone: v.phone, type: v.type, title: v.title, status: "active" },
            orderBy: { created_at: "asc" },
          });
          if (usable(alt)) v = alt;
        }
        if (usable(v)) {
          const newCount = (v.used_count || 0) + 1;
          await prisma.benefitVoucher.update({
            where: { id: v.id },
            data: {
              used_count: newCount,
              status: newCount >= (v.max_uses || 1) ? "used" : "active",
              used_at: new Date(),
              used_ref: `booking:${booking.id}`,
            },
          });
        }
      } catch (e) { console.error("[auto-redeem voucher]", e); }
    }

    // ── Thông báo realtime cho KHÁCH + staff khi trạng thái lịch đổi ──
    try {
      const io = getIO();
      if (io) {
        const STATUS_LABEL = {
          pending:   "Chờ xử lý",
          active:    "Đã nhận mèo — đang chăm sóc",
          completed: "Hoàn thành",
          cancelled: "Đã hủy",
        };
        const payload = {
          bookingId:   booking.id,
          storeId:     booking.store_id,
          status,
          statusLabel: STATUS_LABEL[status] || status,
          catName:     booking.cat_name,
        };
        // Khách: tìm userId theo SĐT để bắn vào room cá nhân
        const customer = await prisma.user.findFirst({
          where: { phone: booking.owner_phone },
          select: { id: true },
        });
        if (customer) io.to(`customer-${customer.id}`).emit("booking:status_changed", payload);
        // Staff: admin (xem tất cả) + chi nhánh liên quan
        io.to("admin-room").emit("booking:status_changed", payload);
        io.to(`store-${booking.store_id}`).emit("booking:status_changed", payload);
      }
    } catch { /* socket emit không critical */ }

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