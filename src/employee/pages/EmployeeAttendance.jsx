import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const getToken = () => localStorage.getItem("mc_employee_token") || localStorage.getItem("mc_admin_token");

const todayISO = () => new Date().toISOString().split("T")[0];
const fmtDate  = (dt) => dt ? new Date(dt).toLocaleDateString("vi-VN") : "–";
const fmtTime  = (dt) => dt ? new Date(dt).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"}) : "–";

const STATUS_MAP = {
  present:     { label:"Có mặt",    color:"#22c55e", bg:"#052e16" },
  absent:      { label:"Vắng mặt",  color:"#ef4444", bg:"#2d0f0f" },
  late:        { label:"Đi trễ",    color:"#f59e0b", bg:"#2d1d00" },
  early_leave: { label:"Về sớm",    color:"#f97316", bg:"#2d1500" },
  on_leave:    { label:"Nghỉ phép", color:"#8b5cf6", bg:"#1e0a3c" },
};

const inputStyle  = { background:"#0f1117",border:"1px solid #2d3154",borderRadius:8,padding:"8px 12px",color:"#e8eaf0",fontSize:14 };
const btnSecondary= { padding:"8px 16px",background:"transparent",color:"#8b90a7",border:"1px solid #2d3154",borderRadius:8,cursor:"pointer",fontSize:13 };
const btnPrimary  = { padding:"8px 16px",background:"#5b7cf6",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:600 };

