import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const getToken = () => localStorage.getItem("mc_employee_token") || localStorage.getItem("mc_admin_token");

const todayISO = () => new Date().toISOString().split("T")[0];
const addDays  = (iso, n) => { const d=new Date(iso); d.setDate(d.getDate()+n); return d.toISOString().split("T")[0]; };
const fmtDate  = (iso) => new Date(iso).toLocaleDateString("vi-VN",{weekday:"short",day:"2-digit",month:"2-digit"});

const STATUS_COLORS = {
  scheduled:  { label:"Lên lịch",   color:"#5b7cf6" },
  completed:  { label:"Hoàn thành", color:"#22c55e" },
  absent:     { label:"Vắng mặt",   color:"#ef4444" },
  cancelled:  { label:"Đã hủy",     color:"#6b7280" },
};

const inputStyle  = { background:"#0f1117",border:"1px solid #2d3154",borderRadius:8,padding:"8px 12px",color:"#e8eaf0",fontSize:14 };
const btnPrimary  = { padding:"9px 20px",background:"#5b7cf6",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:600 };
const btnSecondary= { padding:"9px 20px",background:"transparent",color:"#8b90a7",border:"1px solid #2d3154",borderRadius:8,cursor:"pointer",fontSize:13 };
const labelStyle  = { display:"block",color:"#8b90a7",fontSize:12,marginBottom:6,fontWeight:600 };

