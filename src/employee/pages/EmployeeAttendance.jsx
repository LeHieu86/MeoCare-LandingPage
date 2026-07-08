import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { useIsMobile } from "../hooks/useIsMobile";

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const getToken = () => localStorage.getItem("token");

const padZ = (n) => String(n).padStart(2, "0");
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${padZ(d.getMonth() + 1)}-${padZ(d.getDate())}`;
};
const firstOfMonthISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${padZ(d.getMonth() + 1)}-01`;
};
const fmtDate = (isoStr) => {
  if (!isoStr) return "–";
  return new Date(isoStr).toLocaleDateString("vi-VN");
};
const fmtTime = (dt) =>
  dt ? new Date(dt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "–";

/* status → class badge (xem .emp-badge.is-* trong employee.css) */
const STATUS_MAP = {
  present:     { label: "Có mặt",   cls: "is-success" },
  absent:      { label: "Vắng mặt", cls: "is-danger"  },
  late:        { label: "Đi trễ",   cls: "is-warn"    },
  early_leave: { label: "Về sớm",   cls: "is-warn"    },
  on_leave:    { label: "Nghỉ phép",cls: "is-purple"  },
};

const calcLateMinutes = (checkInTime, shiftStartTime) => {
  if (!checkInTime || !shiftStartTime) return 0;
  const checkIn = new Date(checkInTime);
  const [sh, sm] = shiftStartTime.split(":").map(Number);
  const shiftStart = new Date(checkIn);
  shiftStart.setHours(sh, sm, 0, 0);
  return Math.max(0, Math.floor((checkIn - shiftStart) / 60000));
};

const EmployeeAttendance = () => {
  const isMobile = useIsMobile();

  const [records,    setRecords]    = useState([]);
  const [todayAtt,   setTodayAtt]   = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [from,       setFrom]       = useState(firstOfMonthISO);
  const [to,         setTo]         = useState(todayISO);

  const load = useCallback(() => {
    const token = getToken();
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/attendance/today`,                        { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
      fetch(`${API_BASE}/attendance/my?from=${from}&to=${to}`,     { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([att, list]) => {
      setTodayAtt(att);
      setRecords(Array.isArray(list) ? list : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  // Real-time: reload khi có cập nhật chấm công
  useEffect(() => {
    const handler = (e) => {
      if (['attendance:alert', 'leave:approved'].includes(e.detail.event)) load();
    };
    window.addEventListener('emp:socket', handler);
    return () => window.removeEventListener('emp:socket', handler);
  }, [load]);

  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      const r = await fetch(`${API_BASE}/attendance/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({}),
      });
      const d = await r.json();
      if (r.ok) { toast.success("✅ Check-in thành công!"); load(); }
      else       toast.error(d.error || "Lỗi check-in");
    } catch { toast.error("Mất kết nối."); }
    setCheckingIn(false);
  };

  const handleCheckOut = async () => {
    setCheckingIn(true);
    try {
      const r = await fetch(`${API_BASE}/attendance/check-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({}),
      });
      const d = await r.json();
      if (r.ok) { toast.success("👋 Check-out thành công!"); load(); }
      else       toast.error(d.error || "Lỗi check-out");
    } catch { toast.error("Mất kết nối."); }
    setCheckingIn(false);
  };

  // Gộp ngày: nếu cùng ngày có cả record on_leave (không check-in) và record có check-in thực,
  // bỏ card on_leave — chỉ giữ card attendance thực và đánh dấu ngày đó có nghỉ phép
  const leaveOnlyByDate = {};   // dateKey → on_leave record (không có checkIn)
  const hasAttendanceDate = {}; // dateKey → true nếu có checkIn thực
  records.forEach(rec => {
    const dk = new Date(rec.date).toLocaleDateString("vi-VN");
    if (rec.status === "on_leave" && !rec.checkIn) leaveOnlyByDate[dk] = rec;
    if (rec.checkIn) hasAttendanceDate[dk] = true;
  });
  const displayRecords = records.filter(rec => {
    const dk = new Date(rec.date).toLocaleDateString("vi-VN");
    // Lọc bỏ card on_leave nếu ngày đó đã có attendance thực
    if (rec.status === "on_leave" && !rec.checkIn && hasAttendanceDate[dk]) return false;
    return true;
  });
  // Map: dateKey → on_leave record (để hiển thị badge trên card attendance thực)
  const partialLeaveByDate = Object.fromEntries(
    Object.entries(leaveOnlyByDate).filter(([dk]) => hasAttendanceDate[dk])
  );

  const stats = records.reduce((a, r) => {
    a[r.status] = (a[r.status] || 0) + 1;
    a.totalHours = (a.totalHours || 0) + (r.workHours || 0);
    a.totalOT    = (a.totalOT    || 0) + (r.overtimeHours || 0);
    return a;
  }, {});

  const hasCheckedIn  = !!todayAtt?.checkIn;
  const hasCheckedOut = !!todayAtt?.checkOut;

  const statCards = [
    { icon: "⏱️", label: "Tổng giờ",  val: `${(stats.totalHours || 0).toFixed(1)}h`, cls: "" },
    { icon: "✅", label: "Có mặt",     val: (stats.present || 0) + (stats.late || 0) + (stats.early_leave || 0), cls: "is-success" },
    { icon: "⏰", label: "Đi trễ",     val: stats.late || 0,   cls: "is-warn" },
    { icon: "🚫", label: "Vắng mặt",   val: stats.absent || 0, cls: stats.absent ? "is-danger" : "" },
    { icon: "🔥", label: "Tăng ca",    val: `${(stats.totalOT || 0).toFixed(1)}h`, cls: "is-warn" },
  ];

  return (
    <div className="emp-page">

      {/* ── Title ── */}
      <div className="emp-page-header">
        <h1 className="emp-page-title">⏰ Chấm Công</h1>
        <button onClick={load} className="emp-btn-ghost">🔄 Làm mới</button>
      </div>

      {/* ── Check-in Banner ── */}
      <div className="emp-att-banner">
        <div style={{ color: "var(--emp-muted)", fontSize: 12, marginBottom: 6 }}>
          {new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}
        </div>

        {!hasCheckedIn && (
          <div style={{ color: "var(--emp-text)", fontWeight: 700, fontSize: 16, marginBottom: 14 }}>
            Chưa check-in hôm nay
          </div>
        )}
        {hasCheckedIn && !hasCheckedOut && (() => {
          const lateMin = (todayAtt.status === "late" && todayAtt.shiftAssignment?.shift?.startTime)
            ? calcLateMinutes(todayAtt.checkIn, todayAtt.shiftAssignment.shift.startTime) : 0;
          return (
            <div style={{ marginBottom: 14 }}>
              <div style={{ color: "var(--emp-success)", fontWeight: 700, fontSize: 16 }}>🟢 Đang làm việc</div>
              <div style={{ color: "var(--emp-muted)", fontSize: 13, marginTop: 3 }}>
                Vào lúc {fmtTime(todayAtt.checkIn)}
                {todayAtt.shiftAssignment?.shift?.name && ` — ${todayAtt.shiftAssignment.shift.name}`}
              </div>
              {lateMin > 0 && (
                <div style={{ color: "var(--emp-warn)", fontSize: 13, marginTop: 4 }}>
                  ⚠ Đi trễ {lateMin} phút ({(lateMin/60).toFixed(1)} giờ)
                </div>
              )}
            </div>
          );
        })()}
        {hasCheckedOut && (() => {
          const lateMin = (todayAtt.status === "late" && todayAtt.shiftAssignment?.shift?.startTime)
            ? calcLateMinutes(todayAtt.checkIn, todayAtt.shiftAssignment.shift.startTime) : 0;
          return (
            <div style={{ marginBottom: 6 }}>
              <div style={{ color: "var(--emp-text)", fontWeight: 700, fontSize: 15 }}>🎉 Hoàn thành ca</div>
              <div style={{ color: "var(--emp-muted)", fontSize: 13, marginTop: 3 }}>
                {fmtTime(todayAtt.checkIn)} – {fmtTime(todayAtt.checkOut)}
                {" · "}<strong style={{ color: "var(--emp-success)" }}>{todayAtt.workHours?.toFixed(1)}h</strong>
                {todayAtt.overtimeHours > 0 && <span style={{ color: "var(--emp-warn)", marginLeft: 8 }}>+{todayAtt.overtimeHours.toFixed(1)}h OT</span>}
              </div>
              {lateMin > 0 && (
                <div style={{ color: "var(--emp-warn)", fontSize: 13, marginTop: 4 }}>
                  ⚠ Đi trễ {lateMin} phút ({(lateMin/60).toFixed(1)} giờ)
                </div>
              )}
            </div>
          );
        })()}

        {/* Buttons */}
        {!hasCheckedOut && (
          <div className="emp-hero-actions" style={{ marginTop: hasCheckedIn ? 12 : 0 }}>
            {!hasCheckedIn && (
              <button onClick={handleCheckIn} disabled={checkingIn} className="emp-btn-primary emp-btn-block">
                {checkingIn ? "Đang xử lý..." : "▶ Check-in"}
              </button>
            )}
            {hasCheckedIn && !hasCheckedOut && (
              <button onClick={handleCheckOut} disabled={checkingIn} className="emp-btn-danger emp-btn-block">
                {checkingIn ? "Đang xử lý..." : "⏹ Check-out"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Stats ── */}
      <div className="emp-stats-grid cols-5">
        {statCards.map(({ icon, label, val, cls }) => (
          <div key={label} className="emp-stat">
            <div className="emp-stat-icon">{icon}</div>
            <div className={`emp-stat-val ${cls}`}>{val}</div>
            <div className="emp-stat-label">{label}</div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="emp-filters">
        <input type="date" className="emp-date-input" value={from} onChange={e => setFrom(e.target.value)} />
        <span className="emp-filters-sep">–</span>
        <input type="date" className="emp-date-input" value={to} onChange={e => setTo(e.target.value)} />
        <button onClick={() => { setFrom(firstOfMonthISO()); setTo(todayISO()); }} className="emp-btn-ghost">Tháng này</button>
      </div>

      {/* ── Records ── */}
      {loading ? (
        <div>
          {[0, 1, 2].map(i => (
            <div key={i} className="emp-skeleton-card">
              <div className="emp-skeleton emp-skeleton-line" style={{ width: "40%" }} />
              <div className="emp-skeleton emp-skeleton-line" style={{ width: "70%" }} />
            </div>
          ))}
        </div>
      ) : records.length === 0 ? (
        <div className="emp-empty">
          <div className="emp-empty-icon">🗓️</div>
          <p>Không có dữ liệu trong khoảng thời gian này.</p>
        </div>
      ) : isMobile ? (
        /* ── MOBILE: Card list ── */
        <div>
          {displayRecords.map(rec => {
            const dk = new Date(rec.date).toLocaleDateString("vi-VN");
            const partialLeave = partialLeaveByDate[dk];
            const isWorking = rec.checkIn && !rec.checkOut;
            const st = isWorking
              ? { label: "🟢 Đang làm", cls: "is-success" }
              : (STATUS_MAP[rec.status] || STATUS_MAP.absent);
            const lateMin = (rec.status === "late" && rec.shiftAssignment?.shift?.startTime)
              ? calcLateMinutes(rec.checkIn, rec.shiftAssignment.shift.startTime) : 0;
            return (
              <div key={rec.id} className={`emp-att-card ${isWorking ? "is-working" : rec.status === "absent" ? "is-absent" : ""}`}>
                {/* Top row: date + status */}
                <div className="emp-att-card-top">
                  <div>
                    <div className="emp-att-card-date">{fmtDate(rec.date)}</div>
                    {rec.shiftAssignment?.shift?.name && (
                      <div className="emp-att-card-shift">
                        {rec.shiftAssignment.shift.name} · {rec.shiftAssignment.shift.startTime}–{rec.shiftAssignment.shift.endTime}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    <span className={`emp-badge ${st.cls}`}>{st.label}</span>
                    {partialLeave && (
                      <span className="emp-badge sm is-warn">💸 NKL bán ngày</span>
                    )}
                  </div>
                </div>
                {/* Time row */}
                {rec.status === "absent" ? (
                  <div style={{ color: "var(--emp-faint)", fontSize: 12, fontStyle: "italic" }}>
                    Không có dữ liệu chấm công
                  </div>
                ) : (
                <div className="emp-att-times">
                  <div>
                    <div className="emp-att-time-label">Vào</div>
                    <div className="emp-att-time-val">{fmtTime(rec.checkIn)}</div>
                    {lateMin > 0 && (
                      <div style={{ color: "var(--emp-warn)", fontSize: 11, marginTop: 2 }}>
                        Trễ {lateMin}p ({(lateMin/60).toFixed(1)}h)
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="emp-att-time-label">Ra</div>
                    <div className="emp-att-time-val" style={isWorking ? { color: "var(--emp-success-2)" } : undefined}>
                      {isWorking ? "Chưa ra" : fmtTime(rec.checkOut)}
                    </div>
                  </div>
                  {(rec.workHours > 0 || isWorking) && (
                    <div>
                      <div className="emp-att-time-label">Giờ công</div>
                      <div style={{ color: "var(--emp-success)", fontWeight: 700, fontSize: 14 }}>
                        {isWorking ? "–" : `${rec.workHours?.toFixed(1)}h`}
                        {rec.overtimeHours > 0 && <span style={{ color: "var(--emp-warn)", fontSize: 12 }}> +{rec.overtimeHours.toFixed(1)}OT</span>}
                      </div>
                    </div>
                  )}
                </div>
                )}
                {(rec.note || partialLeave?.note) && (
                  <div className="emp-att-note">
                    📝 {rec.note || partialLeave?.note}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ── DESKTOP: Table ── */
        <div className="emp-att-table-wrap">
          <table className="emp-att-table">
            <thead>
              <tr>
                {["Ngày", "Ca làm", "Giờ vào", "Giờ ra", "Giờ công", "Tăng ca", "Trạng thái", "Ghi chú"].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayRecords.map(rec => {
                const dk = new Date(rec.date).toLocaleDateString("vi-VN");
                const partialLeave = partialLeaveByDate[dk];
                const isWorking = rec.checkIn && !rec.checkOut;
                const st = isWorking
                  ? { label: "🟢 Đang làm", cls: "is-success" }
                  : (STATUS_MAP[rec.status] || STATUS_MAP.absent);
                const lateMin = (rec.status === "late" && rec.shiftAssignment?.shift?.startTime)
                  ? calcLateMinutes(rec.checkIn, rec.shiftAssignment.shift.startTime) : 0;
                return (
                  <tr key={rec.id}>
                    <td>{fmtDate(rec.date)}</td>
                    <td>{rec.shiftAssignment?.shift?.name || <span style={{ color: "var(--emp-faint)" }}>–</span>}</td>
                    <td>
                      {rec.status === "absent" ? <span style={{ color: "var(--emp-faint-2)", fontSize: 12 }}>–</span> : (
                        <>
                          <div>{fmtTime(rec.checkIn)}</div>
                          {lateMin > 0 && (
                            <div style={{ color: "var(--emp-warn)", fontSize: 11, marginTop: 2 }}>
                              Trễ {lateMin}p ({(lateMin/60).toFixed(1)}h)
                            </div>
                          )}
                        </>
                      )}
                    </td>
                    <td>
                      {rec.status === "absent"
                        ? <span style={{ color: "var(--emp-faint-2)", fontSize: 12 }}>–</span>
                        : isWorking ? <span style={{ color: "var(--emp-success-2)", fontSize: 12 }}>Chưa ra</span> : fmtTime(rec.checkOut)}
                    </td>
                    <td>{rec.workHours ? <strong style={{ color: "var(--emp-success)" }}>{rec.workHours.toFixed(1)}h</strong> : <span style={{ color: "var(--emp-faint-2)" }}>0h</span>}</td>
                    <td>{rec.overtimeHours > 0 ? <span style={{ color: "var(--emp-warn)" }}>+{rec.overtimeHours.toFixed(1)}h</span> : "–"}</td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                        <span className={`emp-badge ${st.cls}`}>{st.label}</span>
                        {partialLeave && (
                          <span className="emp-badge sm is-warn">💸 NKL bán ngày</span>
                        )}
                      </div>
                    </td>
                    <td><span style={{ color: "var(--emp-muted)", fontSize: 12 }}>{rec.note || partialLeave?.note || "–"}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default EmployeeAttendance;
