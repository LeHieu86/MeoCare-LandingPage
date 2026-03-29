import React, { useState, useEffect } from 'react';
import '../../styles/client/landing.css';
import { Link } from "react-router-dom";

const MeoCareLanding = () => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const services = [
    {
      id: 1,
      icon: '🏥',
      title: 'Khám Sức Khỏe',
      description: 'Kiểm tra sức khỏe định kỳ, tiêm phòng vaccine đầy đủ',
      price: '200.000đ - 500.000đ',
      features: ['Khám tổng quát', 'Tư vấn dinh dưỡng', 'Theo dõi cân nặng']
    },
    {
      id: 2,
      icon: '✂️',
      title: 'Spa & Grooming',
      description: 'Tắm rửa, cắt tỉa lông chuyên nghiệp, an toàn',
      price: '150.000đ - 400.000đ',
      features: ['Tắm gội thảo dược', 'Cắt tỉa lông', 'Vệ sinh tai, móng']
    },
    {
      id: 3,
      icon: '🏠',
      title: 'Khách Sạn Mèo',
      description: 'Phòng riêng tư, chăm sóc 24/7, camera giám sát',
      price: '100.000đ - 300.000đ/ngày',
      features: ['Phòng VIP riêng', 'Chơi đùa hàng ngày', 'Cập nhật hình ảnh']
    },
    {
      id: 4,
      icon: '🍽️',
      title: 'Tư Vấn Dinh Dưỡng',
      description: 'Lên thực đơn khoa học theo từng giai đoạn',
      price: '100.000đ - 200.000đ',
      features: ['Phân tích cơ địa', 'Menu cá nhân hóa', 'Theo dõi tiến độ']
    },
    {
      id: 5,
      icon: '💊',
      title: 'Điều Trị Bệnh',
      description: 'Khám và điều trị các bệnh lý thường gặp',
      price: 'Theo tình trạng',
      features: ['Xét nghiệm máu', 'Siêu âm', 'Phẫu thuật']
    },
    {
      id: 6,
      icon: '🚗',
      title: 'Dịch Vụ Đưa Đón',
      description: 'Đưa đón tận nhà an toàn, nhanh chóng',
      price: '50.000đ - 150.000đ',
      features: ['Xe chuyên dụng', 'Lồng an toàn', 'Hỗ trợ 24/7']
    }
  ];

  const features = [
    { icon: '⭐', text: 'Đội ngũ bác sĩ chuyên môn cao' },
    { icon: '🏆', text: 'Trang thiết bị hiện đại' },
    { icon: '💚', text: 'Chăm sóc tận tâm, yêu thương' },
    { icon: '📱', text: 'Đặt lịch online tiện lợi' }
  ];

  return (
    <div className="meo-care-landing">
      {/* Header */}
      <header className={`header ${isScrolled ? 'scrolled' : ''}`}>
        <div className="container header-content">
          <div className="logo">
            <span className="logo-icon">🐱</span>
            <span className="logo-text">Meo Care</span>
          </div>
          <nav className="nav">
            <Link to="/">Trang chủ</Link>
            <Link to="/menu">Sản phẩm</Link>
            <a href="#services">Dịch Vụ</a>
            <a href="#pricing">Bảng Giá</a>
            <a href="#download">Tải App</a>
            <a href="#contact" className="btn-contact">Liên Hệ</a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-background">
          <div className="hero-blob blob-1"></div>
          <div className="hero-blob blob-2"></div>
          <div className="hero-blob blob-3"></div>
        </div>
        <div className="container hero-content">
          <div className="hero-text">
            <h1 className="hero-title">
              <span className="title-line">Chăm Sóc Mèo</span>
              <span className="title-line highlight">Chuyên Nghiệp</span>
              <span className="title-line">Tận Tâm</span>
            </h1>
            <p className="hero-description">
              Dịch vụ khám sức khỏe, spa, grooming và khách sạn cho mèo cưng của bạn.
              Đặt lịch dễ dàng qua app - Nhận ưu đãi đến 30%!
            </p>
            <div className="hero-buttons">
              <a href="#download" className="btn btn-primary">
                <span>📱</span>
                Tải App Ngay
              </a>
              <a href="#services" className="btn btn-secondary">
                Xem Dịch Vụ
              </a>
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
            <div className="floating-card card-1">
              <span>🏥</span>
              <span>Khám Sức Khỏe</span>
            </div>
            <div className="floating-card card-2">
              <span>✂️</span>
              <span>Spa & Grooming</span>
            </div>
            <div className="floating-card card-3">
              <span>🏠</span>
              <span>Khách Sạn</span>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="services">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Dịch Vụ Của Chúng Tôi</h2>
            <p className="section-subtitle">
              Đầy đủ các dịch vụ chăm sóc mèo chuyên nghiệp, an toàn và tận tâm
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
                <button className="btn-book">Đặt Lịch Ngay</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Download Section */}
      <section id="download" className="download">
        <div className="container">
          <div className="download-content">
            <div className="download-text">
              <h2 className="download-title">Tải App Meo Care</h2>
              <p className="download-description">
                Đặt lịch nhanh chóng, theo dõi lịch sử khám, nhận ưu đãi độc quyền
                và nhiều tiện ích khác chỉ với vài thao tác đơn giản!
              </p>
              <div className="app-badges">
                <a href="https://play.google.com" className="app-badge" target="_blank" rel="noopener noreferrer">
                  <div className="badge-content">
                    <span className="badge-icon">🤖</span>
                    <div className="badge-text">
                      <span className="badge-label">Tải trên</span>
                      <span className="badge-name">Google Play</span>
                    </div>
                  </div>
                </a>
                <a href="https://apps.apple.com" className="app-badge" target="_blank" rel="noopener noreferrer">
                  <div className="badge-content">
                    <span className="badge-icon">🍎</span>
                    <div className="badge-text">
                      <span className="badge-label">Tải trên</span>
                      <span className="badge-name">App Store</span>
                    </div>
                  </div>
                </a>
              </div>
              <div className="download-stats">
                <div className="stat">
                  <div className="stat-number">10K+</div>
                  <div className="stat-label">Lượt tải</div>
                </div>
                <div className="stat">
                  <div className="stat-number">4.8⭐</div>
                  <div className="stat-label">Đánh giá</div>
                </div>
                <div className="stat">
                  <div className="stat-number">5K+</div>
                  <div className="stat-label">Khách hàng</div>
                </div>
              </div>
            </div>
            <div className="download-image">
              <div className="phone-mockup">
                <div className="phone-screen">
                  <div className="app-preview">
                    <div className="preview-header">
                      <span className="preview-logo">🐱</span>
                      <span className="preview-title">Meo Care</span>
                    </div>
                    <div className="preview-content">
                      <div className="preview-card">
                        <div className="preview-icon">📅</div>
                        <div className="preview-text">Đặt lịch dễ dàng</div>
                      </div>
                      <div className="preview-card">
                        <div className="preview-icon">📊</div>
                        <div className="preview-text">Theo dõi sức khỏe</div>
                      </div>
                      <div className="preview-card">
                        <div className="preview-icon">💰</div>
                        <div className="preview-text">Ưu đãi độc quyền</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta">
        <div className="container cta-content">
          <h2 className="cta-title">Sẵn Sàng Chăm Sóc Boss Của Bạn?</h2>
          <p className="cta-description">
            Đặt lịch ngay hôm nay và nhận ưu đãi 20% cho lần đầu sử dụng dịch vụ!
          </p>
          <div className="cta-buttons">
            <a href="tel:0123456789" className="btn btn-cta-primary">
              📞 Gọi Ngay: 0123 456 789
            </a>
            <a href="#download" className="btn btn-cta-secondary">
              📱 Tải App Đặt Lịch
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-about">
              <div className="footer-logo">
                <span className="logo-icon">🐱</span>
                <span className="logo-text">Meo Care</span>
              </div>
              <p className="footer-description">
                Trung tâm chăm sóc mèo hàng đầu Việt Nam.
                Chăm sóc boss của bạn như chính boss của chúng tôi!
              </p>
              <div className="footer-social">
                <a href="https://facebook.com" className="social-link">📘</a>
                <a href="https://instagram.com" className="social-link">📷</a>
                <a href="https://tiktok.com" className="social-link">🎵</a>
              </div>
            </div>
            <div className="footer-links">
              <h4>Dịch Vụ</h4>
              <ul>
                <li><a href="#services">Khám Sức Khỏe</a></li>
                <li><a href="#services">Spa & Grooming</a></li>
                <li><a href="#services">Khách Sạn Mèo</a></li>
                <li><a href="#services">Tư Vấn Dinh Dưỡng</a></li>
              </ul>
            </div>
            <div className="footer-links">
              <h4>Thông Tin</h4>
              <ul>
                <li><a href="#about">Về Chúng Tôi</a></li>
                <li><a href="#pricing">Bảng Giá</a></li>
                <li><a href="#blog">Blog</a></li>
                <li><a href="#contact">Liên Hệ</a></li>
              </ul>
            </div>
            <div className="footer-contact">
              <h4>Liên Hệ</h4>
              <ul>
                <li>📍 123 Đường ABC, Quận 1, TP.HCM</li>
                <li>📞 0123 456 789</li>
                <li>✉️ hello@meocare.vn</li>
                <li>⏰ 8:00 - 20:00 (Hàng ngày)</li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2026 Meo Care. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Floating Zalo Button */}
      <a
        href="https://zalo.me/0123456789"
        className="zalo-button"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat qua Zalo"
      >
        <div className="zalo-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12c0 5.52 4.48 10 10 10s10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
          </svg>
        </div>
        <span className="zalo-text">Chat Zalo</span>
      </a>
    </div>
  );
};

export default MeoCareLanding;
