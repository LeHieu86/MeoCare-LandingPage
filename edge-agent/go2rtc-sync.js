/**
 * go2rtc-sync.js  (EDGE)
 * Port từ backend/routes/cameras.js syncToGo2RTC nhưng trỏ go2rtc CỤC BỘ của Kubuntu.
 * Ghi go2rtc.yaml (persist qua restart) + hot-sync qua REST API. Live view ưu tiên
 * sub-stream (H.264); main (H.265) dành cho ffmpeg ghi đĩa.
 */
const fs   = require('fs');
const path = require('path');

const YAML_PATH  = process.env.GO2RTC_YAML || path.join(__dirname, 'go2rtc.yaml');
const GO2RTC_API = process.env.GO2RTC_API_URL || 'http://localhost:1984';

const liveUrl = (c) => c.rtsp_sub_url || c.rtsp_url;

async function syncToGo2RTC(cameras) {
  const cams = (cameras || []).filter(c => c.rtsp_url);
  try {
    // 1) Ghi yaml để go2rtc khôi phục đúng streams sau restart
    let yaml = 'streams:\n';
    cams.forEach(c => { yaml += `  cam_${c.id}: ${liveUrl(c)}\n`; });
    // rtsp 8554 để app admin xem live trực tiếp qua tailnet: rtsp://<tailnet_host>:8554/cam_<id>
    yaml += `\napi:\n  origin: "*"\n\nrtsp:\n  listen: ":8554"\n\nwebrtc:\n  listen: ":8555"\n`;
    fs.writeFileSync(YAML_PATH, yaml, 'utf8');

    // 2) Hot-sync qua REST API: xoá stream thừa, add/update stream mới
    try {
      const listRes = await fetch(`${GO2RTC_API}/api/streams`);
      const current = listRes.ok ? await listRes.json() : {};
      const wanted  = new Set(cams.map(c => `cam_${c.id}`));

      for (const name of Object.keys(current)) {
        if (name.startsWith('cam_') && !wanted.has(name)) {
          await fetch(`${GO2RTC_API}/api/streams?src=${encodeURIComponent(name)}`, { method: 'DELETE' });
        }
      }
      for (const c of cams) {
        const name = `cam_${c.id}`;
        const url  = `${GO2RTC_API}/api/streams?name=${encodeURIComponent(name)}&src=${encodeURIComponent(liveUrl(c))}`;
        await fetch(url, { method: 'PUT' });
      }
      console.log(`✅ [go2rtc] Đã sync ${cams.length} stream cục bộ.`);
    } catch (apiErr) {
      console.warn('⚠ [go2rtc] Không gọi được REST API (yaml vẫn ghi):', apiErr.message);
    }
  } catch (err) {
    console.error('❌ [go2rtc] Lỗi sync:', err.message);
  }
}

module.exports = { syncToGo2RTC };
