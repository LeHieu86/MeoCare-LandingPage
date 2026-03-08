import React from "react";
import { useNavigate, useLocation } from "react-router-dom";

const AdminSidebar = () => {
  const navigate     = useNavigate();
  const { pathname } = useLocation();

  const logout = () => {
    localStorage.removeItem("mc_admin_token");
    navigate("/admin/login");
  };

  const navItem = (path, icon, label) => (
    <div
      key={path}
      className={`adm-nav-item ${pathname === path ? "adm-nav-active" : ""}`}
      style={{ cursor: "pointer" }}
      onClick={() => navigate(path)}
    >
      <span>{icon}</span> {label}
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
        {navItem("/admin",       "📦", "Sản phẩm")}
        {navItem("/admin/sales", "🧾", "Bán hàng")}
        {navItem("/admin/orders","📋", "Đơn hàng")}
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