import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import ShoppingTab from '../components/shopping/ShoppingTab';
import "../../styles/client/dashboard.css";

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('pets');

  const tabs = [
    { id: 'pets', label: 'Thú Cưng', icon: '🐾' },
    { id: 'services', label: 'Dịch Vụ', icon: '🏥' },
    { id: 'shopping', label: 'Mua Sắm', icon: '🛒' },
    { id: 'camera', label: 'Camera', icon: '📹' }, // Rút gọn chữ trên Mobile cho vừa khít
    { id: 'profile', label: 'Hồ Sơ', icon: '👤' }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'pets': return <Placeholder title="Quản lý Thú Cưng" desc="Danh sách mèo của khách, thêm/sửa/xóa từng bé (tên, tuổi, giống, ảnh, ghi chú)." />;
      case 'services': return <Placeholder title="Đặt Dịch Vụ" desc="Gồm 3 sub-tab: Giữ mèo / Khám bệnh / Grooming — mỗi loại có form đặt lịch + lịch sử." />;
      case 'shopping': return <ShoppingTab />;
      case 'camera': return <Placeholder title="Camera Live" desc="Hiển thị feed camera theo phòng — chỉ active khi khách đang có booking giữ mèo." />;
      case 'profile': return <Placeholder title="Hồ Sơ Cá Nhân" desc="Thông tin cá nhân, số điện thoại, địa chỉ, đổi mật khẩu." />;
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
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="nav-icon">{tab.icon}</span>
              <span className="nav-label">{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="btn-logout">🚪 Đăng xuất</button>
        </div>
      </aside>

      {/* === KHU VỰC NỘI DUNG CHÍNH === */}
      <main className="dashboard-main">
        <div className="dashboard-content">
          {renderContent()}
        </div>
      </main>

      {/* === BOTTOM NAVIGATION (Chỉ hiện Mobile) === */}
      <nav className="mobile-bottom-nav">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`bottom-nav-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
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