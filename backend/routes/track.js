/**
 * /api/track — Đếm lượt truy cập website khách.
 *
 * - POST /pageview : website khách (React) bắn beacon mỗi lần mở/chuyển trang. PUBLIC
 *   (khách chưa đăng nhập vẫn tính), rate-limit theo IP chống spam, nuốt mọi lỗi để
 *   KHÔNG bao giờ làm hỏng trải nghiệm khách.
 * - GET  /stats?period=day|month|year : admin xem tổng hợp (headline + biểu đồ + top trang).
 *
 * Múi giờ: DB lưu UTC; VN = UTC+7 cố định (không DST) → gom nhóm bằng
 * ("created_at" + interval '7 hours') để ra đúng ngày/giờ địa phương. Ranh giới kỳ
 * (đầu ngày/tháng/năm) tính trong JS: tiến trình chạy TZ=Asia/Ho_Chi_Minh (docker env)
 * nên new Date(y,m,d) = đúng nửa đêm giờ VN.
 */
const express = require("express");
const router  = express.Router();
const rateLimit = require("express-rate-limit");
const prisma = require("../lib/prisma");
const { getIO } = require("../socket");
const { verifyToken } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/requireRole");

// Nhận diện bot theo user-agent để loại khỏi thống kê "khách thật". Không cần chính xác
// tuyệt đối — chỉ chặn crawler phổ biến khỏi thổi phồng số liệu.
const BOT_RE = /bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|whatsapp|telegrambot|headless|lighthouse|pingdom|uptimerobot|curl|wget|python-requests|axios\//i;

// Chặn spam beacon: 120 lượt / phút / IP là thừa cho người dùng thật (mỗi lần chuyển
// trang mới bắn 1 cái), nhưng đủ chặn kịch bản bơm số.
const beaconLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: false,
  legacyHeaders: false,
  // Vượt giới hạn thì im lặng bỏ qua (vẫn 204) — không báo lỗi cho website khách.
  handler: (req, res) => res.status(204).end(),
});

// ── POST /pageview — ghi 1 lượt xem ──────────────────────────────────────────
router.post("/pageview", beaconLimiter, async (req, res) => {
  // Trả 204 NGAY, ghi DB chạy nền — beacon không được làm khách phải chờ.
  res.status(204).end();
  try {
    let { path, visitorId, referrer } = req.body || {};
    if (typeof path !== "string" || !path) return;

    // Chỉ giữ phần đường dẫn, cắt query/hash và chặn độ dài để không ai nhét rác.
    path = path.split(/[?#]/)[0].slice(0, 300);
    visitorId = typeof visitorId === "string" ? visitorId.slice(0, 64) : null;
    referrer  = typeof referrer === "string" && referrer ? referrer.slice(0, 300) : null;

    const ua = req.get("user-agent") || "";
    const isBot = BOT_RE.test(ua);
    await prisma.pageView.create({ data: { path, visitorId, referrer, isBot } });

    // Báo dashboard admin để số nhảy real-time. Chỉ khách thật (bỏ bot). Tiết lưu tối đa
    // 1 lần/giây: dashboard nhận tín hiệu là tự nạp lại từ DB nên bỏ bớt tín hiệu lúc
    // dồn dập không mất mát gì.
    if (!isBot) emitTrafficHit(path);
  } catch (err) {
    // Không bao giờ ném ra ngoài — đếm traffic hỏng không được ảnh hưởng gì.
    console.error("[track] Ghi pageview lỗi:", err?.message || err);
  }
});

// Tiết lưu phát socket: nhiều hit trong 1 giây → chỉ 1 tín hiệu "traffic:hit".
let _lastEmit = 0;
function emitTrafficHit(path) {
  try {
    if (Date.now() - _lastEmit < 1000) return;
    _lastEmit = Date.now();
    const io = getIO();
    if (io) io.to("admin-room").emit("traffic:hit", { path, at: new Date().toISOString() });
  } catch { /* socket chưa sẵn sàng — bỏ qua, dashboard vẫn có auto-refresh dự phòng */ }
}

// ── Cấu hình từng kỳ: ranh giới thời gian + độ chia biểu đồ ───────────────────
const VN_OFFSET = "interval '7 hours'"; // UTC → giờ VN

// Trả { start, end, trunc } cho kỳ. start/end là mốc UTC (JS Date, TZ container = VN).
function periodRange(period) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  if (period === "year") {
    return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1), trunc: "month" };
  }
  if (period === "day") {
    return { start: new Date(y, m, d), end: new Date(y, m, d + 1), trunc: "hour" };
  }
  // mặc định: tháng này, chia theo ngày
  return { start: new Date(y, m, 1), end: new Date(y, m + 1, 1), trunc: "day" };
}

