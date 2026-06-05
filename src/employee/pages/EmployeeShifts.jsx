import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { useIsMobile } from "../hooks/useIsMobile";

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const getToken = () => localStorage.getItem("token");

const padZ     = (n) => String(n).padStart(2, "0");
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${padZ(d.getMonth()+1)}-${padZ(d.getDate())}`; };
const toLocalISO = (s) => { const d = new Date(s); return `${d.getFullYear()}-${padZ(d.getMonth()+1)}-${padZ(d.getDate())}`; };
const isoOfDay  = (y, m, d) => `${y}-${padZ(m+1)}-${padZ(d)}`;

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

const LEAVE_TYPE_LABEL = {
  annual:    "Phép năm",
  sick:      "Phép ốm",
  unpaid:    "Nghỉ không lương",
  maternity: "Nghỉ thai sản",
  paternity: "Nghỉ thai sản (cha)",
  wedding:   "Nghỉ cưới",
  other:     "Nghỉ khác",
};

const STATUS_CFG = {
  scheduled: { label: "Lên lịch",   bg: "rgba(148,163,184,.1)",  color: "#94a3b8", dot: "#94a3b8" },
  completed: { label: "Hoàn thành", bg: "rgba(34,197,94,.15)",   color: "#22c55e", dot: "#22c55e" },
  late:      { label: "Đi trễ",    bg: "rgba(245,158,11,.15)",  color: "#f59e0b", dot: "#f59e0b" },
  absent:    { label: "Vắng mặt",   bg: "rgba(239,68,68,.15)",   color: "#ef4444", dot: "#ef4444" },
  on_leave:     { label: "Nghỉ phép",       bg: "rgba(139,92,246,.15)",  color: "#a78bfa", dot: "#a78bfa" },
  unpaid_leave: { label: "Nghỉ không lương", bg: "rgba(245,158,11,.15)",  color: "#f59e0b", dot: "#f59e0b" },
  cancelled:    { label: "Đã hủy",          bg: "rgba(107,114,128,.12)", color: "#6b7280", dot: "#6b7280" },
};

// "unpaid" → key riêng, còn lại → on_leave
const leaveStatusKey = (leaveType) => leaveType === "unpaid" ? "unpaid_leave" : "on_leave";

// Ca đã qua giờ kết thúc mà chưa check-in → vắng mặt
const getEffectiveStatus = (a, day) => {
  // Ưu tiên 1: ShiftAssignment.status đã được cập nhật rõ ràng
  if (a.status === "on_leave")  return "on_leave";
  if (a.status === "completed") return "completed";
  if (a.status === "cancelled") return "cancelled";

  // Ưu tiên 2: attendance có status cụ thể
  if (a.attendance?.status === "on_leave")    return "on_leave";
  if (a.attendance?.status === "late")        return "late";
  if (a.attendance?.status === "early_leave") return "late"; // hiện như đi trễ
  if (a.attendance?.checkIn)                  return "completed";

  // Ưu tiên 3: tính theo thời gian
  const today = todayISO();
  if (day < today) return "absent";
  if (day === today && a.shift?.endTime) {
    const [eh, em] = a.shift.endTime.split(":").map(Number);
    const now = new Date(); const end = new Date(); end.setHours(eh, em, 0, 0);
    if (now >= end) return "absent";
  }
  return "scheduled";
};

// Modal đăng ký ca
const RegisterModal = ({ shifts, onClose, onDone, isMobile, defaultDate }) => {
  const [form, setForm]   = useState({ shiftId: "", date: defaultDate || todayISO(), note: "" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

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

  const selectedShift = shifts.find(s => s.id === parseInt(form.shiftId));

  return (
    <div className="emp-modal-overlay sheet">
      <div className="emp-modal-card">
        {isMobile && <div className="emp-modal-handle" />}
        <h3 className="emp-modal-title">📅 Đăng ký ca làm</h3>
        <form onSubmit={submit}>
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <label className="emp-form-label">Chọn ca *</label>
              <select className="emp-select" value={form.shiftId} onChange={e => set("shiftId", e.target.value)}>
                <option value="">-- Chọn ca --</option>
                {shifts.filter(s => s.isActive).map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</option>
                ))}
              </select>
            </div>
            {selectedShift && (
              <div style={{ background: "var(--emp-primary-soft)", border: "1px solid rgba(91,124,246,.25)", borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ color: "var(--emp-primary)", fontWeight: 700, fontSize: 14 }}>{selectedShift.name}</div>
                <div style={{ color: "var(--emp-text-2)", fontSize: 13, marginTop: 2 }}>🕐 {selectedShift.startTime} – {selectedShift.endTime}</div>
              </div>
            )}
            <div>
              <label className="emp-form-label">Ngày làm *</label>
              <input type="date" className="emp-date-input" value={form.date} min={todayISO()} onChange={e => set("date", e.target.value)} />
            </div>
            <div>
              <label className="emp-form-label">Ghi chú</label>
              <input className="emp-input" value={form.note} placeholder="(tuỳ chọn)" onChange={e => set("note", e.target.value)} />
            </div>
          </div>
          <div className="emp-modal-actions">
            <button type="button" onClick={onClose} className="emp-btn-ghost" style={{ flex: 1, padding: 12, fontSize: 15 }}>Hủy</button>
            <button type="submit" disabled={saving} className="emp-btn-primary" style={{ flex: 2 }}>
              {saving ? "Đang gửi..." : "✅ Đăng ký"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Popup chi tiết ngày
const DayPopup = ({ day, assignments, onClose, onRegister, isPartTime, approvedLeave }) => {
  const today = todayISO();
  const isFuture = day >= today;
  const leaveCfg = approvedLeave ? STATUS_CFG[leaveStatusKey(approvedLeave.leaveType)] : STATUS_CFG.on_leave;

  return (
    <div className="emp-modal-overlay" onClick={onClose}>
      <div className="emp-modal-card popup" onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12 }}>
          <div style={{ color: "var(--emp-text)", fontWeight: 700, fontSize: 15 }}>
            {new Date(...day.split("-").map((n,i)=>i===1?n-1:+n)).toLocaleDateString("vi-VN",{weekday:"long",day:"2-digit",month:"2-digit",year:"numeric"})}
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--emp-muted)", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        {/* Card nghỉ phép đã duyệt */}
        {approvedLeave && (
          <div style={{ background:leaveCfg.bg,borderRadius:10,padding:"12px 14px",border:`1px solid ${leaveCfg.dot}44`,marginBottom:10 }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <div style={{ color:"#e8eaf0",fontWeight:700,fontSize:14 }}>
              {approvedLeave?.leaveType === "unpaid" ? "💸 Nghỉ không lương" : "🌿 Nghỉ phép"}
            </div>
              <span style={{ color:leaveCfg.color,fontSize:11,fontWeight:700,background:`${leaveCfg.dot}22`,padding:"2px 8px",borderRadius:10 }}>
                Đã duyệt
              </span>
            </div>
            <div style={{ color:leaveCfg.color,fontSize:13,fontWeight:600,marginTop:6 }}>
              {LEAVE_TYPE_LABEL[approvedLeave.leaveType] || approvedLeave.leaveType}
            </div>
            {approvedLeave.reason && (
              <div style={{ color:"#8b90a7",fontSize:12,marginTop:3 }}>📝 {approvedLeave.reason}</div>
            )}
            <div style={{ color:"#8b90a7",fontSize:11,marginTop:4 }}>
              {new Date(approvedLeave.startDate).toLocaleDateString("vi-VN")} → {new Date(approvedLeave.endDate).toLocaleDateString("vi-VN")}
              {" "}· {approvedLeave.totalDays} ngày
            </div>
          </div>
        )}

        {/* Ca làm — hiển thị với trạng thái "Nghỉ phép" nếu có approved leave */}
        {assignments.length === 0 && !approvedLeave ? (
          <div style={{ color:"#8b90a7",fontSize:13,textAlign:"center",padding:"16px 0" }}>Không có ca làm ngày này</div>
        ) : assignments.length > 0 ? (
          <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
            {assignments.map(a => {
              const eff = approvedLeave ? leaveStatusKey(approvedLeave.leaveType) : getEffectiveStatus(a, day);
              const cfg = STATUS_CFG[eff] || STATUS_CFG.scheduled;
              const lateMin = (!approvedLeave && a.attendance?.status === "late" && a.shift?.startTime)
                ? (() => { const ci=new Date(a.attendance.checkIn); const [sh,sm]=a.shift.startTime.split(":").map(Number); const ss=new Date(ci); ss.setHours(sh,sm,0,0); return Math.max(0,Math.floor((ci-ss)/60000)); })()
                : 0;
              return (
                <div key={a.id} style={{ background:cfg.bg,borderRadius:10,padding:"12px 14px",border:`1px solid ${cfg.dot}44` }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                    <div style={{ color:"#e8eaf0",fontWeight:700,fontSize:14 }}>{a.shift?.name}</div>
                    <span style={{ color:cfg.color,fontSize:11,fontWeight:700,background:`${cfg.dot}22`,padding:"2px 8px",borderRadius:10 }}>{cfg.label}</span>
                  </div>
                  <div style={{ color:"#8b90a7",fontSize:12,marginTop:4 }}>🕐 {a.shift?.startTime} – {a.shift?.endTime}</div>
                  {!approvedLeave && a.attendance?.checkIn && (
                    <div style={{ marginTop:6 }}>
                      <div style={{ color:"#22c55e",fontSize:12 }}>
                        ✓ {new Date(a.attendance.checkIn).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})}
                        {a.attendance.checkOut && ` → ${new Date(a.attendance.checkOut).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})}`}
                        {a.attendance.workHours ? ` · ${a.attendance.workHours.toFixed(1)}h` : ""}
                      </div>
                      {lateMin > 0 && <div style={{ color:"#f59e0b",fontSize:11,marginTop:2 }}>⚠ Đi trễ {lateMin} phút</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}

        {isFuture && isPartTime && !approvedLeave && (
          <button onClick={() => { onClose(); onRegister(day); }}
            style={{ marginTop:16,width:"100%",padding:"10px",background:"rgba(91,124,246,.15)",color:"#5b7cf6",border:"1px solid rgba(91,124,246,.3)",borderRadius:10,cursor:"pointer",fontWeight:600,fontSize:13 }}>
            + Đăng ký ca ngày này
          </button>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
const EmployeeShifts = () => {
  const isMobile = useIsMobile();
  const now = new Date();

  const [year,        setYear]        = useState(now.getFullYear());
  const [month,       setMonth]       = useState(now.getMonth()); // 0-based
  const [assignments,    setAssignments]    = useState([]);
  const [shifts,         setShifts]         = useState([]);
  const [leaveRequests,  setLeaveRequests]  = useState([]);
  const [empType,        setEmpType]        = useState(null); // "full-time" | "part-time"
  const [loading,        setLoading]        = useState(true);
  const [showModal,   setShowModal]   = useState(false);
  const [modalDate,   setModalDate]   = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);

  // Tính from/to của tháng đang xem (thêm buffer tuần đầu/cuối)
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  // Lùi về T2 của tuần đầu
  const startOffset = (firstDay.getDay() + 6) % 7; // 0=Mon
  const calStart = new Date(firstDay); calStart.setDate(1 - startOffset);
  // Tới CN của tuần cuối
  const endOffset = (7 - lastDay.getDay()) % 7;
  const calEnd = new Date(lastDay); calEnd.setDate(lastDay.getDate() + endOffset);

  const fromISO = isoOfDay(calStart.getFullYear(), calStart.getMonth(), calStart.getDate());
  const toISO   = isoOfDay(calEnd.getFullYear(),   calEnd.getMonth(),   calEnd.getDate());

  const load = useCallback(() => {
    const token = getToken();
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/shift-assignments/my?from=${fromISO}&to=${toISO}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${API_BASE}/shifts?active=1`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${API_BASE}/leave/my`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({ leaves: [] })),
      fetch(`${API_BASE}/employees/me/profile`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([a, s, lr, emp]) => {
      setAssignments(Array.isArray(a) ? a : []);
      setShifts(Array.isArray(s) ? s : []);
      setLeaveRequests(Array.isArray(lr?.leaves) ? lr.leaves : []);
      setEmpType(emp?.employmentType ?? null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [fromISO, toISO]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handler = (e) => {
      if (['leave:approved', 'leave:rejected'].includes(e.detail.event)) load();
    };
    window.addEventListener('emp:socket', handler);
    return () => window.removeEventListener('emp:socket', handler);
  }, [load]);

  // Build map: ISO → assignments[]
  const dayMap = {};
  assignments.forEach(a => {
    const iso = toLocalISO(a.date);
    if (!dayMap[iso]) dayMap[iso] = [];
    dayMap[iso].push(a);
  });

  // Map: ISO → leaveType — cho các ngày được HR duyệt nghỉ phép
  const leaveMap = new Map();
  leaveRequests
    .filter(l => l.status === "approved")
    .forEach(l => {
      const cur = new Date(l.startDate);
      const end = new Date(l.endDate);
      while (cur <= end) {
        leaveMap.set(`${cur.getFullYear()}-${padZ(cur.getMonth()+1)}-${padZ(cur.getDate())}`, l.leaveType);
        cur.setDate(cur.getDate() + 1);
      }
    });

  // Thống kê tháng (chỉ tính ngày trong tháng đang xem)
  const today = todayISO();
  const thisMonthISO = `${year}-${padZ(month+1)}`;
  const monthAssigns = assignments.filter(a => toLocalISO(a.date).startsWith(thisMonthISO));
  const stats = monthAssigns.reduce((acc, a) => {
    const iso = toLocalISO(a.date);
    // Nếu ngày đó có phép đã duyệt → ưu tiên trạng thái nghỉ, không tính đi trễ/vắng
    const eff = leaveMap.has(iso)
      ? leaveStatusKey(leaveMap.get(iso))
      : getEffectiveStatus(a, iso);
    acc[eff] = (acc[eff] || 0) + 1;
    return acc;
  }, {});

  // Build calendar grid
  const calDays = [];
  const cur = new Date(calStart);
  while (cur <= calEnd) {
    calDays.push(isoOfDay(cur.getFullYear(), cur.getMonth(), cur.getDate()));
    cur.setDate(cur.getDate() + 1);
  }

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y-1); } else setMonth(m => m-1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y+1); } else setMonth(m => m+1); };

  const openRegister = (date) => { setModalDate(date); setShowModal(true); };

  const MONTH_NAMES = ["Tháng 1","Tháng 2","Tháng 3","Tháng 4","Tháng 5","Tháng 6","Tháng 7","Tháng 8","Tháng 9","Tháng 10","Tháng 11","Tháng 12"];

  return (
    <div className="emp-page">
      {/* ── Header ── */}
      <div className="emp-page-header">
        <div>
          <h1 className="emp-page-title">📅 Ca Làm của Tôi</h1>
          <p className="emp-page-sub">{monthAssigns.length} ca trong tháng</p>
        </div>
        <div className="emp-page-actions">
          <button onClick={load} className="emp-icon-btn">🔄</button>
          {empType === "part-time" && (
            <button onClick={() => openRegister(today)} className="emp-btn-primary" style={{ padding: "9px 16px", fontSize: 13 }}>
              + Đăng ký ca
            </button>
          )}
        </div>
      </div>

      {/* ── Stats tháng ── */}
      <div className="emp-chips">
        {Object.entries({ scheduled:"Lên lịch", completed:"Hoàn thành", late:"Đi trễ", absent:"Vắng mặt", on_leave:"Nghỉ phép", unpaid_leave:"Không lương" }).map(([key, label]) => {
          const cfg = STATUS_CFG[key];
          return (
            <div key={key} className="emp-chip">
              <div className="emp-chip-dot" style={{ background: cfg.dot }} />
              <span className="emp-chip-label">{label}</span>
              <span className="emp-chip-val" style={{ color: cfg.color }}>{stats[key] || 0}</span>
            </div>
          );
        })}
      </div>

      {/* ── Calendar ── */}
      <div className="emp-cal">
        {/* Month nav */}
        <div className="emp-cal-nav">
          <button onClick={prevMonth} className="emp-cal-nav-btn">‹</button>
          <div className="emp-cal-month">{MONTH_NAMES[month]} {year}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setMonth(now.getMonth()); setYear(now.getFullYear()); }} className="emp-cal-today-btn">
              Hôm nay
            </button>
            <button onClick={nextMonth} className="emp-cal-nav-btn">›</button>
          </div>
        </div>

        {/* Weekday headers */}
        <div className="emp-cal-weekdays">
          {WEEKDAYS.map((d, i) => (
            <div key={d} className={`emp-cal-weekday ${i === 6 ? "sun" : ""}`}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        {loading ? (
          <div className="emp-empty"><div className="emp-skeleton" style={{ height: 200, margin: 16, borderRadius: 10 }} /></div>
        ) : (
          <div className="emp-cal-grid">
            {calDays.map((iso, idx) => {
              const [y2, m2, d2] = iso.split("-").map(Number);
              const isCurrentMonth = (m2 === month + 1 && y2 === year);
              const isToday  = iso === today;
              const isPast   = iso < today;
              const dayAssigns = dayMap[iso] || [];
              const isWeekend = idx % 7 === 6; // CN

              // Tính status tổng hợp của ngày
              const isOnLeave = leaveMap.has(iso);
              let dayStatus = null;
              if (isOnLeave) {
                dayStatus = leaveStatusKey(leaveMap.get(iso));
              } else if (dayAssigns.length > 0) {
                const statuses = dayAssigns.map(a => getEffectiveStatus(a, iso));
                if (statuses.includes("absent"))         dayStatus = "absent";
                else if (statuses.includes("completed")) dayStatus = "completed";
                else if (statuses.includes("on_leave"))  dayStatus = "on_leave";
                else if (statuses.includes("scheduled")) dayStatus = "scheduled";
              }
              const cfg = dayStatus ? STATUS_CFG[dayStatus] : null;

              return (
                <div
                  key={iso}
                  onClick={() => dayAssigns.length > 0 || iso >= today ? setSelectedDay(iso) : null}
                  style={{
                    minHeight: isMobile ? 52 : 72,
                    padding: isMobile ? "6px 4px" : "8px",
                    borderRight: (idx+1)%7===0 ? "none" : "1px solid var(--emp-border)",
                    borderBottom: idx < calDays.length - 7 ? "1px solid var(--emp-border)" : "none",
                    background: isToday ? "rgba(91,124,246,.08)" : "transparent",
                    cursor: dayAssigns.length > 0 || iso >= today ? "pointer" : "default",
                    opacity: isCurrentMonth ? 1 : 0.35,
                    transition: "background .12s",
                    position: "relative",
                  }}
                  onMouseEnter={e => { if (isCurrentMonth) e.currentTarget.style.background = isToday ? "rgba(91,124,246,.14)" : "rgba(255,255,255,.03)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isToday ? "rgba(91,124,246,.08)" : "transparent"; }}
                >
                  {/* Số ngày */}
                  <div style={{
                    display:"flex",alignItems:"center",justifyContent:"center",
                    width: isToday ? (isMobile?22:26) : "auto",
                    height: isToday ? (isMobile?22:26) : "auto",
                    borderRadius:"50%",
                    background: isToday ? "#5b7cf6" : "transparent",
                    color: isToday ? "#fff" : isWeekend ? (isCurrentMonth?"#f87171":"#f8717166") : isCurrentMonth ? "#e8eaf0" : "#4b5563",
                    fontSize: isMobile ? 12 : 13,
                    fontWeight: isToday ? 700 : 500,
                    margin: isToday ? "0 auto" : "0",
                  }}>
                    {d2}
                  </div>

                  {/* Ca làm / nghỉ phép */}
                  {isCurrentMonth && (isOnLeave || dayAssigns.length > 0) && (
                    <div style={{ marginTop: isMobile ? 3 : 4 }}>
                      {/* Badge nghỉ phép đã duyệt (ưu tiên hiển thị trước) */}
                      {isOnLeave && (() => {
                        const lk  = leaveStatusKey(leaveMap.get(iso));
                        const lc  = STATUS_CFG[lk];
                        const isU = lk === "unpaid_leave";
                        return (
                          <div style={{
                            background: lc.bg,
                            borderRadius: 4,
                            padding: isMobile ? "2px 4px" : "3px 6px",
                            marginBottom: 2,
                            overflow: "hidden",
                          }}>
                            {isMobile ? (
                              <div style={{ width:6,height:6,borderRadius:"50%",background:lc.dot,margin:"2px auto" }} />
                            ) : (
                              <div style={{ color:lc.color,fontSize:10,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>
                                {isU ? "💸 Không lương" : "🌿 Nghỉ phép"}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      {/* Ca làm (chỉ hiện nếu không phải ngày nghỉ) */}
                      {!isOnLeave && dayAssigns.slice(0, isMobile ? 1 : 2).map(a => {
                        const eff = getEffectiveStatus(a, iso);
                        const c   = STATUS_CFG[eff] || STATUS_CFG.scheduled;
                        return (
                          <div key={a.id} style={{
                            background: c.bg,
                            borderRadius: 4,
                            padding: isMobile ? "2px 4px" : "3px 6px",
                            marginBottom: 2,
                            overflow: "hidden",
                          }}>
                            {isMobile ? (
                              <div style={{ width:6,height:6,borderRadius:"50%",background:c.dot,margin:"2px auto" }} />
                            ) : (
                              <>
                                <div style={{ color:c.color,fontSize:10,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>
                                  {a.shift?.name}
                                </div>
                                <div style={{ color:c.color,fontSize:9,opacity:.8 }}>
                                  {a.shift?.startTime}–{a.shift?.endTime}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                      {!isOnLeave && dayAssigns.length > (isMobile ? 1 : 2) && (
                        <div style={{ color:"#8b90a7",fontSize:9,textAlign:"center" }}>+{dayAssigns.length - (isMobile?1:2)}</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Legend ── */}
      <div className="emp-legend">
        {Object.entries(STATUS_CFG).map(([key, cfg]) => (
          <div key={key} className="emp-legend-item">
            <div className="emp-legend-swatch" style={{ background: cfg.bg, border: `1px solid ${cfg.dot}66` }} />
            <span className="emp-legend-label">{cfg.label}</span>
          </div>
        ))}
      </div>

      {/* ── Day detail popup ── */}
      {selectedDay && (
        <DayPopup
          day={selectedDay}
          assignments={dayMap[selectedDay] || []}
          onClose={() => setSelectedDay(null)}
          onRegister={(date) => { setSelectedDay(null); openRegister(date); }}
          isPartTime={empType === "part-time"}
          approvedLeave={leaveRequests.find(l =>
            l.status === "approved" &&
            selectedDay >= toLocalISO(l.startDate) &&
            selectedDay <= toLocalISO(l.endDate)
          ) ?? null}
        />
      )}

      {/* ── Register modal (chỉ part-time) ── */}
      {showModal && empType === "part-time" && (
        <RegisterModal
          shifts={shifts}
          isMobile={isMobile}
          defaultDate={modalDate}
          onClose={() => { setShowModal(false); setModalDate(null); }}
          onDone={() => { setShowModal(false); setModalDate(null); load(); }}
        />
      )}
    </div>
  );
};

export default EmployeeShifts;
