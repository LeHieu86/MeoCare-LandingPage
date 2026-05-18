import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api, { getUser, setUser } from "../../utils/api";
import { VN_BANKS } from "../../utils/bankList";
import "../../../styles/client/account.css";

const ROLE_LABEL = {
  customer: { text: "Khách hàng", color: "#FF9B71" },
  admin:    { text: "Quản trị",   color: "#6366f1" },
  staff:    { text: "Nhân viên",  color: "#22c55e" },
};

const getInitials = (fullName = "") =>
  fullName.split(" ").filter(Boolean).slice(-2).map((w) => w[0].toUpperCase()).join("");

const formatDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

/* ══════════════════════════════════════════════════
   BANK INFO MODAL — STK ngân hàng để hoàn tiền
   ══════════════════════════════════════════════════ */
const BankInfoModal = ({ user, onClose, onSaved }) => {
  const [form, setForm] = useState({
    bank_code: VN_BANKS.find(b => b.name === user.bank_name)?.code || "",
    bank_account: user.bank_account || "",
    bank_holder: user.bank_holder || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    const bank = VN_BANKS.find(b => b.code === form.bank_code);
    if (!bank) { setError("Chọn ngân hàng"); return; }
    if (!/^\d{6,20}$/.test(form.bank_account.trim())) { setError("STK phải là 6-20 chữ số"); return; }
    if (!form.bank_holder.trim()) { setError("Nhập tên chủ tài khoản"); return; }
    setSaving(true);
    try {
      const data = await api.put("/account/bank", {
        bank_name: bank.name,
        bank_account: form.bank_account.trim(),
        bank_holder: form.bank_holder.trim().toUpperCase(),
        bank_bin: bank.bin,
      });
      if (data.success) { onSaved(data.user); onClose(); }
      else setError(data.message || "Lưu thất bại");
    } catch (e) { setError(e.message || "Lỗi kết nối"); }
    finally { setSaving(false); }
  };

  const handleClear = async () => {
    if (!window.confirm("Xóa thông tin STK đã lưu?")) return;
    setSaving(true);
    try {
      const data = await api.put("/account/bank", { bank_name: "", bank_account: "", bank_holder: "", bank_bin: "" });
      if (data.success) { onSaved(data.user); onClose(); }
    } finally { setSaving(false); }
  };

  return (
    <div className="cl-backdrop" onClick={onClose}>
      <div className="cl-modal bm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bm-header">
          <h3 className="bm-title">🏦 Tài khoản ngân hàng</h3>
          <button className="bm-close" onClick={onClose} aria-label="Đóng">✕</button>
        </div>
        <p className="bm-hint">
          Dùng để nhận tiền hoàn khi đơn bị hủy. Có thể để trống nếu chưa cần.
        </p>

        <div className="bm-body">
          <div className="bm-field">
            <label className="bm-label">Ngân hàng</label>
            <select
              className="bm-input"
              value={form.bank_code}
              onChange={(e) => setForm({ ...form, bank_code: e.target.value })}
            >
              <option value="">— Chọn ngân hàng —</option>
              {VN_BANKS.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
            </select>
          </div>
          <div className="bm-field">
            <label className="bm-label">Số tài khoản</label>
            <input
              className="bm-input"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={form.bank_account}
              onChange={(e) => setForm({ ...form, bank_account: e.target.value.replace(/\D/g, "") })}
              placeholder="9704..."
            />
          </div>
          <div className="bm-field">
            <label className="bm-label">Tên chủ tài khoản (in hoa)</label>
            <input
              className="bm-input"
              type="text"
              autoComplete="off"
              value={form.bank_holder}
              onChange={(e) => setForm({ ...form, bank_holder: e.target.value })}
              placeholder="NGUYEN VAN A"
              style={{ textTransform: "uppercase" }}
            />
          </div>
        </div>

        {error && <div className="bm-error">{error}</div>}

        <div className="bm-actions">
          {user.bank_account && (
            <button className="bm-btn bm-btn-clear" onClick={handleClear} disabled={saving}>
              🗑 Xóa STK
            </button>
          )}
          <button className="bm-btn bm-btn-ghost" onClick={onClose} disabled={saving}>Hủy</button>
          <button className="bm-btn bm-btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════
   CHANGE PASSWORD MODAL
   ══════════════════════════════════════════════════ */
const ChangePasswordModal = ({ onClose }) => {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError(""); setSuccess("");
  };

  const getStrength = (pw) => {
    if (!pw) return { level: 0, label: "", color: "" };
    let score = 0;
    if (pw.length >= 6) score++;
    if (pw.length >= 10) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 1) return { level: 1, label: "Yếu", color: "#ef4444" };
    if (score <= 2) return { level: 2, label: "Trung bình", color: "#f59e0b" };
    if (score <= 3) return { level: 3, label: "Khá", color: "#3b82f6" };
    return { level: 4, label: "Mạnh", color: "#22c55e" };
  };

  const strength = getStrength(form.newPassword);
  const passwordsMatch = form.newPassword && form.confirmPassword && form.newPassword === form.confirmPassword;
  const passwordsMismatch = form.confirmPassword && !passwordsMatch;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) { setError("Vui lòng điền đầy đủ"); return; }
    if (form.newPassword.length < 6) { setError("Mật khẩu mới ít nhất 6 ký tự"); return; }
    if (form.newPassword !== form.confirmPassword) { setError("Mật khẩu xác nhận không khớp"); return; }
    setSaving(true); setError("");
    try {
      const data = await api.put("/account/password", form);
      if (data.success) {
        setSuccess("Đổi mật khẩu thành công!");
        setTimeout(() => onClose(), 1500);
      }
    } catch (err) {
      setError(err.message || "Đổi mật khẩu thất bại");
    } finally { setSaving(false); }
  };

  return (
    <div className="cl-backdrop" onClick={onClose}>
      <div className="cl-modal ai-pw-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ai-pw-modal-header">
          <h3>🔐 Đổi mật khẩu</h3>
          <button className="cl-btn-icon" onClick={onClose}>✕</button>
        </div>

        <form className="ai-pw-modal-body" onSubmit={handleSubmit}>
          <div className="cl-form-group">
            <label className="cl-label">Mật khẩu hiện tại *</label>
            <div className="ai-input-wrap">
              <input className="cl-input" type={showCurrent ? "text" : "password"}
                name="currentPassword" value={form.currentPassword} onChange={handleChange}
                placeholder="Nhập mật khẩu hiện tại" autoComplete="current-password" />
              <button type="button" className="ai-eye-btn" onClick={() => setShowCurrent(!showCurrent)}>
                {showCurrent ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <hr className="cl-divider" />

          <div className="cl-form-group">
            <label className="cl-label">Mật khẩu mới *</label>
            <div className="ai-input-wrap">
              <input className="cl-input" type={showNew ? "text" : "password"}
                name="newPassword" value={form.newPassword} onChange={handleChange}
                placeholder="Ít nhất 6 ký tự" autoComplete="new-password" />
              <button type="button" className="ai-eye-btn" onClick={() => setShowNew(!showNew)}>
                {showNew ? "🙈" : "👁️"}
              </button>
            </div>
            {form.newPassword && (
              <div className="ai-pw-strength">
                <div className="ai-pw-bars">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="ai-pw-bar"
                      style={{ background: i <= strength.level ? strength.color : "var(--cl-border)" }} />
                  ))}
                </div>
                <span className="ai-pw-label" style={{ color: strength.color }}>{strength.label}</span>
              </div>
            )}
          </div>

          <div className="cl-form-group">
            <label className="cl-label">Xác nhận mật khẩu mới *</label>
            <input
              className={`cl-input ${passwordsMismatch ? "ai-input-error" : ""} ${passwordsMatch ? "ai-input-success" : ""}`}
              type="password" name="confirmPassword" value={form.confirmPassword}
              onChange={handleChange} placeholder="Nhập lại mật khẩu mới" autoComplete="new-password" />
            {passwordsMatch && <span className="ai-hint-ok">✓ Khớp</span>}
            {passwordsMismatch && <span className="ai-hint-err">✗ Không khớp</span>}
          </div>

          {error && <div className="cl-alert cl-alert-error">{error}</div>}
          {success && <div className="cl-alert cl-alert-success">{success}</div>}

          <div className="ai-modal-actions">
            <button type="button" className="cl-btn cl-btn-ghost" onClick={onClose}>Hủy</button>
            <button type="submit" className="cl-btn cl-btn-primary" disabled={saving}>
              {saving ? "Đang xử lý..." : "Đổi mật khẩu"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════
   MAIN ACCOUNT INFO
   ══════════════════════════════════════════════════ */
const AccountInfo = ({ onLogout }) => {
  const navigate = useNavigate();
  const avatarRef = useRef(null);
  const [user, setUserState] = useState(getUser());
  const [loading, setLoading] = useState(true);
  const [avatarUploading, setAvatarUploading] = useState(false);

  /* Edit mode */
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ fullName: "", email: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  /* Modals */
  const [showLogout, setShowLogout] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showBank, setShowBank] = useState(false);

  /* ── Fetch profile ── */
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await api.get("/account/profile");
        if (data.success) {
          setUserState(data.user);
          const stored = getUser();
          if (stored) setUser({ ...stored, ...data.user });
        }
      } catch { /* api.js xử lý 401 */ }
      finally { setLoading(false); }
    };
    fetchProfile();
  }, []);

  /* ── Avatar upload ── */
  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const token = localStorage.getItem("token");
      const res = await fetch("/api/account/avatar", {
        method: "PUT",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setUserState((prev) => ({ ...prev, avatar: data.avatar }));
        const stored = getUser();
        if (stored) setUser({ ...stored, avatar: data.avatar });
      }
    } catch (err) {
      console.error("Upload avatar thất bại:", err);
    } finally {
      setAvatarUploading(false);
      if (avatarRef.current) avatarRef.current.value = "";
    }
  };

  /* ── Inline edit ── */
  const startEdit = () => {
    setEditForm({
      fullName: user.fullName || "",
      email: user.email || "",
      phone: user.phone && user.phone !== "Null" ? user.phone : "",
    });
    setEditing(true);
    setMessage(null);
  };

  const cancelEdit = () => { setEditing(false); setMessage(null); };

  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
    setMessage(null);
  };

  const handleSave = async () => {
    if (!editForm.fullName.trim()) { setMessage({ type: "error", text: "Họ tên không được trống" }); return; }
    setSaving(true); setMessage(null);
    try {
      const data = await api.put("/account/profile", editForm);
      if (data.success) {
        setUserState(data.user);
        const stored = getUser();
        if (stored) setUser({ ...stored, ...data.user });
        setEditing(false);
        setMessage({ type: "success", text: "Cập nhật thành công!" });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Cập nhật thất bại" });
    } finally { setSaving(false); }
  };

  /* ── Logout ── */
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    if (onLogout) onLogout();
    else navigate("/");
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="ai-container">
        <div className="cl-empty">
          <div className="cl-spinner cl-spinner-dark" style={{ margin: "0 auto" }} />
          <p style={{ marginTop: 12 }}>Đang tải thông tin...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="ai-container">
        <div className="cl-empty">
          <div className="cl-empty-icon">🔒</div>
          <p>Vui lòng đăng nhập để xem thông tin tài khoản</p>
        </div>
      </div>
    );
  }

  const roleInfo = ROLE_LABEL[user.role] || ROLE_LABEL.customer;
  const initials = getInitials(user.fullName) || user.username?.[0]?.toUpperCase() || "?";

  return (
    <div className="ai-container">
      {/* ── PROFILE HEADER + AVATAR UPLOAD ── */}
      <div className="ai-header-card">
        <div
          className="ai-avatar"
          style={{ background: `linear-gradient(135deg, #FFB899 0%, ${roleInfo.color} 100%)` }}
          onClick={() => !avatarUploading && avatarRef.current?.click()}
        >
          {user.avatar ? (
            <img src={user.avatar} alt="avatar" className="ai-avatar-img" />
          ) : (
            initials
          )}
          <div className="ai-avatar-overlay">
            {avatarUploading ? "⏳" : "📷"}
          </div>
          <input ref={avatarRef} type="file" accept="image/jpeg,image/png,image/webp"
            onChange={handleAvatarUpload} hidden />
        </div>
        <div className="ai-header-info">
          <h2 className="ai-fullname">{user.fullName || user.username}</h2>
          <span className="ai-role-badge" style={{ background: roleInfo.color }}>{roleInfo.text}</span>
          <p className="ai-username">@{user.username}</p>
        </div>
      </div>

      {/* ── THÔNG TIN CÁ NHÂN — inline edit ── */}
      <div className="cl-card">
        <div className="ai-section-header">
          <h3 className="ai-section-title">Thông tin cá nhân</h3>
          {!editing && (
            <button className="ai-edit-btn" onClick={startEdit}>✏️ Sửa</button>
          )}
        </div>

        {message && (
          <div className={`cl-alert ${message.type === "success" ? "cl-alert-success" : "cl-alert-error"}`}>
            {message.text}
          </div>
        )}

        {editing ? (
          <div className="ai-edit-form">
            <div className="ai-edit-row">
              <span className="ai-info-icon">👤</span>
              <div className="ai-edit-field">
                <label className="ai-info-label">Họ và tên *</label>
                <input className="cl-input" type="text" name="fullName"
                  value={editForm.fullName} onChange={handleEditChange} placeholder="Nguyễn Văn A" />
              </div>
            </div>

            <div className="ai-edit-row">
              <span className="ai-info-icon">📧</span>
              <div className="ai-edit-field">
                <label className="ai-info-label">Email</label>
                <input className="cl-input" type="email" name="email"
                  value={editForm.email} onChange={handleEditChange} placeholder="email@example.com" />
              </div>
            </div>

            <div className="ai-edit-row">
              <span className="ai-info-icon">📞</span>
              <div className="ai-edit-field">
                <label className="ai-info-label">Số điện thoại</label>
                <input className="cl-input" type="tel" name="phone"
                  value={editForm.phone} onChange={handleEditChange} placeholder="0912 345 678" maxLength={10} />
              </div>
            </div>

            <div className="ai-edit-row ai-edit-readonly">
              <span className="ai-info-icon">🔑</span>
              <div className="ai-edit-field">
                <label className="ai-info-label">Tên đăng nhập</label>
                <span className="ai-info-value">{user.username}</span>
              </div>
            </div>

            <div className="ai-edit-actions">
              <button className="cl-btn cl-btn-ghost" onClick={cancelEdit} disabled={saving}>Hủy</button>
              <button className="cl-btn cl-btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        ) : (
          <div className="ai-info-list">
            <InfoRow icon="👤" label="Họ và tên" value={user.fullName || "Chưa cập nhật"} />
            <InfoRow icon="📧" label="Email" value={user.email || "Chưa cập nhật"} />
            <InfoRow icon="📞" label="Số điện thoại" value={user.phone && user.phone !== "Null" ? user.phone : "Chưa cập nhật"} />
            <InfoRow icon="🔑" label="Tên đăng nhập" value={user.username} />
            <InfoRow icon="📅" label="Ngày tạo" value={formatDate(user.created_at)} />
          </div>
        )}
      </div>

      {/* ── TÀI KHOẢN NGÂN HÀNG ── */}
      <div className="cl-card">
        <h3 className="ai-section-title">🏦 Tài khoản ngân hàng (hoàn tiền)</h3>
        {user.bank_account ? (
          <div className="ai-info-list">
            <InfoRow icon="🏦" label="Ngân hàng" value={user.bank_name} />
            <InfoRow icon="🔢" label="Số tài khoản" value={user.bank_account} />
            <InfoRow icon="👤" label="Chủ tài khoản" value={user.bank_holder} />
          </div>
        ) : (
          <p className="cl-text-muted" style={{ fontSize: 13, margin: 0 }}>
            Chưa lưu STK. Thêm để được hoàn tiền nhanh khi đơn bị hủy.
          </p>
        )}
        <button
          className="cl-btn cl-btn-ghost"
          onClick={() => setShowBank(true)}
          style={{ marginTop: 12, width: "100%" }}
        >
          {user.bank_account ? "✏️ Sửa STK" : "+ Thêm STK ngân hàng"}
        </button>
      </div>

      {/* ── TÀI KHOẢN ── */}
      <div className="cl-card">
        <h3 className="ai-section-title">Tài khoản</h3>
        <div className="ai-action-list">
          <button className="ai-action-btn" onClick={() => setShowPassword(true)}>
            <span className="ai-action-icon">🔐</span>
            <span className="ai-action-label">Đổi mật khẩu</span>
            <span className="ai-action-arrow">→</span>
          </button>
          <button className="ai-action-btn ai-action-logout" onClick={() => setShowLogout(true)}>
            <span className="ai-action-icon">🚪</span>
            <span className="ai-action-label">Đăng xuất</span>
          </button>
        </div>
      </div>

      {/* ── MODALS ── */}
      {showBank && <BankInfoModal user={user} onClose={() => setShowBank(false)} onSaved={setUserState} />}
      {showPassword && <ChangePasswordModal onClose={() => setShowPassword(false)} />}

      {showLogout && (
        <div className="cl-backdrop" onClick={() => setShowLogout(false)}>
          <div className="cl-modal ai-logout-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ai-logout-icon">🚪</div>
            <h3>Đăng xuất?</h3>
            <p className="cl-text-muted">Bạn có chắc muốn đăng xuất?</p>
            <div className="ai-modal-actions">
              <button className="cl-btn cl-btn-ghost" onClick={() => setShowLogout(false)}>Hủy</button>
              <button className="cl-btn ai-btn-danger" onClick={handleLogout}>Đăng xuất</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const InfoRow = ({ icon, label, value }) => (
  <div className="ai-info-row">
    <span className="ai-info-icon">{icon}</span>
    <div className="ai-info-content">
      <span className="ai-info-label">{label}</span>
      <span className="ai-info-value">{value}</span>
    </div>
  </div>
);

export default AccountInfo;