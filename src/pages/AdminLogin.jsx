import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { adminAPI } from "../hooks/useProducts";
import "../styles/admin.css";

const AdminLogin = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect
  useEffect(() => {
    const token = localStorage.getItem("mc_admin_token");
    if (token) {
      adminAPI.verifyToken().then((res) => {
        if (res.valid) navigate("/admin");
      });
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await adminAPI.login(form.username, form.password);
      if (res.token) {
        localStorage.setItem("mc_admin_token", res.token);
        navigate("/admin");
      } else {
        setError(res.error || "Đăng nhập thất bại.");
      }
    } catch {
      setError("Không thể kết nối đến server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="adm-login-wrap">
      <div className="adm-login-card">
        <div className="adm-login-brand">
          <span className="adm-brand-icon">🐱</span>
          <span className="adm-brand-name">Meo Care</span>
          <span className="adm-brand-tag">Admin</span>
        </div>

        <h1 className="adm-login-title">Đăng nhập</h1>
        <p className="adm-login-sub">Quản lý sản phẩm Meo Care</p>

        <form className="adm-login-form" onSubmit={handleSubmit}>
          <div className="adm-field">
            <label className="adm-label">Tên đăng nhập</label>
            <input
              className="adm-input"
              type="text"
              autoComplete="username"
              placeholder="admin"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
          </div>

          <div className="adm-field">
            <label className="adm-label">Mật khẩu</label>
            <input
              className="adm-input"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>

          {error && <div className="adm-error">{error}</div>}

          <button className="adm-login-btn" type="submit" disabled={loading}>
            {loading ? <span className="adm-spinner" /> : "Đăng nhập →"}
          </button>
        </form>

        <a href="/" className="adm-back-link">← Quay về trang sản phẩm</a>
      </div>
    </div>
  );
};

export default AdminLogin;