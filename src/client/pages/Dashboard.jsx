import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import authService from '../../../backend/services/authService';
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
  const [activeTab, setActiveTab] = useState('pets');
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

  const tabs = [
    { id: 'pets',     label: 'Thú Cưng',  icon: '🐾' },
    { id: 'services', label: 'Dịch Vụ',   icon: '🏥' },
    { id: 'shopping', label: 'Mua Sắm',   icon: '🛒' },
    { id: 'orders',   label: 'Đơn Hàng',  icon: '📦' },
    { id: 'active',   label: 'Đang dùng', icon: '🎯' },
    { id: 'profile',  label: 'Hồ Sơ',     icon: '👤' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'pets':     return <PetList />;
      case 'services': return <StoreService />;
      case 'shopping': return <ShoppingTab onNavToggle={setHideBottomNav} />;
      case 'orders':   return <MyOrders />;
      case 'active':   return <ActiveServices onGoToServices={() => handleTabChange('services')} />;
      case 'profile':  return <AccountInfo onLogout={handleLogout} />;
      default:         return null;
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
            {/* <span className="bottom-nav-label">{tab.label}</span> */} 
            {/* Bỏ comment dòng trên nếu bạn muốn hiện thêm chữ dưới icon (như Shopee) */}
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