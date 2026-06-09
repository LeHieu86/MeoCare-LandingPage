/**
 * agent.js  (EDGE AGENT — chạy trên mỗi Kubuntu chi nhánh)
 *
 * Vòng đời:
 *  1) Kéo config từ trung tâm: GET {CENTRAL_URL}/api/agent/config  (header X-Agent-Token).
 *     → danh sách camera (rtsp_url/sub, disk_id, recording) + ổ đĩa (mount_path CỤC BỘ).
 *  2) Sync go2rtc cục bộ (live view trong LAN chi nhánh, sau này xem từ xa qua Tailscale).
 *  3) RECONCILE: camera nào recording=true & có HDD hợp lệ → đảm bảo đang ghi; còn lại → dừng.
 *  4) Lặp lại mỗi POLL_INTERVAL giây để bắt thay đổi (thêm cam, bật/tắt ghi từ trung tâm).
 *
 * Ghi hình hoàn toàn CỤC BỘ — mất Internet vẫn ghi (chỉ không cập nhật được config mới).
 *
 * Phase 2 sẽ thêm: POST /heartbeat (df + trạng thái ghi) và GET /commands (lệnh tức thời).
 */
const recorder = require('./recorder');
const { syncToGo2RTC } = require('./go2rtc-sync');

const CENTRAL_URL   = (process.env.CENTRAL_URL || '').replace(/\/$/, '');
const AGENT_TOKEN   = process.env.AGENT_TOKEN || '';
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '60', 10) * 1000;

if (!CENTRAL_URL || !AGENT_TOKEN) {
  console.error('[Agent] FATAL: cần CENTRAL_URL và AGENT_TOKEN trong môi trường.');
  process.exit(1);
}

let lastConfig = null;   // giữ config gần nhất để vẫn ghi khi mất mạng

async function fetchConfig() {
  const res = await fetch(`${CENTRAL_URL}/api/agent/config`, {
    headers: { 'X-Agent-Token': AGENT_TOKEN },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${body.slice(0, 120)}`);
  }
  const json = await res.json();
  if (!json?.data) throw new Error('Phản hồi config rỗng');
  return json.data;   // { store_id, segment_duration, disks, cameras }
}

/** Đảm bảo trạng thái ghi khớp desired-state từ config. */
function reconcile(config) {
  const { cameras = [], disks = [], segment_duration = 900 } = config;
  const diskById = new Map(disks.map(d => [d.id, d]));

  // Tập camera CẦN ghi: recording=true + có disk hợp lệ
  const desired = new Map();
  for (const cam of cameras) {
    if (cam.recording && cam.disk_id && diskById.has(cam.disk_id)) {
      desired.set(cam.id, { cam, disk: diskById.get(cam.disk_id) });
    }
  }

  // Dừng camera đang ghi nhưng không còn trong desired (tắt ghi / đổi/bỏ HDD)
  for (const idStr of Object.keys(recorder.getStatus())) {
    const id = parseInt(idStr, 10);
    if (!desired.has(id)) {
      const r = recorder.stopCamera(id);
      if (r.ok) console.log(`[Agent] ⏹  Dừng ghi cam ${id}`);
    }
  }

  // Bật camera cần ghi mà chưa chạy
  for (const [id, { cam, disk }] of desired) {
    if (!recorder.isRecording(id)) {
      const r = recorder.startCamera(cam, disk, segment_duration);
      console.log(`[Agent] ${r.ok ? '▶  Bắt đầu' : '⚠  Lỗi'} ghi cam ${id} (${cam.name}): ${r.message}`);
    }
  }
}

async function tick() {
  try {
    const config = await fetchConfig();
    lastConfig = config;
    await syncToGo2RTC(config.cameras);
    reconcile(config);
  } catch (err) {
    console.warn(`[Agent] Không lấy được config (${err.message}).`,
      lastConfig ? 'Giữ ghi theo config cũ.' : 'Chưa có config nào — chờ thử lại.');
    if (lastConfig) reconcile(lastConfig);   // mất mạng: vẫn duy trì ghi theo config cũ
  }
}

async function main() {
  console.log(`[Agent] Khởi động — trung tâm: ${CENTRAL_URL}, poll mỗi ${POLL_INTERVAL / 1000}s`);
  await tick();
  setInterval(tick, POLL_INTERVAL);
}

process.on('SIGTERM', () => { recorder.stopAll(); process.exit(0); });
process.on('SIGINT',  () => { recorder.stopAll(); process.exit(0); });

main();