// ── Modal Đăng ký ca ──────────────────────────────────────────
const RegisterModal = ({ shifts, onClose, onDone }) => {
  const [form, setForm] = useState({ shiftId:"", date: todayISO(), note:"" });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.shiftId) { toast.error("Vui lòng chọn ca làm."); return; }
    setSaving(true);
    const r = await fetch(`${API_BASE}/shift-assignments/register`, {
      method:"POST",
      headers:{ "Content-Type":"application/json", Authorization:`Bearer ${getToken()}` },
      body: JSON.stringify({ ...form, shiftId: parseInt(form.shiftId) }),
    });
    const d = await r.json();
    if (r.ok) { toast.success("✅ Đăng ký ca thành công!"); onDone(d); }
    else        toast.error(d.error || "Lỗi đăng ký ca.");
    setSaving(false);
  };

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000 }}>
      <div style={{ background:"#1a1d2e",border:"1px solid #2d3154",borderRadius:16,padding:32,width:420 }}>
        <h3 style={{ color:"#e8eaf0",margin:"0 0 20px",fontSize:18 }}>📅 Đăng ký ca làm</h3>
        <form onSubmit={submit}>
          <div style={{ display:"grid",gap:14 }}>
            <div>
              <label style={labelStyle}>Chọn ca *</label>
              <select style={{ ...inputStyle,width:"100%",boxSizing:"border-box" }} value={form.shiftId}
                onChange={e => setForm(f => ({ ...f, shiftId: e.target.value }))}>
                <option value="">-- Chọn ca --</option>
                {shifts.filter(s => s.isActive).map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Ngày làm *</label>
              <input type="date" style={{ ...inputStyle,width:"100%",boxSizing:"border-box" }}
                value={form.date} min={todayISO()}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Ghi chú</label>
              <input style={{ ...inputStyle,width:"100%",boxSizing:"border-box" }}
                value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            </div>
          </div>
          <div style={{ display:"flex",gap:10,marginTop:20,justifyContent:"flex-end" }}>
            <button type="button" onClick={onClose} style={btnSecondary}>Hủy</button>
            <button type="submit" disabled={saving} style={btnPrimary}>{saving?"Đang gửi...":"Đăng ký"}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
const EmployeeShifts = () => {
  const [assignments, setAssignments] = useState([]);
  const [shifts,      setShifts]      = useState([]);
  const [weekFrom,    setWeekFrom]    = useState(todayISO());
  const [loading,     setLoading]     = useState(true);
  const [showModal,   setShowModal]   = useState(false);

  const load = useCallback(() => {
    const token = getToken();
    setLoading(true);
    const to = addDays(weekFrom, 6);
    Promise.all([
      fetch(`${API_BASE}/shift-assignments/my?from=${weekFrom}&to=${to}`, { headers:{ Authorization:`Bearer ${token}` } }).then(r=>r.json()),
      fetch(`${API_BASE}/shifts?active=1`, { headers:{ Authorization:`Bearer ${token}` } }).then(r=>r.json()),
    ]).then(([a, s]) => {
      setAssignments(Array.isArray(a) ? a : []);
      setShifts(Array.isArray(s) ? s : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [weekFrom]);

  useEffect(() => { load(); }, [load]);

  const handleCancel = async (id) => {
    if (!confirm("Hủy đăng ký ca này?")) return;
    const r = await fetch(`${API_BASE}/shift-assignments/${id}`, {
      method:"DELETE", headers:{ Authorization:`Bearer ${getToken()}` },
    });
    const d = await r.json();
    if (r.ok) { toast.success("Đã hủy ca."); setAssignments(prev => prev.filter(a => a.id!==id)); }
    else        toast.error(d.error || "Không thể hủy.");
  };

  const weekDays = Array.from({length:7}, (_,i) => addDays(weekFrom,i));

  return (
    <div style={{ padding:28 }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24 }}>
        <div>
          <h1 style={{ color:"#e8eaf0",fontSize:22,fontWeight:700,margin:0 }}>📅 Ca Làm của Tôi</h1>
          <p style={{ color:"#8b90a7",fontSize:13,margin:"4px 0 0" }}>{assignments.length} ca trong tuần này</p>
        </div>
        <button style={btnPrimary} onClick={() => setShowModal(true)}>+ Đăng ký ca</button>
      </div>

      {/* ── Week nav ── */}
      <div style={{ display:"flex",gap:10,marginBottom:20,alignItems:"center" }}>
        <button style={btnSecondary} onClick={() => setWeekFrom(addDays(weekFrom,-7))}>◀ Tuần trước</button>
        <span style={{ color:"#e8eaf0",fontSize:14 }}>{fmtDate(weekFrom)} – {fmtDate(addDays(weekFrom,6))}</span>
        <button style={btnSecondary} onClick={() => setWeekFrom(addDays(weekFrom,7))}>Tuần sau ▶</button>
        <button style={btnSecondary} onClick={() => setWeekFrom(todayISO())}>Hôm nay</button>
      </div>

      {loading ? (
        <div style={{ textAlign:"center",color:"#8b90a7",padding:60 }}>Đang tải...</div>
      ) : (
        <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:10 }}>
          {weekDays.map(day => {
            const dayCells = assignments.filter(a => a.date.split("T")[0] === day);
            const isToday  = day === todayISO();
            return (
              <div key={day} style={{ background: isToday?"rgba(91,124,246,.08)":"#1a1d2e",border:`1px solid ${isToday?"#5b7cf6":"#2d3154"}`,borderRadius:12,padding:12,minHeight:140 }}>
                <div style={{ color:isToday?"#5b7cf6":"#8b90a7",fontSize:12,fontWeight:700,marginBottom:8,textAlign:"center" }}>
                  {fmtDate(day)}
                  {isToday && <span style={{ marginLeft:4,background:"#5b7cf6",color:"#fff",borderRadius:4,padding:"1px 5px",fontSize:10 }}>Hôm nay</span>}
                </div>
                {dayCells.length === 0
                  ? <div style={{ color:"#3d4165",fontSize:11,textAlign:"center",marginTop:20 }}>–</div>
                  : dayCells.map(a => {
                    const sc = STATUS_COLORS[a.status] || STATUS_COLORS.scheduled;
                    return (
                      <div key={a.id} style={{ background:"#0f1117",border:`1px solid ${sc.color}44`,borderRadius:8,padding:"8px 10px",marginBottom:6 }}>
                        <div style={{ color:sc.color,fontWeight:700,fontSize:12 }}>{a.shift?.name}</div>
                        <div style={{ color:"#8b90a7",fontSize:11 }}>{a.shift?.startTime}–{a.shift?.endTime}</div>
                        {a.attendance?.checkIn && (
                          <div style={{ color:"#22c55e",fontSize:10,marginTop:4 }}>
                            ✓ {new Date(a.attendance.checkIn).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})}
                            {a.attendance.workHours ? ` · ${a.attendance.workHours.toFixed(1)}h` : ""}
                          </div>
                        )}
                        {a.status === "scheduled" && new Date(day) > new Date() && (
                          <button onClick={() => handleCancel(a.id)} style={{ color:"#ef4444",background:"none",border:"none",cursor:"pointer",fontSize:10,padding:0,marginTop:4 }}>✕ Hủy</button>
                        )}
                      </div>
                    );
                  })
                }
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <RegisterModal
          shifts={shifts}
          onClose={() => setShowModal(false)}
          onDone={(d) => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
};

export default EmployeeShifts;
