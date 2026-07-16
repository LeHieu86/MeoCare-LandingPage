/**
 * tailscale.js — Trạng thái LIVE của máy chi nhánh trên Tailscale.
 *
 * Vì sao: Store.tailscaleIp chỉ là ô text admin gõ vào — không ai biết máy đó còn online
 * hay đã rớt. Hỏi thẳng Tailscale API cho ra ĐÚNG chấm xanh trong admin console Tailscale
 * (nguồn sự thật). Khác hẳn heartbeat của edge-agent (nas.js): heartbeat đi từ chi nhánh
 * qua internet ra trung tâm, nên Tailscale rớt mà mạng thường còn thì heartbeat VẪN xanh
 * trong khi xem camera đã hỏng — đúng cái ca cần phát hiện.
 *
 * Cấu hình .env (xem .env.example). Thiếu → tắt hẳn, không ảnh hưởng gì.
 *
 * An toàn: mọi lỗi mạng đều nuốt và giữ lại snapshot tốt gần nhất → API Tailscale chớp
 * tắt không làm cả trang chi nhánh chuyển xám, và KHÔNG bao giờ làm vỡ GET /api/stores.
 */
const API = "https://api.tailscale.com/api/v2";

// '-' = tailnet mặc định của credential — hầu hết trường hợp không cần đổi.
const TAILNET      = process.env.TAILSCALE_TAILNET || "-";
const OAUTH_ID     = process.env.TAILSCALE_OAUTH_CLIENT_ID;
const OAUTH_SECRET = process.env.TAILSCALE_OAUTH_CLIENT_SECRET;
const API_KEY      = process.env.TAILSCALE_API_KEY;
// 15s: độ trễ thấy được của chấm live = TTL này + chu kỳ poll của app (CỘNG dồn, vì
// app có thể hỏi ngay sau khi cache vừa làm mới) → 15+15 ≈ 30s worst case.
const CACHE_TTL_MS = parseInt(process.env.TAILSCALE_CACHE_TTL_MS || "15000", 10);
// Gọi API hỏng liên tục quá ngưỡng này → coi như MÙ, trả "không rõ" thay vì tiếp tục
// khẳng định trạng thái cũ. Phải > CACHE_TTL_MS vài lần để chịu được blip mạng ngắn.
const STALE_MAX_MS = parseInt(process.env.TAILSCALE_STALE_MAX_MS || "60000", 10);

/** Đã cấu hình credential chưa. Chưa → getStatus() luôn trả null (UI không vẽ chấm). */
const isEnabled = () => !!(API_KEY || (OAUTH_ID && OAUTH_SECRET));

// ── Token ────────────────────────────────────────────────────────────────────
let _token = null; // { value, expires }

/**
 * Bearer token để gọi API. API key dùng thẳng; OAuth thì đổi client_credentials lấy
 * access token (sống 1 tiếng) rồi giữ lại trong RAM.
 */
async function getToken() {
  if (API_KEY) return API_KEY;
  if (_token && _token.expires > Date.now()) return _token.value;

  const res = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: OAUTH_ID, client_secret: OAUTH_SECRET }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`OAuth token lỗi ${res.status}`);

  const json = await res.json();
  if (!json.access_token) throw new Error("OAuth không trả access_token");
  // Trừ hao 60s để không lỡ dùng trúng token vừa hết hạn giữa chừng.
  _token = {
    value: json.access_token,
    expires: Date.now() + (json.expires_in ?? 3600) * 1000 - 60_000,
  };
  return _token.value;
}

// ── Danh sách thiết bị ───────────────────────────────────────────────────────

/**
 * Mọi cách gọi tên một máy — IP v4/v6, MagicDNS đầy đủ, tên máy, và nhãn đầu của
 * MagicDNS. Admin gõ kiểu nào vào ô "IP Tailscale" cũng khớp được.
 */
function keysOf(device) {
  const keys = [...(device.addresses || []), device.name, device.hostname];
  if (device.name?.includes(".")) keys.push(device.name.split(".")[0]);
  return keys.filter(Boolean).map((k) => k.toLowerCase());
}

