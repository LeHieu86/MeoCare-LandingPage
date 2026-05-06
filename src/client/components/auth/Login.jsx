import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import authService from "../../../../backend/services/authService";
import "../../../styles/client/auth.css";

const Login = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: localStorage.getItem("mc_remember_user") || "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(!!localStorage.getItem("mc_remember_user"));

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

      if (remember) {
        localStorage.setItem("mc_remember_user", form.username);
      } else {
        localStorage.removeItem("mc_remember_user");
      }

      // ── Trigger browser password popup ──
      triggerBrowserSave(form.username, form.password);

      setTimeout(() => {
        if (data.user.role === "admin") navigate("/admin");
        else navigate("/dashboard");
      }, 500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Đặt ngoài component hoặc cuối file
  function triggerBrowserSave(username, password) {
    const iframe = document.createElement("iframe");
    iframe.name = "pw-save-frame";
    iframe.style.cssText = "position:absolute;width:0;height:0;border:0;opacity:0;pointer-events:none";
    document.body.appendChild(iframe);

    const form = document.createElement("form");
    form.action = "/login";       // URL giả, iframe sẽ chặn navigation
    form.method = "POST";
    form.target = "pw-save-frame"; // submit vào iframe, không navigate trang chính

    const uInput = document.createElement("input");
    uInput.type = "text";
    uInput.name = "username";
    uInput.autocomplete = "username";
    uInput.value = username;

    const pInput = document.createElement("input");
    pInput.type = "password";
    pInput.name = "password";
    pInput.autocomplete = "current-password";
    pInput.value = password;

    form.appendChild(uInput);
    form.appendChild(pInput);
    document.body.appendChild(form);
    form.submit();

    // Cleanup sau 2s
    setTimeout(() => {
      form.remove();
      iframe.remove();
    }, 2000);
  }

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

      <div className="auth-card">
        <Link to="/" className="auth-logo">
          <span className="auth-logo-icon">🐱</span>
          <span className="auth-logo-text">Meo Care</span>
        </Link>

        <div className="auth-header">
          <h1 className="auth-title">Chào mừng trở lại!</h1>
          <p className="auth-subtitle">Đăng nhập để theo dõi bé yêu của bạn 🐾</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} action="/login" method="POST">
          {error && (
            <div className="auth-error">
              <span>⚠️</span> {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="username">Tên đăng nhập</label>
            <div className="input-wrapper">
              <span className="input-icon">👤</span>
              <input
                type="text"
                name="username"
                id="username"
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
            <label className="form-label" htmlFor="password">Mật khẩu</label>
            <div className="input-wrapper">
              <span className="input-icon">🔒</span>
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                id="password"
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
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
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