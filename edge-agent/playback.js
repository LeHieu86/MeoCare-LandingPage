/**
 * playback.js  (EDGE)
 * HTTP server phục vụ XEM LẠI bản ghi cho app admin — CHỈ mở trong tailnet (Tailscale ACL).
 *   GET /recordings/dates?camId=<id>            → ['2026-06-09', ...] (ngày có bản ghi)
 *   GET /recordings?camId=<id>&date=YYYY-MM-DD  → [{file,size,mtime}, ...] (đoạn trong ngày)
 *   GET /recordings/file?camId=<id>&date=&file= → stream MP4 (hỗ trợ HTTP Range)
 *
 * Bảo mật: lấy camId (số) → tra ra tên cam + ổ trong config (KHÔNG nhận path từ client).
 * date/file validate bằng regex (chống path traversal). Tuỳ chọn PLAYBACK_TOKEN.
 */
const http = require('http');
const fs   = require('fs');
const fsp  = fs.promises;
const path = require('path');

const PORT  = parseInt(process.env.AGENT_HTTP_PORT || '8080', 10);
const TOKEN = process.env.PLAYBACK_TOKEN || '';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const FILE_RE = /^\d{2}-\d{2}-\d{2}\.mp4$/;

let getConfig = () => null;   // injected từ agent.js → trả lastConfig

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };
const sendJson = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json', ...CORS });
  res.end(JSON.stringify(obj));
};

// Tra camera theo id → { cam, disk } (mount cục bộ). null nếu không có/không gán ổ.
function resolveCam(config, camId) {
  const cam  = (config?.cameras || []).find(c => c.id === camId);
  if (!cam) return null;
  const disk = (config?.disks || []).find(d => d.id === cam.disk_id);
  if (!disk?.mount_path) return null;
  return { cam, disk };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://local');
    if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }

    if (TOKEN) {
      const t = req.headers['x-playback-token'] || url.searchParams.get('token');
      if (t !== TOKEN) return sendJson(res, 401, { error: 'unauthorized' });
    }

    const config = getConfig();
    const camId  = parseInt(url.searchParams.get('camId') || '', 10);
    const found  = resolveCam(config, camId);

    // ── Danh sách ngày ──────────────────────────────────────────────
    if (url.pathname === '/recordings/dates') {
      if (!found) return sendJson(res, 404, { error: 'camera' });
      const camDir = path.join(found.disk.mount_path, found.cam.name);
      let dates = [];
      try {
        const ents = await fsp.readdir(camDir, { withFileTypes: true });
        dates = ents.filter(d => d.isDirectory() && DATE_RE.test(d.name))
                    .map(d => d.name).sort().reverse();
      } catch { /* chưa có thư mục */ }
      return sendJson(res, 200, { success: true, camId, dates });
    }

    // ── Danh sách đoạn trong 1 ngày ─────────────────────────────────
    if (url.pathname === '/recordings') {
      if (!found) return sendJson(res, 404, { error: 'camera' });
      const date = url.searchParams.get('date') || '';
      if (!DATE_RE.test(date)) return sendJson(res, 400, { error: 'date' });
      const dir = path.join(found.disk.mount_path, found.cam.name, date);
      const files = [];
      try {
        for (const name of await fsp.readdir(dir)) {
          if (!FILE_RE.test(name)) continue;
          const st = await fsp.stat(path.join(dir, name));
          files.push({ file: name, size: st.size, mtime: st.mtimeMs });
        }
      } catch { /* chưa có */ }
      files.sort((a, b) => a.file.localeCompare(b.file));
      return sendJson(res, 200, { success: true, camId, date, files });
    }

    // ── Stream 1 file MP4 (Range) ───────────────────────────────────
    if (url.pathname === '/recordings/file') {
      if (!found) return sendJson(res, 404, { error: 'camera' });
      const date = url.searchParams.get('date') || '';
      const file = url.searchParams.get('file') || '';
      if (!DATE_RE.test(date) || !FILE_RE.test(file)) return sendJson(res, 400, { error: 'bad path' });

      const filePath = path.join(found.disk.mount_path, found.cam.name, date, file);
      let st;
      try { st = await fsp.stat(filePath); } catch { return sendJson(res, 404, { error: 'not found' }); }

      const headers = { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', ...CORS };
      const range = req.headers.range;
      if (range) {
        const m = /bytes=(\d+)-(\d*)/.exec(range);
        const start = m ? parseInt(m[1], 10) : 0;
        const end   = m && m[2] ? parseInt(m[2], 10) : st.size - 1;
        if (start >= st.size || end >= st.size || start > end) {
          res.writeHead(416, { 'Content-Range': `bytes */${st.size}`, ...CORS });
          return res.end();
        }
        headers['Content-Range']  = `bytes ${start}-${end}/${st.size}`;
        headers['Content-Length'] = end - start + 1;
        res.writeHead(206, headers);
        fs.createReadStream(filePath, { start, end }).pipe(res);
      } else {
        headers['Content-Length'] = st.size;
        res.writeHead(200, headers);
        fs.createReadStream(filePath).pipe(res);
      }
      return;
    }

    sendJson(res, 404, { error: 'not found' });
  } catch (e) {
    try { sendJson(res, 500, { error: e.message }); } catch { /* socket đã đóng */ }
  }
});

function start(configGetter) {
  getConfig = configGetter;
  server.listen(PORT, () => console.log(`[Agent] Playback HTTP trên :${PORT}${TOKEN ? ' (có token)' : ' (tailnet-only)'}`));
}

module.exports = { start };
