import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../../styles/client/landing.css';

const MeoCareLanding = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ✅ CHỈ GIỮ LẠI 2 DỊCH VỤ ĐÃ LÀM XONG
  const services = [
    {
      id: 1,
      icon: '🏠',
      title: 'Dịch Vụ Giữ Mèo',
      description: 'Phòng riêng tư, vệ sinh chuẩn, đặc biệt có hệ thống Camera Live để bạn theo dõi bé yêu 24/7.',
      price: '130.000đ - 200.000đ/ngày',
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
              <button onClick={() => navigate('/portal')} className="btn btn-primary">
                <span>📅</span>
                Đặt Lịch Ngay
              </button>
              <button onClick={() => navigate('/menu')} className="btn btn-secondary">
                🛒 Xem Sản Phẩm
              </button>
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