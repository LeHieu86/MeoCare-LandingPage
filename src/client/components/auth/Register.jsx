import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import authService from "../../../../backend/services/authService";
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
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
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
      setError(validationError);
      return;
    }
    setLoading(true);
    setError("");
    try {
      await authService.register({
        fullName: form.fullName,
        username: form.username,
        email: form.email,
        phone: form.phone || undefined,
        password: form.password,
      });
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
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
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && (
            <div className="auth-error">
              <span>⚠️</span> {error}
            </div>
          )}

          {/* Họ tên + Username — 2 cột */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Họ và tên <span className="required">*</span></label>
              <div className="input-wrapper">
                <span className="input-icon">✏️</span>
                <input
                  type="text"
                  name="fullName"
                  className="form-input"
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
                <span className="input-icon">👤</span>
                <input
                  type="text"
                  name="username"
                  className="form-input"
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
                <span className="input-icon">✉️</span>
                <input
                  type="email"
                  name="email"
                  className="form-input"
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
                <span className="input-icon">📞</span>
                <input
                  type="tel"
                  name="phone"
                  className="form-input"
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
              <span className="input-icon">🔒</span>
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                className="form-input"
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
                {showPassword ? "🙈" : "👁️"}
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
              <span className="input-icon">🔐</span>
              <input
                type={showConfirm ? "text" : "password"}
                name="confirmPassword"
                className="form-input"
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
                {showConfirm ? "🙈" : "👁️"}
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