import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import authService from '../utils/authService';
import { useAuth } from '../components/auth/AuthContext';
import ShoppingTab from '../components/shopping/ShoppingTab';
import MyOrders from '../components/shopping/MyOrders';
import PetList from '../components/pets/PetList';
import StoreService from '../components/store-services/StoreService';
import ActiveServices from '../components/store-services/ActiveServices';
import AccountInfo from '../components/accounts/AccountInfo';
import NotificationBell from '../components/common/NotificationBell';
import "../../styles/client/dashboard.css";
import "../../styles/client/orders.css";

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('services');
  const [profileSubTab, setProfileSubTab] = useState('account'); // 'account' | 'pets'
  const [hideBottomNav, setHideBottomNav] = useState(false);
  const contentRef = useRef(null);

  const handleLogout = () => {
    authService.logout();
    navigate('/');
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (tabId !== 'shopping') setHideBottomNav(false);
    if (contentRef.current) contentRef.current.scrollTop = 0;
  };

  const userInitial = user ? (user.fullName || user.username || 'U')[0].toUpperCase() : 'U';

  // 5 tab thay vì 6 — Thú Cưng gộp vào Hồ Sơ
  const tabs = [
    { id: 'services', label: 'Dịch Vụ',   icon: '🏥' },
    { id: 'active',   label: 'Đang Dùng', icon: '🎯' },
    { id: 'shopping', label: 'Mua Sắm',   icon: '🛒' },
    { id: 'orders',   label: 'Đơn Hàng',  icon: '📦' },
    { id: 'profile',  label: 'Hồ Sơ',     icon: '👤' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'services': return <StoreService
        onGoToActive={() => handleTabChange('active')}
        onGoToShopping={() => handleTabChange('shopping')}
        onGoToOrders={() => handleTabChange('orders')}
      />;
      case 'active':   return <ActiveServices onGoToServices={() => handleTabChange('services')} />;
      case 'shopping': return <ShoppingTab onNavToggle={setHideBottomNav} />;
      case 'orders':   return <MyOrders />;
      case 'profile':
        return (
          <div className="profile-tabs-wrapper">
            {/* Sub-tab switcher */}
            <div className="profile-subtabs">
              <button
                className={`profile-subtab ${profileSubTab === 'account' ? 'active' : ''}`}
                onClick={() => setProfileSubTab('account')}
              >
                <span>👤</span> Hồ Sơ
              </button>
              <button
                className={`profile-subtab ${profileSubTab === 'pets' ? 'active' : ''}`}
                onClick={() => setProfileSubTab('pets')}
              >
                <span>🐾</span> Thú Cưng
              </button>
            </div>
            {profileSubTab === 'account'
              ? <AccountInfo onLogout={handleLogout} />
              : <PetList />
            }
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="dashboard-layout">
      
      {/* === SIDEBAR TRÁI (Chỉ hiện Desktop) === */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-header">
          <Link to="/" className="sidebar-logo" style={{ textDecoration: 'none' }}>
            <span className="logo-icon">🐱</span>
            <span className="logo-text">Meo Care</span>
          </Link>
          <p className="sidebar-subtitle">Trung tâm điều khiển</p>
        </div>

        {/* User Card */}
        <div className="sidebar-user-card">
          <div className="sidebar-user-avatar">{userInitial}</div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user?.fullName || user?.username || 'Khách hàng'}</span>
            <span className="sidebar-user-badge">
              {user?.role === 'admin' ? '👑 Admin' : user?.role === 'manager' ? '🏢 Quản lý' : '🐾 Thành viên'}
            </span>
          </div>
        </div>

        {/* Notification row — desktop sidebar */}
        <div className="sidebar-notif-row">
          <span className="sidebar-notif-label">Thông báo</span>
          <NotificationBell onGoToOrders={() => handleTabChange('orders')} />
        </div>

        <nav className="sidebar-nav">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => handleTabChange(tab.id)}
            >
              <span className="nav-icon">{tab.icon}</span>
              <span className="nav-label">{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="btn-logout" onClick={handleLogout}>🚪 Đăng xuất</button>
        </div>
      </aside>

      {/* === KHU VỰC NỘI DUNG CHÍNH === */}
      <main className="dashboard-main">
        {/* App Bar — mobile only */}
        <header className="app-bar">
          <div className="app-bar-brand">
            <span className="app-bar-cat">🐱</span>
            <div className="app-bar-brand-text">
              <span className="app-bar-name">Meo Care</span>
              <span className="app-bar-greeting">
                {(() => { const h = new Date().getHours(); return h < 12 ? 'Buổi sáng' : h < 18 ? 'Buổi chiều' : 'Buổi tối'; })()}, {(user?.fullName || user?.username || 'bạn').split(' ').pop()} 👋
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <NotificationBell onGoToOrders={() => handleTabChange('orders')} />
            <button
              className="app-bar-avatar"
              onClick={() => handleTabChange('profile')}
              title={user?.fullName || user?.username || 'Hồ sơ'}
            >
              {userInitial}
            </button>
          </div>
        </header>
        <div className="dashboard-content" ref={contentRef}>
          <div key={activeTab} className="tab-content-anim">
            {renderContent()}
          </div>
        </div>
      </main>

      {/* === BOTTOM NAVIGATION (Chỉ hiện Mobile) === */}
      <nav className={`mobile-bottom-nav${hideBottomNav ? ' hidden' : ''}`}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`bottom-nav-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => handleTabChange(tab.id)}
          >
            <div className="bottom-nav-pill">
              <span className="bottom-nav-icon">{tab.icon}</span>
            </div>
            <span className="bottom-nav-label">{tab.label}</span>
          </button>
        ))}
      </nav>

    </div>
  );
};

const Placeholder = ({ title, desc }) => (
  <div className="placeholder-box">
    <h2>{title}</h2>
    <p>{desc}</p>
    <div className="placeholder-coming-soon">Chuẩn bị triển khai...</div>
  </div>
);

export default Dashboard;