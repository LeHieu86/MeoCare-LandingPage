import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import authService from '../utils/authService';
import ShoppingTab from '../components/shopping/ShoppingTab';
import MyOrders from '../components/shopping/MyOrders';
import PetList from '../components/pets/PetList';
import StoreService from '../components/store-services/StoreService';
import ActiveServices from '../components/store-services/ActiveServices';
import AccountInfo from '../components/accounts/AccountInfo';
import "../../styles/client/dashboard.css";
import "../../styles/client/orders.css";

const Dashboard = () => {
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
      case 'services': return <StoreService onGoToActive={() => handleTabChange('active')}/>;
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
        <div className="content-mobile-title">
          <span>{tabs.find(t => t.id === activeTab)?.icon}</span>
          <span>{tabs.find(t => t.id === activeTab)?.label}</span>
        </div>
        <div className="dashboard-content" ref={contentRef}>
          {renderContent()}
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
            <span className="bottom-nav-icon">{tab.icon}</span>
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