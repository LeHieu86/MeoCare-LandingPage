import { useState, useEffect, useRef, useCallback } from "react";
import "../../styles/admin/admin.css";

const API = import.meta.env.VITE_API_URL || "/api";

export default function NASManager() {
  const [config, setConfig] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState('');
  const [status, setStatus] = useState(null);
  const [activeTab, setActiveTab] = useState('config');
  const [message, setMessage] = useState(null);
  const logRef = useRef(null);

  const getHeaders = () => {
    const token = localStorage.getItem("mc_admin_token");
    return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  };
  const apiGet = async (url) => (await fetch(url, { headers: getHeaders() })).json();
  const apiPost = async (url, body = {}) => (await fetch(url, { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) })).json();
  const apiPut = async (url, body = {}) => (await fetch(url, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(body) })).json();

  const loadConfig = useCallback(async () => {
    try {
      const res = await apiGet(`${API}/admin/nas/config`);
      if (res.success) setConfig(res.data);
    } catch { setMessage({ text: 'Khong the tai cau hinh', type: 'error' }); }
    finally { setLoading(false); }
  }, []);

  const loadStatus = useCallback(async () => {
    try { const res = await apiGet(`${API}/admin/nas/status`); if (res.success) setStatus(res.data); } catch {}
  }, []);

  const loadLogs = useCallback(async () => {
    try { const res = await apiGet(`${API}/admin/nas/logs`); if (res.success) setLogs(res.data); } catch {}
  }, []);

  useEffect(() => { loadConfig(); loadStatus(); }, [loadConfig, loadStatus]);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiGet(`${API}/cameras`);
        if (Array.isArray(res.data)) setCameras(res.data);
        else if (Array.isArray(res)) setCameras(res);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (activeTab === 'logs') {
      loadLogs();
      const t = setInterval(loadLogs, 2000);
      return () => clearInterval(t);
    }
  }, [activeTab, loadLogs]);

  useEffect(() => {
    if (activeTab === 'logs' && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs, activeTab]);

  const showMsg = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const updateRoom = (idx, field, value) => {
    const newRooms = [...config.rooms];
    newRooms[idx] = { ...newRooms[idx], [field]: field === 'camera_id' ? (parseInt(value) || null) : value };
    setConfig({ ...config, rooms: newRooms });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiPut(`${API}/admin/nas/config`, config);
      if (res.success) { showMsg('Luu thanh cong'); loadStatus(); }
      else showMsg(res.error || 'Loi', 'error');
    } catch { showMsg('Loi ket noi', 'error'); }
    finally { setSaving(false); }
  };

  const handleGenerate = async () => {
    try {
      const res = await apiPost(`${API}/admin/nas/generate`);
      if (res.warning) showMsg(res.warning, 'warn');
      else if (res.success) showMsg(res.message);
      else showMsg(res.error || 'Loi', 'error');
      loadStatus();
    } catch { showMsg('Loi ket noi', 'error'); }
  };

  const handleRun = async () => {
    try {
      const res = await apiPost(`${API}/admin/nas/run`);
      if (res.success) { showMsg(res.message); loadStatus(); setActiveTab('logs'); }
      else showMsg(res.error || 'Loi', 'error');
    } catch { showMsg('Loi ket noi', 'error'); }
  };

  const handleStop = async () => {
    try {
      const res = await apiPost(`${API}/admin/nas/stop`);
      showMsg(res.message); loadStatus();
    } catch {}
  };

  const renderPreview = () => {
    if (!config) return null;
    const now = new Date();
    const fmt = config.date_format;
    const dateStr = fmt.replace('%d', String(now.getDate()).padStart(2, '0')).replace('%m', String(now.getMonth() + 1).padStart(2, '0')).replace('%Y', now.getFullYear());
    const segMin = config.segment_duration / 60;

    return (
      <div style={{ fontFamily: 'monospace', fontSize: 13, background: '#0a0f1a', padding: 20, borderRadius: 8, border: '1px solid #1e293b', overflow: 'auto' }}>
        {config.rooms.map(room => {
          const cam = cameras.find(c => c.id === room.camera_id);
          return (
            <div key={room.name}>
              <div><span style={{ color: '#64748b' }}>├── </span><span style={{ color: '#00d4aa', fontWeight: 600 }}>{config.nas_root}/</span></div>
              <div><span style={{ color: '#64748b' }}>│   └── </span><span style={{ color: '#00d4aa', fontWeight: 600 }}>{room.name}/</span></div>
              <div><span style={{ color: '#64748b' }}>│       └── </span><span style={{ color: '#f59e0b', fontWeight: 600 }}>{dateStr}/</span> <span style={{ color: '#475569', fontSize: 11 }}>(tu dong)</span></div>
              {[1, 2, 3].map(i => {
                const s = (i - 1) * segMin, e = i * segMin;
                const sh = String(Math.floor(s / 60)).padStart(2, '0'), sm = String(s % 60).padStart(2, '0');
                const eh = String(Math.floor(e / 60)).padStart(2, '0'), em = String(e % 60).padStart(2, '0');
                return (
                  <div key={i}>
                    <span style={{ color: '#64748b' }}>│           ├── </span>
                    <span style={{ color: '#e2e8f0' }}>part_{sh}{sm}00{config.output_format}</span>
                    <span style={{ color: '#475569', fontSize: 11 }}> ({sh}:{sm}:00 - {eh}:{em}:00)</span>
                  </div>
                );
              })}
              {cam && <div><span style={{ color: '#64748b' }}>│           </span><span style={{ color: '#475569', fontSize: 11 }}>Camera: {cam.name} ({cam.rtsp_url})</span></div>}
              <div><span style={{ color: '#64748b' }}>│           └── </span><span style={{ color: '#475569' }}>...</span></div>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400, color: '#64748b' }}>Dang tai...</div>;
  if (!config) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400, color: '#ef4444' }}>Khong the tai cau hinh</div>;

  const S = { input: { width: '100%', padding: '10px 14px', background: '#0a0f1a', border: '1px solid #1e293b', borderRadius: 8, color: '#f1f5f9', fontSize: 14, outline: 'none' }, select: { width: '100%', padding: '10px 14px', background: '#0a0f1a', border: '1px solid #1e293b', borderRadius: 8, color: '#f1f5f9', fontSize: 14, outline: 'none' }, label: { display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }, field: { marginBottom: 18 } };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      {message && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '12px 20px', borderRadius: 8, background: message.type === 'error' ? '#1c1017' : message.type === 'warn' ? '#1a1500' : '#0a1a15', border: `1px solid ${message.type === 'error' ? '#7f1d1d' : message.type === 'warn' ? '#713f12' : '#064e3b'}`, color: message.type === 'error' ? '#fca5a5' : message.type === 'warn' ? '#fcd34d' : '#6ee7b7', fontSize: 13, fontWeight: 500 }}>{message.text}</div>
      )}

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>Quan ly NAS Video</h1>
        <p style={{ fontSize: 13, color: '#64748b' }}>Tu dong ghi video tu camera, chia 15p/file, luu theo Phong/Ngay tren NAS</p>
      </div>

      {status && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: status.running ? '#0a1a15' : '#0f1219', border: `1px solid ${status.running ? '#064e3b' : '#1e293b'}`, color: status.running ? '#6ee7b7' : '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: status.running ? '#10b981' : '#475569', boxShadow: status.running ? '0 0 6px #10b981' : 'none' }} />
            {status.running ? `Dang ghi (PID: ${status.pid})` : 'Khong ghi'}
          </div>
          {[['Config', status.configExists], ['Script', status.scriptExists]].map(([label, ok]) => (
            <div key={label} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, background: ok ? '#0a1a15' : '#1c1017', border: `1px solid ${ok ? '#064e3b' : '#7f1d1d'}`, color: ok ? '#6ee7b7' : '#fca5a5' }}>{label}: {ok ? 'OK' : 'Thieu'}</div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid #1e293b' }}>
        {[['config', 'Cau hinh'], ['preview', 'Xem truoc'], ['action', 'Thuc thi'], ['logs', 'Logs']].map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{ padding: '10px 20px', border: 'none', background: 'transparent', color: activeTab === id ? '#00d4aa' : '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer', borderBottom: activeTab === id ? '2px solid #00d4aa' : '2px solid transparent', marginBottom: -1 }}>
            {label}
          </button>
        ))}
      </div>

      {/* TAB: Cấu hình */}
      {activeTab === 'config' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20 }}>
          <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: 24 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16 }}>Phong → Camera mapping</h3>

            <div style={{ border: '1px solid #1e293b', borderRadius: 8, overflow: 'hidden', marginBottom: 18 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#0a0f1a' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, color: '#64748b', fontWeight: 600 }}>Ten phong</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, color: '#64748b', fontWeight: 600 }}>Camera</th>
                    <th style={{ width: 50 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {config.rooms.map((room, idx) => (
                    <tr key={idx} style={{ borderTop: '1px solid #1e293b' }}>
                      <td style={{ padding: '6px 14px' }}>
                        <input value={room.name} onChange={e => updateRoom(idx, 'name', e.target.value)} style={{ ...S.input, background: 'transparent', border: 'none', padding: 0 }} placeholder="PhongA01" />
                      </td>
                      <td style={{ padding: '6px 14px' }}>
                        <select value={room.camera_id || ''} onChange={e => updateRoom(idx, 'camera_id', e.target.value)} style={{ ...S.select, background: '#0a0f1a', padding: '6px 10px', fontSize: 13 }}>
                          <option value="">— Chon camera —</option>
                          {cameras.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '6px 14px', textAlign: 'center' }}>
                        <button onClick={() => setConfig({ ...config, rooms: config.rooms.filter((_, i) => i !== idx) })} style={{ border: 'none', background: 'transparent', color: '#f87171', cursor: 'pointer', fontSize: 15 }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ padding: '10px 14px', borderTop: '1px solid #1e293b' }}>
                <button onClick={() => setConfig({ ...config, rooms: [...config.rooms, { name: '', camera_id: null }] })} style={{ border: 'none', background: 'transparent', color: '#00d4aa', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>+ Them phong</button>
              </div>
            </div>

            <div style={S.field}>
              <label style={S.label}>Duong dan NAS</label>
              <input value={config.nas_root} onChange={e => setConfig({ ...config, nas_root: e.target.value })} style={S.input} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={S.field}>
                <label style={S.label}>Dinh dang ngay</label>
                <select value={config.date_format} onChange={e => setConfig({ ...config, date_format: e.target.value })} style={S.select}>
                  <option value="%d-%m-%Y">DD-MM-YYYY</option>
                  <option value="%Y-%m-%d">YYYY-MM-DD</option>
                  <option value="%d_%m_%Y">DD_MM_YYYY</option>
                </select>
              </div>
              <div style={S.field}>
                <label style={S.label}>Thoi luong moi file (giay)</label>
                <input type="number" value={config.segment_duration} onChange={e => setConfig({ ...config, segment_duration: parseInt(e.target.value) || 900 })} min={60} style={S.input} />
              </div>
            </div>
          </div>

          <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: 24 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16 }}>Thong tin</h3>
            {[
              ['So phong', config.rooms.length],
              ['Camera available', cameras.length],
              ['Phong da map camera', config.rooms.filter(r => r.camera_id).length],
              ['Thoi luong moi file', `${config.segment_duration / 60} phut`],
              ['Video 1 gio =', `${Math.ceil(60 / (config.segment_duration / 60))} file`],
              ['Video 24 gio =', `${Math.ceil(1440 / (config.segment_duration / 60))} file/phong/ngay`],
            ].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#0a0f1a', borderRadius: 8, border: '1px solid #1e293b', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: '#64748b' }}>{l}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: l.includes('=') ? '#00d4aa' : '#f1f5f9' }}>{v}</span>
              </div>
            ))}

            <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={handleSave} disabled={saving} style={{ padding: '12px 32px', background: saving ? '#1e293b' : '#00d4aa', color: saving ? '#64748b' : '#0a0f1a', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Dang luu...' : 'Luu cau hinh'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB: Xem trước */}
      {activeTab === 'preview' && (
        <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: 24 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16 }}>Cau truc thu muc se duoc tao tren NAS</h3>
          {renderPreview()}
        </div>
      )}

      {/* TAB: Thực thi */}
      {activeTab === 'action' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: 24 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16 }}>Buoc 1: Sinh config</h3>
            <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7, marginBottom: 20 }}>Gan RTSP URL tu camera vao cau hinh. Moi lan them/sua camera, can sinh config lai.</p>
            <button onClick={handleGenerate} style={{ width: '100%', padding: '12px', background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, color: '#f1f5f9', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Sinh Config</button>
          </div>
          <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: 24 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16 }}>Buoc 2: Bat dau / Dung ghi</h3>
            <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7, marginBottom: 20 }}>FFmpeg se ghi lien tuc tu camera, cat 15p/file, luu thang len NAS. Tu dong restart neu crash.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleRun} disabled={status?.running} style={{ flex: 1, padding: '12px', background: status?.running ? '#1e293b' : '#00d4aa', border: 'none', borderRadius: 8, color: status?.running ? '#64748b' : '#0a0f1a', fontSize: 14, fontWeight: 700, cursor: status?.running ? 'not-allowed' : 'pointer' }}>Bat dau ghi</button>
              {status?.running && (
                <button onClick={handleStop} style={{ padding: '12px 16px', background: '#1c1017', border: '1px solid #7f1d1d', borderRadius: 8, color: '#fca5a5', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Dung</button>
              )}
            </div>
          </div>
          <div style={{ gridColumn: 'span 2', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 10, padding: 16, display: 'flex', gap: 12 }}>
            <span style={{ color: '#f59e0b', fontSize: 16 }}>⚠</span>
            <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7 }}>
              <strong style={{ color: '#f59e0b' }}>Luu y:</strong> NAS phai duoc mount truoc khi bat dau ghi. Moi phong PHAI chon camera. Khi thay doi camera RTSP URL, can "Sinh Config" lai roi "Dung ghi" va "Bat dau ghi" lai.
            </div>
          </div>
        </div>
      )}

      {/* TAB: Logs */}
      {activeTab === 'logs' && (
        <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: '#0a0f1a', borderBottom: '1px solid #1e293b' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} />
            </div>
            <span style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>{status?.running ? 'Cap nhat moi 2 giay...' : 'Khong ghi'}</span>
          </div>
          <pre ref={logRef} style={{ padding: 16, margin: 0, maxHeight: 500, overflow: 'auto', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.7, color: '#94a3b8', background: '#060a10' }}>
            {logs || 'Chua co log. Bat dau ghi de xem log.'}
          </pre>
        </div>
      )}
    </div>
  );
}
