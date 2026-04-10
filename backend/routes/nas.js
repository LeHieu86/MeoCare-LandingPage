const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const db = require('../db/database');

const SCRIPTS_DIR = path.join(__dirname, '..', '..', 'scripts');
const CONFIG_JSON_PATH = path.join(SCRIPTS_DIR, 'nas_config.json');
const RECORDER_SCRIPT = path.join(SCRIPTS_DIR, 'nas_recorder.py');
const LOG_FILE_PATH = path.join(SCRIPTS_DIR, 'nas_output.log');
const PID_FILE = path.join(SCRIPTS_DIR, 'nas_pid.txt');

// Luu reference den child process
let recorderChild = null;

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
    const { nas_root, rooms, segment_duration, date_format, output_format, codec, source_dir, log_file, watch_interval } = req.body;
    if (!nas_root || !rooms || !Array.isArray(rooms) || rooms.length === 0) {
      return res.status(400).json({ error: 'nas_root va rooms khong hop le' });
    }
    db.prepare(`
      UPDATE nas_config SET
        nas_root = ?, rooms = ?, segment_duration = ?, date_format = ?,
        output_format = ?, codec = ?, source_dir = ?,
        log_file = ?, watch_interval = ?,
        updated_at = datetime('now', 'localtime')
      WHERE id = 1
    `).run(
      nas_root, JSON.stringify(rooms), segment_duration || 900,
      date_format || '%d-%m-%Y', output_format || '.mp4', codec || 'copy',
      source_dir || '', log_file || '/tmp/nas_recorder.log', watch_interval || 30
    );
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

    const rooms = JSON.parse(config.rooms || '[]');

    const enrichedRooms = rooms.map(room => {
      let rtsp_url = null;
      if (room.camera_id) {
        const camera = db.prepare('SELECT rtsp_url FROM cameras WHERE id = ?').get(room.camera_id);
        rtsp_url = camera ? camera.rtsp_url : null;
      }
      return {
        name: room.name,
        rtsp_url: rtsp_url
      };
    });

    const logPath = path.join(SCRIPTS_DIR, 'nas_output.log').replace(/\\/g, '/');

    const pythonConfig = {
      nas_root: config.nas_root,
      rooms: enrichedRooms,
      segment_duration: config.segment_duration,
      date_format: config.date_format,
      output_format: config.output_format,
      codec: config.codec,
      log_file: logPath,
      watch_interval: config.watch_interval
    };

    fs.writeFileSync(CONFIG_JSON_PATH, JSON.stringify(pythonConfig, null, 2), 'utf-8');

    const missing = enrichedRooms.filter(r => !r.rtsp_url).map(r => r.name);
    if (missing.length > 0) {
      return res.json({
        success: true,
        warning: `Cac phong chua chon camera: ${missing.join(', ')}`,
        config_path: CONFIG_JSON_PATH
      });
    }

    res.json({ success: true, message: 'Da sinh config', config_path: CONFIG_JSON_PATH });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/nas/run
router.post('/run', (req, res) => {
  try {
    if (!fs.existsSync(RECORDER_SCRIPT)) {
      return res.status(404).json({ error: 'Khong tim thay nas_recorder.py' });
    }
    if (!fs.existsSync(CONFIG_JSON_PATH)) {
      return res.status(404).json({ error: 'Chua sinh config' });
    }

    // Kiem tra process THUC SU con song hay khong
    if (fs.existsSync(PID_FILE)) {
      const oldPid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim());
      try {
        process.kill(oldPid, 0);
        return res.status(409).json({ error: 'Recorder dang chay! Vui long Dung truoc.' });
      } catch {
        try { fs.unlinkSync(PID_FILE); } catch {}
      }
    }

    // Kiem tra config co phong nao thieu RTSP
    const configRaw = fs.readFileSync(CONFIG_JSON_PATH, 'utf-8');
    const config = JSON.parse(configRaw);
    const missing = config.rooms.filter(r => !r.rtsp_url).map(r => r.name);
    if (missing.length > 0) {
      return res.status(400).json({ error: `Phong chua co RTSP: ${missing.join(', ')}` });
    }

    // Xoa log cu
    if (fs.existsSync(LOG_FILE_PATH)) fs.unlinkSync(LOG_FILE_PATH);
    fs.writeFileSync(LOG_FILE_PATH, '', 'utf-8');

    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const command = `${pythonCmd} "${RECORDER_SCRIPT}"`;

    const child = exec(command, { cwd: SCRIPTS_DIR, maxBuffer: 10 * 1024 * 1024 });

    // Ghi stdout/stderr vao log
    child.stdout.on('data', (data) => {
      fs.appendFileSync(LOG_FILE_PATH, data.toString(), 'utf-8');
    });
    child.stderr.on('data', (data) => {
      fs.appendFileSync(LOG_FILE_PATH, data.toString(), 'utf-8');
    });

    // CHI XOA PID KHI CHILD THUC SU EXIT
    child.on('exit', (code) => {
      const endLog = `\n[${new Date().toLocaleString('vi-VN')}] --- RECORDER STOP (code: ${code}) ---\n`;
      fs.appendFileSync(LOG_FILE_PATH, endLog);
      try { fs.unlinkSync(PID_FILE); } catch {}
      if (recorderChild === child) recorderChild = null;
    });

    // Luu pid NGAY - KHONG xoa cho den khi child.on('exit')
    const pid = child.pid;
    fs.writeFileSync(PID_FILE, String(pid), 'utf-8');

    // Luu reference
    recorderChild = child;

    res.json({ success: true, message: `Dang ghi (PID: ${pid})`, pid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/nas/stop
router.post('/stop', (req, res) => {
  try {
    if (!fs.existsSync(PID_FILE)) {
      return res.json({ success: true, message: 'Khong co recorder dang chay.' });
    }

    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim());

    // Gui SIGTERM - KHONG xoa PID file
    // Python se ghi xong file cuoi roi tu exit
    // child.on('exit') moi xoa PID file
    if (recorderChild && recorderChild.kill) {
      recorderChild.kill('SIGTERM');
    } else {
      try { process.kill(pid, 'SIGTERM'); } catch {
        try { fs.unlinkSync(PID_FILE); } catch {}
        return res.json({ success: true, message: 'Recorder da dung.' });
      }
    }

    fs.appendFileSync(LOG_FILE_PATH, '\n[STOP] Yeu cau dung boi admin. Dang cho file cuoi ghi xong...\n');
    res.json({ success: true, message: `Da gui yeu cau dung PID: ${pid}. Dang cho file cuoi ghi xong...` });
  } catch {
    res.json({ success: true, message: 'Loi khi dung recorder.' });
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
    let running = false;
    let pid = null;

    if (fs.existsSync(PID_FILE)) {
      pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim());
      // signal 0 = chi kiem tra song chet, khong giet
      try {
        process.kill(pid, 0);
        running = true;
      } catch {
        // Process da chet THUC SU → xoa pid file
        try { fs.unlinkSync(PID_FILE); } catch {}
        pid = null;
      }
    }

    res.json({
      success: true,
      data: {
        running,
        pid,
        configExists: fs.existsSync(CONFIG_JSON_PATH),
        scriptExists: fs.existsSync(RECORDER_SCRIPT)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
