import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

// Nhóm cha có `children`; mục đơn (single) không có `children` sẽ render phẳng.
const NAV_GROUPS = [
  {
    id: "products",
    label: "Sản phẩm",
    icon: "📦",
    children: [
      { path: "/admin",                  label: "Quản lý sản phẩm", icon: "🛍️", exact: true },
      { path: "/admin/purchase-orders",  label: "Nhập hàng",        icon: "📝" },
      { path: "/admin/sales",            label: "Bán hàng",         icon: "🧾" },
    ],
  },
  {
    id: "customers",
    label: "Khách hàng",
    icon: "👥",
    children: [
      { path: "/admin/orders",   label: "Đơn hàng", icon: "📋" },
      { path: "/admin/bookings", label: "Đặt lịch", icon: "📅" },
    ],
  },
  {
    id: "facility",
    label: "Cơ sở",
    icon: "🏠",
    children: [
      { path: "/admin/rooms",   label: "Phòng",     icon: "🛏️" },
      { path: "/admin/cameras", label: "Camera",    icon: "📷" },
      { path: "/admin/nas",     label: "NAS Video", icon: "💾" },
    ],
  },
  { path: "/admin/chat", label: "Tin nhắn", icon: "💬" },
];

const itemMatches = (item, pathname) => {
  if (item.exact) return pathname === item.path;
  return pathname === item.path || pathname.startsWith(item.path + "/");
};

const groupContainsActive = (group, pathname) =>
  group.children?.some((c) => itemMatches(c, pathname)) ?? false;

const AdminSidebar = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // User-controlled open state. Nhóm chứa route active luôn mở (derive trong render).
  const [openGroups, setOpenGroups] = useState({});

  const isGroupOpen = (group) =>
    !!openGroups[group.id] || groupContainsActive(group, pathname);

  const toggleGroup = (id) =>
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));

  const logout = () => {
    localStorage.removeItem("mc_admin_token");
    navigate("/admin/login");
  };

  const renderLeaf = (item, isChild = false) => (
    <div
      key={item.path}
      className={`adm-nav-item ${itemMatches(item, pathname) ? "adm-nav-active" : ""}`}
      style={{ cursor: "pointer", paddingLeft: isChild ? 28 : undefined }}
      onClick={() => navigate(item.path)}
    >
      <span>{item.icon}</span> {item.label}
    </div>
  );

  const renderGroup = (group) => {
    const isOpen   = isGroupOpen(group);
    const isActive = groupContainsActive(group, pathname);
    return (
      <div key={group.id}>
        <div
          className={`adm-nav-item ${isActive && !isOpen ? "adm-nav-active" : ""}`}
          style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}
          onClick={() => toggleGroup(group.id)}
        >
          <span><span>{group.icon}</span> {group.label}</span>
          <span style={{ fontSize: 10, opacity: 0.7, transition: "transform 0.2s", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
        </div>
        {isOpen && group.children.map((c) => renderLeaf(c, true))}
      </div>
    );
  };

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
        {NAV_GROUPS.map((item) => (item.children ? renderGroup(item) : renderLeaf(item)))}
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
