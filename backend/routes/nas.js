const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');
const { execSync } = require('child_process');
const prisma   = require('../lib/prisma');
const recorder = require('./recorder-services');
const { verifyToken } = require('../middleware/auth');
const { storeContext } = require('../middleware/storeContext');
const { storeWhere } = require('../lib/storeFilter');

// Chặn khách hàng — NAS/camera là hạ tầng nội bộ, chỉ nhân viên/quản trị được truy cập
const requireStaff = (req, res, next) =>
  !req.user?.role || ['customer', 'client'].includes(req.user.role)
    ? res.status(403).json({ error: 'Không có quyền truy cập NAS.' })
    : next();

// Ghi hình đã chuyển sang edge-agent. Trung tâm chỉ ghi khi bật cờ di trú (xem server.js).
const CENTRAL_REC = process.env.ENABLE_CENTRAL_RECORDER === 'true';
// Agent im lặng quá ngưỡng này → coi như offline.
const HEARTBEAT_TIMEOUT_MS = 90_000;

function getDiskUsage(mountPath) {
  try {
    const out = execSync(`df -Pk "${mountPath}"`, { timeout:3000, encoding:'utf8' });
    const lines = out.trim().split('\n');
    const p = lines[lines.length - 1].trim().split(/\s+/);
    // POSIX df -Pk columns: Filesystem 1024-blocks Used Available Capacity% Mounted
    const toGb = kb => parseFloat((parseInt(kb) / 1024 / 1024).toFixed(1));
    return {
      total_gb:    toGb(p[1]),
      used_gb:     toGb(p[2]),
      free_gb:     toGb(p[3]),
      percent_used: parseInt(p[4]) || 0,
    };
  } catch { return { total_gb:0, used_gb:0, free_gb:0, percent_used:0 }; }
}

