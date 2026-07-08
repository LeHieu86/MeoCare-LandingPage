import React, { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import EmployeeSessionModal from "../components/EmployeeSessionModal";
import useEmployeeSocket from "../hooks/useEmployeeSocket";
import "../../styles/employee/employee.css";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

const NAV = [
  { path: "/employee",            label: "Tổng quan",  icon: "🏠", exact: true  },
  { path: "/employee/shifts",     label: "Ca làm",     icon: "📅", exact: false },
  { path: "/employee/attendance", label: "Chấm công",  icon: "⏰", exact: false },
  { path: "/employee/leave",      label: "Nghỉ phép",  icon: "🏖️", exact: false },
  { path: "/employee/salary",     label: "Lương",      icon: "💰", exact: false },
  // Chat khách hàng (web inbox): CHỈ admin — chủ tiệm trực tin khi chưa có nhân viên.
  // (Quản lý vẫn dùng chat khách trong app Flutter theo chi nhánh.)
  { path: "/employee/chat",       label: "Chat khách", icon: "💬", exact: false, roles: ["admin"] },
];

const EmployeeLayout = () => {
  const navigate     = useNavigate();
  const { pathname } = useLocation();
  const [user,           setUser]           = useState(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Kết nối socket 1 lần, broadcast xuống các page qua CustomEvent 'emp:socket'
  useEmployeeSocket();

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

  // Admin (chủ) chỉ dùng cổng này để chat → vào thẳng /employee/chat, không xem dashboard NV.
  useEffect(() => {
    if (user?.role === "admin" && pathname === "/employee") {
      navigate("/employee/chat", { replace: true });
    }
  }, [user, pathname, navigate]);

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

  // Admin (chủ) chỉ trực chat → CHỈ thấy mục Chat khách, ẩn hết tab nhân viên cho gọn.
  // Nhân viên/quản lý thấy các tab thường (mục không gắn `roles`), không thấy chat.
  const navItems =
    user?.role === "admin"
      ? NAV.filter((item) => item.roles?.includes("admin"))
      : NAV.filter((item) => !item.roles);

  return (
    <div className="emp-layout">

      {/* ══ SIDEBAR (desktop) ══════════════════════════════════ */}
      <aside className="emp-sidebar">
        {/* Logo */}
        <div className="emp-sidebar-brand">
          <div className="emp-sidebar-brand-logo">🐱</div>
          <div className="emp-sidebar-brand-name">Meo Care</div>
          <div className="emp-sidebar-brand-sub">Cổng nhân viên</div>
        </div>

        {/* User info — click → profile */}
        {user && (
          <Link to="/employee/profile" className="emp-sidebar-user">
            <div className="emp-sidebar-user-avatar">
              {user.avatar
                ? <img src={user.avatar} alt="" />
                : "👤"}
            </div>
            <div className="emp-sidebar-user-meta">
              <div className="emp-sidebar-user-name">
                {user.fullName || user.username}
              </div>
              <div className="emp-sidebar-user-role">
                {user.role === "manager" ? "Quản lý" : user.role === "stock-manager" ? "Quản lý kho" : user.role === "admin" ? "Admin" : "Nhân viên"}
              </div>
            </div>
            <span className="emp-sidebar-user-chevron">›</span>
          </Link>
        )}

        {/* Nav links */}
        <nav className="emp-sidebar-nav">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`emp-nav-link ${isActive(item) ? "active" : ""}`}
            >
              <span className="emp-nav-link-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}

          {user?.role !== "employee" && user?.role !== "admin" && (
            <Link to="/admin" className="emp-nav-link emp-nav-admin">
              <span>⚙️</span>Admin Panel
            </Link>
          )}
        </nav>

        {/* Footer */}
        <div className="emp-sidebar-footer">
          <a href="/">🌐 Trang web</a>
          <button onClick={logout} className="emp-sidebar-logout">
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
        {navItems.map(item => (
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
