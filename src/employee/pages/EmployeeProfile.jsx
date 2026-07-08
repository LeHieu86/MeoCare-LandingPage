import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const getToken = () => localStorage.getItem("token");

// ── Danh sách ngân hàng VN phổ biến (tên + BIN VietQR) ─────────────────────
const BANKS = [
  { name: "Vietcombank",          bin: "970436" },
  { name: "Techcombank",          bin: "970407" },
  { name: "MB Bank",              bin: "970422" },
  { name: "BIDV",                 bin: "970418" },
  { name: "Vietinbank",           bin: "970415" },
  { name: "Agribank",             bin: "970405" },
  { name: "VPBank",               bin: "970432" },
  { name: "ACB",                  bin: "970416" },
  { name: "TPBank",               bin: "970423" },
  { name: "Sacombank",            bin: "970403" },
  { name: "HDBank",               bin: "970437" },
  { name: "SHB",                  bin: "970443" },
  { name: "OCB",                  bin: "970448" },
  { name: "MSB",                  bin: "970426" },
  { name: "SeABank",              bin: "970440" },
  { name: "Eximbank",             bin: "970431" },
  { name: "LienVietPostBank",     bin: "970449" },
  { name: "NCB",                  bin: "970419" },
  { name: "BacABank",             bin: "970409" },
  { name: "VietBank",             bin: "970433" },
];

