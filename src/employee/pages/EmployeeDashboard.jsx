import React, { useState, useEffect, useCallback } from "react";
import { useOutletContext, Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

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
      // Lọc ca hôm nay nếu giờ kết thúc đã qua → chỉ hiện ca còn relevance
      const now = new Date();
      const filtered = (shifts || []).filter((sa) => {
        const saDate = sa.date?.split("T")[0];
        if (saDate !== todayISO()) return true; // ngày tương lai: luôn giữ
        if (!sa.shift?.endTime) return true;
        const [eh, em] = sa.shift.endTime.split(":").map(Number);
        const shiftEnd = new Date();
        shiftEnd.setHours(eh, em, 0, 0);
        return now < shiftEnd; // giữ nếu ca chưa kết thúc
      });
      setUpcomingShifts(filtered.slice(0, 5));
      setPendingLeaves((leaves || []).filter(l => l.status === "pending").slice(0, 3));
      setLatestSalary(Array.isArray(salary) ? salary[0] : null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Real-time: reload dashboard khi có sự kiện liên quan
  useEffect(() => {
    const RELOAD_EVENTS = ['leave:approved','leave:rejected','leave:manager_approved','ot:approved','ot:rejected','attendance:alert'];
    const handler = (e) => { if (RELOAD_EVENTS.includes(e.detail.event)) load(); };
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
    <div className="emp-page">
      <div className="emp-skeleton emp-skeleton-hero" />
      <div className="emp-stats-grid">
        {[0, 1, 2].map(i => (
          <div key={i} className="emp-skeleton-card">
            <div className="emp-skeleton emp-skeleton-line" style={{ width: "50%" }} />
            <div className="emp-skeleton emp-skeleton-line" style={{ width: "80%" }} />
            <div className="emp-skeleton emp-skeleton-line" style={{ width: "65%" }} />
          </div>
        ))}
      </div>
    </div>
  );

  const todayLabel = new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
  const hasCheckedIn  = !!todayAtt?.checkIn;
  const hasCheckedOut = !!todayAtt?.checkOut;

  return (
    <div className="emp-page">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="emp-page-header">
        <div>
          <div className="emp-page-eyebrow">{todayLabel}</div>
          <h1 className="emp-page-title">
            Xin chào, {user?.fullName?.split(" ").pop() || user?.username} 👋
          </h1>
          {empProfile && (
            <p className="emp-page-sub">
              [{empProfile.employeeCode}] · {empProfile.position}
            </p>
          )}
        </div>
        <div className="emp-page-actions">
          <button onClick={load} className="emp-icon-btn">🔄</button>
          {/* Account button */}
          <button
            onClick={() => navigate("/employee/profile")}
            className="emp-avatar-btn"
            title="Tài khoản"
          >
            {user?.avatar
              ? <img src={user.avatar} alt="" />
              : <span>👤</span>}
          </button>
        </div>
      </div>

      {/* ── Check-in Card ──────────────────────────────────── */}
      <div className={`emp-hero ${hasCheckedOut ? "is-done" : ""}`}>
        {/* Status text */}
        <div className="emp-hero-label">Trạng thái hôm nay</div>
        {!hasCheckedIn && <div className="emp-hero-status">Chưa check-in</div>}
        {hasCheckedIn && !hasCheckedOut && (
          <div>
            <div className="emp-hero-status">Đang làm việc ✅</div>
            <div className="emp-hero-sub">Vào lúc {fmtTime(todayAtt.checkIn)}</div>
          </div>
        )}
        {hasCheckedOut && (
          <div>
            <div className="emp-hero-status">Hoàn thành ca 🎉</div>
            <div className="emp-hero-sub">
              {fmtTime(todayAtt.checkIn)} – {fmtTime(todayAtt.checkOut)} · {todayAtt.workHours?.toFixed(1)}h
            </div>
          </div>
        )}

        {/* Buttons */}
        {!hasCheckedOut && (
          <div className="emp-hero-actions">
            {!hasCheckedIn && (
              <button onClick={handleCheckIn} disabled={checkingIn} className="emp-hero-btn">
                {checkingIn ? "Đang xử lý..." : "▶ Check-in"}
              </button>
            )}
            {hasCheckedIn && !hasCheckedOut && (
              <button onClick={handleCheckOut} disabled={checkingIn} className="emp-hero-btn emp-hero-btn--out">
                {checkingIn ? "Đang xử lý..." : "⏹ Check-out"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Info Cards ─────────────────────────────────────── */}
      <div className="emp-stats-grid">

        {/* Ca sắp tới */}
        <div className="emp-card emp-stat-span-2">
          <div className="emp-card-head">
            <div className="emp-card-title">📅 Ca sắp tới</div>
            <Link to="/employee/shifts" className="emp-link">Xem tất cả →</Link>
          </div>
          {upcomingShifts.length === 0
            ? <div className="emp-muted-text">Chưa có ca được lên lịch.</div>
            : upcomingShifts.map(s => (
              <div key={s.id} className="emp-list-row">
                <div className="emp-list-row-title">{s.shift?.name}</div>
                <div className="emp-list-row-sub">
                  {new Date(s.date).toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" })}
                  {" · "}{s.shift?.startTime}–{s.shift?.endTime}
                </div>
              </div>
            ))
          }
        </div>

        {/* Đơn nghỉ */}
        <div className="emp-card">
          <div className="emp-card-head">
            <div className="emp-card-title">🏖️ Đơn nghỉ</div>
            <Link to="/employee/leave" className="emp-link">Xem →</Link>
          </div>
          {pendingLeaves.length === 0
            ? <div className="emp-muted-text">Không có đơn chờ duyệt.</div>
            : pendingLeaves.map(l => (
              <div key={l.id} className="emp-list-row">
                <div style={{ color: "var(--emp-warn)", fontWeight: 600, fontSize: 11 }}>⏳ Chờ duyệt</div>
                <div style={{ color: "var(--emp-text)", fontSize: 13, marginTop: 2 }}>
                  {l.totalDays} ngày · {l.leaveType === "annual" ? "Nghỉ phép" : l.leaveType === "sick" ? "Nghỉ bệnh" : "Khác"}
                </div>
              </div>
            ))
          }
          <Link to="/employee/leave?action=new" className="emp-link" style={{ display: "block", marginTop: 6 }}>
            + Gửi đơn mới
          </Link>
        </div>

        {/* Lương */}
        <div className="emp-card">
          <div className="emp-card-head">
            <div className="emp-card-title">💰 Lương</div>
            <Link to="/employee/salary" className="emp-link">Xem →</Link>
          </div>
          {!latestSalary
            ? <div className="emp-muted-text">Chưa có dữ liệu lương.</div>
            : <>
              <div style={{ color: "var(--emp-muted)", fontSize: 11 }}>Tháng {latestSalary.month}/{latestSalary.year}</div>
              <div style={{ color: "var(--emp-success)", fontWeight: 800, fontSize: 20, marginTop: 4 }}>{fmt(latestSalary.netSalary)}</div>
              <div style={{ color: "var(--emp-muted)", fontSize: 11, marginTop: 4 }}>
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
