/**
 * EmployeeSessionModal — Hiện khi JWT nhân viên hết hạn (401)
 * Cho phép đăng nhập lại ngay tại trang mà không mất trạng thái.
 */
import React, { useState } from "react";
import toast from "react-hot-toast";

const API = import.meta.env.VITE_API_URL || "/api";

const ALLOWED_ROLES = ["employee", "manager", "stock-manager", "admin"];

export default function EmployeeSessionModal({ onSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) { setError("Vui lòng nhập đầy đủ thông tin"); return; }
    setLoading(true);
    setError("");
    try {
      const res  = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password, remember: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.token) throw new Error(data.error || "Đăng nhập thất bại");
      if (!ALLOWED_ROLES.includes(data.user?.role))
        throw new Error("Tài khoản không có quyền truy cập cổng nhân viên");

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      toast.success(`Xin chào lại, ${data.user.fullName || data.user.username}!`);
      onSuccess(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="emp-modal-overlay z-top">
      <div className="emp-modal-card narrow">
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>🔐</div>
          <h2 style={{ color: "var(--emp-text)", margin: 0, fontSize: 20, fontWeight: 700 }}>Phiên làm việc hết hạn</h2>
          <p style={{ color: "var(--emp-muted)", fontSize: 13, margin: "8px 0 0" }}>
            Đăng nhập lại để tiếp tục
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="emp-modal-error">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label className="emp-form-label">TÊN ĐĂNG NHẬP</label>
            <input
              className="emp-input"
              value={username}
              onChange={e => { setUsername(e.target.value); setError(""); }}
              placeholder="Tên đăng nhập..."
              autoFocus
              disabled={loading}
            />
          </div>

          <div style={{ marginBottom: 22 }}>
            <label className="emp-form-label">MẬT KHẨU</label>
            <div className="emp-input-wrap">
              <input
                className="emp-input"
                style={{ paddingRight: 44 }}
                type={showPw ? "text" : "password"}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(""); }}
                placeholder="••••••••"
                disabled={loading}
              />
              <button type="button" onClick={() => setShowPw(s => !s)} className="emp-eye-btn">
                {showPw ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="emp-btn-primary emp-btn-block">
            {loading ? "Đang đăng nhập..." : "Đăng nhập lại"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: "var(--emp-faint)" }}>
          Hoặc{" "}
          <a href="/login" style={{ color: "var(--emp-primary)", textDecoration: "none" }}>chuyển về trang đăng nhập</a>
        </p>
      </div>
    </div>
  );
}