async function fetchDevices() {
  const token = await getToken();
  const res = await fetch(`${API}/tailnet/${encodeURIComponent(TAILNET)}/devices`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    // Token hỏng/bị thu hồi → bỏ token đang giữ để lần sau xin lại từ đầu.
    if (res.status === 401 || res.status === 403) _token = null;
    throw new Error(`Lấy devices lỗi ${res.status}`);
  }

  const { devices = [] } = await res.json();
  const map = new Map();
  for (const d of devices) {
    const status = {
      // connectedToControl = máy đang giữ kết nối tới control server Tailscale.
      // KHÔNG có trường tên `online` — đừng đi tìm.
      online: !!d.connectedToControl,
      // Spec Tailscale bảo lastSeen bị bỏ khi connectedToControl=true, nhưng THỰC TẾ
      // (đo 2026-07-17) máy online vẫn trả lastSeen ≈ now và nhích liên tục. Nên chỉ
      // tin nó khi offline; lúc online nó chỉ là "vừa thấy xong", không có ý nghĩa.
      last_seen: d.lastSeen || null,
      device: d.name || d.hostname || null,
    };
    for (const k of keysOf(d)) map.set(k, status);
  }
  return map;
}

// ── Cache ────────────────────────────────────────────────────────────────────
// Cả danh sách chi nhánh dùng chung 1 snapshot → mỗi TTL chỉ 1 lần gọi Tailscale.
let _cache    = null; // { map, expires, at }
let _inflight = null; // gộp các request đồng thời vào cùng 1 lần gọi API

async function refresh() {
  if (!isEnabled()) return null;
  if (_cache && _cache.expires > Date.now()) return _cache.map;
  if (_inflight) return _inflight;

  _inflight = (async () => {
    try {
      _cache = { map: await fetchDevices(), expires: Date.now() + CACHE_TTL_MS, at: Date.now() };
    } catch (e) {
      console.error("[tailscale] Không lấy được danh sách thiết bị:", e?.message || e);
      // Chớp tắt vài giây (hay gặp: bật/tắt Tailscale trên host làm Docker mất mạng
      // một lúc) → xài tạm snapshot cũ cho chấm khỏi nhấp nháy.
      // NHƯNG quá STALE_MAX_MS mà vẫn không gọi được thì VỨT snapshot: thà báo
      // "không rõ" còn hơn khẳng định "Online" bằng dữ liệu từ đời nào. Chấm live mà
      // nói dối lúc đang mù thì nguy hiểm hơn là không có chấm.
      if (_cache && Date.now() - _cache.at > STALE_MAX_MS) _cache = null;
      if (!_cache) return null;
      _cache.expires = Date.now() + CACHE_TTL_MS; // lùi lần thử kế, khỏi bắn API mỗi request
    }
    return _cache.map;
  })().finally(() => { _inflight = null; });

  return _inflight;
}

/**
 * Trạng thái live của 1 host (IP Tailscale / MagicDNS / tên máy đã lưu ở Store).
 *
 * Ba kết quả KHÁC NHAU, đừng gộp:
 * → null — chưa cấu hình credential, HOẶC host không có trong tailnet (thường do admin
 *   gõ sai IP). UI để trống, không báo đỏ oan.
 * → { unknown: true } — có bật, nhưng đang KHÔNG gọi được Tailscale API và snapshot
 *   cuối đã quá cũ. UI phải báo "không rõ" — tuyệt đối không đoán online/offline.
 * → { online, last_seen, device, checked_at } — biết chắc. last_seen chỉ có ý nghĩa
 *   khi offline; checked_at = lúc lấy snapshot, để biết số liệu cũ tới đâu.
 */
async function getStatus(host) {
  if (!host) return null;
  const map = await refresh();
  // Bật mà không có dữ liệu nào dùng được → mù, phải nói thẳng là mù.
  if (!map) return isEnabled() ? { unknown: true } : null;

  const hit = map.get(host.trim().toLowerCase());
  if (!hit) return null;
  return { ...hit, checked_at: new Date(_cache.at).toISOString() };
}

module.exports = { isEnabled, getStatus, CACHE_TTL_MS, STALE_MAX_MS };
