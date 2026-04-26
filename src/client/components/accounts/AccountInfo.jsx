import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import authService from "../../../../backend/services/authService";
import "../../../styles/client/account.css";

const ROLE_LABEL = {
  customer: { text: "Khách hàng", color: "#FF9B71" },
  admin:    { text: "Quản trị",   color: "#6366f1" },
  staff:    { text: "Nhân viên",  color: "#22c55e" },
};

const getInitials = (fullName = "") =>
  fullName
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0].toUpperCase())
    .join("");

const AccountInfo = ({ onLogout }) => {
  const navigate = useNavigate();
  const user = authService.getUser();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  if (!user) {
    return (
      <div className="ai-container">
        <div className="ai-empty">
          <div className="ai-empty-icon">🔒</div>
          <h3>Chưa đăng nhập</h3>
          <p>Vui lòng đăng nhập để xem thông tin tài khoản</p>
        </div>
      </div>
    );
  }

  const roleInfo = ROLE_LABEL[user.role] || ROLE_LABEL.customer;
  const initials = getInitials(user.fullName) || user.username?.[0]?.toUpperCase() || "?";

  const handleLogout = () => {
    authService.logout();
    if (onLogout) onLogout();
    else navigate("/");
  };

  return (
    <div className="ai-container">
      {/* ── PROFILE HEADER ── */}
      <div className="ai-header-card">
        <div className="ai-avatar" style={{ background: `linear-gradient(135deg, #FFB899 0%, ${roleInfo.color} 100%)` }}>
          {initials}
        </div>
        <div className="ai-header-info">
          <h2 className="ai-fullname">{user.fullName || user.username}</h2>
          <span className="ai-role-badge" style={{ background: roleInfo.color }}>
            {roleInfo.text}
          </span>
          <p className="ai-username">@{user.username}</p>
        </div>
      </div>

      {/* ── THÔNG TIN CÁ NHÂN ── */}
      <div className="ai-section">
        <h3 className="ai-section-title">Thông tin cá nhân</h3>
        <div className="ai-info-list">
          <InfoRow icon="👤" label="Họ và tên" value={user.fullName || "Chưa cập nhật"} />
          <InfoRow icon="📧" label="Email"     value={user.email   || "Chưa cập nhật"} />
          <InfoRow icon="📞" label="Số điện thoại" value={user.phone || "Chưa cập nhật"} />
          <InfoRow icon="🔑" label="Tên đăng nhập" value={user.username} />
        </div>
      </div>

      {/* ── HÀNH ĐỘNG ── */}
      <div className="ai-section">
        <h3 className="ai-section-title">Tài khoản</h3>
        <div className="ai-action-list">
          <button className="ai-action-btn" disabled>
            <span className="ai-action-icon">✏️</span>
            <span className="ai-action-label">Chỉnh sửa thông tin</span>
            <span className="ai-action-badge">Sắp có</span>
          </button>
          <button className="ai-action-btn" disabled>
            <span className="ai-action-icon">🔐</span>
            <span className="ai-action-label">Đổi mật khẩu</span>
            <span className="ai-action-badge">Sắp có</span>
          </button>
          <button
            className="ai-action-btn ai-action-logout"
            onClick={() => setShowLogoutConfirm(true)}
          >
            <span className="ai-action-icon">🚪</span>
            <span className="ai-action-label">Đăng xuất</span>
          </button>
        </div>
      </div>

      {/* ── CONFIRM LOGOUT MODAL ── */}
      {showLogoutConfirm && (
        <div className="ai-modal-overlay" onClick={() => setShowLogoutConfirm(false)}>
          <div className="ai-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ai-modal-icon">🚪</div>
            <h3>Đăng xuất?</h3>
            <p>Bạn có chắc muốn đăng xuất khỏi tài khoản?</p>
            <div className="ai-modal-actions">
              <button
                className="ai-modal-btn ai-modal-cancel"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Hủy
              </button>
              <button
                className="ai-modal-btn ai-modal-confirm"
                onClick={handleLogout}
              >
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const InfoRow = ({ icon, label, value }) => (
  <div className="ai-info-row">
    <span className="ai-info-icon">{icon}</span>
    <div className="ai-info-content">
      <span className="ai-info-label">{label}</span>
      <span className="ai-info-value">{value}</span>
    </div>
  </div>
);

export default AccountInfo;
