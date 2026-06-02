import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { useIsMobile } from "../hooks/useIsMobile";

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const getToken = () => localStorage.getItem("token");

const padZ     = (n) => String(n).padStart(2, "0");
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${padZ(d.getMonth()+1)}-${padZ(d.getDate())}`; };
const addDays  = (iso, n) => { const [y,m,d]=iso.split("-").map(Number); const dt=new Date(y,m-1,d+n); return `${dt.getFullYear()}-${padZ(dt.getMonth()+1)}-${padZ(dt.getDate())}`; };
const fmtDate  = (iso) => { const [y,m,d]=iso.split("-").map(Number); return new Date(y,m-1,d).toLocaleDateString("vi-VN",{weekday:"short",day:"2-digit",month:"2-digit"}); };
const fmtDateFull = (iso) => { const [y,m,d]=iso.split("-").map(Number); return new Date(y,m-1,d).toLocaleDateString("vi-VN",{weekday:"long",day:"2-digit",month:"2-digit"}); };
const toLocalISO = (s) => { const d=new Date(s); return `${d.getFullYear()}-${padZ(d.getMonth()+1)}-${padZ(d.getDate())}`; };

const STATUS_COLORS = {
  scheduled: { label: "Lên lịch",   color: "#5b7cf6" },
  completed: { label: "Hoàn thành", color: "#22c55e" },
  absent:    { label: "Vắng mặt",   color: "#ef4444" },
  cancelled: { label: "Đã hủy",     color: "#6b7280" },
};

// Ca đã qua giờ kết thúc mà chưa check-in → coi là vắng mặt
const getEffectiveStatus = (a, day) => {
  if (a.status !== "scheduled") return a.status;   // đã có trạng thái thật → giữ nguyên
  if (a.attendance?.checkIn)    return a.status;   // đã check-in → không override
  const today = todayISO();
  const isPast  = day < today;
  const isToday = day === today;
  if (isPast) return "absent";
  if (isToday && a.shift?.endTime) {
    const [eh, em] = a.shift.endTime.split(":").map(Number);
    const now = new Date();
    const end = new Date(); end.setHours(eh, em, 0, 0);
    if (now >= end) return "absent";
  }
  return "scheduled";
};

const calcLateMinutes = (checkInTime, shiftStartTime) => {
  if (!checkInTime || !shiftStartTime) return 0;
  const checkIn = new Date(checkInTime);
  const [sh, sm] = shiftStartTime.split(":").map(Number);
  const shiftStart = new Date(checkIn);
  shiftStart.setHours(sh, sm, 0, 0);
  return Math.max(0, Math.floor((checkIn - shiftStart) / 60000));
};

// ── Modal đăng ký ca (mobile-friendly) ───────────────────────────────────────
const RegisterModal = ({ shifts, onClose, onDone, isMobile }) => {
  const [form, setForm]   = useState({ shiftId: "", date: todayISO(), note: "" });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.shiftId) { toast.error("Vui lòng chọn ca làm."); return; }
    setSaving(true);
    const r = await fetch(`${API_BASE}/shift-assignments/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ ...form, shiftId: parseInt(form.shiftId) }),
    });
    const d = await r.json();
    if (r.ok) { toast.success("✅ Đăng ký ca thành công!"); onDone(d); }
    else        toast.error(d.error || "Lỗi đăng ký ca.");
    setSaving(false);
  };

  const inputStyle = { width:"100%",background:"#0f1117",border:"1px solid #2d3154",borderRadius:8,padding:"10px 12px",color:"#e8eaf0",fontSize:16,boxSizing:"border-box" };
  const labelStyle = { display:"block",color:"#8b90a7",fontSize:12,marginBottom:6,fontWeight:600 };

  const selectedShift = shifts.find(s => s.id === parseInt(form.shiftId));

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.6)",display:"flex",alignItems:isMobile?"flex-end":"center",justifyContent:"center",zIndex:1000 }}>
      <div style={{
        background:"#1a1d2e",border:"1px solid #2d3154",
        borderRadius: isMobile ? "20px 20px 0 0" : 16,
        padding: isMobile ? "24px 20px 32px" : 32,
        width: isMobile ? "100%" : 420,
      }}>
        {/* Handle bar on mobile */}
        {isMobile && (
          <div style={{ width:40,height:4,background:"#2d3154",borderRadius:4,margin:"0 auto 20px" }} />
        )}
        <h3 style={{ color:"#e8eaf0",margin:"0 0 20px",fontSize:18 }}>📅 Đăng ký ca làm</h3>
        <form onSubmit={submit}>
          <div style={{ display:"grid",gap:14 }}>
            <div>
              <label style={labelStyle}>Chọn ca *</label>
              <select style={inputStyle} value={form.shiftId}
                onChange={e => setForm(f => ({ ...f, shiftId: e.target.value }))}>
                <option value="">-- Chọn ca --</option>
                {shifts.filter(s => s.isActive).map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</option>
                ))}
              </select>
            </div>

            {/* Shift detail preview */}
            {selectedShift && (
              <div style={{ background:"rgba(91,124,246,.1)",border:"1px solid rgba(91,124,246,.25)",borderRadius:10,padding:"10px 14px" }}>
                <div style={{ color:"#5b7cf6",fontWeight:700,fontSize:14 }}>{selectedShift.name}</div>
                <div style={{ color:"#c8cad8",fontSize:13,marginTop:2 }}>
                  🕐 {selectedShift.startTime} – {selectedShift.endTime}
                </div>
                {selectedShift.lunchBreakStart && (
                  <div style={{ color:"#8b90a7",fontSize:12,marginTop:2 }}>
                    🍱 Nghỉ trưa {selectedShift.lunchBreakStart}–{selectedShift.lunchBreakEnd}
                  </div>
                )}
              </div>
            )}

            <div>
              <label style={labelStyle}>Ngày làm *</label>
              <input type="date" style={inputStyle} value={form.date} min={todayISO()}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Ghi chú</label>
              <input style={inputStyle} value={form.note}
                placeholder="(tuỳ chọn)"
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            </div>
          </div>

          <div style={{ display:"flex",gap:10,marginTop:20 }}>
            <button type="button" onClick={onClose}
              style={{ flex:1,padding:"12px",background:"transparent",color:"#8b90a7",border:"1px solid #2d3154",borderRadius:10,cursor:"pointer",fontSize:15 }}>
              Hủy
            </button>
            <button type="submit" disabled={saving}
              style={{ flex:2,padding:"12px",background:"#5b7cf6",color:"#fff",border:"none",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:15 }}>
              {saving ? "Đang gửi..." : "✅ Đăng ký"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
const EmployeeShifts = () => {
  const isMobile = useIsMobile();

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
      fetch(`${API_BASE}/shift-assignments/my?from=${weekFrom}&to=${to}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${API_BASE}/shifts?active=1`,                                 { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([a, s]) => {
      setAssignments(Array.isArray(a) ? a : []);
      setShifts(Array.isArray(s) ? s : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [weekFrom]);

  useEffect(() => { load(); }, [load]);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekFrom, i));

  const btnGhost = { padding:"8px 14px",background:"transparent",color:"#8b90a7",border:"1px solid #2d3154",borderRadius:8,cursor:"pointer",fontSize:13 };

  return (
    <div className="emp-page">

      {/* ── Header ── */}
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:isMobile?14:24 }}>
        <div>
          <h1 style={{ color:"#e8eaf0",fontSize:isMobile?19:22,fontWeight:700,margin:0 }}>📅 Ca Làm của Tôi</h1>
          <p style={{ color:"#8b90a7",fontSize:12,margin:"3px 0 0" }}>{assignments.length} ca trong tuần</p>
        </div>
        <div style={{ display:"flex",gap:8 }}>
          <button style={btnGhost} onClick={load}>🔄</button>
          <button
            onClick={() => setShowModal(true)}
            style={{ padding:"9px 16px",background:"#5b7cf6",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:700 }}>
            + Đăng ký ca
          </button>
        </div>
      </div>

      {/* ── Week nav ── */}
      <div style={{ display:"flex",gap:8,marginBottom:16,alignItems:"center",flexWrap:"wrap" }}>
        <button style={btnGhost} onClick={() => setWeekFrom(addDays(weekFrom,-7))}>◀</button>
        <span style={{ color:"#e8eaf0",fontSize:13,flex:1,textAlign:"center" }}>
          {fmtDate(weekFrom)} – {fmtDate(addDays(weekFrom,6))}
        </span>
        <button style={btnGhost} onClick={() => setWeekFrom(addDays(weekFrom,7))}>▶</button>
        <button style={btnGhost} onClick={() => setWeekFrom(todayISO())}>Hôm nay</button>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div style={{ textAlign:"center",color:"#8b90a7",padding:60 }}>Đang tải...</div>
      ) : isMobile ? (

        /* ══ MOBILE: List view grouped by day ══════════════════ */
        <div>
          {weekDays.map(day => {
            const dayCells = assignments.filter(a => toLocalISO(a.date) === day);
            const isToday  = day === todayISO();
            const isPast   = day < todayISO();

            return (
              <div key={day} style={{ marginBottom: 8 }}>
                {/* Day header */}
                <div style={{
                  display:"flex",alignItems:"center",gap:10,
                  padding:"8px 4px",marginBottom: dayCells.length ? 6 : 2,
                }}>
                  <span style={{ color: isToday?"#5b7cf6": isPast?"#4b5563":"#8b90a7",fontWeight: isToday?700:600,fontSize:14 }}>
                    {fmtDateFull(day)}
                  </span>
                  {isToday && (
                    <span style={{ background:"#5b7cf6",color:"#fff",borderRadius:6,padding:"1px 8px",fontSize:11,fontWeight:700 }}>
                      Hôm nay
                    </span>
                  )}
                  {dayCells.length === 0 && (
                    <span style={{ color:"#3d4165",fontSize:12 }}>Không có ca</span>
                  )}
                </div>

                {/* Shift cards for this day */}
                {dayCells.map(a => {
                  const effStatus = getEffectiveStatus(a, day);
                  const sc = STATUS_COLORS[effStatus] || STATUS_COLORS.scheduled;
                  const lateMin = (a.attendance?.status === "late" && a.shift?.startTime)
                    ? calcLateMinutes(a.attendance.checkIn, a.shift.startTime) : 0;
                  return (
                    <div key={a.id} style={{
                      background:"#1a1d2e",
                      border:`1px solid ${sc.color}44`,
                      borderLeft:`3px solid ${sc.color}`,
                      borderRadius:12,padding:"14px 16px",marginBottom:8,
                      display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,
                    }}>
                      <div style={{ flex:1 }}>
                        <div style={{ color:"#e8eaf0",fontWeight:700,fontSize:15 }}>{a.shift?.name}</div>
                        <div style={{ color:"#8b90a7",fontSize:13,marginTop:3 }}>
                          🕐 {a.shift?.startTime} – {a.shift?.endTime}
                        </div>
                        {a.attendance?.checkIn && (
                          <div style={{ marginTop:4 }}>
                            <div style={{ color:"#22c55e",fontSize:12 }}>
                              ✓ {new Date(a.attendance.checkIn).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})}
                              {a.attendance.workHours ? ` · ${a.attendance.workHours.toFixed(1)}h` : ""}
                            </div>
                            {lateMin > 0 && (
                              <div style={{ color:"#f59e0b",fontSize:11,marginTop:2 }}>
                                ⚠ Đi trễ {lateMin} phút ({(lateMin/60).toFixed(1)} giờ)
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div style={{ display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6 }}>
                        <span style={{ color:sc.color,fontSize:11,fontWeight:600,background:`${sc.color}18`,padding:"2px 8px",borderRadius:10 }}>
                          {sc.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

      ) : (

        /* ══ DESKTOP: 7-column grid ═══════════════════════════ */
        <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:10 }}>
          {weekDays.map(day => {
            const dayCells = assignments.filter(a => toLocalISO(a.date) === day);
            const isToday  = day === todayISO();
            return (
              <div key={day} style={{ background:isToday?"rgba(91,124,246,.08)":"#1a1d2e",border:`1px solid ${isToday?"#5b7cf6":"#2d3154"}`,borderRadius:12,padding:12,minHeight:140 }}>
                <div style={{ color:isToday?"#5b7cf6":"#8b90a7",fontSize:12,fontWeight:700,marginBottom:8,textAlign:"center" }}>
                  {fmtDate(day)}
                  {isToday && <span style={{ marginLeft:4,background:"#5b7cf6",color:"#fff",borderRadius:4,padding:"1px 5px",fontSize:10 }}>Hôm nay</span>}
                </div>
                {dayCells.length === 0
                  ? <div style={{ color:"#3d4165",fontSize:11,textAlign:"center",marginTop:20 }}>–</div>
                  : dayCells.map(a => {
                    const effStatus = getEffectiveStatus(a, day);
                    const sc = STATUS_COLORS[effStatus] || STATUS_COLORS.scheduled;
                    const lateMin = (a.attendance?.status === "late" && a.shift?.startTime)
                      ? calcLateMinutes(a.attendance.checkIn, a.shift.startTime) : 0;
                    return (
                      <div key={a.id} style={{ background:"#0f1117",border:`1px solid ${sc.color}44`,borderRadius:8,padding:"8px 10px",marginBottom:6 }}>
                        <div style={{ color:sc.color,fontWeight:700,fontSize:12 }}>{a.shift?.name}</div>
                        <div style={{ color:"#8b90a7",fontSize:11 }}>{a.shift?.startTime}–{a.shift?.endTime}</div>
                        {a.attendance?.checkIn && (
                          <div style={{ marginTop:4 }}>
                            <div style={{ color:"#22c55e",fontSize:10 }}>
                              ✓ {new Date(a.attendance.checkIn).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})}
                              {a.attendance.workHours ? ` · ${a.attendance.workHours.toFixed(1)}h` : ""}
                            </div>
                            {lateMin > 0 && (
                              <div style={{ color:"#f59e0b",fontSize:10,marginTop:2 }}>
                                ⚠ Đi trễ {lateMin} phút ({(lateMin/60).toFixed(1)} giờ)
                              </div>
                            )}
                          </div>
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
          isMobile={isMobile}
          onClose={() => setShowModal(false)}
          onDone={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
};

export default EmployeeShifts;
