const express = require("express");
// THAY ĐỔI: Import Prisma
const prisma = require("../lib/prisma");
const fs = require("fs");
const path = require("path");
const net = require("net");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

// ── TCP probe: kiểm tra camera có thực sự online không ──────────────────────
// Kết nối TCP tới IP:port của RTSP URL (mặc định port 554).
// Timeout 3s → nếu camera mất điện / mất mạng sẽ phát hiện được.
function probeCameraOnline(rtspUrl, timeoutMs = 3000) {
  return new Promise((resolve) => {
    try {
      // rtsp://user:pass@192.168.1.100:554/path  hoặc  rtsp://192.168.1.100/path
      const match = rtspUrl.match(/rtsp:\/\/(?:[^@]+@)?([^/:]+)(?::(\d+))?/i);
      if (!match) return resolve(false);
      const host = match[1];
      const port = parseInt(match[2] || "554", 10);

      const socket = new net.Socket();
      let done = false;

      const finish = (online) => {
        if (!done) {
          done = true;
          socket.destroy();
          resolve(online);
        }
      };

      socket.setTimeout(timeoutMs);
      socket.once("connect", () => finish(true));
      socket.once("timeout", () => finish(false));
      socket.once("error",   () => finish(false));
      socket.connect(port, host);
    } catch {
      resolve(false);
    }
  });
}

const YAML_PATH = path.join(__dirname, "../../go2rtc.yaml");
const GO2RTC_API = process.env.GO2RTC_API_URL || "http://meocare_go2rtc:1984";

// Ghi yaml để persist qua restart, + gọi REST API để hot-reload không cần restart container
const syncToGo2RTC = async () => {
  try {
    const cameras = await prisma.camera.findMany({
      where: { rtsp_url: { not: null } },
      select: { id: true, rtsp_url: true, rtsp_sub_url: true }
    });

    // Live view ưu tiên sub-stream (H.264) — main (H.265) dành cho ffmpeg ghi NAS
    const liveUrl = (c) => c.rtsp_sub_url || c.rtsp_url;

    // 1) Ghi file yaml (để go2rtc khôi phục đúng streams sau khi restart)
    let yamlContent = "streams:\n";
    cameras.forEach(c => {
      yamlContent += `  cam_${c.id}: ${liveUrl(c)}\n`;
    });
    yamlContent += `\napi:\n  origin: "*"\n\nwebrtc:\n  listen: ":8555"\n`;
    fs.writeFileSync(YAML_PATH, yamlContent, 'utf8');

    // 2) Hot-sync qua REST API: lấy streams hiện tại, xoá cái thừa, add/update cái mới
    try {
      const listRes = await fetch(`${GO2RTC_API}/api/streams`);
      const current = listRes.ok ? await listRes.json() : {};
      const wantedNames = new Set(cameras.map(c => `cam_${c.id}`));

      // Xoá stream không còn trong DB
      for (const name of Object.keys(current)) {
        if (name.startsWith("cam_") && !wantedNames.has(name)) {
          await fetch(`${GO2RTC_API}/api/streams?src=${encodeURIComponent(name)}`, { method: "DELETE" });
        }
      }

      // Add / update từng camera (live view dùng sub-stream nếu có)
      for (const c of cameras) {
        const name = `cam_${c.id}`;
        const url  = `${GO2RTC_API}/api/streams?name=${encodeURIComponent(name)}&src=${encodeURIComponent(liveUrl(c))}`;
        await fetch(url, { method: "PUT" });
      }
      console.log("✅ Đã sync streams qua go2rtc REST API.");
    } catch (apiErr) {
      console.warn("⚠ Không gọi được go2rtc REST API (file yaml vẫn được ghi):", apiErr.message);
    }
  } catch (err) {
    console.error("❌ Lỗi sync go2RTC:", err.message);
  }
};

// ================== LIVE STATUS — TCP probe mỗi camera ==================
// GET /api/cameras/live-status
// Trả về: { success: true, data: { "1": true, "2": false, ... } }
router.get("/live-status", verifyToken, async (req, res) => {
  try {
    const cameras = await prisma.camera.findMany({
      select: { id: true, rtsp_url: true }
    });

    // Probe tất cả song song (Promise.all) để giảm thời gian chờ
    const results = await Promise.all(
      cameras.map(async (cam) => {
        if (!cam.rtsp_url) return { id: cam.id, online: false };
        const online = await probeCameraOnline(cam.rtsp_url);
        return { id: cam.id, online };
      })
    );

    const statusMap = {};
    results.forEach(({ id, online }) => { statusMap[id] = online; });

    res.json({ success: true, data: statusMap });
  } catch (err) {
    console.error("live-status error:", err);
    res.status(500).json({ success: false, error: "Lỗi kiểm tra trạng thái camera." });
  }
});

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

    const { name, room_id, rtsp_url, rtsp_sub_url } = req.body;

    if (!name || !room_id || !rtsp_url) {
      return res.status(400).json({ error: "Thiếu thông tin." });
    }

    await prisma.camera.create({
      data: {
        name,
        room_id,
        rtsp_url,
        rtsp_sub_url: rtsp_sub_url || null
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

    const { name, room_id, rtsp_url, rtsp_sub_url, status } = req.body;
    const { id } = req.params;

    await prisma.camera.update({
      where: { id: parseInt(id) },
      data: { name, room_id, rtsp_url, rtsp_sub_url: rtsp_sub_url ?? null, status }
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