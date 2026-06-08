import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import authService from "../../utils/authService";
import "../../../styles/client/auth.css";

const Login = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: localStorage.getItem("mc_remember_user") || "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // Mặc định BẬT ghi nhớ → giữ đăng nhập tới khi người dùng tự đăng xuất
  const [remember, setRemember] = useState(true);
  const [showForgot, setShowForgot] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await authService.login(form.username, form.password, remember);

      const isPhone = /^0[3-9]\d{8}$/.test(form.username.trim());
      if (remember && !isPhone) {
        localStorage.setItem("mc_remember_user", form.username);
      } else {
        localStorage.removeItem("mc_remember_user");
      }

      // ── Trigger browser password popup ──
      triggerBrowserSave(form.username, form.password);

      toast.success("Đăng nhập thành công! 🎉");
      setTimeout(() => {
        const role = data.user.role;
        if (role === "admin") navigate("/admin");
        else if (["employee", "manager", "stock-manager"].includes(role)) navigate("/employee");
        else navigate("/dashboard"); // customer
      }, 500);
    } catch (err) {
      toast.error(err.message || "Đăng nhập thất bại");
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
          <div className="auth-social-proof">
            <span>🐾 <strong>100+</strong> khách hàng tin tưởng</span>
            <span className="auth-proof-dot">·</span>
            <span>⭐ 4.9 đánh giá</span>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} action="/login" method="POST">
          <div className="form-group">
            <label className="form-label" htmlFor="username">Tên đăng nhập hoặc số điện thoại</label>
            <div className="input-wrapper">
              <svg className="input-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              <input
                type="text"
                name="username"
                id="username"
                className="form-input form-input-icon"
                placeholder="Tên đăng nhập hoặc 0912..."
                value={form.username}
                onChange={handleChange}
                autoComplete="username"
                inputMode="text"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Mật khẩu</label>
            <div className="input-wrapper">
              <svg className="input-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                id="password"
                className="form-input form-input-icon"
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
            <button type="button" className="forgot-link" onClick={() => setShowForgot(true)}>Quên mật khẩu?</button>
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

      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
    </div>
  );
};

/* ── Modal Quên mật khẩu (tự phục vụ: xác minh email → đặt lại ngay) ── */
function ForgotPasswordModal({ onClose }) {
  const [form, setForm] = useState({ identifier: "", email: "", newPassword: "", confirm: "" });
  const [showPw, setShowPw] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.identifier.trim() || !form.email.trim() || !form.newPassword) {
      toast.error("Vui lòng nhập đầy đủ thông tin"); return;
    }
    if (form.newPassword.length < 6) { toast.error("Mật khẩu mới phải có ít nhất 6 ký tự"); return; }
    if (form.newPassword !== form.confirm) { toast.error("Mật khẩu xác nhận không khớp"); return; }
    setSending(true);
    try {
      await authService.forgotPassword(form.identifier.trim(), form.email.trim(), form.newPassword);
      setDone(true);
      toast.success("Đặt lại mật khẩu thành công!");
    } catch (err) {
      toast.error(err.message || "Có lỗi xảy ra");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="cl-backdrop" onClick={onClose}>
      <div className="cl-modal fp-modal" onClick={(e) => e.stopPropagation()}>
        <button className="fp-close" onClick={onClose} aria-label="Đóng">✕</button>

        {done ? (
          <div className="fp-done">
            <div className="fp-done-icon">✅</div>
            <h3>Đã đặt lại mật khẩu!</h3>
            <p>Bạn có thể đăng nhập ngay bằng mật khẩu mới vừa tạo.</p>
            <button className="btn-auth" onClick={onClose}>Đăng nhập ngay</button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="fp-head">
              <div className="fp-icon">🔑</div>
              <h3>Quên mật khẩu?</h3>
              <p>Xác minh bằng email đã đăng ký để tự đặt lại mật khẩu mới.</p>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="fp-id">Số điện thoại / Tên đăng nhập</label>
              <div className="input-wrapper">
                <svg className="input-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                <input id="fp-id" type="text" className="form-input form-input-icon"
                  placeholder="0912... hoặc tên đăng nhập"
                  value={form.identifier} onChange={(e) => set("identifier", e.target.value)} autoFocus required />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="fp-email">Email đã đăng ký</label>
              <div className="input-wrapper">
                <svg className="input-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16v16H4z" opacity="0"/><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>
                </svg>
                <input id="fp-email" type="email" className="form-input form-input-icon"
                  placeholder="email@example.com"
                  value={form.email} onChange={(e) => set("email", e.target.value)} required />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="fp-pw">Mật khẩu mới</label>
              <div className="input-wrapper">
                <svg className="input-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input id="fp-pw" type={showPw ? "text" : "password"} className="form-input form-input-icon"
                  placeholder="Ít nhất 6 ký tự"
                  value={form.newPassword} onChange={(e) => set("newPassword", e.target.value)} autoComplete="new-password" required />
                <button type="button" className="toggle-password" onClick={() => setShowPw(!showPw)} tabIndex={-1}>
                  {showPw ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="fp-confirm">Xác nhận mật khẩu mới</label>
              <div className="input-wrapper">
                <svg className="input-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input id="fp-confirm" type={showPw ? "text" : "password"} className="form-input form-input-icon"
                  placeholder="Nhập lại mật khẩu mới"
                  value={form.confirm} onChange={(e) => set("confirm", e.target.value)} autoComplete="new-password" required />
              </div>
            </div>

            <button type="submit" className={`btn-auth ${sending ? "loading" : ""}`} disabled={sending}>
              {sending ? <><span className="spinner" /> Đang xử lý...</> : <><span>🔓</span> Đặt lại mật khẩu</>}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default Login;