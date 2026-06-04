import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import authService from "../../utils/authService";
import "../../../styles/client/auth.css";

const Register = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const validate = () => {
    if (!form.fullName.trim()) return "Vui lòng nhập họ và tên.";
    if (form.username.length < 4) return "Tên đăng nhập phải có ít nhất 4 ký tự.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "Email không hợp lệ.";
    if (form.password.length < 6) return "Mật khẩu phải có ít nhất 6 ký tự.";
    if (form.password !== form.confirmPassword) return "Mật khẩu xác nhận không khớp.";
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setLoading(true);
    try {
      await authService.register({
        fullName: form.fullName,
        username: form.username,
        email: form.email,
        phone: form.phone || undefined,
        password: form.password,
      });
      toast.success("Đăng ký thành công! Chào mừng bạn 🎉");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.message || "Đăng ký thất bại");
    } finally {
      setLoading(false);
    }
  };

  // Hiển thị strength của password
  const getPasswordStrength = () => {
    const p = form.password;
    if (!p) return null;
    if (p.length < 6) return { level: 1, label: "Yếu", color: "#ef4444" };
    if (p.length < 8) return { level: 2, label: "Trung bình", color: "#f59e0b" };
    if (/[A-Z]/.test(p) && /[0-9]/.test(p)) return { level: 4, label: "Mạnh", color: "#10b981" };
    return { level: 3, label: "Khá", color: "#3b82f6" };
  };

  const strength = getPasswordStrength();

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <div className="auth-blob blob-a" />
        <div className="auth-blob blob-b" />
        <div className="auth-blob blob-c" />
      </div>

      <div className="paw-decor paw-1">🐾</div>
      <div className="paw-decor paw-2">🐾</div>
      <div className="paw-decor paw-3">🐾</div>

      <div className="auth-card auth-card-register">
        {/* Logo */}
        <Link to="/" className="auth-logo">
          <span className="auth-logo-icon">🐱</span>
          <span className="auth-logo-text">Meo Care</span>
        </Link>

        <div className="auth-header">
          <h1 className="auth-title">Tạo tài khoản mới</h1>
          <p className="auth-subtitle">Đăng ký để bắt đầu chăm sóc bé mèo của bạn 😺</p>
          <div className="auth-social-proof">
            <span>🐾 Tham gia cùng <strong>100+ khách hàng</strong> MeoCare</span>
            <span className="auth-proof-dot">·</span>
            <span>Miễn phí hoàn toàn</span>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {/* Họ tên + Username — 2 cột */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Họ và tên <span className="required">*</span></label>
              <div className="input-wrapper">
                <svg className="input-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
                <input
                  type="text"
                  name="fullName"
                  className="form-input form-input-icon"
                  placeholder="Nguyễn Văn A"
                  value={form.fullName}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Tên đăng nhập <span className="required">*</span></label>
              <div className="input-wrapper">
                <svg className="input-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                <input
                  type="text"
                  name="username"
                  className="form-input form-input-icon"
                  placeholder="vidu123"
                  value={form.username}
                  onChange={handleChange}
                  autoComplete="username"
                  required
                />
              </div>
            </div>
          </div>

          {/* Email + Phone — 2 cột */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Email <span className="required">*</span></label>
              <div className="input-wrapper">
                <svg className="input-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                </svg>
                <input
                  type="email"
                  name="email"
                  className="form-input form-input-icon"
                  placeholder="email@gmail.com"
                  value={form.email}
                  onChange={handleChange}
                  autoComplete="email"
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Số điện thoại</label>
              <div className="input-wrapper">
                <svg className="input-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.82a16 16 0 0 0 6.29 6.29l.97-.97a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                <input
                  type="tel"
                  name="phone"
                  className="form-input form-input-icon"
                  placeholder="09xxxxxxxx (tuỳ chọn)"
                  value={form.phone}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label">Mật khẩu <span className="required">*</span></label>
            <div className="input-wrapper">
              <svg className="input-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                className="form-input form-input-icon"
                placeholder="Tối thiểu 6 ký tự"
                value={form.password}
                onChange={handleChange}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
            {/* Password strength bar */}
            {strength && (
              <div className="password-strength">
                <div className="strength-bars">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="strength-bar"
                      style={{ backgroundColor: i <= strength.level ? strength.color : "#e5e7eb" }}
                    />
                  ))}
                </div>
                <span className="strength-label" style={{ color: strength.color }}>
                  {strength.label}
                </span>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="form-group">
            <label className="form-label">Xác nhận mật khẩu <span className="required">*</span></label>
            <div className="input-wrapper">
              <svg className="input-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <input
                type={showConfirm ? "text" : "password"}
                name="confirmPassword"
                className="form-input form-input-icon"
                placeholder="Nhập lại mật khẩu"
                value={form.confirmPassword}
                onChange={handleChange}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowConfirm(!showConfirm)}
                tabIndex={-1}
              >
                {showConfirm ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
            {/* Match indicator */}
            {form.confirmPassword && (
              <span className={`match-hint ${form.password === form.confirmPassword ? "match" : "no-match"}`}>
                {form.password === form.confirmPassword ? "✅ Mật khẩu khớp" : "❌ Chưa khớp"}
              </span>
            )}
          </div>

          {/* Terms */}
          <label className="terms-check">
            <input type="checkbox" required />
            <span>
              Tôi đồng ý với{" "}
              <a href="#terms" className="auth-link">Điều khoản dịch vụ</a>
              {" "}và{" "}
              <a href="#privacy" className="auth-link">Chính sách bảo mật</a>
            </span>
          </label>

          <div className="auth-security-badge">
            🔒 Thông tin của bạn được bảo mật tuyệt đối
          </div>

          <button
            type="submit"
            className={`btn-auth ${loading ? "loading" : ""}`}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner" />
                Đang đăng ký...
              </>
            ) : (
              <>
                <span>🎉</span> Tạo Tài Khoản
              </>
            )}
          </button>
        </form>

        <div className="auth-divider">
          <span>hoặc</span>
        </div>

        <div className="auth-switch">
          <p>
            Đã có tài khoản?{" "}
            <Link to="/login" className="auth-link">
              Đăng nhập ngay
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;