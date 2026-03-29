import React from "react";
import { useNavigate, useLocation } from "react-router-dom";

const NAV_ITEMS = [
  { path: "/admin", label: "Sản phẩm", icon: "📦", exact: true },
  { path: "/admin/rooms", label: "Phòng", icon: "🏠" },
  { path: "/admin/cameras", label: "Camera", icon: "📷" },
  { path: "/admin/sales", label: "Bán hàng", icon: "🧾" },
  { path: "/admin/orders", label: "Đơn hàng", icon: "📋" },
];

const AdminSidebar = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const logout = () => {
    localStorage.removeItem("mc_admin_token");
    navigate("/admin/login");
  };

  const isActive = (item) => {
    if (item.exact) return pathname === item.path;
    return pathname === item.path || pathname.startsWith(item.path + "/");
  };

  const navItem = (item) => (
    <div
      key={item.path}
      className={`adm-nav-item ${isActive(item) ? "adm-nav-active" : ""}`}
      style={{ cursor: "pointer" }}
      onClick={() => navigate(item.path)}
    >
      <span>{item.icon}</span> {item.label}
    </div>
  );

  return (
    <aside className="adm-sidebar">
      <div className="adm-sidebar-brand">
        <span className="adm-brand-icon">🐱</span>
        <div>
          <div className="adm-brand-name">Meo Care</div>
          <div className="adm-brand-tag">Admin Panel</div>
        </div>
      </div>

      <nav className="adm-nav">
        {NAV_ITEMS.map(navItem)}
      </nav>

      <div className="adm-sidebar-footer">
        <a href="/" target="_blank" rel="noreferrer" className="adm-nav-item">
          <span>🌐</span> Xem trang web
        </a>
        <button className="adm-nav-item adm-logout" onClick={logout}>
          <span>🚪</span> Đăng xuất
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;