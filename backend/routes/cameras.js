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

// ══════════════════════════════════════════════════════════════════════════
// GHÉP RTSP URL THEO HÃNG — nhập IP/user/pass + chọn hãng, hết gõ tay sai đường dẫn.
// Thêm hãng mới sau này = thêm 1 dòng vào bảng dưới, KHÔNG đụng app.
// ══════════════════════════════════════════════════════════════════════════
// Mỗi hãng: (channel, stream) → phần đường dẫn sau host. stream: 'main' | 'sub'.
const RTSP_TEMPLATES = {
  hikvision: {
    label: "Hikvision",
    // Hikvision: /Streaming/Channels/<channel*100 + streamType>. Kênh 1 → 101 (main), 102 (sub).
    path: (ch, stream) => `/Streaming/Channels/${ch * 100 + (stream === "sub" ? 2 : 1)}`,
  },
  dahua: {
    label: "Dahua",
    // Dahua (và OEM Amcrest): subtype=0 main, 1 sub.
    path: (ch, stream) => `/cam/realmonitor?channel=${ch}&subtype=${stream === "sub" ? 1 : 0}`,
  },
};

const isKnownBrand = (b) => Object.prototype.hasOwnProperty.call(RTSP_TEMPLATES, b);

/**
 * Từ body request → các cột lưu vào DB.
 * - Chọn hãng (brand ∈ RTSP_TEMPLATES): backend ghép rtsp_url/sub + lưu thành phần.
 * - Nhập tay (brand 'manual'/trống): dùng rtsp_url/rtsp_sub_url gửi lên, thành phần = null.
 * Ném lỗi (message tiếng Việt) nếu thiếu dữ liệu → handler trả 400.
 */
function resolveCameraUrls(body) {
  const { brand } = body;
  if (isKnownBrand(brand)) {
    const { main, sub } = buildRtspUrls({
      brand, host: body.cam_host, user: body.cam_user, pass: body.cam_pass,
      port: body.cam_port, channel: body.cam_channel,
    });
    return {
      brand,
      cam_host: (body.cam_host || "").trim(),
      cam_user: (body.cam_user || "").trim() || null,
      cam_pass: body.cam_pass || null,
      cam_port: parseInt(body.cam_port, 10) || 554,
      cam_channel: parseInt(body.cam_channel, 10) || 1,
      rtsp_url: main,
      rtsp_sub_url: sub,   // Hikvision/Dahua đều có sub riêng
    };
  }
  // Nhập tay
  const rtsp_url = (body.rtsp_url || "").trim();
  if (!rtsp_url) throw new Error("Thiếu RTSP URL (hoặc chọn hãng để tự ghép).");
  return {
    brand: "manual",
    cam_host: null, cam_user: null, cam_pass: null, cam_port: null, cam_channel: null,
    rtsp_url,
    rtsp_sub_url: (body.rtsp_sub_url || "").trim() || null,
  };
}

/**
 * Ghép rtsp_url (main) + rtsp_sub_url (sub) từ thành phần kết nối.
 * user/pass được ENCODE để mật khẩu có ký tự đặc biệt (@ : / ...) không làm hỏng URL.
 * Trả { main, sub } hoặc ném lỗi nếu thiếu trường / hãng lạ.
 */
