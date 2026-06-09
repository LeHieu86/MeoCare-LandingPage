/**
 * recorder.js  (EDGE)
 * Bản port từ backend/routes/recorder-services.js — GIỮ NGUYÊN logic ffmpeg/segment/
 * auto-restart/log, nhưng KHÔNG truy vấn Prisma. Mọi tham số (camera, disk, segment)
 * được agent.js truyền vào, vì Kubuntu chi nhánh không có DB.
 *
 * Mỗi camera = 1 process ffmpeg độc lập, ghi vào disk.mount_path/<cam>/<ngày>/HH-MM-SS.mp4.
 */
const { spawn } = require('child_process');
const fs   = require('fs');
const path = require('path');

const TZ = process.env.TZ || 'Asia/Ho_Chi_Minh';

// Map process đang chạy: { camera_id: child_process }
const processes = {};
// Camera bị dừng chủ động (qua agent reconcile) — tránh auto-restart
const stoppedIntentionally = new Set();

// Log mỗi camera trong ./logs (tồn tại trong container agent)
const LOGS_DIR = path.join(__dirname, 'logs');
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
const logPath = (camId) => path.join(LOGS_DIR, `recorder_${camId}.log`);

function appendLog(camId, msg) {
  try {
    const line = `[${new Date().toLocaleString('vi-VN')}] ${msg}\n`;
    fs.appendFileSync(logPath(camId), line);
  } catch { /* ignore log errors */ }
}

function getOutputDir(mountPath, camName) {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: TZ });
  const dir   = path.join(mountPath, camName, today);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Bắt đầu ghi 1 camera.
 * @param {{id:number,name:string,rtsp_url:string}} cam
 * @param {{mount_path:string,label?:string}} disk
 * @param {number} segment  giây/đoạn
 */
function startCamera(cam, disk, segment = 900) {
  const camId = cam.id;
  if (processes[camId]) return { ok: false, message: 'Camera đang ghi rồi' };
  if (!cam.rtsp_url)     return { ok: false, message: 'Camera chưa có RTSP URL' };
  if (!disk?.mount_path) return { ok: false, message: 'Camera chưa được gán HDD' };
  if (!fs.existsSync(disk.mount_path))
    return { ok: false, message: `HDD chưa mount: ${disk.mount_path}` };

  const outputDir = getOutputDir(disk.mount_path, cam.name);
  const outputPat = path.join(outputDir, '%H-%M-%S.mp4');

  // ffmpeg args — Hikvision cần tcp, copy stream không re-encode
  const args = [
    '-loglevel', 'warning',
    '-rtsp_transport', 'tcp',
    '-i', cam.rtsp_url,
    '-c', 'copy',
    '-f', 'segment',
    '-segment_time', String(segment),
    '-segment_atclocktime', '1',
    '-reset_timestamps', '1',
    '-strftime', '1',
    outputPat,
  ];

  // Lưu lại tham số để auto-restart dùng đúng disk/segment
  const meta = { cam, disk, segment };
  const child = spawn('ffmpeg', args, { detached: false });

  child.stdout.on('data', d => appendLog(camId, d.toString().trim()));
  child.stderr.on('data', d => appendLog(camId, d.toString().trim()));
  child.on('exit', (code, signal) => {
    appendLog(camId, `Process kết thúc — code:${code} signal:${signal}`);
    delete processes[camId];
    if (!stoppedIntentionally.has(camId)) {
      appendLog(camId, 'Tự restart sau 5 giây...');
      setTimeout(() => startCamera(meta.cam, meta.disk, meta.segment), 5000);
    }
    stoppedIntentionally.delete(camId);
  });

  processes[camId] = child;
  appendLog(camId, `Bắt đầu ghi → ${outputDir} (PID: ${child.pid})`);
  return { ok: true, message: `Đang ghi vào ${disk.label || disk.mount_path} (PID: ${child.pid})`, pid: child.pid };
}

/** Dừng ghi 1 camera (chủ động — không auto-restart). */
function stopCamera(camId) {
  const child = processes[camId];
  if (!child) return { ok: false, message: 'Camera không đang ghi' };
  stoppedIntentionally.add(camId);
  child.kill('SIGTERM');
  delete processes[camId];
  appendLog(camId, 'Đã dừng (reconcile).');
  return { ok: true, message: 'Đã dừng ghi' };
}

function isRecording(camId) { return !!processes[camId]; }

function getStatus() {
  const running = {};
  for (const [id, child] of Object.entries(processes)) {
    running[id] = { pid: child.pid, running: true };
  }
  return running;
}

function getCameraLog(camId, lines = 100) {
  const lp = logPath(camId);
  if (!fs.existsSync(lp)) return '';
  return fs.readFileSync(lp, 'utf-8').split('\n').slice(-lines).join('\n');
}

function stopAll() {
  for (const [id, child] of Object.entries(processes)) {
    stoppedIntentionally.add(parseInt(id));
    child.kill('SIGTERM');
    delete processes[id];
  }
}

process.on('SIGTERM', stopAll);
process.on('SIGINT',  stopAll);

module.exports = { startCamera, stopCamera, isRecording, getStatus, getCameraLog, stopAll };
