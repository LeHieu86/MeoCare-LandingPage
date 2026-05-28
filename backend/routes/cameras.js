const express = require("express");
// THAY ĐỔI: Import Prisma
const prisma = require("../lib/prisma");
const fs = require("fs");
const path = require("path");
const net = require("net");
const crypto = require("crypto");
const { verifyToken } = require("../middleware/auth");
const { storeContext } = require("../middleware/storeContext");
const { storeWhere, injectStoreId } = require("../lib/storeFilter");

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
router.get("/live-status", verifyToken, storeContext, async (req, res) => {
  try {
    const cameras = await prisma.camera.findMany({
      where: storeWhere(req),
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

// ── HTTP PUT với Digest / Basic auth (dùng cho Hikvision ISAPI) ─────────────
// Camera Hikvision thường dùng Digest MD5, nhưng một số model cũ dùng Basic.
// Hàm này thử không auth → nếu 401 parse WWW-Authenticate → gửi Digest → nếu không có
// realm/nonce thì fallback Basic.
async function httpPutWithAuth(host, urlPath, username, password, body) {
  const url = `http://${host}${urlPath}`;
  const commonHeaders = { "Content-Type": "application/xml" };
  const signal = AbortSignal.timeout(8000);

  // Lần 1: không auth (một số camera nội bộ không cần)
  let res = await fetch(url, { method: "PUT", headers: commonHeaders, body, signal });
  if (res.status !== 401) return res;

  // 401 — đọc WWW-Authenticate
  const wwwAuth = res.headers.get("www-authenticate") || "";
  const realm   = (wwwAuth.match(/realm="([^"]+)"/)  || [])[1];
  const nonce   = (wwwAuth.match(/nonce="([^"]+)"/)  || [])[1];
  const opaque  = (wwwAuth.match(/opaque="([^"]+)"/) || [])[1];
  const hasQop  = /qop="?auth"?/i.test(wwwAuth);

  if (!realm || !nonce) {
    // Không có Digest info → thử Basic
    const b64 = Buffer.from(`${username}:${password}`).toString("base64");
    return fetch(url, {
      method: "PUT",
      headers: { ...commonHeaders, Authorization: `Basic ${b64}` },
      body,
      signal: AbortSignal.timeout(8000),
    });
  }

  // Digest MD5
  const nc     = "00000001";
  const cnonce = crypto.randomBytes(8).toString("hex");
  const ha1 = crypto.createHash("md5").update(`${username}:${realm}:${password}`).digest("hex");
  const ha2 = crypto.createHash("md5").update(`PUT:${urlPath}`).digest("hex");
  const responseHash = hasQop
    ? crypto.createHash("md5").update(`${ha1}:${nonce}:${nc}:${cnonce}:auth:${ha2}`).digest("hex")
    : crypto.createHash("md5").update(`${ha1}:${nonce}:${ha2}`).digest("hex");

  let authHeader =
    `Digest username="${username}", realm="${realm}", nonce="${nonce}", ` +
    `uri="${urlPath}", response="${responseHash}"`;
  if (hasQop) authHeader += `, qop=auth, nc=${nc}, cnonce="${cnonce}"`;
  if (opaque) authHeader += `, opaque="${opaque}"`;

  return fetch(url, {
    method: "PUT",
    headers: { ...commonHeaders, Authorization: authHeader },
    body,
    signal: AbortSignal.timeout(8000),
  });
}

// ── Helper chung: sync giờ một camera ───────────────────────────────────────
// Trả về { success, message?, error?, localTime? }
async function syncOneCameraTime(cam) {
  if (!cam.rtsp_url) return { success: false, error: "Camera chưa có RTSP URL." };

  const m = cam.rtsp_url.match(/rtsp:\/\/([^:@]+):([^@]+)@([^/:]+)(?::(\d+))?/i);
  if (!m) return { success: false, error: "RTSP URL không hợp lệ (cần user:pass@host)." };
  const [, username, password, host] = m;

  // Giờ Việt Nam (UTC+7) — tính thủ công để không phụ thuộc TZ process
  const pad    = (n) => String(n).padStart(2, "0");
  const vn     = new Date(Date.now() + 7 * 3_600_000);
  const localTime =
    `${vn.getUTCFullYear()}-${pad(vn.getUTCMonth() + 1)}-${pad(vn.getUTCDate())}T` +
    `${pad(vn.getUTCHours())}:${pad(vn.getUTCMinutes())}:${pad(vn.getUTCSeconds())}+07:00`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Time version="2.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
  <timeMode>manual</timeMode>
  <localTime>${localTime}</localTime>
  <timeZone>CST-7:00:00</timeZone>
</Time>`;

  try {
    const apiRes = await httpPutWithAuth(host, "/ISAPI/System/time", username, password, xml);
    if (apiRes.ok || apiRes.status === 200) {
      console.log(`✅ Sync time cam ${cam.id} (${host}) → ${localTime}`);
      return { success: true, message: `Đồng bộ thành công → ${localTime}`, localTime };
    }
    const text = await apiRes.text().catch(() => "");
    console.error(`❌ Sync time cam ${cam.id}: HTTP ${apiRes.status}`, text.slice(0, 200));
    return { success: false, error: `HTTP ${apiRes.status} — kiểm tra user/pass trong RTSP URL.` };
  } catch (err) {
    const isNetErr = ["TimeoutError", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT"].some(
      (t) => err.name === t || err.code === t
    );
    return { success: false, error: isNetErr ? "Không kết nối được (timeout/refused)." : err.message };
  }
}

// POST /api/cameras/sync-all-time — sync giờ tất cả camera có RTSP URL
router.post("/sync-all-time", verifyToken, storeContext, async (req, res) => {
  if (!["admin"].includes(req.user.role))
    return res.status(403).json({ error: "Không có quyền." });
  try {
    const all = await prisma.camera.findMany({
      where: storeWhere(req),
      select: { id: true, name: true, rtsp_url: true },
    });
    const cameras = all.filter((c) => c.rtsp_url && c.rtsp_url.trim() !== "");

    if (cameras.length === 0) {
      return res.json({ success: true, total: 0, synced: 0, failed: 0, results: [] });
    }

    const results = await Promise.all(
      cameras.map(async (cam) => {
        try {
          const r = await syncOneCameraTime(cam);
          return { id: cam.id, name: cam.name, ...r };
        } catch (err) {
          console.error(`[sync-time] ${cam.name}: ${err.message}`);
          return { id: cam.id, name: cam.name, success: false, error: err.message ?? "Timeout" };
        }
      })
    );

    const synced = results.filter((r) => r.success).length;
    const failed  = results.length - synced;
    console.log(`📡 Sync all time: ${synced}/${results.length} thành công.`);
    res.json({ success: true, total: results.length, synced, failed, results });
  } catch (err) {
    console.error("sync-all-time error:", err);
    res.status(500).json({ success: false, error: "Lỗi server." });
  }
});

// ================== GET CAMERAS (admin) ==================
router.get("/", verifyToken, storeContext, async (req, res) => {
  try {
    const { room_id } = req.query;
    const cameras = await prisma.camera.findMany({
      where: {
        ...storeWhere(req),
        ...(room_id ? { room_id } : {}),
      },
      orderBy: { created_at: "desc" }
    });

    res.json(cameras);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server." });
  }
});

// ================== CREATE CAMERA (admin) ==================
router.post("/", verifyToken, storeContext, async (req, res) => {
  try {
    if (!["admin"].includes(req.user.role)) {
      return res.status(403).json({ error: "Không có quyền." });
    }

    const { name, room_id, rtsp_url, rtsp_sub_url } = req.body;

    if (!name || !room_id || !rtsp_url) {
      return res.status(400).json({ error: "Thiếu thông tin." });
    }

    await prisma.camera.create({
      data: {
        ...injectStoreId(req),
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
router.put("/:id", verifyToken, storeContext, async (req, res) => {
  try {
    if (!["admin"].includes(req.user.role)) {
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
router.delete("/:id", verifyToken, storeContext, async (req, res) => {
  try {
    if (!["admin"].includes(req.user.role)) {
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