function buildRtspUrls({ brand, host, user, pass, port, channel }) {
  const tpl = RTSP_TEMPLATES[brand];
  if (!tpl) throw new Error(`Hãng camera không hỗ trợ tự ghép: ${brand}`);
  host = (host || "").trim();
  if (!host) throw new Error("Thiếu IP/host camera.");
  const p = parseInt(port, 10) || 554;
  const ch = parseInt(channel, 10) || 1;
  const cred = user ? `${encodeURIComponent(user)}:${encodeURIComponent(pass || "")}@` : "";
  const base = `rtsp://${cred}${host}:${p}`;
  return { main: base + tpl.path(ch, "main"), sub: base + tpl.path(ch, "sub") };
}

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
      // rtsp_url là non-nullable → "not: null" không hợp lệ. Loại rtsp rỗng cho chắc.
      where: { rtsp_url: { not: '' } },
      select: { id: true, stream_key: true, rtsp_url: true, rtsp_sub_url: true }
    });

    // Live view ưu tiên sub-stream (H.264) — main (H.265) dành cho ffmpeg ghi NAS
    const liveUrl = (c) => c.rtsp_sub_url || c.rtsp_url;
    // Tên stream go2rtc = cam_<stream_key bí mật> (không dùng id tuần tự — chống đoán)
    const streamName = (c) => `cam_${c.stream_key}`;

    // 1) Ghi file yaml (để go2rtc khôi phục đúng streams sau khi restart)
    let yamlContent = "streams:\n";
    cameras.forEach(c => {
      yamlContent += `  ${streamName(c)}: ${liveUrl(c)}\n`;
    });
    yamlContent += `\napi:\n  origin: "*"\n\nwebrtc:\n  listen: ":8555"\n`;
    fs.writeFileSync(YAML_PATH, yamlContent, 'utf8');

    // 2) Hot-sync qua REST API: lấy streams hiện tại, xoá cái thừa, add/update cái mới
    try {
      const listRes = await fetch(`${GO2RTC_API}/api/streams`);
      const current = listRes.ok ? await listRes.json() : {};
      const wantedNames = new Set(cameras.map(streamName));

      // Xoá stream không còn trong DB
      for (const name of Object.keys(current)) {
        if (name.startsWith("cam_") && !wantedNames.has(name)) {
          await fetch(`${GO2RTC_API}/api/streams?src=${encodeURIComponent(name)}`, { method: "DELETE" });
        }
      }

      // Add / update từng camera (live view dùng sub-stream nếu có)
      for (const c of cameras) {
        const name = streamName(c);
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
  // Sync giờ là thao tác bảo trì camera — admin + manager (manager bị giới hạn theo
  // storeContext nên chỉ ảnh hưởng camera chi nhánh mình).
  if (!["admin", "manager"].includes(req.user.role))
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

// ================== DANH SÁCH HÃNG hỗ trợ tự ghép URL ==================
// App đọc để đổ dropdown "Loại camera" — thêm hãng ở backend là app tự có, không cần cập nhật.
router.get("/brands", verifyToken, (_req, res) => {
  const brands = Object.entries(RTSP_TEMPLATES).map(([value, t]) => ({ value, label: t.label }));
  brands.push({ value: "manual", label: "Khác (nhập RTSP thủ công)" });
  res.json({ success: true, brands });
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

    // Gắn IP Tailscale của chi nhánh vào mỗi camera → app xem live qua go2rtc tailnet
    // (rtsp://<ip>:8554/cam_<key>). Quản lý IP ở phần Chi nhánh (Store.tailscaleIp).
    // null = chưa cấu hình → app dùng RTSP trực tiếp.
    const storeIds = [...new Set(cameras.map(c => c.store_id))];
    const stores = storeIds.length
      ? await prisma.store.findMany({
          where: { id: { in: storeIds } },
          select: { id: true, tailscaleIp: true },
        })
      : [];
    const hostByStore = Object.fromEntries(stores.map(s => [s.id, s.tailscaleIp]));
    const out = cameras.map(c => ({ ...c, tailnet_host: hostByStore[c.store_id] || null }));

    res.json(out);
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

    const { name, room_id } = req.body;
    if (!name) return res.status(400).json({ error: "Thiếu tên camera." });

    let camFields;
    try {
      camFields = resolveCameraUrls(req.body);   // ghép từ hãng, hoặc lấy URL nhập tay
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    await prisma.camera.create({
      data: { ...injectStoreId(req), name, room_id: room_id || null, ...camFields },
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

    const { name, room_id, status } = req.body;
    const { id } = req.params;

    let camFields;
    try {
      camFields = resolveCameraUrls(req.body);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    await prisma.camera.update({
      where: { id: parseInt(id) },
      data: { name, room_id: room_id || null, status, ...camFields },
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
// Cho server.js gọi lúc khởi động: đảm bảo go2rtc LUÔN khớp DB, không cần ai sửa camera
// để kích hoạt đồng bộ. Chống lỗi "sửa đúng URL trong app rồi mà vẫn không lên hình".
module.exports.syncToGo2RTC = syncToGo2RTC;
// Xuất để test (không dùng trong luồng app).
module.exports.__test = { buildRtspUrls, resolveCameraUrls };