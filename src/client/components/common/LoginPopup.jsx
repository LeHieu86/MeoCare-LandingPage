import React, { useState } from "react";
import "../../../styles/client/login-popup.css";

const API = "/api";

const LoginPopup = ({ onSuccess, onClose }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Vui lòng nhập đầy đủ thông tin");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Đăng nhập thất bại");
      }

      onSuccess(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-popup-overlay" onClick={onClose}>
      <div className="login-popup" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <button className="login-popup-close" onClick={onClose}>
          ✕
        </button>

        <div className="login-popup-icon">🔒</div>
        <h2 className="login-popup-title">Phiên đăng nhập đã hết hạn</h2>
        <p className="login-popup-subtitle">
          Vui lòng đăng nhập lại để tiếp tục
        </p>

        {/* Error */}
        {error && (
          <div className="login-popup-error">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Form */}
        <div className="login-popup-form" >
          <div className="login-popup-field">
            <label>Tên đăng nhập</label>
            <div className="login-popup-input-wrap">
              <span className="login-popup-input-icon">👤</span>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (error) setError("");
                }}
                placeholder="Nhập tên đăng nhập..."
                autoFocus
                disabled={loading}
              />
            </div>
          </div>

          <div className="login-popup-field">
            <label>Mật khẩu</label>
            <div className="login-popup-input-wrap">
              <span className="login-popup-input-icon">🔑</span>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError("");
                }}
                placeholder="Nhập mật khẩu..."
                disabled={loading}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit(e)}
              />
              <button
                type="button"
                className="login-popup-toggle-pw"
                onClick={() => setShowPassword((s) => !s)}
                tabIndex={-1}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <button
            className="login-popup-submit"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <span className="login-popup-spinner" />
            ) : (
              "Đăng nhập"
            )}
          </button>
        </div>

        <p className="login-popup-hint">
          Đăng nhập xong bạn sẽ tiếp tục thao tác ngay tại đây
        </p>
      </div>
    </div>
  );
};

export default LoginPopup;