const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const db = require('../db/database');

const SCRIPTS_DIR = path.join(__dirname, '..', '..', 'scripts');
const CONFIG_JSON_PATH = path.join(SCRIPTS_DIR, 'nas_config.json');
const PYTHON_SCRIPT_PATH = path.join(SCRIPTS_DIR, 'nas_video_splitter.py');
const LOG_FILE_PATH = path.join(SCRIPTS_DIR, 'nas_output.log');

// GET /api/admin/nas/config
router.get('/config', (req, res) => {
  try {
    const config = db.prepare('SELECT * FROM nas_config WHERE id = 1').get();
    if (!config) return res.status(404).json({ error: 'Chua co cau hinh' });
    config.rooms = JSON.parse(config.rooms || '[]');
    config.delete_source = config.delete_source === 1;
    res.json({ success: true, data: config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/nas/config
router.put('/config', (req, res) => {
  try {
    const { nas_root, rooms, segment_duration, date_format, output_format, codec, source_dir, delete_source, run_mode, log_file, watch_interval } = req.body;
    if (!nas_root || !rooms || !Array.isArray(rooms) || rooms.length === 0) {
      return res.status(400).json({ error: 'nas_root va rooms khong hop le' });
    }
    db.prepare(`
      UPDATE nas_config SET
        nas_root = ?, rooms = ?, segment_duration = ?, date_format = ?,
        output_format = ?, codec = ?, source_dir = ?, delete_source = ?,
        run_mode = ?, log_file = ?, watch_interval = ?,
        updated_at = datetime('now', 'localtime')
      WHERE id = 1
    `).run(nas_root, JSON.stringify(rooms), segment_duration, date_format || '%d-%m-%Y', output_format || '.mp4', codec || 'copy', source_dir || '/home/user/videos/input', delete_source ? 1 : 0, run_mode || 'once', log_file || '/tmp/nas_video_splitter.log', watch_interval || 30);
    res.json({ success: true, message: 'Luu cau hinh thanh cong' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/nas/generate
router.post('/generate', (req, res) => {
  try {
    const config = db.prepare('SELECT * FROM nas_config WHERE id = 1').get();
    if (!config) return res.status(404).json({ error: 'Chua co cau hinh' });
    if (!fs.existsSync(SCRIPTS_DIR)) fs.mkdirSync(SCRIPTS_DIR, { recursive: true });
    const pythonConfig = {
      nas_root: config.nas_root,
      rooms: JSON.parse(config.rooms || '[]'),
      segment_duration: config.segment_duration,
      date_format: config.date_format,
      output_format: config.output_format,
      codec: config.codec,
      source_dir: config.source_dir,
      delete_source: config.delete_source === 1,
      log_file: config.log_file,
      watch_interval: config.watch_interval,
      video_extensions: ['.mp4', '.mkv', '.avi', '.mov', '.flv', '.wmv', '.ts']
    };
    fs.writeFileSync(CONFIG_JSON_PATH, JSON.stringify(pythonConfig, null, 2), 'utf-8');
    res.json({ success: true, message: 'Da sinh file config', config_path: CONFIG_JSON_PATH });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/nas/run
router.post('/run', (req, res) => {
  try {
    if (!fs.existsSync(PYTHON_SCRIPT_PATH)) {
      return res.status(404).json({ error: 'Khong tim thay script Python', path: PYTHON_SCRIPT_PATH });
    }
    if (!fs.existsSync(CONFIG_JSON_PATH)) {
      return res.status(404).json({ error: 'Chua sinh file config' });
    }
    const runMode = req.body.mode || 'once';
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    let command = `${pythonCmd} "${PYTHON_SCRIPT_PATH}"`;
    if (runMode === 'watch') command += ' --watch';

    if (fs.existsSync(LOG_FILE_PATH)) fs.unlinkSync(LOG_FILE_PATH);
    fs.writeFileSync(LOG_FILE_PATH, '', 'utf-8');

    const child = exec(command, { cwd: SCRIPTS_DIR, maxBuffer: 10 * 1024 * 1024 }, (error) => {
      const finalLog = `\n[${new Date().toLocaleString('vi-VN')}] --- SCRIPT KET THUC ---\n`;
      fs.appendFileSync(LOG_FILE_PATH, finalLog + (error ? `Loi: ${error.message}\n` : 'Hoan thanh.\n'));
    });

    child.stdout.on('data', (data) => fs.appendFileSync(LOG_FILE_PATH, data.toString(), 'utf-8'));
    child.stderr.on('data', (data) => fs.appendFileSync(LOG_FILE_PATH, data.toString(), 'utf-8'));

    const pid = child.pid;
    fs.writeFileSync(path.join(SCRIPTS_DIR, 'nas_pid.txt'), String(pid), 'utf-8');
    res.json({ success: true, message: `Script dang chay (PID: ${pid})`, pid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/nas/stop
router.post('/stop', (req, res) => {
  try {
    const pidFile = path.join(SCRIPTS_DIR, 'nas_pid.txt');
    if (!fs.existsSync(pidFile)) return res.json({ success: true, message: 'Khong co script nao dang chay' });
    const pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim());
    if (process.platform === 'win32') exec(`taskkill /PID ${pid} /F`);
    else process.kill(pid, 'SIGTERM');
    fs.unlinkSync(pidFile);
    fs.appendFileSync(LOG_FILE_PATH, '\n[STOP] Script da bi dung boi admin.\n');
    res.json({ success: true, message: `Da dung script PID: ${pid}` });
  } catch {
    res.json({ success: true, message: 'Khong the dung hoac script da dung' });
  }
});

// GET /api/admin/nas/logs
router.get('/logs', (req, res) => {
  try {
    if (!fs.existsSync(LOG_FILE_PATH)) return res.json({ success: true, data: '' });
    res.json({ success: true, data: fs.readFileSync(LOG_FILE_PATH, 'utf-8') });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/nas/status
router.get('/status', (req, res) => {
  try {
    const pidFile = path.join(SCRIPTS_DIR, 'nas_pid.txt');
    let running = false, pid = null;
    if (fs.existsSync(pidFile)) {
      pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim());
      try { process.kill(pid, 0); running = true; } catch { fs.unlinkSync(pidFile); }
    }
    res.json({ success: true, data: { running, pid, configExists: fs.existsSync(CONFIG_JSON_PATH), scriptExists: fs.existsSync(PYTHON_SCRIPT_PATH) }});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;