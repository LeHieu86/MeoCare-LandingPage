const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

// THAY ĐỔI: Import Prisma thay vì db
const prisma = require('../lib/prisma');

const SCRIPTS_DIR = path.join(__dirname, '..', '..', 'scripts');
const CONFIG_JSON_PATH = path.join(SCRIPTS_DIR, 'nas_config.json');
const PYTHON_SCRIPT_PATH = path.join(SCRIPTS_DIR, 'nas_video_splitter.py');
const LOG_FILE_PATH = path.join(SCRIPTS_DIR, 'nas_output.log');

// ================== GET /api/admin/nas/config ==================
router.get('/config', async (req, res) => {
  try {
    // THAY ĐỔI: Dùng findUnique lấy thẳng row id=1
    const config = await prisma.nasConfig.findUnique({ where: { id: 1 } });
    
    if (!config) return res.status(404).json({ error: 'Chua co cau hinh' });
    
    // ✨ PHÉP MẪU CỦA PRISMA: 
    // Vì trong Schema 'rooms' là Json và 'delete_source' là Boolean,
    // Nên Prisma tự động trả về mảng Array và Boolean true/false chuẩn của Javascript!
    // KHÔNG CẦN JSON.parse(config.rooms) hay config.delete_source === 1 nữa!
    
    res.json({ success: true, data: config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================== PUT /api/admin/nas/config ==================
router.put('/config', async (req, res) => {
  try {
    const { 
      nas_root, rooms, segment_duration, date_format, output_format, 
      codec, source_dir, delete_source, run_mode, log_file, watch_interval 
    } = req.body;

    if (!nas_root || !rooms || !Array.isArray(rooms) || rooms.length === 0) {
      return res.status(400).json({ error: 'nas_root va rooms khong hop le' });
    }

    // THAY ĐỔI: Dùng upsert (Update hoặc Insert nếu chưa có)
    // Dùng upsert cho an toàn 100% dù row id=1 có bị xóa hay không
    await prisma.nasConfig.upsert({
      where: { id: 1 },
      update: {
        nas_root,
        rooms, // Prisma tự động stringify JSON khi lưu vào Postgres
        segment_duration: segment_duration || 900,
        date_format: date_format || '%d-%m-%Y',
        output_format: output_format || '.mp4',
        codec: codec || 'copy',
        source_dir: source_dir || '/home/user/videos/input',
        delete_source: delete_source || false, // Prisma tự động xử lý Boolean
        // KHÔNG CẦN updated_at: datetime('now'), vì trong Schema đã có @updatedAt rồi!
      },
      create: {
        id: 1,
        nas_root,
        rooms,
        segment_duration: segment_duration || 900,
        date_format: date_format || '%d-%m-%Y',
        output_format: output_format || '.mp4',
        codec: codec || 'copy',
        source_dir: source_dir || '/home/user/videos/input',
        delete_source: delete_source || false,
      }
    });

    res.json({ success: true, message: 'Luu cau hinh thanh cong' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================== POST /api/admin/nas/generate ==================
router.post('/generate', async (req, res) => {
  try {
    const config = await prisma.nasConfig.findUnique({ where: { id: 1 } });
    if (!config) return res.status(404).json({ error: 'Chua co cau hinh' });
    
    if (!fs.existsSync(SCRIPTS_DIR)) fs.mkdirSync(SCRIPTS_DIR, { recursive: true });
    
    // Chuẩn bị config cho Python
    const pythonConfig = {
      nas_root: config.nas_root,
      rooms: config.rooms, // Đã là Array sẵn rồi, không cần JSON.parse
      segment_duration: config.segment_duration,
      date_format: config.date_format,
      output_format: config.output_format,
      codec: config.codec,
      source_dir: config.source_dir,
      delete_source: config.delete_source, // Đã là Boolean sẵn rồi, không cần === 1
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

// ================== CÁC ROUTE PHẦN CỨNG (KHÔNG ĐỤNG ĐẾN DATABASE) ==================
// Lưu ý: Các route bên dưới chỉ thêm chữ 'async' vào function,
// Logic xử lý File System (fs) và Tiến trình (exec) GIỮ NGUYÊN 100%.
// Không được thay đổi gì logic của chúng để tránh lỗi phần cứng!

// POST /api/admin/nas/run
router.post('/run', async (req, res) => {
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
router.post('/stop', async (req, res) => {
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
router.get('/logs', async (req, res) => {
  try {
    if (!fs.existsSync(LOG_FILE_PATH)) return res.json({ success: true, data: '' });
    res.json({ success: true, data: fs.readFileSync(LOG_FILE_PATH, 'utf-8') });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/nas/status
router.get('/status', async (req, res) => {
  try {
    const pidFile = path.join(SCRIPTS_DIR, 'nas_pid.txt');
    let running = false, pid = null;
    if (fs.existsSync(pidFile)) {
      pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim());
      try { process.kill(pid, 0); running = true; } catch { fs.unlinkSync(pidFile); }
    }
    res.json({ 
      success: true, 
      data: { 
        running, 
        pid, 
        configExists: fs.existsSync(CONFIG_JSON_PATH), 
        scriptExists: fs.existsSync(PYTHON_SCRIPT_PATH) 
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;