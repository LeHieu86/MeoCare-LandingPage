const crypto = require("crypto");
const prisma = require("../lib/prisma");

/**
 * Middleware Idempotency-Key — chống request trùng phía client.
 *
 * Cách dùng client: sinh 1 UUID cho mỗi THAO TÁC (vd lúc mở form đặt đơn), gửi qua
 * header "Idempotency-Key". Bấm 2 lần hay app retry do timeout → cùng key → server
 * trả lại đúng response đã lưu, KHÔNG chạy lại handler (không tạo đơn/booking trùng).
 *
 * Luồng xử lý:
 *   1. Không có header → bỏ qua (giữ nguyên hành vi cũ, không phá client hiện tại).
 *   2. Lần đầu  → tạo row "đang xử lý" (statusCode=null) → chạy handler → lưu response.
 *   3. Replay (đã xong)      → trả thẳng response đã cache.
 *   4. Đang xử lý (chưa xong) → 409 (request đầu chưa về, chống double-click).
 *   5. Cùng key, body khác   → 422 (client dùng lại key sai cách).
 *
 * An toàn lỗi: chỉ cache response THÀNH CÔNG (2xx). Mọi lỗi 4xx/5xx → xóa key để client
 * sửa input và thử lại được. Mọi sự cố của bản thân middleware đều "fail-open" (cho request
 * đi tiếp) để idempotency không bao giờ làm sập luồng nghiệp vụ chính.
 *
 * @param {object} [opts]
 * @param {string} [opts.scope] Nhãn gom nhóm cho route (mặc định "METHOD path").
 * @param {boolean} [opts.required] true = bắt buộc có header, thiếu thì trả 400.
 */
function idempotency(opts = {}) {
  return async function idempotencyMiddleware(req, res, next) {
    const key = req.get("Idempotency-Key");

    if (!key) {
      if (opts.required) {
        return res.status(400).json({ error: "Thiếu header Idempotency-Key" });
      }
      return next(); // không bắt buộc → giữ hành vi cũ
    }
    // Chặn key rác (quá ngắn/quá dài)
    if (typeof key !== "string" || key.length < 8 || key.length > 200) {
      return res.status(400).json({ error: "Idempotency-Key không hợp lệ" });
    }

    const scope = opts.scope || `${req.method} ${req.baseUrl}${req.path}`;
    const requestHash = crypto
      .createHash("sha256")
      .update(`${req.method}|${req.originalUrl}|${stableStringify(req.body)}`)
      .digest("hex");

    // ── Bước 1: cố tạo row "đang xử lý". Unique(key) đảm bảo chỉ 1 request thắng. ──
    try {
      await prisma.idempotencyKey.create({
        data: { key, scope, requestHash, statusCode: null },
      });
    } catch (e) {
      if (e?.code === "P2002") {
        // Key đã tồn tại → là replay hoặc request song song
        return handleExisting(req, res, next, { key, requestHash });
      }
      // Lỗi DB khác → fail-open, cho request đi tiếp như bình thường
      console.error("[idempotency] create lỗi, bỏ qua:", e?.message);
      return next();
    }

    // ── Bước 2: là request ĐẦU TIÊN. Bắt response để cache lại khi xong. ──
    captureResponse(res, key);
    return next();
  };
}

/* Xử lý khi key đã tồn tại trong DB */
async function handleExisting(req, res, next, { key, requestHash }) {
  let record;
  try {
    record = await prisma.idempotencyKey.findUnique({ where: { key } });
  } catch (e) {
    console.error("[idempotency] findUnique lỗi, bỏ qua:", e?.message);
    return next(); // fail-open
  }
  if (!record) return next(); // bị xóa giữa chừng (race với cleanup) → cho đi tiếp

  // Cùng key nhưng body khác → dùng sai key
  if (record.requestHash !== requestHash) {
    return res.status(422).json({
      error: "Idempotency-Key đã được dùng cho một request khác",
    });
  }

  // Chưa có statusCode → request đầu đang chạy dở
  if (record.statusCode == null) {
    return res.status(409).json({
      error: "Yêu cầu đang được xử lý, vui lòng đợi.",
    });
  }

  // Đã xong → trả lại response đã cache
  res.set("Idempotent-Replayed", "true");
  return res.status(record.statusCode).json(record.responseBody);
}

/* Bọc res.json để lưu (statusCode, body) sau khi gửi xong. */
function captureResponse(res, key) {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    res.locals._idemBody = body;
    res.locals._idemCaptured = true;
    return originalJson(body);
  };

  res.on("finish", async () => {
    try {
      // CHỈ cache phản hồi thành công 2xx (đó là lúc đơn/booking đã thực sự được tạo).
      // Mọi lỗi 4xx/5xx → xóa key, để khách sửa input rồi thử lại (tránh "bẫy 422").
      // Các route ở đây đều validate TRƯỚC khi ghi DB nên double-click một request lỗi là vô hại.
      const isSuccess =
        res.locals._idemCaptured && res.statusCode >= 200 && res.statusCode < 300;
      if (isSuccess) {
        await prisma.idempotencyKey.update({
          where: { key },
          data: { statusCode: res.statusCode, responseBody: res.locals._idemBody },
        });
      } else {
        await prisma.idempotencyKey.delete({ where: { key } }).catch(() => {});
      }
    } catch (e) {
      console.error("[idempotency] lưu response lỗi:", e?.message);
    }
  });
}

/* JSON.stringify ổn định (sắp xếp key) để body cùng nội dung luôn ra cùng hash. */
function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

module.exports = idempotency;
