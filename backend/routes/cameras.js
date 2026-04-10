const express = require("express");
const db = require("../db/database");
const fs = require("fs"); // Thư viện để ghi file
const path = require("path"); // Thư viện xử lý đường dẫn
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

// Đường dẫn chính xác tới file go2rtc.yaml (nằm cùng cấp với server.js)
const YAML_PATH = path.join(__dirname, "../go2rtc.yaml");

// ================= HÀM BỘ PHỤ: GHI LINK VÀO FILE YAML =================
const syncToGo2RTC = () => {
  try {
    // 1. Lấy TẤT CẢ camera đang có trong DB
    const cameras = db.prepare("SELECT id, rtsp_url FROM cameras WHERE rtsp_url IS NOT NULL").all();
    
    // 2. Tạo nội dung YAML mới
    let yamlContent = "streams:\n";
    cameras.forEach(c => {
      yamlContent += `  cam_${c.id}: ${c.rtsp_url}\n`;
    });
    
    // 3. Ghi đè vào file go2rtc.yaml (Go2RTC sẽ tự động reload)
    fs.writeFileSync(YAML_PATH, yamlContent, 'utf8');
    
    console.log("✅ Đã cập nhật file go2rtc.yaml thành công!");
  } catch (err) {
    console.error("❌ Lỗi ghi file go2RTC:", err.message);
  }
};

// ================== GET CAMERAS (admin) ==================
router.get("/", verifyToken, (req, res) => {
  try {
    const { room_id } = req.query;
    let cameras;

    if (room_id) {
      cameras = db.prepare("SELECT * FROM cameras WHERE room_id = ?").all(room_id);
    } else {
      cameras = db.prepare("SELECT * FROM cameras ORDER BY created_at DESC").all();
    }

    res.json(cameras);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== CREATE CAMERA (admin) ==================
router.post("/", verifyToken, (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Không có quyền." });
    }

    const { name, room_id, rtsp_url } = req.body;

    if (!name || !room_id || !rtsp_url) {
      return res.status(400).json({ error: "Thiếu thông tin." });
    }

    db.prepare(`
      INSERT INTO cameras (name, room_id, rtsp_url, created_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `).run(name, room_id, rtsp_url);

    // Ghi vào file YAML
    syncToGo2RTC();

    res.json({ message: "Thêm camera thành công." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== UPDATE CAMERA (admin) ==================
router.put("/:id", verifyToken, (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Không có quyền." });
    }

    const { name, room_id, rtsp_url, status } = req.body;
    const { id } = req.params;

    db.prepare(`
      UPDATE cameras
      SET name = ?, room_id = ?, rtsp_url = ?, status = ?
      WHERE id = ?
    `).run(name, room_id, rtsp_url, status, id);

    // Ghi vào file YAML
    syncToGo2RTC();

    res.json({ message: "Cập nhật camera thành công." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== DELETE CAMERA (admin) ==================
router.delete("/:id", verifyToken, (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Không có quyền." });
    }

    const { id } = req.params;

    db.prepare("DELETE FROM cameras WHERE id = ?").run(id);

    // Ghi vào file YAML (Xóa camera trong DB thì file YAML cũng sẽ không còn dòng đó)
    syncToGo2RTC();

    res.json({ message: "Xoá camera thành công." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

module.exports = router;
