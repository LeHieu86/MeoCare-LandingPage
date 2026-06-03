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
  const [y, m, d] = isoStr.split("T")[0].split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("vi-VN");
};
const fmtTime = (dt) =>
  dt ? new Date(dt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "–";

const STATUS_MAP = {
  present:     { label: "Có mặt",   color: "#22c55e", bg: "rgba(34,197,94,.12)"  },
  absent:      { label: "Vắng mặt", color: "#ef4444", bg: "rgba(239,68,68,.12)"  },
  late:        { label: "Đi trễ",   color: "#f59e0b", bg: "rgba(245,158,11,.12)" },
  early_leave: { label: "Về sớm",   color: "#f97316", bg: "rgba(249,115,22,.12)" },
  on_leave:    { label: "Nghỉ phép",color: "#8b5cf6", bg: "rgba(139,92,246,.12)" },
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

  const stats = records.reduce((a, r) => {
    a[r.status] = (a[r.status] || 0) + 1;
    a.totalHours = (a.totalHours || 0) + (r.workHours || 0);
    a.totalOT    = (a.totalOT    || 0) + (r.overtimeHours || 0);
    return a;
  }, {});

  const hasCheckedIn  = !!todayAtt?.checkIn;
  const hasCheckedOut = !!todayAtt?.checkOut;

  /* ── shared styles ── */
  const inputStyle = {
    background: "#0f1117", border: "1px solid #2d3154",
    borderRadius: 8, padding: "8px 12px",
    color: "#e8eaf0", fontSize: isMobile ? 16 : 14,
  };
  const btnSecondary = {
    padding: "9px 16px", background: "transparent", color: "#8b90a7",
    border: "1px solid #2d3154", borderRadius: 8, cursor: "pointer", fontSize: 13,
  };

  return (
    <div className="emp-page">

      {/* ── Title ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ color: "#e8eaf0", fontSize: isMobile ? 19 : 22, fontWeight: 700, margin: 0 }}>⏰ Chấm Công</h1>
        <button onClick={load} style={btnSecondary}>🔄 Làm mới</button>
      </div>

      {/* ── Check-in Banner ── */}
      <div style={{
        background: "#1a1d2e", border: "1px solid #2d3154", borderRadius: 16,
        padding: isMobile ? 18 : 20, marginBottom: 20,
      }}>
        <div style={{ color: "#8b90a7", fontSize: 12, marginBottom: 6 }}>
          {new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}
        </div>

        {!hasCheckedIn && (
          <div style={{ color: "#e8eaf0", fontWeight: 700, fontSize: 16, marginBottom: 14 }}>
            Chưa check-in hôm nay
          </div>
        )}
        {hasCheckedIn && !hasCheckedOut && (() => {
          const lateMin = (todayAtt.status === "late" && todayAtt.shiftAssignment?.shift?.startTime)
            ? calcLateMinutes(todayAtt.checkIn, todayAtt.shiftAssignment.shift.startTime) : 0;
          return (
            <div style={{ marginBottom: 14 }}>
              <div style={{ color: "#22c55e", fontWeight: 700, fontSize: 16 }}>🟢 Đang làm việc</div>
              <div style={{ color: "#8b90a7", fontSize: 13, marginTop: 3 }}>
                Vào lúc {fmtTime(todayAtt.checkIn)}
                {todayAtt.shiftAssignment?.shift?.name && ` — ${todayAtt.shiftAssignment.shift.name}`}
              </div>
              {lateMin > 0 && (
                <div style={{ color: "#f59e0b", fontSize: 13, marginTop: 4 }}>
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
              <div style={{ color: "#e8eaf0", fontWeight: 700, fontSize: 15 }}>🎉 Hoàn thành ca</div>
              <div style={{ color: "#8b90a7", fontSize: 13, marginTop: 3 }}>
                {fmtTime(todayAtt.checkIn)} – {fmtTime(todayAtt.checkOut)}
                {" · "}<strong style={{ color: "#22c55e" }}>{todayAtt.workHours?.toFixed(1)}h</strong>
                {todayAtt.overtimeHours > 0 && <span style={{ color: "#f59e0b", marginLeft: 8 }}>+{todayAtt.overtimeHours.toFixed(1)}h OT</span>}
              </div>
              {lateMin > 0 && (
                <div style={{ color: "#f59e0b", fontSize: 13, marginTop: 4 }}>
                  ⚠ Đi trễ {lateMin} phút ({(lateMin/60).toFixed(1)} giờ)
                </div>
              )}
            </div>
          );
        })()}

        {/* Buttons */}
        {!hasCheckedOut && (
          <div style={{ display: "flex", gap: 10, marginTop: hasCheckedIn ? 12 : 0 }}>
            {!hasCheckedIn && (
              <button onClick={handleCheckIn} disabled={checkingIn}
                style={{ flex: isMobile ? 1 : undefined, background: "#5b7cf6", color: "#fff", border: "none", borderRadius: 10, padding: isMobile ? "13px 0" : "11px 28px", fontWeight: 700, fontSize: isMobile ? 15 : 14, cursor: "pointer", minHeight: 46 }}>
                {checkingIn ? "Đang xử lý..." : "▶ Check-in"}
              </button>
            )}
            {hasCheckedIn && !hasCheckedOut && (
              <button onClick={handleCheckOut} disabled={checkingIn}
                style={{ flex: isMobile ? 1 : undefined, background: "transparent", color: "#ef4444", border: "1px solid #ef4444", borderRadius: 10, padding: isMobile ? "13px 0" : "11px 28px", fontWeight: 700, fontSize: isMobile ? 15 : 14, cursor: "pointer", minHeight: 46 }}>
                {checkingIn ? "Đang xử lý..." : "⏹ Check-out"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Stats ── */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { icon: "⏱️", label: "Tổng giờ",  val: `${(stats.totalHours || 0).toFixed(1)}h`, valColor: "#e8eaf0" },
          { icon: "✅", label: "Có mặt",     val: (stats.present || 0) + (stats.late || 0) + (stats.early_leave || 0), valColor: "#22c55e" },
          { icon: "⏰", label: "Đi trễ",     val: stats.late || 0,   valColor: "#f59e0b" },
          { icon: "🚫", label: "Vắng mặt",   val: stats.absent || 0, valColor: stats.absent ? "#ef4444" : "#e8eaf0" },
          { icon: "🔥", label: "Tăng ca",    val: `${(stats.totalOT || 0).toFixed(1)}h`, valColor: "#f59e0b" },
        ].map(({ icon, label, val, valColor }) => (
          <div key={label} style={{ background: "#1a1d2e", border: "1px solid #2d3154", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 18 }}>{icon}</div>
            <div style={{ color: valColor, fontWeight: 800, fontSize: 18, marginTop: 4 }}>{val}</div>
            <div style={{ color: "#8b90a7", fontSize: 11, marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <input type="date" style={{ ...inputStyle, flex: "1 1 130px" }} value={from} onChange={e => setFrom(e.target.value)} />
        <span style={{ color: "#6b7280" }}>–</span>
        <input type="date" style={{ ...inputStyle, flex: "1 1 130px" }} value={to}   onChange={e => setTo(e.target.value)} />
        <button onClick={() => { setFrom(firstOfMonthISO()); setTo(todayISO()); }} style={btnSecondary}>Tháng này</button>
      </div>

      {/* ── Records ── */}
      {loading ? (
        <div style={{ textAlign: "center", color: "#8b90a7", padding: 60 }}>Đang tải...</div>
      ) : records.length === 0 ? (
        <div style={{ textAlign: "center", color: "#8b90a7", padding: 60 }}>
          Không có dữ liệu trong khoảng thời gian này.
        </div>
      ) : isMobile ? (
        /* ── MOBILE: Card list ── */
        <div>
          {records.map(rec => {
            const isWorking = rec.checkIn && !rec.checkOut;
            const st = isWorking
              ? { label: "🟢 Đang làm", color: "#34d399", bg: "rgba(34,197,94,.1)" }
              : (STATUS_MAP[rec.status] || STATUS_MAP.absent);
            const lateMin = (rec.status === "late" && rec.shiftAssignment?.shift?.startTime)
              ? calcLateMinutes(rec.checkIn, rec.shiftAssignment.shift.startTime) : 0;
            return (
              <div key={rec.id} style={{
                background: "#1a1d2e",
                border: `1px solid ${isWorking ? "rgba(34,197,94,.3)" : rec.status === "absent" ? "rgba(239,68,68,.25)" : "#2d3154"}`,
                borderRadius: 12, padding: "14px 16px", marginBottom: 10,
              }}>
                {/* Top row: date + status */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div>
                    <div style={{ color: "#e8eaf0", fontWeight: 700, fontSize: 14 }}>{fmtDate(rec.date)}</div>
                    {rec.shiftAssignment?.shift?.name && (
                      <div style={{ color: "#8b90a7", fontSize: 12, marginTop: 2 }}>
                        {rec.shiftAssignment.shift.name} · {rec.shiftAssignment.shift.startTime}–{rec.shiftAssignment.shift.endTime}
                      </div>
                    )}
                  </div>
                  <span style={{ background: st.bg, color: st.color, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                    {st.label}
                  </span>
                </div>
                {/* Time row */}
                {rec.status === "absent" ? (
                  <div style={{ color: "#6b7280", fontSize: 12, fontStyle: "italic" }}>
                    Không có dữ liệu chấm công
                  </div>
                ) : (
                <div style={{ display: "flex", gap: 16 }}>
                  <div>
                    <div style={{ color: "#6b7280", fontSize: 11 }}>Vào</div>
                    <div style={{ color: "#e8eaf0", fontWeight: 600, fontSize: 14 }}>{fmtTime(rec.checkIn)}</div>
                    {lateMin > 0 && (
                      <div style={{ color: "#f59e0b", fontSize: 11, marginTop: 2 }}>
                        Trễ {lateMin}p ({(lateMin/60).toFixed(1)}h)
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{ color: "#6b7280", fontSize: 11 }}>Ra</div>
                    <div style={{ color: isWorking ? "#34d399" : "#e8eaf0", fontWeight: 600, fontSize: 14 }}>
                      {isWorking ? "Chưa ra" : fmtTime(rec.checkOut)}
                    </div>
                  </div>
                  {(rec.workHours > 0 || isWorking) && (
                    <div>
                      <div style={{ color: "#6b7280", fontSize: 11 }}>Giờ công</div>
                      <div style={{ color: "#22c55e", fontWeight: 700, fontSize: 14 }}>
                        {isWorking ? "–" : `${rec.workHours?.toFixed(1)}h`}
                        {rec.overtimeHours > 0 && <span style={{ color: "#f59e0b", fontSize: 12 }}> +{rec.overtimeHours.toFixed(1)}OT</span>}
                      </div>
                    </div>
                  )}
                </div>
                )}
                {rec.note && (
                  <div style={{ color: "#8b90a7", fontSize: 12, marginTop: 8, paddingTop: 8, borderTop: "1px solid #1e2138" }}>
                    📝 {rec.note}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ── DESKTOP: Table ── */
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #2d3154" }}>
                {["Ngày", "Ca làm", "Giờ vào", "Giờ ra", "Giờ công", "Tăng ca", "Trạng thái", "Ghi chú"].map(h => (
                  <th key={h} style={{ textAlign: "left", color: "#8b90a7", fontSize: 12, fontWeight: 600, padding: "10px 12px", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map(rec => {
                const isWorking = rec.checkIn && !rec.checkOut;
                const st = isWorking
                  ? { label: "🟢 Đang làm", color: "#34d399", bg: "rgba(34,197,94,.1)" }
                  : (STATUS_MAP[rec.status] || STATUS_MAP.absent);
                const lateMin = (rec.status === "late" && rec.shiftAssignment?.shift?.startTime)
                  ? calcLateMinutes(rec.checkIn, rec.shiftAssignment.shift.startTime) : 0;
                return (
                  <tr key={rec.id} style={{ borderBottom: "1px solid #1e2138", background: isWorking ? "rgba(34,197,94,.02)" : undefined }}>
                    <td style={td}>{fmtDate(rec.date)}</td>
                    <td style={td}>{rec.shiftAssignment?.shift?.name || <span style={{ color: "#6b7280" }}>–</span>}</td>
                    <td style={td}>
                      {rec.status === "absent" ? <span style={{ color: "#4b5563", fontSize: 12 }}>–</span> : (
                        <>
                          <div>{fmtTime(rec.checkIn)}</div>
                          {lateMin > 0 && (
                            <div style={{ color: "#f59e0b", fontSize: 11, marginTop: 2 }}>
                              Trễ {lateMin}p ({(lateMin/60).toFixed(1)}h)
                            </div>
                          )}
                        </>
                      )}
                    </td>
                    <td style={td}>
                      {rec.status === "absent"
                        ? <span style={{ color: "#4b5563", fontSize: 12 }}>–</span>
                        : isWorking ? <span style={{ color: "#34d399", fontSize: 12 }}>Chưa ra</span> : fmtTime(rec.checkOut)}
                    </td>
                    <td style={td}>{rec.workHours ? <strong style={{ color: "#22c55e" }}>{rec.workHours.toFixed(1)}h</strong> : <span style={{ color: "#4b5563" }}>0h</span>}</td>
                    <td style={td}>{rec.overtimeHours > 0 ? <span style={{ color: "#f59e0b" }}>+{rec.overtimeHours.toFixed(1)}h</span> : "–"}</td>
                    <td style={td}>
                      <span style={{ background: st.bg, color: st.color, padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                        {st.label}
                      </span>
                    </td>
                    <td style={td}><span style={{ color: "#8b90a7", fontSize: 12 }}>{rec.note || "–"}</span></td>
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

const td = { padding: "12px", color: "#c8cad8", fontSize: 13, verticalAlign: "middle" };

export default EmployeeAttendance;
