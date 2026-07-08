/**
 * lib/aiConfig.js — Cấu hình bot CSKH có thể chỉnh từ app Admin (lưu AppSetting),
 * env làm MẶC ĐỊNH. Getter đọc bộ nhớ (đồng bộ, hot-path), tự refresh mỗi 30s +
 * refresh ngay khi admin lưu. API KEY KHÔNG nằm ở đây (giữ trong .env, không lộ ra app).
 */
const prisma = require("./prisma");

const KEYS = {
  botEnabled: "cskh_bot_enabled",
  aiEnabled:  "cskh_ai_enabled",
  model:      "cskh_model",
  maxPerDay:  "cskh_max_per_day",
};

// Khởi tạo từ env (dùng tới khi DB nạp xong / nếu DB chưa có giá trị)
const _cfg = {
  botEnabled: process.env.AI_CSKH_ENABLED === "true",
  aiEnabled:  true, // có dùng lớp AI hay không (rules-only khi false / thiếu key)
  model:      process.env.AI_CSKH_MODEL || "claude-sonnet-4-6",
  maxPerDay:  parseInt(process.env.AI_MAX_PER_DAY || "1000", 10),
};

async function refresh() {
  try {
    const rows = await prisma.appSetting.findMany({ where: { key: { in: Object.values(KEYS) } } });
    const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    if (m[KEYS.botEnabled] !== undefined) _cfg.botEnabled = m[KEYS.botEnabled] === "true";
    if (m[KEYS.aiEnabled]  !== undefined) _cfg.aiEnabled  = m[KEYS.aiEnabled] === "true";
    if (m[KEYS.model])                    _cfg.model      = m[KEYS.model];
    if (m[KEYS.maxPerDay])                _cfg.maxPerDay  = parseInt(m[KEYS.maxPerDay], 10) || _cfg.maxPerDay;
  } catch { /* DB chưa sẵn sàng → giữ giá trị hiện tại (env defaults) */ }
}

const ALLOWED_MODELS = ["claude-sonnet-4-6", "claude-haiku-4-5", "claude-opus-4-8"];

async function update(patch) {
  const writes = [];
  if (typeof patch.botEnabled === "boolean") writes.push([KEYS.botEnabled, patch.botEnabled ? "true" : "false"]);
  if (typeof patch.aiEnabled  === "boolean") writes.push([KEYS.aiEnabled,  patch.aiEnabled ? "true" : "false"]);
  if (patch.model && ALLOWED_MODELS.includes(patch.model)) writes.push([KEYS.model, patch.model]);
  if (patch.maxPerDay !== undefined) {
    const n = Math.max(0, parseInt(patch.maxPerDay, 10) || 0);
    writes.push([KEYS.maxPerDay, String(n)]);
  }
  for (const [key, value] of writes) {
    await prisma.appSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }
  await refresh();
  return snapshot();
}

function hasKey() { return !!process.env.ANTHROPIC_API_KEY; }

// Trạng thái cho app Admin xem (KHÔNG trả key thật)
function snapshot() {
  const aiActive = _cfg.botEnabled && _cfg.aiEnabled && hasKey();
  return {
    botEnabled: _cfg.botEnabled,
    aiEnabled:  _cfg.aiEnabled,
    model:      _cfg.model,
    maxPerDay:  _cfg.maxPerDay,
    hasKey:     hasKey(),
    mode: !_cfg.botEnabled ? "off" : (aiActive ? "hybrid" : "rules_only"),
    allowedModels: ALLOWED_MODELS,
  };
}

// Nạp lần đầu + tự làm mới định kỳ (không chặn require)
refresh();
setInterval(refresh, 30000).unref?.();

module.exports = {
  refresh, update, snapshot, hasKey,
  botEnabled: () => _cfg.botEnabled,
  aiEnabled:  () => _cfg.aiEnabled,
  model:      () => _cfg.model,
  maxPerDay:  () => _cfg.maxPerDay,
};
