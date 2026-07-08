const express = require("express");
const prisma = require("../lib/prisma");
const { Conversation, Message } = require("../models/Chat");
const { verifyToken } = require("../middleware/auth");
const { storeContext } = require("../middleware/storeContext");

const router = express.Router();

const GENERAL_LABEL = "Hỗ trợ chung";

// Role KHÔNG được mở chat khách hàng (đã có app ChatHub nội bộ riêng).
// Chat chỉ dành cho khách ↔ admin + manager (quản lý chi nhánh).
const NON_CHAT_ROLES = ["employee", "stock-manager", "hr-manager"];

// Tài khoản nội bộ → ẩn khỏi danh sách hội thoại (chỉ hiện KHÁCH HÀNG thật).
const STAFF_ROLES = ["admin", "owner", "manager", "stock-manager", "hr-manager", "employee"];

// Helper: lấy map storeId -> tên chi nhánh
async function getStoreNameMap(ids) {
  const realIds = [...new Set(ids.filter((x) => x != null))];
  if (!realIds.length) return {};
  const stores = await prisma.store.findMany({
    where: { id: { in: realIds } },
    select: { id: true, name: true },
  });
  const map = {};
  stores.forEach((s) => { map[s.id] = s.name; });
  return map;
}

/* ─────────────────────────────────────────────────────────────────────────
   GET /api/chat/my-branches?phone=...  (KHÁCH)
   Trả danh sách kênh khách có thể nhắn: các chi nhánh khách đã đặt dịch vụ
   + 1 kênh "Hỗ trợ chung". Kèm tin nhắn cuối nếu đã có hội thoại.
───────────────────────────────────────────────────────────────────────── */
router.get("/my-branches", async (req, res) => {
  try {
    const phone = (req.query.phone || "").trim();
    if (!phone) return res.status(400).json({ error: "Thiếu số điện thoại" });

    // Chi nhánh khách đã/đang dùng dịch vụ (theo booking)
    const bookings = await prisma.booking.findMany({
      where: { owner_phone: phone },
      distinct: ["store_id"],
      select: { store_id: true },
    });
    const storeIds = bookings.map((b) => b.store_id);
    const nameMap = await getStoreNameMap(storeIds);

    // Hội thoại đã có của khách (để lấy lastMessage + đếm chưa đọc)
    const convs = await Conversation.find({ phone }).select(
      "_id storeId lastMessage lastSenderType updatedAt clientLastSeenAt"
    );
    const convMap = {};
    convs.forEach((c) => { convMap[c.storeId ?? "general"] = c; });

    // Chưa đọc (phía khách) = tin của nhân viên gửi SAU lần khách xem cuối.
    const buildChannel = async (storeId, name) => {
      const c = convMap[storeId ?? "general"];
      let unread = 0;
      if (c) {
        unread = await Message.countDocuments({
          conversationId: c._id,
          senderType: "admin",
          createdAt: { $gt: c.clientLastSeenAt || new Date(0) },
        });
      }
      return {
        storeId: storeId ?? null,
        storeName: name,
        conversationId: c?._id || null,
        lastMessage: c?.lastMessage || "",
        lastSenderType: c?.lastSenderType || null,
        updatedAt: c?.updatedAt || null,
        unread,
      };
    };

    const branchChannels = await Promise.all(
      storeIds
        .filter((id) => nameMap[id]) // bỏ store đã xoá
        .map((id) => buildChannel(id, nameMap[id]))
    );

    // Kênh hỗ trợ chung luôn có
    const channels = [...branchChannels, await buildChannel(null, GENERAL_LABEL)];

    res.json(channels);
  } catch (err) {
    console.error("[chat/my-branches]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

/* ─────────────────────────────────────────────────────────────────────────
   POST /api/chat/room  { phone, name, storeId }  (KHÁCH)
   Lấy/tạo hội thoại cho cặp (phone, storeId). storeId null = Hỗ trợ chung.
   Chỉ cho nhắn chi nhánh khách đã có booking (hoặc kênh chung).
───────────────────────────────────────────────────────────────────────── */
router.post("/room", async (req, res) => {
  try {
    const { phone, name } = req.body;
    const storeId = req.body.storeId != null ? parseInt(req.body.storeId, 10) : null;
    if (!phone) return res.status(400).json({ error: "Thiếu số điện thoại" });

    // Nếu nhắn 1 chi nhánh cụ thể, khách phải từng đặt dịch vụ ở đó
    if (storeId != null) {
      const booked = await prisma.booking.findFirst({
        where: { owner_phone: phone.trim(), store_id: storeId },
        select: { id: true },
      });
      if (!booked) {
        return res.status(403).json({ error: "Bạn chưa dùng dịch vụ tại chi nhánh này." });
      }
    }

    let conversation = await Conversation.findOne({ phone: phone.trim(), storeId });
    if (!conversation) {
      conversation = await Conversation.create({
        phone: phone.trim(),
        storeId,
        clientName: name || "Khách lạ",
      });
    }

    const nameMap = storeId != null ? await getStoreNameMap([storeId]) : {};
    res.json({
      success: true,
      conversationId: conversation._id,
      phone: conversation.phone,
      storeId: conversation.storeId,
      storeName: storeId != null ? (nameMap[storeId] || "Chi nhánh") : GENERAL_LABEL,
      clientName: conversation.clientName,
    });
  } catch (err) {
    console.error("[chat/room]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

/* ─────────────────────────────────────────────────────────────────────────
   GET /api/chat/conversations  (NHÂN VIÊN / ADMIN)
   - Nhân viên chi nhánh: chỉ thấy hội thoại của chi nhánh mình.
   - Admin/owner (global): thấy tất cả, hoặc lọc theo ?store_id=X.
───────────────────────────────────────────────────────────────────────── */
router.get("/conversations", verifyToken, storeContext, async (req, res) => {
  try {
    // Role quản lý không truy cập chat khách hàng
    if (NON_CHAT_ROLES.includes(req.user.role)) {
      return res.status(403).json({ error: "Vai trò này không sử dụng chat khách hàng." });
    }
    // storeContext: global viewer → req.storeId = null (tất cả) hoặc X nếu có ?store_id.
    //               nhân viên CN  → req.storeId = store của họ.
    let filter = {};
    if (req.isGlobalViewer) {
      if (req.storeId != null) filter = { storeId: req.storeId };
      // else: không lọc — thấy tất cả (gồm cả kênh chung storeId=null)
    } else {
      filter = { storeId: req.storeId ?? null };
    }

    const allConvs = await Conversation.find(filter)
      .sort({ updatedAt: -1 })
      .select("-__v");

    // Enrich tên khách từ Postgres theo SĐT
    const phones = allConvs.map((c) => c.phone).filter(Boolean);
    const pgUsers = phones.length
      ? await prisma.user.findMany({
          where: { phone: { in: phones } },
          select: { phone: true, fullName: true, email: true, avatar: true, role: true },
        })
      : [];
    const pgMap = {};
    pgUsers.forEach((u) => { pgMap[u.phone] = u; });

    // Chỉ tập trung cho KHÁCH HÀNG: loại hội thoại thuộc tài khoản nội bộ (mọi role NV).
    const conversations = allConvs.filter(
      (c) => !STAFF_ROLES.includes(pgMap[c.phone]?.role)
    );

    // Tên chi nhánh
    const storeNameMap = await getStoreNameMap(conversations.map((c) => c.storeId));

    // Đếm tin chưa đọc (tin của khách) theo conversation
    const unreadCounts = await Message.aggregate([
      { $match: { senderType: "client", read: false } },
      { $group: { _id: "$conversationId", count: { $sum: 1 } } },
    ]);
    const unreadMap = {};
    unreadCounts.forEach((r) => { unreadMap[r._id.toString()] = r.count; });

    const enriched = conversations.map((conv) => {
      const pg = pgMap[conv.phone];
      const obj = conv.toObject();
      return {
        ...obj,
        clientName: pg?.fullName && pg.fullName !== "Null" ? pg.fullName : obj.clientName,
        email: pg?.email || null,
        avatar: pg?.avatar || null,
        storeName: obj.storeId != null ? (storeNameMap[obj.storeId] || "Chi nhánh") : GENERAL_LABEL,
        unread: unreadMap[obj._id.toString()] || 0,
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error("[chat/conversations]", err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// GET /api/chat/history/:conversationId -> Lấy lịch sử tin nhắn
router.get("/history/:conversationId", async (req, res) => {
  try {
    const messages = await Message.find({ conversationId: req.params.conversationId })
      .sort({ createdAt: 1 })
      .limit(50);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "Lỗi server." });
  }
});

// PUT /api/chat/client-seen/:conversationId -> KHÁCH đã xem hội thoại (đặt mốc đã đọc)
router.put("/client-seen/:conversationId", async (req, res) => {
  try {
    await Conversation.findByIdAndUpdate(req.params.conversationId, {
      clientLastSeenAt: new Date(),
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Lỗi server." });
  }
});

// PUT /api/chat/read/:conversationId -> Đánh dấu tin của khách là đã đọc
router.put("/read/:conversationId", async (req, res) => {
  try {
    await Message.updateMany(
      { conversationId: req.params.conversationId, senderType: "client", read: false },
      { $set: { read: true } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Lỗi server." });
  }
});

module.exports = router;
