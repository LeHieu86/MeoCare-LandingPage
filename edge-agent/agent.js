/**
 * agent.js  (EDGE AGENT — chạy trên mỗi Kubuntu chi nhánh)
 *
 * Vòng đời:
 *  1) Bootstrap: GET {CENTRAL_URL}/api/agent/config (header X-Agent-Token) → desired-state ban đầu.
 *  2) Heartbeat MỖI HEARTBEAT_INTERVAL giây — POST /api/agent/heartbeat:
 *       gửi LÊN: df từng ổ + trạng thái ghi từng camera.
 *       nhận VỀ: desired-state mới nhất (cameras/disks) + hàng lệnh chờ.
 *     → sync go2rtc cục bộ, RECONCILE (ghi camera recording=true & có HDD; dừng cái thừa),
 *       thực thi lệnh tức thời (reload/restart_camera).
 *
 * Ghi hình hoàn toàn CỤC BỘ — mất Internet vẫn ghi (chỉ không cập nhật được desired-state mới).
 */
const fsp = require('fs').promises;
const recorder = require('./recorder');
const { syncToGo2RTC } = require('./go2rtc-sync');

const CENTRAL_URL        = (process.env.CENTRAL_URL || '').replace(/\/$/, '');
const AGENT_TOKEN        = process.env.AGENT_TOKEN || '';
// POLL_INTERVAL giữ tương thích .env cũ; HEARTBEAT_INTERVAL ưu tiên hơn.
const HEARTBEAT_INTERVAL =
  parseInt(process.env.HEARTBEAT_INTERVAL || process.env.POLL_INTERVAL || '15', 10) * 1000;

if (!CENTRAL_URL || !AGENT_TOKEN) {
  console.error('[Agent] FATAL: cần CENTRAL_URL và AGENT_TOKEN trong môi trường.');
  process.exit(1);
}

let lastConfig = null;   // desired-state gần nhất — vẫn ghi theo nó khi mất mạng

// ── Dung lượng ổ (df) qua statfs — không phụ thuộc lệnh shell ──────────────────
async function diskUsage(mountPath) {
  try {
    const s = await fsp.statfs(mountPath);
    const total = s.blocks * s.bsize;
    const free  = s.bavail * s.bsize;
    const used  = total - s.bfree * s.bsize;
    const gb = (b) => +(b / 1024 / 1024 / 1024).toFixed(1);
    return {
      total_gb: gb(total), used_gb: gb(used), free_gb: gb(free),
      percent_used: total ? Math.round((total - free) / total * 100) : 0,
    };
  } catch {
    return { total_gb: 0, used_gb: 0, free_gb: 0, percent_used: 0, error: 'Chưa mount' };
  }
}

// ── Reconcile: trạng thái ghi khớp desired-state ──────────────────────────────
function reconcile(config) {
  const { cameras = [], disks = [], segment_duration = 900 } = config || {};
  const diskById = new Map(disks.map(d => [d.id, d]));

  const desired = new Map();   // camId -> {cam, disk}
  for (const cam of cameras) {
    if (cam.recording && cam.disk_id && diskById.has(cam.disk_id)) {
      desired.set(cam.id, { cam, disk: diskById.get(cam.disk_id) });
    }
  }
  // Dừng cái đang ghi nhưng không còn cần
  for (const idStr of Object.keys(recorder.getStatus())) {
    const id = parseInt(idStr, 10);
    if (!desired.has(id)) {
      const r = recorder.stopCamera(id);
      if (r.ok) console.log(`[Agent] ⏹  Dừng ghi cam ${id}`);
    }
  }
  // Bật cái cần ghi mà chưa chạy
  for (const [id, { cam, disk }] of desired) {
    if (!recorder.isRecording(id)) {
      const r = recorder.startCamera(cam, disk, segment_duration);
      console.log(`[Agent] ${r.ok ? '▶  Bắt đầu' : '⚠  Lỗi'} ghi cam ${id} (${cam.name}): ${r.message}`);
    }
  }
}

// ── Lệnh tức thời (desired-state đã lo bật/tắt; đây cho restart/reload) ─────────
function executeCommands(commands) {
  for (const cmd of commands) {
    try {
      switch (cmd.type) {
        case 'restart_camera': {
          const id = cmd.payload?.camId ?? cmd.camId;
          if (id != null) { recorder.stopCamera(id); /* heartbeat kế sẽ bật lại theo desired */ }
          console.log(`[Agent] ↻ restart_camera ${id}`);
          break;
        }
        case 'reload':
          console.log('[Agent] ↻ reload — sẽ áp desired-state ở heartbeat kế.');
          break;
        default:
          console.warn('[Agent] Lệnh lạ:', cmd.type);
      }
    } catch (e) { console.warn('[Agent] Lỗi thực thi lệnh:', e.message); }
  }
}

// ── Gom runtime để báo lên ────────────────────────────────────────────────────
async function collectRuntime() {
  const disksReport = {};
  for (const d of (lastConfig?.disks || [])) {
    disksReport[d.id] = await diskUsage(d.mount_path);
  }
  const status = recorder.getStatus();   // {id:{pid,running}}
  const camsReport = Object.entries(status).map(([id, s]) => ({
    id: parseInt(id, 10), recording: true, pid: s.pid,
  }));
  return { disks: disksReport, cameras: camsReport, ts: Date.now() };
}

async function fetchConfig() {
  const res = await fetch(`${CENTRAL_URL}/api/agent/config`, {
    headers: { 'X-Agent-Token': AGENT_TOKEN },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json?.data) throw new Error('config rỗng');
  return json.data;
}

async function heartbeat() {
  const runtime = await collectRuntime();
  try {
    const res = await fetch(`${CENTRAL_URL}/api/agent/heartbeat`, {
      method: 'POST',
      headers: { 'X-Agent-Token': AGENT_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify(runtime),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.config) {
      lastConfig = json.config;
      await syncToGo2RTC(json.config.cameras);
      reconcile(json.config);
    }
    if (Array.isArray(json.commands) && json.commands.length) executeCommands(json.commands);
  } catch (err) {
    console.warn(`[Agent] heartbeat lỗi (${err.message}).`,
      lastConfig ? 'Giữ ghi theo config cũ.' : 'Chưa có config — chờ thử lại.');
    if (lastConfig) reconcile(lastConfig);   // mất mạng: vẫn duy trì ghi
  }
}

async function main() {
  console.log(`[Agent] Khởi động — trung tâm: ${CENTRAL_URL}, heartbeat mỗi ${HEARTBEAT_INTERVAL / 1000}s`);
  // Bootstrap config (không chặn nếu lỗi — heartbeat sẽ lấy lại)
  try {
    lastConfig = await fetchConfig();
    await syncToGo2RTC(lastConfig.cameras);
    reconcile(lastConfig);
  } catch (err) {
    console.warn('[Agent] Bootstrap config lỗi:', err.message, '— sẽ thử qua heartbeat.');
  }
  await heartbeat();
  setInterval(heartbeat, HEARTBEAT_INTERVAL);
}

process.on('SIGTERM', () => { recorder.stopAll(); process.exit(0); });
process.on('SIGINT',  () => { recorder.stopAll(); process.exit(0); });

main();
