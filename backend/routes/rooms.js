const express = require("express");
// THAY ĐỔI: Import Prisma
const prisma = require("../lib/prisma");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

// ================== GET ALL ROOMS (admin) ==================
router.get("/", verifyToken, async (req, res) => {
  try {
    const rooms = await prisma.room.findMany({
      orderBy: { created_at: "desc" }
    });
    res.json(rooms);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== GET AVAILABLE ROOMS (public) ==================
router.get("/available", async (req, res) => {
  try {
    const { check_in, check_out } = req.query;

    // Khởi tạo điều kiện tìm kiếm cơ bản: Phòng đang trống
    const whereCondition = { status: "empty" };

    // Nếu có ngày nhận/trả, thêm điều kiện loại trừ các phòng đã bị đặt
    if (check_in && check_out) {
      whereCondition.NOT = {
        bookings: {
          some: {
            status: { in: ["pending", "active"] },
            room_id: { not: null },
            check_in: { lt: check_out },
            check_out: { gt: check_in }
          }
        }
      };
    }

    const rooms = await prisma.room.findMany({
      where: whereCondition,
      orderBy: { id: "asc" }
    });

    res.json(rooms);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== CREATE ROOM (admin) ==================
router.post("/", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Không có quyền." });
    }

    const { id, name, status = "empty", camera_id = null } = req.body;

    if (!id || !name) {
      return res.status(400).json({ error: "Thiếu thông tin." });
    }

    // Kiểm tra ID phòng đã tồn tại chưa (Vì id là String nên dùng findUnique)
    const exist = await prisma.room.findUnique({ where: { id } });
    if (exist) {
      return res.status(400).json({ error: "ID phòng đã tồn tại." });
    }

    // Tạo phòng mới (Truyền thẳng id vào, không cần nextId như SQLite)
    await prisma.room.create({
      data: {
        id, // id là String do bạn tự quy định (VD: "A01")
        name,
        status,
        camera_id: camera_id || null
        // created_at và updated_at đã có default trong Schema
      }
    });

    res.json({ message: "Tạo phòng thành công." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== UPDATE ROOM (admin) ==================
router.put("/:id", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Không có quyền." });
    }

    const { name, status, camera_id } = req.body;
    const { id } = req.params; // id là String, KHÔNG CẦN parseInt

    await prisma.room.update({
      where: { id },
      data: {
        name,
        status,
        camera_id: camera_id || null
        // KHÔNG CẦN updated_at: datetime('now')
        // Vì Prisma có cờ @updatedAt sẽ tự động cập nhật thời gian mỗi khi chạy hàm update()
      }
    });

    res.json({ message: "Cập nhật thành công." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== DELETE ROOM (admin) ==================
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Không có quyền." });
    }

    const { id } = req.params;

    // ✨ CASCADE DELETE (Xóa thác mục)
    // Vì trong Schema, các bảng Bookings, Cameras, Services đều có:
    // room Room @relation(fields: [room_id], references: [id], onDelete: Cascade)
    // Nên chỉ cần 1 lệnh delete này, Postgres sẽ tự động xóa toàn bộ 
    // lịch sử đặt phòng, camera, dịch vụ liên quan đến phòng này!
    await prisma.room.delete({
      where: { id }
    });

    res.json({ message: "Xoá phòng thành công." });
  } catch (err) {
    // Nếu lỗi có thể do còn ràng buộc (dù đã set Cascade, bắt lỗi để UI hiện thông báo đẹp hơn)
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

module.exports = router;