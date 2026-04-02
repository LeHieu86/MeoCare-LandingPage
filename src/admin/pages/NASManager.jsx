import { useState, useEffect, useRef, useCallback } from 'react';
import "../../styles/admin/admin.css";
// import { api } from '../../hooks/api'; // Import api từ project của bạn, hoặc dùng fetch trực tiếp

// Nếu project bạn dùng fetch trực tiếp, thay api.get/post bằng:
// const api = {
//   get: (url) => fetch(url, { headers: authHeaders() }).then(r => r.json()),
//   post: (url, body) => fetch(url, { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
//   put: (url, body) => fetch(url, { method: 'PUT', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
// };

const API_BASE = '/api/admin/nas';

export default function NASManager() {
  // ===== State =====
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newRoom, setNewRoom] = useState('');
  const [logs, setLogs] = useState('');
  const [status, setStatus] = useState(null);
  const [activeTab, setActiveTab] = useState('config');
  const [message, setMessage] = useState(null);
  const logIntervalRef = useRef(null);

  // ===== Lấy auth headers =====
  const getHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  };

  // ===== Fetch helpers =====
  const apiGet = async (url) => {
    const res = await fetch(url, { headers: getHeaders() });
    return res.json();
  };
  const apiPost = async (url, body = {}) => {
    const res = await fetch(url, { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) });
    return res.json();
  };
  const apiPut = async (url, body = {}) => {
    const res = await fetch(url, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(body) });
    return res.json();
  };

  // ===== Load cấu hình =====
  const loadConfig = useCallback(async () => {
    try {
      const res = await apiGet(`${API_BASE}/config`);
      if (res.success) setConfig(res.data);
    } catch (err) {
      showMessage('Khong the tai cau hinh', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  // ===== Load trạng thái =====
  const loadStatus = useCallback(async () => {
    try {
      const res = await apiGet(`${API_BASE}/status`);
      if (res.success) setStatus(res.data);
    } catch {}
  }, []);

  // ===== Load logs =====
  const loadLogs = useCallback(async () => {
    try {
      const res = await apiGet(`${API_BASE}/logs`);
      if (res.success) setLogs(res.data);
    } catch {}
  }, []);

  // ===== Init =====
  useEffect(() => {
    loadConfig();
    loadStatus();
  }, [loadConfig, loadStatus]);

  // ===== Auto refresh logs khi đang chạy =====
  useEffect(() => {
    if (activeTab === 'logs') {
      loadLogs();
      logIntervalRef.current = setInterval(loadLogs, 2000);
    }
    return () => {
      if (logIntervalRef.current) clearInterval(logIntervalRef.current);
    };
  }, [activeTab, loadLogs]);

  // ===== Message =====
  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  // ===== Room management =====
  const addRoom = () => {
    const name = newRoom.trim();
    if (!name) return;
    if (config.rooms.includes(name)) {
      showMessage('Phong da ton tai', 'error');
      return;
    }
    setConfig({ ...config, rooms: [...config.rooms, name] });
    setNewRoom('');
  };

  const removeRoom = (name) => {
    if (config.rooms.length <= 1) {
      showMessage('Phai co it nhat 1 phong', 'error');
      return;
    }
    setConfig({ ...config, rooms: config.rooms.filter(r => r !== name) });
  };

  // ===== Lưu cấu hình =====
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiPut(`${API_BASE}/config`, config);
      if (res.success) {
        showMessage('Luu cau hinh thanh cong');
        loadStatus();
      } else {
        showMessage(res.error || 'Loi luu cau hinh', 'error');
      }
    } catch {
      showMessage('Loi ket noi server', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ===== Sinh config file =====
  const handleGenerate = async () => {
    try {
      const res = await apiPost(`${API_BASE}/generate`);
      if (res.success) {
        showMessage('Da sinh file config cho Python');
        loadStatus();
      } else {
        showMessage(res.error || 'Loi sinh config', 'error');
      }
    } catch {
      showMessage('Loi ket noi server', 'error');
    }
  };

  // ===== Chạy script =====
  const handleRun = async (mode = 'once') => {
    try {
      const res = await apiPost(`${API_BASE}/run`, { mode });
      if (res.success) {
        showMessage(res.message);
        loadStatus();
        setActiveTab('logs');
      } else {
        showMessage(res.error || 'Loi chay script', 'error');
      }
    } catch {
      showMessage('Loi ket noi server', 'error');
    }
  };

  // ===== Dừng script =====
  const handleStop = async () => {
    try {
      const res = await apiPost(`${API_BASE}/stop`);
      showMessage(res.message);
      loadStatus();
    } catch {}
  };

  // ===== Xem trước cấu trúc thư mục =====
  const renderPreview = () => {
    if (!config) return null;
    const now = new Date();
    const fmt = config.date_format;
    const dateStr = fmt
      .replace('%d', String(now.getDate()).padStart(2, '0'))
      .replace('%m', String(now.getMonth() + 1).padStart(2, '0'))
      .replace('%Y', now.getFullYear());
    const segMin = config.segment_duration / 60;

    return (
      <div style={{ fontFamily: 'monospace', fontSize: 13, background: '#0a0f1a', padding: 20, borderRadius: 8, border: '1px solid #1e293b', overflow: 'auto' }}>
        {config.rooms.map(room => (
          <div key={room}>
            <div><span style={{ color: '#64748b' }}>├── </span><span style={{ color: '#00d4aa', fontWeight: 600 }}>{config.nas_root}/</span></div>
            <div><span style={{ color: '#64748b' }}>│   └── </span><span style={{ color: '#00d4aa', fontWeight: 600 }}>{room}/</span></div>
            <div><span style={{ color: '#64748b' }}>│       └── </span><span style={{ color: '#f59e0b', fontWeight: 600 }}>{dateStr}/</span> <span style={{ color: '#475569', fontSize: 11 }}>(tu dong tao)</span></div>
            {[1, 2, 3].map(i => {
              const start = (i - 1) * segMin;
              const end = i * segMin;
              const sh = String(Math.floor(start / 60)).padStart(2, '0');
              const sm = String(start % 60).padStart(2, '0');
              const eh = String(Math.floor(end / 60)).padStart(2, '0');
              const em = String(end % 60).padStart(2, '0');
              return (
                <div key={i}>
                  <span style={{ color: '#64748b' }}>│           ├── </span>
                  <span style={{ color: '#e2e8f0' }}>video_part{String(i).padStart(3, '0')}{config.output_format}</span>
                  <span style={{ color: '#475569', fontSize: 11 }}> ({sh}:{sm}:00 - {eh}:{em}:00)</span>
                </div>
              );
            })}
            <div><span style={{ color: '#64748b' }}>│           └── </span><span style={{ color: '#475569' }}>...</span></div>
          </div>
        ))}
      </div>
    );
  };

  // ===== Loading =====
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <div style={{ color: '#64748b', fontSize: 14 }}>Dang tai cau hinh...</div>
      </div>
    );
  }

  if (!config) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <div style={{ color: '#ef4444', fontSize: 14 }}>Khong the tai cau hinh NAS</div>
      </div>
    );
  }

  // ===== Render =====
  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* Message toast */}
      {message && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          padding: '12px 20px', borderRadius: 8,
          background: message.type === 'error' ? '#1c1017' : '#0a1a15',
          border: `1px solid ${message.type === 'error' ? '#7f1d1d' : '#064e3b'}`,
          color: message.type === 'error' ? '#fca5a5' : '#6ee7b7',
          fontSize: 13, fontWeight: 500,
          animation: 'fadeIn 0.3s ease'
        }}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>
          Quan ly NAS Video
        </h1>
        <p style={{ fontSize: 13, color: '#64748b' }}>
          Tu dong cat video va sap xep theo cau truc phong/ngay tren NAS
        </p>
      </div>

      {/* Status bar */}
      {status && (
        <div style={{
          display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap'
        }}>
          <div style={{
            padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: status.running ? '#0a1a15' : '#0f1219',
            border: `1px solid ${status.running ? '#064e3b' : '#1e293b'}`,
            color: status.running ? '#6ee7b7' : '#64748b',
            display: 'flex', alignItems: 'center', gap: 6
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: status.running ? '#10b981' : '#475569',
              boxShadow: status.running ? '0 0 6px #10b981' : 'none'
            }} />
            {status.running ? `Dang chay (PID: ${status.pid})` : 'Khong chay'}
          </div>
          <div style={{
            padding: '8px 14px', borderRadius: 8, fontSize: 12,
            background: status.configExists ? '#0a1a15' : '#1c1017',
            border: `1px solid ${status.configExists ? '#064e3b' : '#7f1d1d'}`,
            color: status.configExists ? '#6ee7b7' : '#fca5a5'
          }}>
            Config: {status.configExists ? 'Da sinh' : 'Chua sinh'}
          </div>
          <div style={{
            padding: '8px 14px', borderRadius: 8, fontSize: 12,
            background: status.scriptExists ? '#0a1a15' : '#1c1017',
            border: `1px solid ${status.scriptExists ? '#064e3b' : '#7f1d1d'}`,
            color: status.scriptExists ? '#6ee7b7' : '#fca5a5'
          }}>
            Script: {status.scriptExists ? 'Co san' : 'Thieu'}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid #1e293b' }}>
        {[
          { id: 'config', label: 'Cau hinh' },
          { id: 'preview', label: 'Xem truoc' },
          { id: 'action', label: 'Thuc thi' },
          { id: 'logs', label: 'Logs' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 20px', border: 'none', background: 'transparent',
              color: activeTab === tab.id ? '#00d4aa' : '#64748b',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              borderBottom: activeTab === tab.id ? '2px solid #00d4aa' : '2px solid transparent',
              marginBottom: -1, transition: 'all 0.2s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Cấu hình */}
      {activeTab === 'config' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Thư mục */}
          <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: 24 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16 }}>
              <i className="fas fa-folder" style={{ color: '#00d4aa', marginRight: 8 }} />Cau truc thu muc
            </h3>

            <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Danh sach phong</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                value={newRoom}
                onChange={e => setNewRoom(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addRoom())}
                placeholder="VD: PhongA01"
                style={{
                  flex: 1, padding: '10px 14px', background: '#0a0f1a', border: '1px solid #1e293b',
                  borderRadius: 8, color: '#f1f5f9', fontSize: 14, outline: 'none'
                }}
              />
              <button onClick={addRoom} style={{
                padding: '10px 16px', background: '#00d4aa', color: '#0a0f1a', border: 'none',
                borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 14
              }}>+</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
              {config.rooms.map(r => (
                <span key={r} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', borderRadius: 8, fontSize: 13,
                  background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.2)', color: '#00d4aa'
                }}>
                  {r}
                  <span onClick={() => removeRoom(r)} style={{ cursor: 'pointer', opacity: 0.6, fontSize: 11 }}>x</span>
                </span>
              ))}
            </div>

            <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Duong dan NAS</label>
            <input
              value={config.nas_root}
              onChange={e => setConfig({ ...config, nas_root: e.target.value })}
              style={{
                width: '100%', padding: '10px 14px', background: '#0a0f1a', border: '1px solid #1e293b',
                borderRadius: 8, color: '#f1f5f9', fontSize: 14, outline: 'none', marginBottom: 18
              }}
            />

            <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Dinh dang ngay</label>
            <select
              value={config.date_format}
              onChange={e => setConfig({ ...config, date_format: e.target.value })}
              style={{
                width: '100%', padding: '10px 14px', background: '#0a0f1a', border: '1px solid #1e293b',
                borderRadius: 8, color: '#f1f5f9', fontSize: 14, outline: 'none'
              }}
            >
              <option value="%d-%m-%Y">DD-MM-YYYY</option>
              <option value="%Y-%m-%d">YYYY-MM-DD</option>
              <option value="%d_%m_%Y">DD_MM_YYYY</option>
              <option value="%Y%m%d">YYYYMMDD</option>
            </select>
          </div>

          {/* Video */}
          <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: 24 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16 }}>
              <i className="fas fa-scissors" style={{ color: '#00d4aa', marginRight: 8 }} />Xu ly video
            </h3>

            <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Thoi luong moi file (giay)</label>
            <input
              type="number"
              value={config.segment_duration}
              onChange={e => setConfig({ ...config, segment_duration: parseInt(e.target.value) || 900 })}
              min={1}
              style={{
                width: '100%', padding: '10px 14px', background: '#0a0f1a', border: '1px solid #1e293b',
                borderRadius: 8, color: '#f1f5f9', fontSize: 14, outline: 'none', marginBottom: 18
              }}
            />

            <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Dinh dang dau ra</label>
            <select
              value={config.output_format}
              onChange={e => setConfig({ ...config, output_format: e.target.value })}
              style={{
                width: '100%', padding: '10px 14px', background: '#0a0f1a', border: '1px solid #1e293b',
                borderRadius: 8, color: '#f1f5f9', fontSize: 14, outline: 'none', marginBottom: 18
              }}
            >
              <option value=".mp4">MP4</option>
              <option value=".mkv">MKV</option>
              <option value=".ts">TS</option>
            </select>

            <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Che do ma hoa</label>
            <select
              value={config.codec}
              onChange={e => setConfig({ ...config, codec: e.target.value })}
              style={{
                width: '100%', padding: '10px 14px', background: '#0a0f1a', border: '1px solid #1e293b',
                borderRadius: 8, color: '#f1f5f9', fontSize: 14, outline: 'none', marginBottom: 18
              }}
            >
              <option value="copy">Copy - Nhanh, khong mat chat luong</option>
              <option value="libx264">H.264 - Cham, nho hon</option>
              <option value="libx265">H.265 - Cham nhat, nho nhat</option>
            </select>

            <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Thu muc nguon video</label>
            <input
              value={config.source_dir}
              onChange={e => setConfig({ ...config, source_dir: e.target.value })}
              style={{
                width: '100%', padding: '10px 14px', background: '#0a0f1a', border: '1px solid #1e293b',
                borderRadius: 8, color: '#f1f5f9', fontSize: 14, outline: 'none', marginBottom: 18
              }}
            />

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#94a3b8', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={config.delete_source}
                onChange={e => setConfig({ ...config, delete_source: e.target.checked })}
                style={{ accentColor: '#00d4aa' }}
              />
              Xoa file goc sau khi xu ly
            </label>
          </div>

          {/* Nút lưu */}
          <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '12px 32px', background: saving ? '#1e293b' : '#00d4aa',
                color: saving ? '#64748b' : '#0a0f1a', border: 'none', borderRadius: 8,
                fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {saving ? 'Dang luu...' : 'Luu cau hinh'}
            </button>
          </div>
        </div>
      )}

      {/* Tab: Xem trước */}
      {activeTab === 'preview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20 }}>
          <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: 24 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16 }}>
              Cau truc thu muc se duoc tao
            </h3>
            {renderPreview()}
          </div>
          <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: 24 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16 }}>
              Thong ke
            </h3>
            {[
              ['So phong', config.rooms.length],
              ['Thoi luong moi file', `${config.segment_duration / 60} phut`],
              ['Dinh dang', config.output_format.toUpperCase().replace('.', '')],
              ['Video 1 gio =', `${Math.ceil(60 / (config.segment_duration / 60))} file`],
              ['Video 2 gio =', `${Math.ceil(120 / (config.segment_duration / 60))} file`],
              ['Video 8 gio =', `${Math.ceil(480 / (config.segment_duration / 60))} file`],
            ].map(([label, value]) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between', padding: '10px 14px',
                background: '#0a0f1a', borderRadius: 8, border: '1px solid #1e293b', marginBottom: 8
              }}>
                <span style={{ fontSize: 13, color: '#64748b' }}>{label}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: label.includes('=') ? '#00d4aa' : '#f1f5f9' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Thực thi */}
      {activeTab === 'action' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: 24 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 20 }}>
              Buoc 1: Sinh file config
            </h3>
            <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7, marginBottom: 20 }}>
              Sinh file <code style={{ background: '#0a0f1a', padding: '2px 8px', borderRadius: 4, color: '#00d4aa', fontSize: 12 }}>nas_config.json</code> tu cau hinh hien tai. Script Python se doc file nay de biet can lam gi.
            </p>
            <button onClick={handleGenerate} style={{
              width: '100%', padding: '12px', background: '#0f172a', border: '1px solid #1e293b',
              borderRadius: 8, color: '#f1f5f9', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.2s'
            }}>
              <i className="fas fa-file-code" style={{ marginRight: 8 }} />Sinh Config
            </button>
          </div>

          <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: 24 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 20 }}>
              Buoc 2: Chay script
            </h3>
            <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7, marginBottom: 20 }}>
              Chay script Python de bat dau cat video. Chon che do xu ly mot lan hoac giam sat tu dong.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => handleRun('once')}
                disabled={status?.running}
                style={{
                  flex: 1, padding: '12px', background: status?.running ? '#1e293b' : '#00d4aa',
                  border: 'none', borderRadius: 8,
                  color: status?.running ? '#64748b' : '#0a0f1a',
                  fontSize: 14, fontWeight: 700, cursor: status?.running ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Chay 1 lan
              </button>
              <button
                onClick={() => handleRun('watch')}
                disabled={status?.running}
                style={{
                  flex: 1, padding: '12px', background: status?.running ? '#1e293b' : '#0f172a',
                  border: '1px solid #1e293b', borderRadius: 8,
                  color: status?.running ? '#64748b' : '#f1f5f9',
                  fontSize: 14, fontWeight: 600, cursor: status?.running ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Giam sat
              </button>
              {status?.running && (
                <button
                  onClick={handleStop}
                  style={{
                    padding: '12px 16px', background: '#1c1017', border: '1px solid #7f1d1d',
                    borderRadius: 8, color: '#fca5a5', fontSize: 14, fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  <i className="fas fa-stop" />
                </button>
              )}
            </div>
          </div>

          {/* Lưu ý */}
          <div style={{ gridColumn: 'span 2', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 10, padding: 16, display: 'flex', gap: 12 }}>
            <i className="fas fa-triangle-exclamation" style={{ color: '#f59e0b', fontSize: 16, marginTop: 2 }} />
            <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7 }}>
              <strong style={{ color: '#f59e0b' }}>Yeu cau:</strong> Server phai cai dat Python 3.8+ va FFmpeg. File <code style={{ background: '#0a0f1a', padding: '2px 6px', borderRadius: 4, color: '#00d4aa', fontSize: 12 }}>nas_video_splitter.py</code> phai dat trong thu muc <code style={{ background: '#0a0f1a', padding: '2px 6px', borderRadius: 4, color: '#00d4aa', fontSize: 12 }}>scripts/</code> o goc du an. NAS phai duoc mount vao duong dan da cau hinh.
            </div>
          </div>
        </div>
      )}

      {/* Tab: Logs */}
      {activeTab === 'logs' && (
        <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 16px', background: '#0a0f1a', borderBottom: '1px solid #1e293b'
          }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} />
            </div>
            <span style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>
              {status?.running ? 'Dang cap nhat moi 2 giay...' : 'Script khong chay'}
            </span>
          </div>
          <pre style={{
            padding: 16, margin: 0, maxHeight: 500, overflow: 'auto',
            fontFamily: 'monospace', fontSize: 12, lineHeight: 1.7,
            color: '#94a3b8', background: '#060a10',
            scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent'
          }}>
            {logs || 'Chua co log nao. Chay script de bat dau ghi log.'}
          </pre>
        </div>
      )}
    </div>
  );
}