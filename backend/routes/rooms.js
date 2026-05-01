const express = require("express");
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

// ================== GET AVAILABLE ROOMS (for admin modal) ==================
router.get("/available", async (req, res) => {
  try {
    /* ── Chỉ lọc phòng KHÔNG bị occupied ──
       Phòng chỉ chuyển "occupied" khi admin nhận mèo (active).
       Booking pending KHÔNG khóa phòng → admin tự quyết định. */
    const rooms = await prisma.room.findMany({
      where: {
        status: { not: "occupied" }
      },
      select: { id: true, name: true, status: true },
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

    const exist = await prisma.room.findUnique({ where: { id } });
    if (exist) {
      return res.status(400).json({ error: "ID phòng đã tồn tại." });
    }

    await prisma.room.create({
      data: {
        id,
        name,
        status,
        camera_id: camera_id || null
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
    const { id } = req.params;

    await prisma.room.update({
      where: { id },
      data: {
        name,
        status,
        camera_id: camera_id || null
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

    await prisma.room.delete({
      where: { id }
    });

    res.json({ message: "Xoá phòng thành công." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

module.exports = router;