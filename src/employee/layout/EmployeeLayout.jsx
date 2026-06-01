import React, { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import EmployeeSessionModal from "../components/EmployeeSessionModal";
import "../../styles/employee/employee.css";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

const NAV = [
  { path: "/employee",            label: "Tổng quan",  icon: "🏠", exact: true  },
  { path: "/employee/shifts",     label: "Ca làm",     icon: "📅", exact: false },
  { path: "/employee/attendance", label: "Chấm công",  icon: "⏰", exact: false },
  { path: "/employee/leave",      label: "Nghỉ phép",  icon: "🏖️", exact: false },
  { path: "/employee/salary",     label: "Lương",      icon: "💰", exact: false },
];

const EmployeeLayout = () => {
  const navigate     = useNavigate();
  const { pathname } = useLocation();
  const [user,           setUser]           = useState(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  // ── Xác thực ban đầu ─────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { navigate("/login"); return; }
    fetch(`${API_BASE}/auth/verify`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => {
        if (!d.valid) { navigate("/login"); return; }
        if (!["employee", "manager", "stock-manager", "admin"].includes(d.user.role)) {
          navigate("/"); return;
        }
        setUser(d.user);
        localStorage.setItem("user", JSON.stringify(d.user));
      })
      .catch(() => navigate("/login"));
  }, [navigate]);

  // ── Global 401 interceptor ────────────────────────────────────
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      const response = await originalFetch.apply(this, args);
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
      const isLoginCall = url.includes("/auth/login") || url.includes("/auth/verify");
      if (response.status === 401 && !isLoginCall) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.dispatchEvent(new CustomEvent("auth:employee-expired"));
      }
      return response;
    };
    const handleExpired = () => setSessionExpired(true);
    window.addEventListener("auth:employee-expired", handleExpired);
    return () => {
      window.fetch = originalFetch;
      window.removeEventListener("auth:employee-expired", handleExpired);
    };
  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const isActive = (item) =>
    item.exact ? pathname === item.path : pathname.startsWith(item.path);

  return (
    <div className="emp-layout">

      {/* ══ SIDEBAR (desktop) ══════════════════════════════════ */}
      <aside className="emp-sidebar">
        {/* Logo */}
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #2d3154" }}>
          <div style={{ fontSize: 24, marginBottom: 4 }}>🐱</div>
          <div style={{ color: "#e8eaf0", fontWeight: 700, fontSize: 15 }}>Meo Care</div>
          <div style={{ color: "#8b90a7", fontSize: 11 }}>Cổng nhân viên</div>
        </div>

        {/* User info — click → profile */}
        {user && (
          <Link to="/employee/profile" style={{ padding: "14px 20px", borderBottom: "1px solid #2d3154", display: "flex", alignItems: "center", gap: 10, textDecoration: "none", transition: "background .15s" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(91,124,246,.08)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#2d3154", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, overflow: "hidden", flexShrink: 0, border: "2px solid #2d3154" }}>
              {user.avatar
                ? <img src={user.avatar} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                : "👤"}
            </div>
            <div style={{ overflow: "hidden", flex: 1 }}>
              <div style={{ color: "#e8eaf0", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user.fullName || user.username}
              </div>
              <div style={{ color: "#8b90a7", fontSize: 11 }}>
                {user.role === "manager" ? "Quản lý" : user.role === "stock-manager" ? "Quản lý kho" : user.role === "admin" ? "Admin" : "Nhân viên"}
              </div>
            </div>
            <span style={{ color: "#8b90a7", fontSize: 12, flexShrink: 0 }}>›</span>
          </Link>
        )}

        {/* Nav links */}
        <nav style={{ flex: 1, padding: "12px 0", overflowY: "auto" }}>
          {NAV.map(item => (
            <Link
              key={item.path}
              to={item.path}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "11px 20px", textDecoration: "none",
                fontSize: 14, fontWeight: 600,
                background:  isActive(item) ? "rgba(91,124,246,.15)" : "transparent",
                color:       isActive(item) ? "#5b7cf6" : "#8b90a7",
                borderLeft:  isActive(item) ? "3px solid #5b7cf6" : "3px solid transparent",
                transition: "all .15s",
              }}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </Link>
          ))}

          {user?.role !== "employee" && (
            <Link to="/admin" style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", textDecoration: "none", fontSize: 13, color: "#6b7280", marginTop: 8 }}>
              <span>⚙️</span>Admin Panel
            </Link>
          )}
        </nav>

        {/* Footer */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid #2d3154" }}>
          <a href="/" style={{ display: "block", color: "#8b90a7", fontSize: 13, textDecoration: "none", marginBottom: 8 }}>
            🌐 Trang web
          </a>
          <button onClick={logout} style={{ background: "transparent", border: "none", color: "#ef4444", fontSize: 13, cursor: "pointer", padding: 0, fontWeight: 600 }}>
            🚪 Đăng xuất
          </button>
        </div>
      </aside>

      {/* ══ MAIN CONTENT ══════════════════════════════════════ */}
      <main className="emp-main">
        <Outlet context={{ user }} />
      </main>

      {/* ══ BOTTOM NAV (mobile) ══════════════════════════════ */}
      <nav className="emp-bottom-nav">
        {NAV.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={isActive(item) ? "active" : ""}
          >
            <span className="bnav-icon">{item.icon}</span>
            <span className="bnav-label">{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* ══ SESSION EXPIRED MODAL ════════════════════════════ */}
      {sessionExpired && (
        <EmployeeSessionModal
          onSuccess={(updatedUser) => {
            if (updatedUser) setUser(updatedUser);
            setSessionExpired(false);
          }}
        />
      )}
    </div>
  );
};

export default EmployeeLayout;
