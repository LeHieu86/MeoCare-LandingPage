import React, { useState, useEffect, useCallback } from "react";
import { useOutletContext, Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useIsMobile } from "../hooks/useIsMobile";

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const fmt    = (n) => (n || 0).toLocaleString("vi-VN") + "đ";
const fmtTime = (dt) => dt ? new Date(dt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : null;
const padZ   = (n) => String(n).padStart(2, "0");
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${padZ(d.getMonth() + 1)}-${padZ(d.getDate())}`;
};
const getToken = () => localStorage.getItem("token");

const EmployeeDashboard = () => {
  const { user }   = useOutletContext() || {};
  const isMobile   = useIsMobile();
  const navigate   = useNavigate();

  const [empProfile,     setEmpProfile]     = useState(null);
  const [todayAtt,       setTodayAtt]       = useState(null);
  const [upcomingShifts, setUpcomingShifts] = useState([]);
  const [pendingLeaves,  setPendingLeaves]  = useState([]);
  const [latestSalary,   setLatestSalary]   = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [checkingIn,     setCheckingIn]     = useState(false);

  const load = useCallback(() => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/employees/me/profile`,               { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
      fetch(`${API_BASE}/attendance/today`,                    { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
      fetch(`${API_BASE}/shift-assignments/my?from=${todayISO()}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/leave/my`,                            { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/salary/my`,                           { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : []),
    ]).then(([emp, att, shifts, leaves, salary]) => {
      setEmpProfile(emp);
      setTodayAtt(att);
      setUpcomingShifts((shifts || []).slice(0, 5));
      setPendingLeaves((leaves || []).filter(l => l.status === "pending").slice(0, 3));
      setLatestSalary(Array.isArray(salary) ? salary[0] : null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      const r = await fetch(`${API_BASE}/attendance/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({}),
      });
      const d = await r.json();
      if (r.ok) { setTodayAtt(d); toast.success("✅ Check-in thành công!"); }
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
      if (r.ok) { setTodayAtt(d); toast.success("👋 Check-out thành công!"); }
      else       toast.error(d.error || "Lỗi check-out");
    } catch { toast.error("Mất kết nối."); }
    setCheckingIn(false);
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "80vh", color: "#8b90a7" }}>
      Đang tải...
    </div>
  );

  const todayLabel = new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
  const hasCheckedIn  = !!todayAtt?.checkIn;
  const hasCheckedOut = !!todayAtt?.checkOut;

  /* ── Màu nền check-in card theo trạng thái ── */
  const ciGradient = hasCheckedOut
    ? "linear-gradient(135deg,#064e3b,#065f46)"
    : "linear-gradient(135deg,#5b7cf6,#4c6ef5)";

  return (
    <div className="emp-page">

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: isMobile ? 16 : 24 }}>
        <div>
          <div style={{ color: "#8b90a7", fontSize: 12, marginBottom: 2 }}>{todayLabel}</div>
          <h1 style={{ color: "#e8eaf0", fontSize: isMobile ? 20 : 24, fontWeight: 800, margin: 0 }}>
            Xin chào, {user?.fullName?.split(" ").pop() || user?.username} 👋
          </h1>
          {empProfile && (
            <p style={{ color: "#8b90a7", fontSize: 12, margin: "3px 0 0" }}>
              [{empProfile.employeeCode}] · {empProfile.position}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={load}
            style={{ background: "transparent", color: "#8b90a7", border: "1px solid #2d3154", borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontSize: 13 }}
          >🔄</button>
          {/* Account button */}
          <button
            onClick={() => navigate("/employee/profile")}
            style={{ width: 36, height: 36, borderRadius: "50%", background: "#2d3154", border: "2px solid #3d4270", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", padding: 0, flexShrink: 0 }}
            title="Tài khoản"
          >
            {user?.avatar
              ? <img src={user.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontSize: 16 }}>👤</span>}
          </button>
        </div>
      </div>

      {/* ── Check-in Card ──────────────────────────────────── */}
      <div style={{
        background: ciGradient,
        borderRadius: isMobile ? 18 : 20,
        padding: isMobile ? "22px 20px" : 28,
        marginBottom: isMobile ? 16 : 24,
      }}>
        {/* Status text */}
        <div style={{ color: "rgba(255,255,255,.7)", fontSize: 12, marginBottom: 6 }}>Trạng thái hôm nay</div>
        {!hasCheckedIn && <div style={{ color: "#fff", fontWeight: 700, fontSize: isMobile ? 17 : 18 }}>Chưa check-in</div>}
        {hasCheckedIn && !hasCheckedOut && (
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: isMobile ? 17 : 18 }}>Đang làm việc ✅</div>
            <div style={{ color: "rgba(255,255,255,.8)", fontSize: 13, marginTop: 2 }}>Vào lúc {fmtTime(todayAtt.checkIn)}</div>
          </div>
        )}
        {hasCheckedOut && (
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: isMobile ? 17 : 18 }}>Hoàn thành ca 🎉</div>
            <div style={{ color: "rgba(255,255,255,.8)", fontSize: 13, marginTop: 2 }}>
              {fmtTime(todayAtt.checkIn)} – {fmtTime(todayAtt.checkOut)} · {todayAtt.workHours?.toFixed(1)}h
            </div>
          </div>
        )}

        {/* Buttons */}
        {!hasCheckedOut && (
          <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
            {!hasCheckedIn && (
              <button onClick={handleCheckIn} disabled={checkingIn}
                style={{
                  flex: isMobile ? 1 : undefined,
                  background: "#fff", color: "#5b7cf6", border: "none",
                  borderRadius: 12, padding: isMobile ? "14px 0" : "14px 28px",
                  fontWeight: 800, fontSize: isMobile ? 16 : 15, cursor: "pointer",
                  minHeight: 50,
                }}>
                {checkingIn ? "Đang xử lý..." : "▶ Check-in"}
              </button>
            )}
            {hasCheckedIn && !hasCheckedOut && (
              <button onClick={handleCheckOut} disabled={checkingIn}
                style={{
                  flex: isMobile ? 1 : undefined,
                  background: "rgba(255,255,255,.15)", color: "#fff",
                  border: "2px solid rgba(255,255,255,.4)", borderRadius: 12,
                  padding: isMobile ? "14px 0" : "14px 28px",
                  fontWeight: 700, fontSize: isMobile ? 16 : 15, cursor: "pointer",
                  minHeight: 50,
                }}>
                {checkingIn ? "Đang xử lý..." : "⏹ Check-out"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Info Cards ─────────────────────────────────────── */}
      <div className="emp-stats-grid">

        {/* Ca sắp tới */}
        <div className="emp-card" style={{ gridColumn: isMobile ? "span 2" : "span 1" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ color: "#e8eaf0", fontWeight: 700, fontSize: 14 }}>📅 Ca sắp tới</div>
            <Link to="/employee/shifts" style={{ color: "#5b7cf6", fontSize: 12, textDecoration: "none" }}>Xem tất cả →</Link>
          </div>
          {upcomingShifts.length === 0
            ? <div style={{ color: "#8b90a7", fontSize: 13 }}>Chưa có ca được lên lịch.</div>
            : upcomingShifts.map(s => (
              <div key={s.id} style={{ borderBottom: "1px solid #1e2138", paddingBottom: 8, marginBottom: 8 }}>
                <div style={{ color: "#e8eaf0", fontWeight: 600, fontSize: 13 }}>{s.shift?.name}</div>
                <div style={{ color: "#5b7cf6", fontSize: 12 }}>
                  {new Date(s.date).toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" })}
                  {" · "}{s.shift?.startTime}–{s.shift?.endTime}
                </div>
              </div>
            ))
          }
        </div>

        {/* Đơn nghỉ */}
        <div className="emp-card">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ color: "#e8eaf0", fontWeight: 700, fontSize: 14 }}>🏖️ Đơn nghỉ</div>
            <Link to="/employee/leave" style={{ color: "#5b7cf6", fontSize: 12, textDecoration: "none" }}>Xem →</Link>
          </div>
          {pendingLeaves.length === 0
            ? <div style={{ color: "#8b90a7", fontSize: 13 }}>Không có đơn chờ duyệt.</div>
            : pendingLeaves.map(l => (
              <div key={l.id} style={{ borderBottom: "1px solid #1e2138", paddingBottom: 8, marginBottom: 8 }}>
                <div style={{ color: "#f59e0b", fontWeight: 600, fontSize: 11 }}>⏳ Chờ duyệt</div>
                <div style={{ color: "#e8eaf0", fontSize: 13, marginTop: 2 }}>
                  {l.totalDays} ngày · {l.leaveType === "annual" ? "Nghỉ phép" : l.leaveType === "sick" ? "Nghỉ bệnh" : "Khác"}
                </div>
              </div>
            ))
          }
          <Link to="/employee/leave?action=new" style={{ display: "block", marginTop: 6, color: "#5b7cf6", fontSize: 12, textDecoration: "none", fontWeight: 600 }}>
            + Gửi đơn mới
          </Link>
        </div>

        {/* Lương */}
        <div className="emp-card">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ color: "#e8eaf0", fontWeight: 700, fontSize: 14 }}>💰 Lương</div>
            <Link to="/employee/salary" style={{ color: "#5b7cf6", fontSize: 12, textDecoration: "none" }}>Xem →</Link>
          </div>
          {!latestSalary
            ? <div style={{ color: "#8b90a7", fontSize: 13 }}>Chưa có dữ liệu lương.</div>
            : <>
              <div style={{ color: "#8b90a7", fontSize: 11 }}>Tháng {latestSalary.month}/{latestSalary.year}</div>
              <div style={{ color: "#22c55e", fontWeight: 800, fontSize: 20, marginTop: 4 }}>{fmt(latestSalary.netSalary)}</div>
              <div style={{ color: "#8b90a7", fontSize: 11, marginTop: 4 }}>
                {latestSalary.salaryType === "hourly"
                  ? `${(latestSalary.totalWorkHours || 0).toFixed(1)}h thực làm`
                  : `${latestSalary.workedDays}/${latestSalary.standardDays} ngày công`}
              </div>
            </>
          }
        </div>

      </div>
    </div>
  );
};

export default EmployeeDashboard;