// Gom 3 truy vấn + lấp series thành payload dashboard. Tách khỏi handler để test được.
async function computeStats(period) {
  const { start, end, trunc } = periodRange(period);

  // date_trunc không tham số hoá được → dùng literal từ whitelist ('hour'|'day'|'month'),
  // AN TOÀN vì không lấy từ input thô. Còn mốc thời gian thì tham số hoá ($1/$2).
  const bucketExpr = `date_trunc('${trunc}', "created_at" + ${VN_OFFSET})`;

  const [totals, series, topPaths] = await Promise.all([
    // Tổng cả kỳ: distinct khách phải đếm trên TOÀN kỳ, không cộng dồn từng bucket.
    prisma.$queryRawUnsafe(
      `SELECT count(*)::int AS views, count(DISTINCT "visitor_id")::int AS visitors
         FROM page_views
        WHERE "created_at" >= $1 AND "created_at" < $2 AND "is_bot" = false`,
      start, end,
    ),
    prisma.$queryRawUnsafe(
      `SELECT ${bucketExpr} AS bucket,
              count(*)::int AS views,
              count(DISTINCT "visitor_id")::int AS visitors
         FROM page_views
        WHERE "created_at" >= $1 AND "created_at" < $2 AND "is_bot" = false
        GROUP BY bucket ORDER BY bucket`,
      start, end,
    ),
    prisma.$queryRawUnsafe(
      `SELECT "path", count(*)::int AS views
         FROM page_views
        WHERE "created_at" >= $1 AND "created_at" < $2 AND "is_bot" = false
        GROUP BY "path" ORDER BY views DESC LIMIT 6`,
      start, end,
    ),
  ]);

  return {
    success: true,
    period,
    range: { from: start.toISOString(), to: end.toISOString() },
    totals: totals[0] || { views: 0, visitors: 0 },
    series: fillSeries(series, period, start),
    topPaths,
  };
}

// ── GET /stats — tổng hợp cho dashboard admin ────────────────────────────────
router.get("/stats", verifyToken, requireAdmin, async (req, res) => {
  try {
    const period = ["day", "month", "year"].includes(req.query.period) ? req.query.period : "month";
    res.json(await computeStats(period));
  } catch (err) {
    console.error("[track] /stats lỗi:", err);
    res.status(500).json({ error: "Lỗi lấy thống kê truy cập." });
  }
});

/**
 * Lấp các bucket rỗng để biểu đồ liền mạch (giờ không có khách vẫn hiện cột 0).
 * DB chỉ trả bucket CÓ dữ liệu → ở đây sinh đủ khung theo kỳ rồi map số vào.
 */
function fillSeries(rows, period, start) {
  // Map bucket-time (đã ở giờ VN do date_trunc trên (utc+7)) → số liệu.
  const byKey = new Map();
  for (const r of rows) {
    const b = new Date(r.bucket);
    byKey.set(b.getUTCFullYear() * 1e6 + b.getUTCMonth() * 1e4 + b.getUTCDate() * 100 + b.getUTCHours(),
              { views: r.views, visitors: r.visitors });
  }
  const y = start.getFullYear(), m = start.getMonth(), d = start.getDate();
  const out = [];
  const push = (key, label) => {
    const hit = byKey.get(key) || { views: 0, visitors: 0 };
    out.push({ label, views: hit.views, visitors: hit.visitors });
  };

  if (period === "day") {
    for (let h = 0; h < 24; h++)
      push(y * 1e6 + m * 1e4 + d * 100 + h, String(h).padStart(2, "0"));
  } else if (period === "year") {
    for (let mo = 0; mo < 12; mo++)
      push(y * 1e6 + mo * 1e4 + 1 * 100 + 0, `T${mo + 1}`);
  } else {
    const days = new Date(y, m + 1, 0).getDate();
    for (let dd = 1; dd <= days; dd++)
      push(y * 1e6 + m * 1e4 + dd * 100 + 0, String(dd));
  }
  return out;
}

module.exports = router;
// Xuất thêm để test (không dùng trong luồng app).
module.exports.computeStats = computeStats;
module.exports.fillSeries   = fillSeries;
