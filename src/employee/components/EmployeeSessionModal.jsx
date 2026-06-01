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
    <div style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", backdropFilter:"blur(4px)",
      display:"flex", alignItems:"center", justifyContent:"center", zIndex:99999,
      fontFamily:"'Nunito',sans-serif",
    }}>
      <div style={{
        background:"#1a1d2e", border:"1px solid #2d3154", borderRadius:20,
        padding:"36px 32px", width:370, boxShadow:"0 24px 80px rgba(0,0,0,0.6)",
      }}>
        {/* Header */}
        <div style={{ textAlign:"center", marginBottom:24 }}>
          <div style={{ fontSize:44, marginBottom:10 }}>🔐</div>
          <h2 style={{ color:"#e8eaf0", margin:0, fontSize:20, fontWeight:700 }}>Phiên làm việc hết hạn</h2>
          <p style={{ color:"#8b90a7", fontSize:13, margin:"8px 0 0" }}>
            Đăng nhập lại để tiếp tục
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background:"rgba(239,68,68,.1)", border:"1px solid rgba(239,68,68,.3)",
            borderRadius:10, padding:"10px 14px", marginBottom:18,
            color:"#ef4444", fontSize:13, display:"flex", gap:8,
          }}>
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom:14 }}>
            <label style={{ color:"#8b90a7", fontSize:12, display:"block", marginBottom:6, fontWeight:600 }}>
              TÊN ĐĂNG NHẬP
            </label>
            <input
              value={username}
              onChange={e => { setUsername(e.target.value); setError(""); }}
              placeholder="Tên đăng nhập..."
              autoFocus
              disabled={loading}
              style={{
                width:"100%", boxSizing:"border-box", padding:"11px 14px",
                background:"#0f1117", border:"1px solid #2d3154", borderRadius:10,
                color:"#e8eaf0", fontSize:14, outline:"none",
              }}
            />
          </div>

          <div style={{ marginBottom:22 }}>
            <label style={{ color:"#8b90a7", fontSize:12, display:"block", marginBottom:6, fontWeight:600 }}>
              MẬT KHẨU
            </label>
            <div style={{ position:"relative" }}>
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(""); }}
                placeholder="••••••••"
                disabled={loading}
                style={{
                  width:"100%", boxSizing:"border-box", padding:"11px 44px 11px 14px",
                  background:"#0f1117", border:"1px solid #2d3154", borderRadius:10,
                  color:"#e8eaf0", fontSize:14, outline:"none",
                }}
              />
              <button type="button" onClick={() => setShowPw(s => !s)}
                style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)",
                  background:"none", border:"none", cursor:"pointer", fontSize:16, opacity:.6 }}>
                {showPw ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width:"100%", padding:"13px", fontSize:15, fontWeight:700,
              background:"#5b7cf6", color:"#fff", border:"none", borderRadius:12,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? .7 : 1, transition:"opacity .2s",
            }}
          >
            {loading ? "Đang đăng nhập..." : "Đăng nhập lại"}
          </button>
        </form>

        <p style={{ textAlign:"center", marginTop:16, fontSize:12, color:"#6b7280" }}>
          Hoặc{" "}
          <a href="/login" style={{ color:"#5b7cf6", textDecoration:"none" }}>chuyển về trang đăng nhập</a>
        </p>
      </div>
    </div>
  );
}
