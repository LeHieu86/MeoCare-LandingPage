import { useState, useEffect, useRef, useCallback } from 'react';
import "../../styles/admin/admin.css";

const API_BASE = '/api/admin/nas';

export default function NASManager() {
  const [config, setConfig]     = useState(null);
  const [status, setStatus]     = useState(null);
  const [cameras, setCameras]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [activeTab, setActiveTab] = useState('cameras');
  const [message, setMessage]   = useState(null);
  const [logCam, setLogCam]     = useState(null);
  const [logData, setLogData]   = useState('');
  const logRef = useRef(null);
  const logInt = useRef(null);

  const getHeaders = () => {
    const t = localStorage.getItem('mc_admin_token');
    return { 'Content-Type':'application/json', ...(t?{Authorization:`Bearer ${t}`}:{}) };
  };
  const api = (url, opts={}) => fetch(url, { headers:getHeaders(), ...opts }).then(r=>r.json());
  const showMsg = (text, type='success') => { setMessage({text,type}); setTimeout(()=>setMessage(null),4000); };

  const loadAll = useCallback(async () => {
    try {
      const [cfgRes, camRes] = await Promise.all([
        api(`${API_BASE}/config`),
        fetch('/api/cameras', { headers:getHeaders() }).then(r=>r.json()),
      ]);
      if (cfgRes.success) setConfig(cfgRes.data);
      if (Array.isArray(camRes)) setCameras(camRes);
    } catch { showMsg('Không thể tải dữ liệu','error'); }
    finally { setLoading(false); }
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const r = await api(`${API_BASE}/status`);
      if (r.success) setStatus(r.data);
    } catch {
      // ignore status polling errors
    }
  }, []);

  useEffect(() => { loadAll(); loadStatus(); }, [loadAll, loadStatus]);
  useEffect(() => {
    const interval = setInterval(loadStatus, 5000);
    return () => clearInterval(interval);
  }, [loadStatus]);

  // Log camera cụ thể
  const openLog = async (cam) => {
    setLogCam(cam);
    clearInterval(logInt.current);
    const fetchLog = async () => {
      const r = await api(`${API_BASE}/camera/${cam.id}/log`);
      if (r.success) { setLogData(r.data); if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }
    };
    fetchLog();
    logInt.current = setInterval(fetchLog, 2000);
  };
  const closeLog = () => { clearInterval(logInt.current); setLogCam(null); setLogData(''); };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const r = await api(`${API_BASE}/config`, { method:'PUT', body:JSON.stringify(config) });
      r.success ? showMsg('Đã lưu cấu hình') : showMsg(r.error,'error');
    } catch { showMsg('Lỗi kết nối','error'); }
    finally { setSaving(false); }
  };

  const addDisk = () => {
    const n = (config?.disks||[]).length + 1;
    setConfig(prev => ({...prev, disks:[...(prev?.disks||[]),
      { id:`hdd${n}`, mount_path:`/mnt/hdd${n}`, label:`HDD ${n}` }]}));
  };

  const updateDisk = (diskId, field, val) => {
    setConfig(prev => ({...prev, disks:(prev?.disks||[]).map(d=>d.id===diskId?{...d,[field]:val}:d)}));
  };

  const removeDisk = (diskId) => {
    setConfig(prev => ({...prev, disks:(prev?.disks||[]).filter(d=>d.id!==diskId)}));
  };

  // Gán camera vào HDD
  const assignDisk = async (camId, disk_id) => {
    const r = await api(`${API_BASE}/camera/${camId}/disk`, { method:'PATCH', body:JSON.stringify({disk_id}) });
    if (r.success) { showMsg(r.message); setCameras(prev=>prev.map(c=>c.id===camId?{...c,disk_id}:c)); }
    else showMsg(r.error,'error');
  };

  // Bật/tắt ghi
  const toggleRecording = async (cam) => {
    const isRunning = status?.cameras?.find(c=>c.id===cam.id)?.running;
    const endpoint  = isRunning ? 'stop' : 'start';
    const r = await api(`${API_BASE}/camera/${cam.id}/${endpoint}`, { method:'POST' });
    showMsg(r.message, r.success?'success':'error');
    loadStatus();
  };

  const handleStartAll = async () => {
    const r = await api(`${API_BASE}/start-all`, { method:'POST' });
    showMsg(r.message, r.success?'success':'error'); loadStatus();
  };

  const handleStopAll = async () => {
    const r = await api(`${API_BASE}/stop-all`, { method:'POST' });
    showMsg(r.message); loadStatus();
  };

  const cfg  = config || { disks:[], segment_duration:900, rotate_days:30, output_format:'.mp4', codec:'copy' };
  const card = { background:'var(--adm-surface)', border:'1px solid var(--adm-border)', borderRadius:12, padding:20 };
  const inp  = { width:'100%', background:'var(--adm-surface-2)', border:'1px solid var(--adm-border)', borderRadius:7, padding:'7px 10px', color:'var(--adm-text)', fontSize:12, outline:'none' };
  const lbl  = { fontSize:11, color:'var(--adm-text-2)', marginBottom:4, display:'block' };

  const totalRecording = status?.totalRecording || 0;
  const TABS = [
    { id:'cameras',  label:`📷 Camera (${totalRecording} đang ghi)` },
    { id:'disks',    label:'💾 Ổ cứng' },
    { id:'settings', label:'⚙️ Cài đặt' },
  ];

  if (loading) return <div style={{padding:40,textAlign:'center',color:'var(--adm-text-2)'}}>Đang tải...</div>;

  return (
    <div style={{padding:20,color:'var(--adm-text)'}}>
      {/* Toast */}
      {message && (
        <div style={{position:'fixed',top:20,right:20,zIndex:9999,padding:'10px 18px',borderRadius:8,fontSize:13,fontWeight:500,
          background:message.type==='error'?'rgba(239,68,68,.15)':'rgba(34,197,94,.15)',
          border:`1px solid ${message.type==='error'?'rgba(239,68,68,.4)':'rgba(34,197,94,.4)'}`,
          color:message.type==='error'?'#ef4444':'#22c55e'}}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
        <div>
          <div style={{fontSize:18,fontWeight:700}}>💾 Quản lý NAS & Ghi hình</div>
          <div style={{fontSize:12,color:'var(--adm-text-2)',marginTop:3}}>
            {cameras.length} camera · {cfg.disks.length} ổ cứng · {totalRecording} đang ghi
          </div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={handleStopAll}
            style={{padding:'7px 14px',borderRadius:7,border:'1px solid rgba(239,68,68,.3)',
              background:'rgba(239,68,68,.08)',color:'#ef4444',cursor:'pointer',fontSize:12}}>
            ⏹ Dừng tất cả
          </button>
          <button onClick={handleStartAll}
            style={{padding:'7px 14px',borderRadius:7,border:'none',
              background:'#f59e0b',color:'#000',fontWeight:700,cursor:'pointer',fontSize:12}}>
            ▶ Bật tất cả
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',borderBottom:'1px solid var(--adm-border)',marginBottom:20}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)}
            style={{padding:'9px 16px',border:'none',background:'transparent',cursor:'pointer',fontSize:12,fontWeight:500,
              color:activeTab===t.id?'#f59e0b':'var(--adm-text-2)',
              borderBottom:activeTab===t.id?'2px solid #f59e0b':'2px solid transparent',marginBottom:-1}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ TAB: Camera ══ */}
      {activeTab==='cameras' && (
        <div>
          <div style={{fontSize:12,color:'var(--adm-text-2)',marginBottom:12,padding:'8px 12px',
            background:'rgba(99,102,241,.06)',border:'1px solid rgba(99,102,241,.2)',borderRadius:8}}>
            💡 Mỗi camera ghi bằng ffmpeg process riêng — bật/tắt 1 camera không ảnh hưởng camera khác.
          </div>

          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr><th>Camera</th><th>HDD ghi vào</th><th>Trạng thái ghi</th><th>Dung lượng HDD</th><th>Thao tác</th></tr>
              </thead>
              <tbody>
                {cameras.map(cam => {
                  const camStatus = status?.cameras?.find(c=>c.id===cam.id);
                  const isRunning = camStatus?.running || false;
                  const disk      = cfg.disks.find(d=>d.id===cam.disk_id);
                  const diskUsage = disk ? status?.disks?.[disk.id] : null;
                  const pct       = diskUsage?.percent_used || 0;
                  return (
                    <tr key={cam.id}>
                      <td>
                        <div style={{fontWeight:600,fontSize:13}}>📹 {cam.name}</div>
                        {cam.rtsp_url
                          ? <div style={{fontSize:10,color:'var(--adm-text-2)',fontFamily:'monospace',marginTop:2,maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{cam.rtsp_url}</div>
                          : <div style={{fontSize:11,color:'#f59e0b'}}>⚠ Chưa có RTSP URL</div>
                        }
                      </td>
                      <td>
                        <select style={{...inp,width:'auto',minWidth:130}} value={cam.disk_id||''}
                          onChange={e=>assignDisk(cam.id,e.target.value)}>
                          <option value="">— Chưa gán —</option>
                          {cfg.disks.map(d=><option key={d.id} value={d.id}>{d.label} ({d.mount_path})</option>)}
                        </select>
                      </td>
                      <td>
                        <span style={{display:'inline-flex',alignItems:'center',gap:5,padding:'3px 10px',borderRadius:20,fontSize:12,fontWeight:600,
                          background:isRunning?'rgba(34,197,94,.12)':'rgba(255,255,255,.05)',
                          border:`1px solid ${isRunning?'rgba(34,197,94,.3)':'var(--adm-border)'}`,
                          color:isRunning?'#22c55e':'var(--adm-text-2)'}}>
                          <div style={{width:6,height:6,borderRadius:'50%',background:isRunning?'#22c55e':'#475569',
                            boxShadow:isRunning?'0 0 5px #22c55e':'none'}}/>
                          {isRunning?`Đang ghi (PID ${camStatus.pid})`:'Không ghi'}
                        </span>
                      </td>
                      <td>
                        {diskUsage ? (
                          <div>
                            <div style={{height:4,background:'var(--adm-surface-2)',borderRadius:2,overflow:'hidden',width:100}}>
                              <div style={{height:'100%',width:`${pct}%`,borderRadius:2,
                                background:pct>=85?'#ef4444':pct>70?'#f59e0b':'#22c55e'}}/>
                            </div>
                            <div style={{fontSize:10,color:'var(--adm-text-2)',marginTop:2}}>
                              {pct}% · còn {diskUsage.free_gb?.toFixed(1)}GB
                            </div>
                          </div>
                        ) : <span style={{fontSize:12,color:'var(--adm-text-2)'}}>—</span>}
                      </td>
                      <td>
                        <div style={{display:'flex',gap:6}}>
                          <button onClick={()=>toggleRecording(cam)}
                            disabled={!cam.rtsp_url||!cam.disk_id}
                            style={{padding:'5px 12px',borderRadius:6,border:'none',cursor:'pointer',fontSize:12,fontWeight:600,
                              background:isRunning?'rgba(239,68,68,.12)':'rgba(34,197,94,.12)',
                              color:isRunning?'#ef4444':'#22c55e',
                              opacity:(!cam.rtsp_url||!cam.disk_id)?0.4:1}}>
                            {isRunning?'⏹ Dừng':'▶ Ghi'}
                          </button>
                          <button onClick={()=>openLog(cam)}
                            style={{padding:'5px 10px',borderRadius:6,border:'1px solid var(--adm-border)',
                              background:'transparent',color:'var(--adm-text-2)',cursor:'pointer',fontSize:11}}>
                            📋 Log
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {cameras.some(c=>!c.rtsp_url) && (
            <div style={{marginTop:12,padding:'9px 14px',borderRadius:8,fontSize:12,
              background:'rgba(245,158,11,.08)',border:'1px solid rgba(245,158,11,.2)',color:'#f59e0b'}}>
              ⚠️ Một số camera chưa có RTSP URL — vào <strong>Quản lý Camera</strong> để điền.
            </div>
          )}
        </div>
      )}

      {/* ══ TAB: Ổ cứng ══ */}
      {activeTab==='disks' && (
        <div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:14,marginBottom:16}}>
            {cfg.disks.map(disk => {
              const usage = status?.disks?.[disk.id];
              const pct   = usage?.percent_used || 0;
              const cams  = cameras.filter(c=>c.disk_id===disk.id);
              return (
                <div key={disk.id} style={card}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                    <input value={disk.label} onChange={e=>updateDisk(disk.id,'label',e.target.value)}
                      style={{background:'transparent',border:'none',color:'var(--adm-text)',fontSize:14,fontWeight:700,outline:'none',flex:1}}/>
                    <button onClick={()=>removeDisk(disk.id)}
                      style={{background:'transparent',border:'none',color:'var(--adm-text-2)',cursor:'pointer',fontSize:16}}>✕</button>
                  </div>
                  <div style={{marginBottom:10}}>
                    <span style={lbl}>Mount path</span>
                    <input style={inp} value={disk.mount_path} onChange={e=>updateDisk(disk.id,'mount_path',e.target.value)}/>
                  </div>
                  {usage ? (
                    <div style={{marginBottom:10}}>
                      <div style={{height:6,background:'var(--adm-surface-2)',borderRadius:3,overflow:'hidden',marginBottom:4}}>
                        <div style={{height:'100%',width:`${pct}%`,borderRadius:3,
                          background:pct>=85?'#ef4444':pct>70?'#f59e0b':'#22c55e'}}/>
                      </div>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:pct>=85?'#ef4444':'var(--adm-text-2)'}}>
                        <span>{pct}% đã dùng</span>
                        <span>còn {usage.free_gb?.toFixed(1)}GB / {usage.total_gb}GB</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{fontSize:11,color:'#f59e0b',marginBottom:10}}>⚠ Chưa mount hoặc không tìm thấy</div>
                  )}
                  <div style={{fontSize:11,color:'var(--adm-text-2)'}}>
                    Camera gán vào: {cams.length > 0
                      ? cams.map(c=><span key={c.id} style={{marginRight:6,color:'var(--adm-text)'}}>📹{c.name}</span>)
                      : <span style={{color:'var(--adm-text-2)'}}>Chưa có camera nào</span>
                    }
                  </div>
                </div>
              );
            })}

            <button onClick={addDisk}
              style={{...card,border:'2px dashed var(--adm-border)',background:'transparent',
                cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',
                justifyContent:'center',gap:8,color:'var(--adm-text-2)',minHeight:160}}>
              <div style={{fontSize:28}}>+</div>
              <div style={{fontSize:12}}>Thêm ổ cứng</div>
            </button>
          </div>

          <div style={{display:'flex',justifyContent:'flex-end'}}>
            <button onClick={handleSaveConfig} disabled={saving}
              style={{padding:'8px 24px',borderRadius:7,border:'none',background:'#f59e0b',
                color:'#000',fontWeight:700,cursor:'pointer',fontSize:12}}>
              {saving?'Đang lưu...':'💾 Lưu cấu hình ổ cứng'}
            </button>
          </div>
        </div>
      )}

      {/* ══ TAB: Cài đặt ══ */}
      {activeTab==='settings' && (
        <div style={{maxWidth:600}}>
          <div style={card}>
            <div style={{fontSize:13,fontWeight:600,marginBottom:16}}>⚙️ Cài đặt ghi hình</div>
            {[
              {label:'Thời lượng mỗi đoạn (giây)', key:'segment_duration', type:'number'},
              {label:'Giữ lại bao nhiêu ngày trước khi xóa', key:'rotate_days', type:'number'},
            ].map(({label,key,type})=>(
              <div key={key} style={{marginBottom:12}}>
                <span style={lbl}>{label}</span>
                <input style={inp} type={type} value={cfg[key]||''}
                  onChange={e=>setConfig(p=>({...p,[key]:parseInt(e.target.value)||0}))}/>
              </div>
            ))}
            <div style={{marginBottom:12}}>
              <span style={lbl}>Định dạng đầu ra</span>
              <select style={inp} value={cfg.output_format||'.mp4'}
                onChange={e=>setConfig(p=>({...p,output_format:e.target.value}))}>
                <option value=".mp4">MP4</option>
                <option value=".mkv">MKV</option>
                <option value=".ts">TS</option>
              </select>
            </div>
            <div style={{marginBottom:16}}>
              <span style={lbl}>Codec</span>
              <select style={inp} value={cfg.codec||'copy'}
                onChange={e=>setConfig(p=>({...p,codec:e.target.value}))}>
                <option value="copy">Copy — Nhanh, không mất chất lượng (khuyên dùng)</option>
                <option value="libx264">H.264 — Nhỏ hơn, tốn CPU hơn</option>
              </select>
            </div>
            <div style={{padding:'10px 14px',borderRadius:8,fontSize:12,lineHeight:1.8,
              background:'rgba(99,102,241,.06)',border:'1px solid rgba(99,102,241,.2)',color:'var(--adm-text-2)',marginBottom:16}}>
              ℹ️ Hikvision với codec <strong>Copy</strong>: ffmpeg chỉ đóng gói lại stream, CPU gần như 0.
              Mỗi camera chạy 1 process ffmpeg riêng — bật/tắt hoàn toàn độc lập.
            </div>
            <div style={{display:'flex',justifyContent:'flex-end'}}>
              <button onClick={handleSaveConfig} disabled={saving}
                style={{padding:'8px 24px',borderRadius:7,border:'none',background:'#f59e0b',
                  color:'#000',fontWeight:700,cursor:'pointer',fontSize:12}}>
                {saving?'Đang lưu...':'Lưu cài đặt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal Log Camera ══ */}
      {logCam && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.65)',zIndex:1200,
          display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
          onClick={closeLog}>
          <div style={{...card,width:'100%',maxWidth:700,padding:0,overflow:'hidden',maxHeight:'80vh'}}
            onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
              padding:'10px 16px',background:'rgba(0,0,0,.3)',borderBottom:'1px solid var(--adm-border)'}}>
              <div style={{fontSize:13,fontWeight:600}}>📋 Log — {logCam.name}</div>
              <button onClick={closeLog} style={{background:'transparent',border:'none',color:'var(--adm-text-2)',cursor:'pointer',fontSize:18}}>✕</button>
            </div>
            <pre ref={logRef} style={{padding:14,margin:0,maxHeight:'60vh',overflow:'auto',
              fontFamily:'monospace',fontSize:11,lineHeight:1.7,color:'#94a3b8',background:'rgba(0,0,0,.2)'}}>
              {logData||'Chưa có log.'}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}