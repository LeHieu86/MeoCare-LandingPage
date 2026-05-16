/**
 * recorderService.js
 * Quản lý ffmpeg recording process riêng cho từng camera.
 * Bật/tắt từng camera hoàn toàn độc lập — không ảnh hưởng camera khác.
 */

const { spawn } = require('child_process');
const fs   = require('fs');
const path = require('path');
const prisma = require('../lib/prisma');

// Map lưu process đang chạy: { camera_id: child_process }
const processes = {};

// Log path mỗi camera
const logPath = (camId) => path.join(__dirname, '..', '..', 'scripts', `recorder_${camId}.log`);

function appendLog(camId, msg) {
  const line = `[${new Date().toLocaleString('vi-VN')}] ${msg}\n`;
  fs.appendFileSync(logPath(camId), line);
}

/**
 * Lấy thư mục output theo disk + camera + ngày hôm nay
 */
function getOutputDir(mountPath, camName) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const dir   = path.join(mountPath, camName, today);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Bắt đầu ghi 1 camera
 */
async function startCamera(camId) {
  if (processes[camId]) {
    return { ok: false, message: 'Camera đang ghi rồi' };
  }

  // Load camera + config từ DB
  const [cam, config] = await Promise.all([
    prisma.camera.findUnique({ where: { id: camId } }),
    prisma.nasConfig.findUnique({ where: { id: 1 } }),
  ]);

  if (!cam)             return { ok: false, message: 'Không tìm thấy camera' };
  if (!cam.rtsp_url)    return { ok: false, message: 'Camera chưa có RTSP URL' };
  if (!cam.disk_id)     return { ok: false, message: 'Camera chưa được gán vào HDD nào' };

  const disks     = config?.disks || [];
  const disk      = disks.find(d => d.id === cam.disk_id);
  if (!disk)            return { ok: false, message: `Không tìm thấy HDD: ${cam.disk_id}` };
  if (!fs.existsSync(disk.mount_path))
                        return { ok: false, message: `HDD chưa được mount: ${disk.mount_path}` };

  const segment   = config?.segment_duration || 900;
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

  const child = spawn('ffmpeg', args, { detached: false });

  child.stdout.on('data', d => appendLog(camId, d.toString().trim()));
  child.stderr.on('data', d => appendLog(camId, d.toString().trim()));
  child.on('exit', (code, signal) => {
    appendLog(camId, `Process kết thúc — code:${code} signal:${signal}`);
    delete processes[camId];
    // Tự restart sau 5s nếu không phải bị kill chủ động
    if (signal !== 'SIGTERM' && signal !== 'SIGKILL') {
      appendLog(camId, 'Tự restart sau 5 giây...');
      setTimeout(() => startCamera(camId), 5000);
    }
  });

  processes[camId] = child;
  appendLog(camId, `Bắt đầu ghi → ${outputDir} (PID: ${child.pid})`);

  // Cập nhật recording=true trong DB
  await prisma.camera.update({ where:{ id:camId }, data:{ recording:true } });

  return { ok: true, message: `Đang ghi vào ${disk.label} (PID: ${child.pid})`, pid: child.pid };
}

/**
 * Dừng ghi 1 camera
 */
async function stopCamera(camId) {
  const child = processes[camId];
  if (!child) return { ok: false, message: 'Camera không đang ghi' };

  child.kill('SIGTERM');
  delete processes[camId];
  appendLog(camId, 'Đã dừng bởi admin.');

  await prisma.camera.update({ where:{ id:camId }, data:{ recording:false } });

  return { ok: true, message: 'Đã dừng ghi' };
}

/**
 * Toggle: nếu đang ghi thì dừng, không thì bật
 */
async function toggleCamera(camId) {
  if (processes[camId]) return stopCamera(camId);
  return startCamera(camId);
}

/**
 * Lấy trạng thái tất cả camera
 */
function getStatus() {
  const running = {};
  for (const [id, child] of Object.entries(processes)) {
    running[id] = { pid: child.pid, running: true };
  }
  return running;
}

/**
 * Lấy status 1 camera
 */
function getCameraStatus(camId) {
  const child = processes[camId];
  return child ? { running: true, pid: child.pid } : { running: false };
}

/**
 * Khởi động lại tất cả camera có recording=true khi server restart
 */
async function restoreOnStartup() {
  try {
    const cameras = await prisma.camera.findMany({ where: { recording: true } });
    if (!cameras.length) return;
    console.log(`[Recorder] Khôi phục ${cameras.length} camera đang ghi...`);
    for (const cam of cameras) {
      await startCamera(cam.id);
      await new Promise(r => setTimeout(r, 500)); // tránh spawn đồng thời
    }
  } catch (err) {
    console.error('[Recorder] Lỗi khôi phục:', err.message);
  }
}

/**
 * Đọc log của 1 camera (100 dòng cuối)
 */
function getCameraLog(camId, lines = 100) {
  const lp = logPath(camId);
  if (!fs.existsSync(lp)) return '';
  const content = fs.readFileSync(lp, 'utf-8').split('\n');
  return content.slice(-lines).join('\n');
}

/**
 * Dừng tất cả khi server shutdown
 */
function stopAll() {
  for (const [id, child] of Object.entries(processes)) {
    child.kill('SIGTERM');
    delete processes[id];
  }
}

process.on('SIGTERM', stopAll);
process.on('SIGINT',  stopAll);

module.exports = { startCamera, stopCamera, toggleCamera, getStatus, getCameraStatus, getCameraLog, restoreOnStartup, stopAll };