// ── Modal đổi mật khẩu ──────────────────────────────────────────────────────
const PasswordModal = ({ onClose }) => {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [saving, setSaving] = useState(false);
  const [show, setShow] = useState({ cur: false, new: false, conf: false });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.newPassword.length < 6) { toast.error("Mật khẩu mới phải ≥ 6 ký tự."); return; }
    if (form.newPassword !== form.confirmPassword) { toast.error("Mật khẩu xác nhận không khớp."); return; }
    setSaving(true);
    const r = await fetch(`${API_BASE}/account/password`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(form),
    });
    const d = await r.json();
    if (r.ok && d.success) { toast.success("✅ Đổi mật khẩu thành công!"); onClose(); }
    else toast.error(d.message || "Lỗi đổi mật khẩu.");
    setSaving(false);
  };

  const fields = [
    { key: "currentPassword", label: "Mật khẩu hiện tại", showKey: "cur" },
    { key: "newPassword",     label: "Mật khẩu mới",       showKey: "new" },
    { key: "confirmPassword", label: "Xác nhận mật khẩu",  showKey: "conf" },
  ];

  return (
    <div className="emp-modal-overlay">
      <div className="emp-modal-card popup">
        <h3 className="emp-modal-title" style={{ fontSize: 17 }}>🔑 Đổi mật khẩu</h3>
        <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
          {fields.map(({ key, label, showKey }) => (
            <div key={key}>
              <label className="emp-form-label">{label}</label>
              <div className="emp-input-wrap">
                <input type={show[showKey] ? "text" : "password"} className="emp-input" style={{ paddingRight: 40 }}
                  value={form[key]} onChange={e => set(key, e.target.value)} required autoComplete="new-password" />
                <button type="button" onClick={() => setShow(s => ({ ...s, [showKey]: !s[showKey] }))} className="emp-eye-btn">
                  {show[showKey] ? "🙈" : "👁️"}
                </button>
              </div>
            </div>
          ))}
          <div className="emp-modal-actions" style={{ marginTop: 6 }}>
            <button type="button" onClick={onClose} className="emp-btn-ghost" style={{ flex: 1, padding: "11px 0", fontSize: 14 }}>
              Hủy
            </button>
            <button type="submit" disabled={saving} className="emp-btn-primary" style={{ flex: 1, fontSize: 14 }}>
              {saving ? "Đang lưu..." : "Đổi mật khẩu"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
const EmployeeProfile = () => {
  const navigate   = useNavigate();
  const fileRef    = useRef();

  const [user,            setUser]            = useState(null);
  const [empProfile,      setEmpProfile]      = useState(null);
  const [loading,         setLoading]         = useState(true);

  // ── Personal info edit ────────────────────────────────────────────────────
  const [editing,   setEditing]   = useState(false);
  const [infoForm,  setInfoForm]  = useState({ fullName: "", email: "", phone: "" });
  const [savingInfo, setSavingInfo] = useState(false);

  // ── Bank info edit ────────────────────────────────────────────────────────
  const [editingBank,  setEditingBank]  = useState(false);
  const [bankForm,     setBankForm]     = useState({ bankName: "", bankAccount: "", bankAccountName: "", bankBin: "" });
  const [savingBank,   setSavingBank]   = useState(false);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showPwdModal,    setShowPwdModal]    = useState(false);

  const setInfo = (k, v) => setInfoForm(f => ({ ...f, [k]: v }));
  const setBank = (k, v) => setBankForm(f => ({ ...f, [k]: v }));

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) { navigate("/login"); return; }
    setLoading(true);
    try {
      const [ur, er] = await Promise.all([
        fetch(`${API_BASE}/account/profile`,       { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/employees/me/profile`,  { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const ud = await ur.json();
      const ed = er.ok ? await er.json() : null;
      if (ur.ok && ud.user) {
        setUser(ud.user);
        setInfoForm({ fullName: ud.user.fullName || "", email: ud.user.email || "", phone: ud.user.phone || "" });
      }
      if (ed) {
        setEmpProfile(ed);
        setBankForm({
          bankName:        ed.bankName        || "",
          bankAccount:     ed.bankAccount     || "",
          bankAccountName: ed.bankAccountName || "",
          bankBin:         ed.bankBin         || "",
        });
      }
    } catch { toast.error("Không thể tải thông tin."); }
    setLoading(false);
  }, [navigate]);

  useEffect(() => { load(); }, [load]);

  // ── Khi chọn ngân hàng → tự điền BIN ─────────────────────────────────────
  const handleBankSelect = (name) => {
    const bank = BANKS.find(b => b.name === name);
    setBankForm(f => ({ ...f, bankName: name, bankBin: bank?.bin || f.bankBin }));
  };

  // ── Save personal info ────────────────────────────────────────────────────
  const saveInfo = async () => {
    if (!infoForm.fullName.trim()) { toast.error("Họ tên không được trống."); return; }
    setSavingInfo(true);
    const r = await fetch(`${API_BASE}/account/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(infoForm),
    });
    const d = await r.json();
    if (r.ok && d.success) {
      toast.success("✅ Cập nhật thành công!");
      setUser(d.user);
      const stored = JSON.parse(localStorage.getItem("user") || "{}");
      localStorage.setItem("user", JSON.stringify({ ...stored, ...d.user }));
      setEditing(false);
    } else toast.error(d.message || "Lỗi cập nhật.");
    setSavingInfo(false);
  };

  // ── Save bank info ────────────────────────────────────────────────────────
  const saveBank = async () => {
    if (bankForm.bankName && !bankForm.bankAccount) { toast.error("Vui lòng nhập số tài khoản."); return; }
    if (bankForm.bankAccount && !bankForm.bankName)  { toast.error("Vui lòng chọn ngân hàng."); return; }
    setSavingBank(true);
    const r = await fetch(`${API_BASE}/employees/me/bank`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(bankForm),
    });
    const d = await r.json();
    if (r.ok && d.success) {
      toast.success("✅ Cập nhật thông tin ngân hàng!");
      setEmpProfile(prev => ({ ...prev, ...d.employee }));
      setEditingBank(false);
    } else toast.error(d.error || "Lỗi cập nhật.");
    setSavingBank(false);
  };

  // ── Upload avatar ─────────────────────────────────────────────────────────
  const handleAvatarFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Ảnh tối đa 5 MB."); return; }
    setUploadingAvatar(true);
    const fd = new FormData();
    fd.append("avatar", file);
    const r = await fetch(`${API_BASE}/account/avatar`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${getToken()}` },
      body: fd,
    });
    const d = await r.json();
    if (r.ok && d.success) {
      toast.success("✅ Ảnh đại diện đã cập nhật!");
      setUser(u => ({ ...u, avatar: d.avatar }));
      const stored = JSON.parse(localStorage.getItem("user") || "{}");
      localStorage.setItem("user", JSON.stringify({ ...stored, avatar: d.avatar }));
    } else toast.error(d.message || "Upload thất bại.");
    setUploadingAvatar(false);
    e.target.value = "";
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  if (loading) return (
    <div className="emp-page">
      <div className="emp-skeleton-card" style={{ display: "flex", gap: 20, alignItems: "center" }}>
        <div className="emp-skeleton" style={{ width: 86, height: 86, borderRadius: "50%" }} />
        <div style={{ flex: 1 }}>
          <div className="emp-skeleton emp-skeleton-line" style={{ width: "50%" }} />
          <div className="emp-skeleton emp-skeleton-line" style={{ width: "30%" }} />
        </div>
      </div>
      <div className="emp-skeleton-card">
        <div className="emp-skeleton emp-skeleton-line" style={{ width: "40%" }} />
        <div className="emp-skeleton emp-skeleton-line" style={{ width: "70%" }} />
      </div>
    </div>
  );

  // ── VietQR URL (nếu có BIN) ───────────────────────────────────────────────
  const vietQrUrl = empProfile?.bankBin && empProfile?.bankAccount
    ? `https://img.vietqr.io/image/${empProfile.bankBin}-${empProfile.bankAccount}-qr_only.png?accountName=${encodeURIComponent(empProfile.bankAccountName || "")}`
    : null;

  const ROLE_LABEL = { admin: "Admin", manager: "Quản lý", employee: "Nhân viên" };
  const hasBankInfo = empProfile?.bankName && empProfile?.bankAccount;

  return (
    <div className="emp-page">
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarFile} />

      {/* ── Header ── */}
      <div className="emp-page-header">
        <h1 className="emp-page-title">👤 Tài Khoản</h1>
        <button onClick={load} className="emp-icon-btn">🔄</button>
      </div>

      {/* ── Avatar card ── */}
      <div className="emp-card emp-profile-card">
        <div className="emp-profile-avatar-wrap">
          <div className="emp-profile-avatar">
            {user?.avatar ? <img src={user.avatar} alt="" /> : "👤"}
          </div>
          <button onClick={() => fileRef.current?.click()} disabled={uploadingAvatar} className="emp-profile-avatar-edit">
            {uploadingAvatar ? "⏳" : "📷"}
          </button>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="emp-profile-name">{user?.fullName || user?.username}</div>
          <div style={{ color: "var(--emp-muted)", fontSize: 13, marginTop: 2 }}>@{user?.username}</div>
          <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span className="emp-badge is-primary">{ROLE_LABEL[user?.role] || user?.role}</span>
            {empProfile?.employeeCode && (
              <span className="emp-badge is-success">{empProfile.employeeCode}</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Thông tin cá nhân ── */}
      <div className="emp-card" style={{ marginBottom: 14 }}>
        <div className="emp-card-head" style={{ marginBottom: 18 }}>
          <div className="emp-card-title">📋 Thông tin cá nhân</div>
          {!editing ? (
            <button onClick={() => setEditing(true)} className="emp-edit-btn">✏️ Chỉnh sửa</button>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setEditing(false); setInfoForm({ fullName: user?.fullName || "", email: user?.email || "", phone: user?.phone || "" }); }}
                className="emp-btn-ghost">Hủy</button>
              <button onClick={saveInfo} disabled={savingInfo} className="emp-btn-primary" style={{ padding: "6px 14px", fontSize: 13 }}>
                {savingInfo ? "Đang lưu..." : "💾 Lưu"}
              </button>
            </div>
          )}
        </div>
        <div style={{ display: "grid", gap: 14 }}>
          <div className="emp-field-row">
            <label className="emp-form-label">Họ và tên</label>
            <input className="emp-field-input" value={infoForm.fullName} onChange={e => setInfo("fullName", e.target.value)} disabled={!editing} />
            {editing && <div className="emp-field-hint">Liên hệ admin nếu cần thay đổi họ tên.</div>}
          </div>
          <div className="emp-field-row">
            <label className="emp-form-label">Email</label>
            <input type="email" className="emp-field-input" value={infoForm.email} onChange={e => setInfo("email", e.target.value)} disabled={!editing} placeholder={editing ? "example@email.com" : "Chưa cập nhật"} />
          </div>
          <div className="emp-field-row">
            <label className="emp-form-label">Số điện thoại</label>
            <input type="tel" className="emp-field-input" value={infoForm.phone} onChange={e => setInfo("phone", e.target.value)} disabled={!editing} placeholder={editing ? "0xxxxxxxxx" : "Chưa cập nhật"} />
          </div>
          {empProfile && (
            <>
              <div className="emp-field-row">
                <label className="emp-form-label">Chức vụ</label>
                <div className="emp-field-static">{empProfile.position || "—"}</div>
              </div>
              {empProfile.department && (
                <div className="emp-field-row">
                  <label className="emp-form-label">Phòng ban</label>
                  <div className="emp-field-static">{empProfile.department}</div>
                </div>
              )}
              <div>
                <label className="emp-form-label">Loại nhân viên</label>
                <div style={{ padding: "10px 12px" }}>
                  <span className={`emp-badge ${empProfile.salaryType === "hourly" ? "is-warn" : "is-primary"}`}>
                    {empProfile.salaryType === "hourly" ? "⏱️ Part-time" : "📅 Full-time"}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Tài khoản ngân hàng ── */}
      <div className="emp-card" style={{ marginBottom: 14 }}>
        <div className="emp-card-head" style={{ marginBottom: 16, alignItems: "flex-start" }}>
          <div>
            <div className="emp-card-title">🏦 Tài khoản ngân hàng</div>
            <div style={{ color: "var(--emp-muted)", fontSize: 11, marginTop: 2 }}>Dùng để nhận lương chuyển khoản</div>
          </div>
          {!editingBank ? (
            <button onClick={() => setEditingBank(true)} className="emp-edit-btn">
              {hasBankInfo ? "✏️ Sửa" : "+ Thêm"}
            </button>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setEditingBank(false); setBankForm({ bankName: empProfile?.bankName || "", bankAccount: empProfile?.bankAccount || "", bankAccountName: empProfile?.bankAccountName || "", bankBin: empProfile?.bankBin || "" }); }}
                className="emp-btn-ghost">Hủy</button>
              <button onClick={saveBank} disabled={savingBank} className="emp-btn-primary" style={{ padding: "6px 14px", fontSize: 13 }}>
                {savingBank ? "Đang lưu..." : "💾 Lưu"}
              </button>
            </div>
          )}
        </div>

        {editingBank ? (
          /* ── Form chỉnh sửa ── */
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <label className="emp-form-label">Ngân hàng *</label>
              <select className="emp-select" value={bankForm.bankName} onChange={e => handleBankSelect(e.target.value)}>
                <option value="">— Chọn ngân hàng —</option>
                {BANKS.map(b => <option key={b.bin} value={b.name}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="emp-form-label">Số tài khoản *</label>
              <input type="text" inputMode="numeric" className="emp-input"
                value={bankForm.bankAccount}
                onChange={e => setBank("bankAccount", e.target.value.replace(/\D/g, ""))}
                placeholder="Nhập số tài khoản" />
            </div>
            <div>
              <label className="emp-form-label">Tên chủ tài khoản *</label>
              <input type="text" className="emp-input"
                value={bankForm.bankAccountName}
                onChange={e => setBank("bankAccountName", e.target.value.toUpperCase())}
                placeholder="VD: NGUYEN VAN A" />
              <div className="emp-field-hint">Nhập IN HOA, đúng tên trên tài khoản ngân hàng.</div>
            </div>
          </div>
        ) : hasBankInfo ? (
          /* ── Hiển thị thông tin ── */
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "grid", gap: 10 }}>
                {[
                  ["Ngân hàng",     empProfile?.bankName],
                  ["Số tài khoản",  empProfile?.bankAccount],
                  ["Chủ tài khoản", empProfile?.bankAccountName],
                ].map(([label, val]) => (
                  <div key={label}>
                    <div style={{ color: "var(--emp-muted)", fontSize: 11, fontWeight: 600 }}>{label}</div>
                    <div style={{ color: "var(--emp-text)", fontSize: 14, fontWeight: 600, marginTop: 2 }}>{val || "—"}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* VietQR */}
            {vietQrUrl && (
              <div style={{ flexShrink: 0, textAlign: "center" }}>
                <img src={vietQrUrl} alt="VietQR" style={{ width: 120, height: 120, borderRadius: 10, background: "#fff", padding: 4 }}
                  onError={e => { e.target.style.display = "none"; }} />
                <div style={{ color: "var(--emp-muted)", fontSize: 10, marginTop: 4 }}>VietQR</div>
              </div>
            )}
          </div>
        ) : (
          <div className="emp-empty" style={{ padding: "20px 0" }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>🏦</div>
            <p>Chưa có thông tin ngân hàng.<br /><span style={{ fontSize: 12 }}>Thêm để nhận lương qua chuyển khoản.</span></p>
          </div>
        )}
      </div>

      {/* ── Actions ── */}
      <div style={{ display: "grid", gap: 10 }}>
        <button onClick={() => setShowPwdModal(true)} className="emp-action-row">
          <span style={{ fontSize: 20 }}>🔑</span>
          <span>Đổi mật khẩu</span>
          <span className="emp-action-row-chevron">›</span>
        </button>
        <button onClick={logout} className="emp-action-row danger">
          <span style={{ fontSize: 20 }}>🚪</span>
          <span>Đăng xuất</span>
        </button>
      </div>

      {showPwdModal && <PasswordModal onClose={() => setShowPwdModal(false)} />}
    </div>
  );
};

export default EmployeeProfile;
