const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const { execSync } = require('child_process');
const prisma   = require('../lib/prisma');
const recorder = require('./recorder-services');
const { verifyToken } = require('../middleware/auth');
const { storeContext } = require('../middleware/storeContext');
const { storeWhere } = require('../lib/storeFilter');

const SCRIPTS_DIR = path.join(__dirname, '..', '..', 'scripts');

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
router.get('/config', verifyToken, storeContext, async (req, res) => {
  try {
    const storeId = req.storeId || 1;
    const config = await prisma.nasConfig.findUnique({ where: { store_id: storeId } });
    if (!config) return res.status(404).json({ error: 'Chưa có cấu hình' });
    res.json({ success: true, data: config });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /config
router.put('/config', verifyToken, storeContext, async (req, res) => {
  try {
    const storeId = req.storeId || 1;
    const { disks, segment_duration, rotate_days, date_format, output_format,
            codec, source_dir, delete_source, log_file, watch_interval } = req.body;
    if (!disks?.length) return res.status(400).json({ error: 'Cần ít nhất 1 HDD' });
    const payload = {
      disks, segment_duration:segment_duration||900, rotate_days:rotate_days||30,
      date_format:date_format||'%Y-%m-%d', output_format:output_format||'.mp4',
      codec:codec||'copy', source_dir:source_dir||'',
      delete_source:delete_source||false, log_file:log_file||'/tmp/nas.log',
      watch_interval:watch_interval||30, nas_root:disks[0]?.mount_path||'',
    };
    await prisma.nasConfig.upsert({
      where:  { store_id: storeId },
      update: payload,
      create: { store_id: storeId, ...payload },
    });
    res.json({ success:true, message:'Đã lưu cấu hình NAS' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /status
router.get('/status', verifyToken, storeContext, async (req, res) => {
  try {
    const storeId = req.storeId || 1;
    const [config, cameras] = await Promise.all([
      prisma.nasConfig.findUnique({ where:{ store_id: storeId } }),
      prisma.camera.findMany({ where: storeWhere(req) }),
    ]);
    const diskUsage = {};
    for (const disk of config?.disks||[]) {
      diskUsage[disk.id] = fs.existsSync(disk.mount_path)
        ? getDiskUsage(disk.mount_path)
        : { total_gb:0, used_gb:0, free_gb:0, percent_used:0, error:'Chưa mount' };
    }
    const cameraStatus = cameras.map(cam => ({
      id:cam.id, name:cam.name, disk_id:cam.disk_id, recording:cam.recording,
      ...recorder.getCameraStatus(cam.id),
    }));
    res.json({ success:true, data:{ disks:diskUsage, cameras:cameraStatus,
      totalRecording:Object.keys(recorder.getStatus()).length }});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /camera/:id/start
router.post('/camera/:id/start', async (req, res) => {
  try {
    const r = await recorder.startCamera(parseInt(req.params.id));
    res.json({ success:r.ok, message:r.message, pid:r.pid });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /camera/:id/stop
router.post('/camera/:id/stop', async (req, res) => {
  try {
    const r = await recorder.stopCamera(parseInt(req.params.id));
    res.json({ success:r.ok, message:r.message });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /camera/:id/toggle
router.post('/camera/:id/toggle', async (req, res) => {
  try {
    const r = await recorder.toggleCamera(parseInt(req.params.id));
    res.json({ success:r.ok, message:r.message, pid:r.pid });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /camera/:id/disk — gán camera vào HDD
router.patch('/camera/:id/disk', async (req, res) => {
  try {
    const { disk_id } = req.body;
    await prisma.camera.update({ where:{id:parseInt(req.params.id)}, data:{ disk_id } });
    res.json({ success:true, message:`Đã gán vào ${disk_id}` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /camera/:id/log
router.get('/camera/:id/log', async (req, res) => {
  try {
    res.json({ success:true, data: recorder.getCameraLog(parseInt(req.params.id)) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /start-all
router.post('/start-all', async (req, res) => {
  try {
    await recorder.restoreOnStartup();
    res.json({ success:true, message:'Đã bật tất cả camera' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /stop-all
router.post('/stop-all', async (req, res) => {
  try {
    recorder.stopAll();
    res.json({ success:true, message:'Đã dừng tất cả' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;