// GET /config
router.get('/config', verifyToken, requireStaff, storeContext, async (req, res) => {
  try {
    const storeId = req.storeId || 1;
    const config = await prisma.nasConfig.findUnique({ where: { store_id: storeId } });
    if (!config) return res.status(404).json({ error: 'Chưa có cấu hình' });
    // KHÔNG lộ agent_token (bí mật agent) ra app staff — chỉ báo đã có hay chưa.
    const { agent_token, ...safe } = config;
    res.json({ success: true, data: { ...safe, has_agent_token: !!agent_token } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /config
router.put('/config', verifyToken, requireStaff, storeContext, async (req, res) => {
  try {
    const storeId = req.storeId || 1;
    const { disks, segment_duration, rotate_days, date_format, output_format,
            codec, source_dir, delete_source, log_file, watch_interval, tailnet_host } = req.body;
    if (!disks?.length) return res.status(400).json({ error: 'Cần ít nhất 1 HDD' });
    const payload = {
      disks, segment_duration:segment_duration||900, rotate_days:rotate_days||30,
      date_format:date_format||'%Y-%m-%d', output_format:output_format||'.mp4',
      codec:codec||'copy', source_dir:source_dir||'',
      delete_source:delete_source||false, log_file:log_file||'/tmp/nas.log',
      watch_interval:watch_interval||30, nas_root:disks[0]?.mount_path||'',
      // Tailscale host của chi nhánh (xem live/playback từ xa). '' → null để rõ là chưa đặt.
      tailnet_host: (tailnet_host || '').trim() || null,
    };
    await prisma.nasConfig.upsert({
      where:  { store_id: storeId },
      update: payload,
      create: { store_id: storeId, ...payload },
    });
    res.json({ success:true, message:'Đã lưu cấu hình NAS' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /agent-token — cho biết chi nhánh đã có agent token chưa (KHÔNG trả token thật)
router.get('/agent-token', verifyToken, requireStaff, storeContext, async (req, res) => {
  try {
    const storeId = req.storeId || 1;
    const config = await prisma.nasConfig.findUnique({
      where: { store_id: storeId }, select: { agent_token: true, tailnet_host: true },
    });
    res.json({
      success: true,
      hasToken: !!config?.agent_token,
      tailnet_host: config?.tailnet_host || null,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /agent-token — sinh token mới cho edge agent của chi nhánh (chỉ admin).
// Trả token MỘT LẦN để cấu hình vào .env của Kubuntu; sau đó không xem lại được.
router.post('/agent-token', verifyToken, requireStaff, storeContext, async (req, res) => {
  try {
    if (req.user.role !== 'admin')
      return res.status(403).json({ error: 'Chỉ admin được tạo agent token.' });
    const storeId = req.storeId || 1;
    const exists = await prisma.nasConfig.findUnique({ where: { store_id: storeId } });
    if (!exists)
      return res.status(404).json({ error: 'Chưa có cấu hình NAS — hãy lưu cấu hình trước.' });
    const token = crypto.randomBytes(32).toString('hex');
    await prisma.nasConfig.update({ where: { store_id: storeId }, data: { agent_token: token } });
    res.json({ success: true, agent_token: token,
      message: 'Lưu token này vào AGENT_TOKEN trên Kubuntu — sẽ không hiển thị lại.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /status
// Ưu tiên dữ liệu agent báo lên (edge). Nếu chưa có heartbeat mà đang chạy chế độ di trú
// (ENABLE_CENTRAL_RECORDER) thì fallback df + recorder cục bộ ở trung tâm.
router.get('/status', verifyToken, requireStaff, storeContext, async (req, res) => {
  try {
    const storeId = req.storeId || 1;
    const [config, cameras] = await Promise.all([
      prisma.nasConfig.findUnique({ where:{ store_id: storeId } }),
      prisma.camera.findMany({ where: storeWhere(req) }),
    ]);

    const hbAt   = config?.last_heartbeat ? new Date(config.last_heartbeat).getTime() : 0;
    const online = !!hbAt && (Date.now() - hbAt) < HEARTBEAT_TIMEOUT_MS;
    const runtime = config?.runtime_status || {};

    let disks = {};
    const camRuntime = {};   // id -> { running, pid }

    if (online) {
      // Nguồn sự thật runtime = agent
      disks = runtime.disks || {};
      for (const c of (runtime.cameras || [])) {
        camRuntime[c.id] = { running: !!c.recording, pid: c.pid };
      }
    } else if (CENTRAL_REC) {
      // Chế độ di trú: trung tâm tự ghi → đọc df + recorder cục bộ
      for (const disk of config?.disks || []) {
        disks[disk.id] = fs.existsSync(disk.mount_path)
          ? getDiskUsage(disk.mount_path)
          : { total_gb:0, used_gb:0, free_gb:0, percent_used:0, error:'Chưa mount' };
      }
      for (const cam of cameras) camRuntime[cam.id] = recorder.getCameraStatus(cam.id);
    }

    const cameraStatus = cameras.map(cam => ({
      id: cam.id, name: cam.name, disk_id: cam.disk_id, recording: cam.recording,
      ...(camRuntime[cam.id] || { running: false }),
    }));
    const totalRecording = Object.values(camRuntime).filter(s => s.running).length;

    res.json({ success:true, data:{
      disks, cameras: cameraStatus, totalRecording,
      online, last_heartbeat: config?.last_heartbeat || null,
      mode: online ? 'edge' : (CENTRAL_REC ? 'central' : 'offline'),
    }});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Đặt desired-state recording cho 1 camera; chế độ di trú thì điều khiển recorder cục bộ luôn.
async function setRecording(camId, want) {
  await prisma.camera.update({ where: { id: camId }, data: { recording: want } });
  if (CENTRAL_REC) {
    try { want ? await recorder.startCamera(camId) : await recorder.stopCamera(camId); }
    catch (e) { /* recorder cục bộ có thể chưa chạy — bỏ qua, agent sẽ reconcile */ }
  }
}

// POST /camera/:id/start
router.post('/camera/:id/start', verifyToken, requireStaff, async (req, res) => {
  try {
    await setRecording(parseInt(req.params.id), true);
    res.json({ success:true, message:'Đã bật ghi (chi nhánh áp dụng trong giây lát).' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /camera/:id/stop
router.post('/camera/:id/stop', verifyToken, requireStaff, async (req, res) => {
  try {
    await setRecording(parseInt(req.params.id), false);
    res.json({ success:true, message:'Đã tắt ghi (chi nhánh áp dụng trong giây lát).' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /camera/:id/toggle
router.post('/camera/:id/toggle', verifyToken, requireStaff, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const cam = await prisma.camera.findUnique({ where: { id }, select: { recording: true } });
    if (!cam) return res.status(404).json({ error: 'Không tìm thấy camera' });
    await setRecording(id, !cam.recording);
    res.json({ success:true, message: !cam.recording ? 'Đã bật ghi.' : 'Đã tắt ghi.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /camera/:id/disk — gán camera vào HDD
router.patch('/camera/:id/disk', verifyToken, requireStaff, async (req, res) => {
  try {
    const { disk_id } = req.body;
    await prisma.camera.update({ where:{id:parseInt(req.params.id)}, data:{ disk_id } });
    res.json({ success:true, message:`Đã gán vào ${disk_id}` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /camera/:id/log
router.get('/camera/:id/log', verifyToken, requireStaff, async (req, res) => {
  try {
    if (CENTRAL_REC) {
      return res.json({ success:true, data: recorder.getCameraLog(parseInt(req.params.id)) });
    }
    res.json({ success:true, data:
      'Ghi hình chạy ở edge agent (Kubuntu chi nhánh).\n' +
      'Xem log trực tiếp trên máy chi nhánh:\n  docker compose logs -f agent' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /start-all — bật ghi tất cả camera của chi nhánh (desired-state)
router.post('/start-all', verifyToken, requireStaff, storeContext, async (req, res) => {
  try {
    await prisma.camera.updateMany({ where: storeWhere(req), data: { recording: true } });
    if (CENTRAL_REC) await recorder.restoreOnStartup();
    res.json({ success:true, message:'Đã bật tất cả camera' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /stop-all — tắt ghi tất cả camera của chi nhánh (desired-state)
router.post('/stop-all', verifyToken, requireStaff, storeContext, async (req, res) => {
  try {
    await prisma.camera.updateMany({ where: storeWhere(req), data: { recording: false } });
    if (CENTRAL_REC) recorder.stopAll();
    res.json({ success:true, message:'Đã dừng tất cả' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;