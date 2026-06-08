import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/auth/AuthContext';
import '../../styles/client/landing.css';

const LIVE_ACTIVITIES = [
  { icon: '🏠', text: 'Chị Lan vừa đặt phòng cho bé Mochi', time: '2 phút trước' },
  { icon: '🛒', text: 'Anh Tuấn vừa mua Thức ăn Royal Canin', time: '4 phút trước' },
  { icon: '📹', text: 'Chị Mai đang xem Camera Live bé Miu', time: '1 phút trước' },
  { icon: '🏠', text: 'Bé Simba vừa được nhận phòng hôm nay', time: '8 phút trước' },
  { icon: '⭐', text: 'Khách hàng đánh giá 5⭐ cho dịch vụ giữ mèo', time: '12 phút trước' },
  { icon: '🛒', text: 'Chị Hoa vừa đặt Cát Vệ Sinh Bioline', time: '5 phút trước' },
];

const MeoCareLanding = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [activityIndex, setActivityIndex] = useState(0);
  const [activityVisible, setActivityVisible] = useState(true);
  const navigate = useNavigate();
  const { user, initializing } = useAuth();

  // Đã đăng nhập mở web/PWA → vào thẳng khu vực của mình, không xem trang giới thiệu.
  // Chờ khôi phục phiên xong (initializing=false) rồi mới quyết để không đá nhầm.
  useEffect(() => {
    if (initializing || !user) return;
    if (user.role === "customer") {
      navigate("/dashboard", { replace: true });
    } else if (["employee", "manager", "stock-manager", "hr-manager"].includes(user.role)) {
      navigate("/employee", { replace: true });
    }
    // admin: web không có route riêng (dùng app Flutter) → để nguyên ở Landing
  }, [initializing, user, navigate]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setActivityVisible(false);
      setTimeout(() => {
        setActivityIndex(i => (i + 1) % LIVE_ACTIVITIES.length);
        setActivityVisible(true);
      }, 400);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // ✅ CHỈ GIỮ LẠI 2 DỊCH VỤ ĐÃ LÀM XONG
  const services = [
    {
      id: 1,
      icon: '🏠',
      title: 'Dịch Vụ Giữ Mèo',
      description: 'Phòng riêng tư, vệ sinh chuẩn, đặc biệt có hệ thống Camera Live để bạn theo dõi bé yêu 24/7.',
      price: '50.000đ - 70.000đ/ngày',
      features: ['Kiểm tra lịch trống trực tiếp', 'Camera giám sát Live', 'Cập nhật tiến trình hàng ngày'],
      link: '/portal' // Thay bằng path thật của bạn
    },
    {
      id: 2,
      icon: '🛒',
      title: 'Cửa Hàng Sản Phẩm',
      description: 'Cung cấp các loại thức ăn, pate, cát vệ sinh và phụ kiện chính hãng cho bé mèo.',
      price: 'Giá tốt nhất thị trường',
      features: ['Thức ăn hạt & Pate', 'Cát vệ sinh khử mùi', 'Đặt hàng giao tận nơi'],
      link: '/menu' // Thay bằng path thật của bạn
    }
  ];

  const features = [
    { icon: '📹', text: 'Camera Live 24/7' }, // Đổi thành điểm mạnh nhất
    { icon: '📅', text: 'Đặt lịch online dễ dàng' },
    { icon: '💚', text: 'Chăm sóc tận tâm, yêu thương' },
    { icon: '🛒', text: 'Sản phẩm chính hãng' }
  ];

  // Đang khôi phục phiên mà có dấu hiệu đã đăng nhập → hiện loader, tránh chớp trang giới thiệu
  // rồi mới nhảy sang Dashboard.
  if (initializing && (localStorage.getItem("token") || localStorage.getItem("rt"))) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", color: "#FF6B9D", fontWeight: 600,
        fontFamily: "system-ui, sans-serif",
      }}>
        Đang tải…
      </div>
    );
  }

  return (
    <div className="meo-care-landing">
      {/* Header */}
            {/* Header */}
      <header className={`header ${isScrolled ? 'scrolled' : ''}`}>
        <div className="container header-content">
          
          <Link to="/" className="logo" style={{textDecoration: 'none'}}>
            <span className="logo-icon">🐱</span>
            <span className="logo-text">Meo Care</span>
          </Link>

          {/* Menu điều hướng nằm giữa */}
          <nav className="nav">
            <Link to="/">Trang chủ</Link>
            <Link to="/menu">Sản phẩm</Link>
            <Link to="/portal">Đặt lịch giữ mèo</Link>
            <a href="#contact">Liên Hệ</a>
          </nav>

          {/* 2 Nút Đăng nhập / Đăng ký nằm bên phải */}
          <div className="header-actions">
            <button onClick={() => navigate('/login')} className="btn-header btn-login">
              Đăng Nhập
            </button>
            <button onClick={() => navigate('/register')} className="btn-header btn-register">
              Đăng Ký
            </button>
          </div>

        </div>
      </header>

      {/* Hero Section - Đổi thông điệp */}
      <section className="hero">
        <div className="hero-background">
          <div className="hero-blob blob-1"></div>
          <div className="hero-blob blob-2"></div>
          <div className="hero-blob blob-3"></div>
        </div>
        <div className="container hero-content">
          <div className="hero-text">
            <div className="hero-badge">
              <span>🐾</span>
              <span>Khách sạn mèo ứng dụng công nghệ Camera 24/7</span>
            </div>
            <h1 className="hero-title">
              <span className="title-line">Giữ Mèo An Toàn</span>
              <span className="title-line highlight">Theo Dõi Camera Live</span>
              <span className="title-line">Mua Sắm Tiện Lợi</span>
            </h1>
            <p className="hero-description">
              Dịch vụ khách sạn mèo hệ thống Camera 24/7 và cung cấp sản phẩm chăm sóc chính hãng. 
              Đặt lịch trực tiếp - Theo dõi bé yêu mọi lúc mọi nơi!
            </p>
            <div className="hero-buttons">
              <button onClick={() => navigate('/portal')} className="btn btn-primary btn-primary-main">
                <span>📅</span>
                Đặt Lịch Ngay
              </button>
              <button onClick={() => navigate('/menu')} className="btn btn-secondary">
                🛒 Xem Sản Phẩm
              </button>
            </div>
            <div className="hero-urgency">
              <span className="urgency-dot" />
              <span className="urgency-text">Hôm nay còn <strong>3 phòng trống</strong> — đặt trước để giữ chỗ!</span>
            </div>
            <div className={`live-activity ${activityVisible ? 'visible' : ''}`}>
              <span className="live-dot" />
              <span className="live-label">LIVE</span>
              <span className="live-icon">{LIVE_ACTIVITIES[activityIndex].icon}</span>
              <span className="live-text">{LIVE_ACTIVITIES[activityIndex].text}</span>
              <span className="live-time">{LIVE_ACTIVITIES[activityIndex].time}</span>
            </div>
            <div className="hero-features">
              {features.map((feature, index) => (
                <div key={index} className="hero-feature" style={{ animationDelay: `${index * 0.1}s` }}>
                  <span className="feature-icon">{feature.icon}</span>
                  <span className="feature-text">{feature.text}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="hero-image">
            <div className="hero-cat-circle">
              <div className="cat-emoji">😺</div>
            </div>
            {/* Chỉnh lại nội dung 3 thẻ nổi cho khớp thực tế */}
            <div className="floating-card card-1">
              <span>🏠</span>
              <span>Giữ Mèo</span>
            </div>
            <div className="floating-card card-2">
              <span>📹</span>
              <span>Camera Live</span>
            </div>
            <div className="floating-card card-3">
              <span>🛒</span>
              <span>Sản Phẩm</span>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <div className="trust-badges-bar">
        <div className="container trust-badges-content">
          <div className="trust-badge"><span>🔒</span><span>Thanh toán an toàn</span></div>
          <div className="trust-badge-divider" />
          <div className="trust-badge"><span>📦</span><span>Giao hàng tận nơi</span></div>
          <div className="trust-badge-divider" />
          <div className="trust-badge"><span>💬</span><span>Hỗ trợ 8:00–20:00</span></div>
          <div className="trust-badge-divider" />
          <div className="trust-badge"><span>🔄</span><span>Đổi trả trong 7 ngày</span></div>
        </div>
      </div>

      {/* Stats strip */}
      <section className="stats-strip">
        <div className="container stats-grid">
          <div className="stat-item">
            <span className="stat-number">100+</span>
            <span className="stat-label">Khách hàng tin tưởng</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-number">4.9 ⭐</span>
            <span className="stat-label">Đánh giá trung bình</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-number">24/7</span>
            <span className="stat-label">Camera giám sát Live</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-number">2+</span>
            <span className="stat-label">Năm kinh nghiệm</span>
          </div>
        </div>
      </section>

      {/* Services Section - Chỉ render 2 thẻ */}
      <section id="services" className="services">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Dịch Vụ Cốt Lõi</h2>
            <p className="section-subtitle">
              Tập trung phát triển 2 dịch vụ tốt nhất: Giữ mèo an tâm tuyệt đối và cung cấp sản phẩm chất lượng
            </p>
          </div>
          <div className="services-grid">
            {services.map((service, index) => (
              <div
                key={service.id}
                className="service-card"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="service-icon">{service.icon}</div>
                <h3 className="service-title">{service.title}</h3>
                <p className="service-description">{service.description}</p>
                <div className="service-price">{service.price}</div>
                <ul className="service-features">
                  {service.features.map((feature, idx) => (
                    <li key={idx}>
                      <span className="check-icon">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                {/* Nút bấm có thể click được thực sự */}
                <button 
                  className="btn-book"
                  onClick={() => navigate(service.link)}
                >
                  {service.id === 1 ? 'Xem Lịch & Đặt Ngay' : 'Khám Phá Sản Phẩm'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ✅ XOÁ HOÀN TOÀN SECTION DOWNLOAD APP Ở ĐÂY */}

      {/* CTA Section - Đổi nút gọi hành động */}
      <section className="cta">
        <div className="container cta-content">
          <h2 className="cta-title">Sẵn Sàng Theo Dõi Boss Của Bạn?</h2>
          <p className="cta-description">
            Đặt lịch giữ mèo để trải nghiệm hệ thống Camera Live 24/7, hoặc mua sắm sản phẩm chăm sóc ngay hôm nay!
          </p>
          <div className="cta-buttons">
            <button onClick={() => navigate('/dat-lich')} className="btn btn-cta-primary">
              📅 Đặt Lịch Giữ Mèo
            </button>
            <button onClick={() => navigate('/menu')} className="btn btn-cta-secondary">
              🛒 Mua Sản Phẩm
            </button>
          </div>
        </div>
      </section>

      {/* Footer - Xóa các link chết */}
      <footer id="contact" className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-about">
              <div className="footer-logo">
                <span className="logo-icon">🐱</span>
                <span className="logo-text">Meo Care</span>
              </div>
              <p className="footer-description">
                Trung tâm chăm sóc mèo ứng dụng công nghệ. Giúp bạn theo dõi bé yêu 24/7 qua Camera Live và tiếp cận sản phẩm chính hãng dễ dàng.
              </p>
              <div className="footer-social">
                <a href="https://facebook.com" className="social-link" target="_blank" rel="noopener noreferrer">📘</a>
                <a href="https://instagram.com" className="social-link" target="_blank" rel="noopener noreferrer">📷</a>
                <a href="https://tiktok.com" className="social-link" target="_blank" rel="noopener noreferrer">🎵</a>
              </div>
            </div>
            <div className="footer-links">
              <h4>Dịch Vụ</h4>
              <ul>
                <li><Link to="/portal">Đặt lịch giữ mèo</Link></li>
                <li><Link to="/portal">Quan sát Camera Live</Link></li>
                <li><Link to="/menu">Mua sản phẩm</Link></li>
              </ul>
            </div>
            <div className="footer-links">
              <h4>Hỗ Trợ</h4>
              <ul>
                <li><a href="#contact">Câu hỏi thường gặp</a></li>
                <li><a href="#contact">Chính sách bảo mật</a></li>
                <li><a href="#contact">Điều khoản dịch vụ</a></li>
              </ul>
            </div>
            <div className="footer-contact">
              <h4>Liên Hệ</h4>
              <ul>
                <li>📍 Thành phố Cần Thơ</li>
                <li>📞 '(+84) 942 768 652'</li>
                <li>✉️ meomeocare.online@gmail.com</li>
                <li>⏰ 8:00 - 20:00 (Hàng ngày)</li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; {new Date().getFullYear()} Meo Care. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default MeoCareLanding;