const EmployeeAttendance = () => {
  const [records,    setRecords]    = useState([]);
  const [todayAtt,   setTodayAtt]   = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [from,       setFrom]       = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0];
  });
  const [to, setTo] = useState(todayISO());

  const load = useCallback(() => {
    const token = getToken();
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/attendance/today`,   { headers:{ Authorization:`Bearer ${token}` } }).then(r=>r.ok?r.json():null),
      fetch(`${API_BASE}/attendance/my?from=${from}&to=${to}`, { headers:{ Authorization:`Bearer ${token}` } }).then(r=>r.json()),
    ]).then(([att, list]) => {
      setTodayAtt(att);
      setRecords(Array.isArray(list) ? list : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      const r = await fetch(`${API_BASE}/attendance/check-in`, {
        method:"POST",
        headers:{ "Content-Type":"application/json", Authorization:`Bearer ${getToken()}` },
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
        method:"POST",
        headers:{ "Content-Type":"application/json", Authorization:`Bearer ${getToken()}` },
        body: JSON.stringify({}),
      });
      const d = await r.json();
      if (r.ok) { toast.success("👋 Check-out thành công!"); load(); }
      else       toast.error(d.error || "Lỗi check-out");
    } catch { toast.error("Mất kết nối."); }
    setCheckingIn(false);
  };

  // Stats
  const stats = records.reduce((a, r) => {
    a[r.status] = (a[r.status]||0)+1;
    a.totalHours = (a.totalHours||0) + (r.workHours||0);
    a.totalOT    = (a.totalOT||0)    + (r.overtimeHours||0);
    return a;
  }, {});

  const hasCheckedIn  = !!todayAtt?.checkIn;
  const hasCheckedOut = !!todayAtt?.checkOut;

  return (
    <div style={{ padding:28 }}>
      <h1 style={{ color:"#e8eaf0",fontSize:22,fontWeight:700,margin:"0 0 20px" }}>⏰ Chấm Công</h1>

      {/* ── Check-in Banner ── */}
      <div style={{ background:"#1a1d2e",border:"1px solid #2d3154",borderRadius:16,padding:20,marginBottom:24,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
        <div>
          <div style={{ color:"#8b90a7",fontSize:13 }}>{new Date().toLocaleDateString("vi-VN",{weekday:"long",day:"2-digit",month:"2-digit"})}</div>
          {!hasCheckedIn && <div style={{ color:"#e8eaf0",fontWeight:700,fontSize:16,marginTop:4 }}>Chưa check-in hôm nay</div>}
          {hasCheckedIn && !hasCheckedOut && (
            <div style={{ color:"#22c55e",fontWeight:700,fontSize:16,marginTop:4 }}>
              ✅ Đang làm việc · Vào {fmtTime(todayAtt.checkIn)}
            </div>
          )}
          {hasCheckedOut && (
            <div style={{ color:"#8b90a7",fontSize:15,marginTop:4 }}>
              🎉 Hoàn thành · {fmtTime(todayAtt.checkIn)} – {fmtTime(todayAtt.checkOut)} · <strong style={{ color:"#22c55e" }}>{todayAtt.workHours?.toFixed(1)}h</strong>
            </div>
          )}
        </div>
        <div style={{ display:"flex",gap:10 }}>
          {!hasCheckedIn && (
            <button onClick={handleCheckIn} disabled={checkingIn} style={{ ...btnPrimary,padding:"12px 28px",fontSize:15 }}>
              {checkingIn ? "..." : "▶ Check-in"}
            </button>
          )}
          {hasCheckedIn && !hasCheckedOut && (
            <button onClick={handleCheckOut} disabled={checkingIn} style={{ ...btnSecondary,padding:"12px 28px",fontSize:15,color:"#ef4444",borderColor:"#ef4444" }}>
              {checkingIn ? "..." : "⏹ Check-out"}
            </button>
          )}
        </div>
      </div>

      {/* ── Summary ── */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:24 }}>
        {[
          { key:"totalHours", icon:"⏱️", label:"Tổng giờ công",   val:`${(stats.totalHours||0).toFixed(1)}h` },
          { key:"totalOT",    icon:"🔥", label:"Tăng ca",         val:`${(stats.totalOT||0).toFixed(1)}h` },
          { key:"present",    icon:"✅", label:"Ngày có mặt",     val:stats.present||0 },
          { key:"absent",     icon:"❌", label:"Ngày vắng mặt",   val:stats.absent||0 },
        ].map(({ key, icon, label, val }) => (
          <div key={key} style={{ background:"#1a1d2e",border:"1px solid #2d3154",borderRadius:12,padding:"16px 18px" }}>
            <div style={{ fontSize:20 }}>{icon}</div>
            <div style={{ color:"#e8eaf0",fontWeight:800,fontSize:20,marginTop:6 }}>{val}</div>
            <div style={{ color:"#8b90a7",fontSize:12,marginTop:2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div style={{ display:"flex",gap:12,marginBottom:16,alignItems:"center" }}>
        <div>
          <span style={{ color:"#8b90a7",fontSize:12,marginRight:6 }}>Từ</span>
          <input type="date" style={{ ...inputStyle,width:150 }} value={from} onChange={e=>setFrom(e.target.value)} />
        </div>
        <div>
          <span style={{ color:"#8b90a7",fontSize:12,marginRight:6 }}>Đến</span>
          <input type="date" style={{ ...inputStyle,width:150 }} value={to} onChange={e=>setTo(e.target.value)} />
        </div>
        <button onClick={load} style={btnSecondary}>Lọc</button>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div style={{ textAlign:"center",color:"#8b90a7",padding:60 }}>Đang tải...</div>
      ) : records.length === 0 ? (
        <div style={{ textAlign:"center",color:"#8b90a7",padding:60 }}>Không có dữ liệu trong khoảng thời gian này.</div>
      ) : (
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%",borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ borderBottom:"1px solid #2d3154" }}>
                {["Ngày","Ca làm","Giờ vào","Giờ ra","Giờ công","Tăng ca","Trạng thái","Ghi chú"].map(h => (
                  <th key={h} style={{ textAlign:"left",color:"#8b90a7",fontSize:12,fontWeight:600,padding:"10px 12px",whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map(rec => {
                const st = STATUS_MAP[rec.status] || STATUS_MAP.absent;
                return (
                  <tr key={rec.id} style={{ borderBottom:"1px solid #1e2138" }}>
                    <td style={td}>{fmtDate(rec.date)}</td>
                    <td style={td}>{rec.shiftAssignment?.shift?.name || <span style={{ color:"#6b7280" }}>–</span>}</td>
                    <td style={td}>{fmtTime(rec.checkIn)}</td>
                    <td style={td}>{fmtTime(rec.checkOut)}</td>
                    <td style={td}>{rec.workHours ? <strong style={{ color:"#22c55e" }}>{rec.workHours.toFixed(1)}h</strong> : "–"}</td>
                    <td style={td}>{rec.overtimeHours > 0 ? <span style={{ color:"#f59e0b" }}>+{rec.overtimeHours.toFixed(1)}h</span> : "–"}</td>
                    <td style={td}>
                      <span style={{ background:st.bg,color:st.color,padding:"3px 10px",borderRadius:20,fontSize:12,fontWeight:600 }}>
                        {st.label}
                      </span>
                    </td>
                    <td style={td}><span style={{ color:"#8b90a7",fontSize:12 }}>{rec.note||"–"}</span></td>
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

const td = { padding:"12px",color:"#c8cad8",fontSize:13,verticalAlign:"middle" };

export default EmployeeAttendance;
