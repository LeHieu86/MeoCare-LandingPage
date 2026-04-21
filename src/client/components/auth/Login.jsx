import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import authService from "../../../../backend/services/authService"; // Giả sử bạn có service này để gọi API
import "../../../styles/client/auth.css";

const Login = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await authService.login(form.username, form.password);
      // Phân luồng theo role
      if (data.user.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Background blobs */}
      <div className="auth-bg">
        <div className="auth-blob blob-a" />
        <div className="auth-blob blob-b" />
        <div className="auth-blob blob-c" />
      </div>

      {/* Paw prints trang trí */}
      <div className="paw-decor paw-1">🐾</div>
      <div className="paw-decor paw-2">🐾</div>
      <div className="paw-decor paw-3">🐾</div>

      <div className="auth-card">
        {/* Logo */}
        <Link to="/" className="auth-logo">
          <span className="auth-logo-icon">🐱</span>
          <span className="auth-logo-text">Meo Care</span>
        </Link>

        <div className="auth-header">
          <h1 className="auth-title">Chào mừng trở lại!</h1>
          <p className="auth-subtitle">Đăng nhập để theo dõi bé yêu của bạn 🐾</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {/* Error message */}
          {error && (
            <div className="auth-error">
              <span>⚠️</span> {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Tên đăng nhập</label>
            <div className="input-wrapper">
              <span className="input-icon">👤</span>
              <input
                type="text"
                name="username"
                className="form-input"
                placeholder="Nhập tên đăng nhập"
                value={form.username}
                onChange={handleChange}
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Mật khẩu</label>
            <div className="input-wrapper">
              <span className="input-icon">🔒</span>
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                className="form-input"
                placeholder="Nhập mật khẩu"
                value={form.password}
                onChange={handleChange}
                autoComplete="current-password"
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
          </div>

          <div className="form-options">
            <label className="remember-me">
              <input type="checkbox" />
              <span>Ghi nhớ đăng nhập</span>
            </label>
            <a href="#forgot" className="forgot-link">Quên mật khẩu?</a>
          </div>

          <button
            type="submit"
            className={`btn-auth ${loading ? "loading" : ""}`}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner" />
                Đang đăng nhập...
              </>
            ) : (
              <>
                <span>🚀</span> Đăng Nhập
              </>
            )}
          </button>
        </form>

        <div className="auth-divider">
          <span>hoặc</span>
        </div>

        <div className="auth-switch">
          <p>
            Chưa có tài khoản?{" "}
            <Link to="/register" className="auth-link">
              Đăng ký ngay
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;