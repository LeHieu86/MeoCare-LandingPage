import React, { useState, useEffect } from "react";
import { useOutletContext, Link } from "react-router-dom";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const fmt = (n) => (n||0).toLocaleString("vi-VN") + "đ";
const fmtTime = (dt) => dt ? new Date(dt).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"}) : null;

const getToken = () => localStorage.getItem("mc_employee_token") || localStorage.getItem("mc_admin_token");

const EmployeeDashboard = () => {
  const { user } = useOutletContext() || {};
  const [empProfile, setEmpProfile] = useState(null);
  const [todayAtt,   setTodayAtt]   = useState(null);   // chấm công hôm nay
  const [upcomingShifts, setUpcomingShifts] = useState([]);
  const [pendingLeaves,  setPendingLeaves]  = useState([]);
  const [latestSalary,   setLatestSalary]   = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    Promise.all([
      fetch(`${API_BASE}/employees/me/profile`, { headers:{ Authorization:`Bearer ${token}` } }).then(r=>r.ok?r.json():null),
      fetch(`${API_BASE}/attendance/today`,      { headers:{ Authorization:`Bearer ${token}` } }).then(r=>r.ok?r.json():null),
      fetch(`${API_BASE}/shift-assignments/my?from=${new Date().toISOString().split("T")[0]}`, { headers:{ Authorization:`Bearer ${token}` } }).then(r=>r.ok?r.json():[]),
      fetch(`${API_BASE}/leave/my`,              { headers:{ Authorization:`Bearer ${token}` } }).then(r=>r.ok?r.json():[]),
      fetch(`${API_BASE}/salary/my`,             { headers:{ Authorization:`Bearer ${token}` } }).then(r=>r.ok?r.json():[]),
    ]).then(([emp, att, shifts, leaves, salary]) => {
      setEmpProfile(emp);
      setTodayAtt(att);
      setUpcomingShifts((shifts||[]).slice(0, 5));
      setPendingLeaves((leaves||[]).filter(l => l.status==="pending").slice(0,3));
      setLatestSalary(Array.isArray(salary) ? salary[0] : null);
      setLoading(false);
    });
  }, []);

  const handleCheckIn = async () => {
    const token = getToken();
    setCheckingIn(true);
    try {
      const r = await fetch(`${API_BASE}/attendance/check-in`, {
        method:"POST",
        headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const d = await r.json();
      if (r.ok) { setTodayAtt(d); toast.success("✅ Check-in thành công!"); }
      else       toast.error(d.error || "Lỗi check-in");
    } catch { toast.error("Mất kết nối."); }
    setCheckingIn(false);
  };

  const handleCheckOut = async () => {
    const token = getToken();
    setCheckingIn(true);
    try {
      const r = await fetch(`${API_BASE}/attendance/check-out`, {
        method:"POST",
        headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const d = await r.json();
      if (r.ok) { setTodayAtt(d); toast.success("👋 Check-out thành công!"); }
      else       toast.error(d.error || "Lỗi check-out");
    } catch { toast.error("Mất kết nối."); }
    setCheckingIn(false);
  };

  if (loading) return <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",color:"#8b90a7" }}>Đang tải...</div>;

  const today = new Date();
  const todayLabel = today.toLocaleDateString("vi-VN",{ weekday:"long",day:"2-digit",month:"2-digit",year:"numeric" });

  const hasCheckedIn  = !!todayAtt?.checkIn;
  const hasCheckedOut = !!todayAtt?.checkOut;

  return (
    <div style={{ padding:28 }}>
      {/* ── Header ── */}
      <div style={{ marginBottom:28 }}>
        <div style={{ color:"#8b90a7",fontSize:13,marginBottom:4 }}>{todayLabel}</div>
        <h1 style={{ color:"#e8eaf0",fontSize:24,fontWeight:800,margin:0 }}>
          Xin chào, {user?.fullName?.split(" ").pop() || user?.username} 👋
        </h1>
        {empProfile && (
          <p style={{ color:"#8b90a7",fontSize:14,margin:"4px 0 0" }}>
            [{empProfile.employeeCode}] · {empProfile.position} · {empProfile.department}
          </p>
        )}
      </div>

      {/* ── Check-in Card ── */}
      <div style={{ background:"linear-gradient(135deg,#5b7cf6,#4c6ef5)",borderRadius:20,padding:28,marginBottom:24,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
        <div>
          <div style={{ color:"rgba(255,255,255,.7)",fontSize:13,marginBottom:6 }}>Trạng thái hôm nay</div>
          {!hasCheckedIn && <div style={{ color:"#fff",fontWeight:700,fontSize:18 }}>Chưa check-in</div>}
          {hasCheckedIn && !hasCheckedOut && (
            <div>
              <div style={{ color:"#fff",fontWeight:700,fontSize:18 }}>Đang làm việc ✅</div>
              <div style={{ color:"rgba(255,255,255,.8)",fontSize:13,marginTop:2 }}>Vào lúc {fmtTime(todayAtt.checkIn)}</div>
            </div>
          )}
          {hasCheckedOut && (
            <div>
              <div style={{ color:"#fff",fontWeight:700,fontSize:18 }}>Đã hoàn thành ca 🎉</div>
              <div style={{ color:"rgba(255,255,255,.8)",fontSize:13,marginTop:2 }}>
                {fmtTime(todayAtt.checkIn)} – {fmtTime(todayAtt.checkOut)} · {todayAtt.workHours?.toFixed(1)}h
              </div>
            </div>
          )}
        </div>
        <div style={{ display:"flex",gap:12 }}>
          {!hasCheckedIn && (
            <button onClick={handleCheckIn} disabled={checkingIn} style={{ background:"#fff",color:"#5b7cf6",border:"none",borderRadius:12,padding:"14px 28px",fontWeight:800,fontSize:15,cursor:"pointer" }}>
              {checkingIn ? "..." : "▶ Check-in"}
            </button>
          )}
          {hasCheckedIn && !hasCheckedOut && (
            <button onClick={handleCheckOut} disabled={checkingIn} style={{ background:"rgba(255,255,255,.15)",color:"#fff",border:"2px solid rgba(255,255,255,.4)",borderRadius:12,padding:"14px 28px",fontWeight:700,fontSize:15,cursor:"pointer" }}>
              {checkingIn ? "..." : "⏹ Check-out"}
            </button>
          )}
        </div>
      </div>

      {/* ── Info Cards ── */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:24 }}>
        {/* Ca làm sắp tới */}
        <div style={{ background:"#1a1d2e",border:"1px solid #2d3154",borderRadius:14,padding:20 }}>
          <div style={{ display:"flex",justifyContent:"space-between",marginBottom:14 }}>
            <div style={{ color:"#e8eaf0",fontWeight:700 }}>📅 Ca sắp tới</div>
            <Link to="/employee/shifts" style={{ color:"#5b7cf6",fontSize:12,textDecoration:"none" }}>Xem tất cả →</Link>
          </div>
          {upcomingShifts.length === 0
            ? <div style={{ color:"#8b90a7",fontSize:13 }}>Chưa có ca làm được lên lịch.</div>
            : upcomingShifts.map(s => (
              <div key={s.id} style={{ borderBottom:"1px solid #1e2138",paddingBottom:10,marginBottom:10 }}>
                <div style={{ color:"#e8eaf0",fontWeight:600,fontSize:13 }}>{s.shift?.name}</div>
                <div style={{ color:"#5b7cf6",fontSize:12 }}>
                  {new Date(s.date).toLocaleDateString("vi-VN",{weekday:"short",day:"2-digit",month:"2-digit"})}
                  {" · "}{s.shift?.startTime}–{s.shift?.endTime}
                </div>
              </div>
            ))
          }
        </div>

        {/* Đơn nghỉ chờ duyệt */}
        <div style={{ background:"#1a1d2e",border:"1px solid #2d3154",borderRadius:14,padding:20 }}>
          <div style={{ display:"flex",justifyContent:"space-between",marginBottom:14 }}>
            <div style={{ color:"#e8eaf0",fontWeight:700 }}>🏖️ Đơn nghỉ</div>
            <Link to="/employee/leave" style={{ color:"#5b7cf6",fontSize:12,textDecoration:"none" }}>Xem tất cả →</Link>
          </div>
          {pendingLeaves.length === 0
            ? <div style={{ color:"#8b90a7",fontSize:13 }}>Không có đơn đang chờ duyệt.</div>
            : pendingLeaves.map(l => (
              <div key={l.id} style={{ borderBottom:"1px solid #1e2138",paddingBottom:10,marginBottom:10 }}>
                <div style={{ color:"#f59e0b",fontWeight:600,fontSize:12 }}>⏳ Chờ duyệt</div>
                <div style={{ color:"#e8eaf0",fontSize:13,marginTop:2 }}>{l.totalDays} ngày · {l.leaveType === "annual" ? "Nghỉ phép" : l.leaveType === "sick" ? "Nghỉ bệnh" : "Nghỉ khác"}</div>
              </div>
            ))
          }
          <Link to="/employee/leave?action=new" style={{ display:"block",marginTop:8,color:"#5b7cf6",fontSize:12,textDecoration:"none",fontWeight:600 }}>
            + Gửi đơn nghỉ mới
          </Link>
        </div>

        {/* Lương tháng gần nhất */}
        <div style={{ background:"#1a1d2e",border:"1px solid #2d3154",borderRadius:14,padding:20 }}>
          <div style={{ display:"flex",justifyContent:"space-between",marginBottom:14 }}>
            <div style={{ color:"#e8eaf0",fontWeight:700 }}>💰 Lương gần nhất</div>
            <Link to="/employee/salary" style={{ color:"#5b7cf6",fontSize:12,textDecoration:"none" }}>Xem tất cả →</Link>
          </div>
          {!latestSalary
            ? <div style={{ color:"#8b90a7",fontSize:13 }}>Chưa có dữ liệu lương.</div>
            : <>
              <div style={{ color:"#8b90a7",fontSize:12,marginBottom:4 }}>Tháng {latestSalary.month}/{latestSalary.year}</div>
              <div style={{ color:"#22c55e",fontWeight:800,fontSize:22 }}>{fmt(latestSalary.netSalary)}</div>
              <div style={{ color:"#8b90a7",fontSize:12,marginTop:6 }}>
                {latestSalary.workedDays}/{latestSalary.standardDays} ngày công
                {latestSalary.overtimeHours > 0 && ` · OT ${latestSalary.overtimeHours}h`}
              </div>
              <div style={{ marginTop:6 }}>
                <span style={{ fontSize:12,padding:"2px 10px",borderRadius:20,fontWeight:600,
                  background: latestSalary.status==="paid" ? "#052e16" : "#1e2138",
                  color:      latestSalary.status==="paid" ? "#22c55e" : "#8b90a7" }}>
                  {latestSalary.status==="paid" ? "✓ Đã nhận" : latestSalary.status==="confirmed" ? "Đã xác nhận" : "Nháp"}
                </span>
              </div>
            </>
          }
        </div>
      </div>
    </div>
  );
};

export default EmployeeDashboard;
