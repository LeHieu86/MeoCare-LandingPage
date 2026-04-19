const express = require("express");
// THAY ĐỔI: Import Prisma
const prisma = require("../lib/prisma");
const fs = require("fs"); 
const path = require("path"); 
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

const YAML_PATH = path.join(__dirname, "../go2rtc.yaml");

// ================= HÀM BỘ PHỤ: GHI LINK VÀO FILE YAML =================
// THAY ĐỔI: Thêm async vào hàm này
const syncToGo2RTC = async () => {
  try {
    // THAY ĐỔI: Truy vấn bằng Prisma
    const cameras = await prisma.camera.findMany({
      where: { rtsp_url: { not: null } }, // Thay vì IS NOT NULL
      select: { id: true, rtsp_url: true } // Chỉ lấy 2 cột này cho nhanh
    });
    
    let yamlContent = "streams:\n";
    cameras.forEach(c => {
      yamlContent += `  cam_${c.id}: ${c.rtsp_url}\n`;
    });
    
    fs.writeFileSync(YAML_PATH, yamlContent, 'utf8');
    console.log("✅ Đã cập nhật file go2rtc.yaml thành công!");
  } catch (err) {
    console.error("❌ Lỗi ghi file go2RTC:", err.message);
  }
};

// ================== GET CAMERAS (admin) ==================
router.get("/", verifyToken, async (req, res) => {
  try {
    const { room_id } = req.query;
    
    // THAY ĐỔI: Dùng findMany với điều kiện động
    const cameras = await prisma.camera.findMany({
      where: room_id ? { room_id } : undefined, // Nếu có room_id thì tìm, không thì lấy hết
      orderBy: { created_at: "desc" }
    });

    res.json(cameras);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== CREATE CAMERA (admin) ==================
router.post("/", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Không có quyền." });
    }

    const { name, room_id, rtsp_url } = req.body;

    if (!name || !room_id || !rtsp_url) {
      return res.status(400).json({ error: "Thiếu thông tin." });
    }

    // THAY ĐỔI: Dùng create
    await prisma.camera.create({
      data: {
        name,
        room_id,
        rtsp_url
        // created_at và status đã có default trong Prisma Schema rồi
      }
    });

    // THAY ĐỔI: Bắt buộc thêm await
    await syncToGo2RTC();

    res.json({ message: "Thêm camera thành công." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== UPDATE CAMERA (admin) ==================
router.put("/:id", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Không có quyền." });
    }

    const { name, room_id, rtsp_url, status } = req.body;
    const { id } = req.params;

    // THAY ĐỔI: Dùng update, LƯU Ý parseInt vì id trong Prisma là Int
    await prisma.camera.update({
      where: { id: parseInt(id) },
      data: { name, room_id, rtsp_url, status }
    });

    // THAY ĐỔI: Bắt buộc thêm await
    await syncToGo2RTC();

    res.json({ message: "Cập nhật camera thành công." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== DELETE CAMERA (admin) ==================
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Không có quyền." });
    }

    const { id } = req.params;

    // THAY ĐỔI: Dùng delete
    await prisma.camera.delete({
      where: { id: parseInt(id) }
    });

    // THAY ĐỔI: Bắt buộc thêm await
    await syncToGo2RTC();

    res.json({ message: "Xoá camera thành công." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

module.exports = router;