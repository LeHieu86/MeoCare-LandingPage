import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useIsMobile } from "../hooks/useIsMobile";

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

  const inputSt = {
    width: "100%", background: "#0f1117", border: "1px solid #2d3154",
    borderRadius: 8, padding: "10px 40px 10px 12px", color: "#e8eaf0",
    fontSize: 16, boxSizing: "border-box",
  };

  const fields = [
    { key: "currentPassword", label: "Mật khẩu hiện tại", showKey: "cur" },
    { key: "newPassword",     label: "Mật khẩu mới",       showKey: "new" },
    { key: "confirmPassword", label: "Xác nhận mật khẩu",  showKey: "conf" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#1a1d2e", border: "1px solid #2d3154", borderRadius: 20, padding: 28, width: "100%", maxWidth: 400 }}>
        <h3 style={{ color: "#e8eaf0", margin: "0 0 20px", fontSize: 17 }}>🔑 Đổi mật khẩu</h3>
        <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
          {fields.map(({ key, label, showKey }) => (
            <div key={key}>
              <label style={{ display: "block", color: "#8b90a7", fontSize: 12, marginBottom: 6, fontWeight: 600 }}>{label}</label>
              <div style={{ position: "relative" }}>
                <input type={show[showKey] ? "text" : "password"} style={inputSt}
                  value={form[key]} onChange={e => set(key, e.target.value)} required autoComplete="new-password" />
                <button type="button" onClick={() => setShow(s => ({ ...s, [showKey]: !s[showKey] }))}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#8b90a7", cursor: "pointer", fontSize: 16, padding: 4 }}>
                  {show[showKey] ? "🙈" : "👁️"}
                </button>
              </div>
            </div>
          ))}
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: "11px 0", background: "transparent", color: "#8b90a7", border: "1px solid #2d3154", borderRadius: 10, cursor: "pointer", fontSize: 14 }}>
              Hủy
            </button>
            <button type="submit" disabled={saving}
              style={{ flex: 1, padding: "11px 0", background: "#5b7cf6", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 14 }}>
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
  const isMobile   = useIsMobile();
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
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "80vh", color: "#8b90a7" }}>Đang tải...</div>
  );

  // ── VietQR URL (nếu có BIN) ───────────────────────────────────────────────
  const vietQrUrl = empProfile?.bankBin && empProfile?.bankAccount
    ? `https://img.vietqr.io/image/${empProfile.bankBin}-${empProfile.bankAccount}-qr_only.png?accountName=${encodeURIComponent(empProfile.bankAccountName || "")}`
    : null;

  const inputSt = (editable) => ({
    width: "100%", background: editable ? "#0f1117" : "transparent",
    border: editable ? "1px solid #2d3154" : "1px solid transparent",
    borderRadius: 8, padding: "10px 12px", color: "#e8eaf0",
    fontSize: 16, boxSizing: "border-box", transition: "all .2s",
  });
  const labelSt = { display: "block", color: "#8b90a7", fontSize: 12, marginBottom: 5, fontWeight: 600 };
  const rowSt   = { paddingBottom: 14, borderBottom: "1px solid #1e2138" };
  const ROLE_LABEL = { admin: "Admin", manager: "Quản lý", employee: "Nhân viên" };

  const hasBankInfo = empProfile?.bankName && empProfile?.bankAccount;

  return (
    <div className="emp-page">
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarFile} />

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: isMobile ? 20 : 24 }}>
        <h1 style={{ color: "#e8eaf0", fontSize: isMobile ? 19 : 22, fontWeight: 700, margin: 0 }}>👤 Tài Khoản</h1>
        <button onClick={load}
          style={{ padding: "8px 14px", background: "transparent", color: "#8b90a7", border: "1px solid #2d3154", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
          🔄
        </button>
      </div>

      {/* ── Avatar card ── */}
      <div style={{ background: "#1a1d2e", border: "1px solid #2d3154", borderRadius: 18, padding: isMobile ? "20px 16px" : "26px 24px", marginBottom: 14, display: "flex", alignItems: "center", gap: isMobile ? 16 : 20 }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div style={{ width: isMobile ? 70 : 86, height: isMobile ? 70 : 86, borderRadius: "50%", background: "#2d3154", display: "flex", alignItems: "center", justifyContent: "center", fontSize: isMobile ? 26 : 34, overflow: "hidden", border: "3px solid #5b7cf6" }}>
            {user?.avatar ? <img src={user.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "👤"}
          </div>
          <button onClick={() => fileRef.current?.click()} disabled={uploadingAvatar}
            style={{ position: "absolute", bottom: 0, right: 0, width: 26, height: 26, borderRadius: "50%", background: "#5b7cf6", border: "2px solid #1a1d2e", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 12 }}>
            {uploadingAvatar ? "⏳" : "📷"}
          </button>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "#e8eaf0", fontWeight: 800, fontSize: isMobile ? 16 : 19, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {user?.fullName || user?.username}
          </div>
          <div style={{ color: "#8b90a7", fontSize: 13, marginTop: 2 }}>@{user?.username}</div>
          <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "rgba(91,124,246,.15)", color: "#a5b4fc", fontWeight: 600 }}>
              {ROLE_LABEL[user?.role] || user?.role}
            </span>
            {empProfile?.employeeCode && (
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "rgba(34,197,94,.1)", color: "#4ade80", fontWeight: 600 }}>
                {empProfile.employeeCode}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Thông tin cá nhân ── */}
      <div style={{ background: "#1a1d2e", border: "1px solid #2d3154", borderRadius: 16, padding: isMobile ? "18px 16px" : "22px 24px", marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ color: "#e8eaf0", fontWeight: 700, fontSize: 14 }}>📋 Thông tin cá nhân</div>
          {!editing ? (
            <button onClick={() => setEditing(true)}
              style={{ padding: "6px 14px", background: "rgba(91,124,246,.15)", color: "#5b7cf6", border: "1px solid rgba(91,124,246,.3)", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              ✏️ Chỉnh sửa
            </button>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setEditing(false); setInfoForm({ fullName: user?.fullName || "", email: user?.email || "", phone: user?.phone || "" }); }}
                style={{ padding: "6px 12px", background: "transparent", color: "#8b90a7", border: "1px solid #2d3154", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>Hủy</button>
              <button onClick={saveInfo} disabled={savingInfo}
                style={{ padding: "6px 14px", background: "#5b7cf6", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                {savingInfo ? "Đang lưu..." : "💾 Lưu"}
              </button>
            </div>
          )}
        </div>
        <div style={{ display: "grid", gap: 14 }}>
          <div style={rowSt}>
            <label style={labelSt}>Họ và tên</label>
            <input style={inputSt(editing)} value={infoForm.fullName} onChange={e => setInfo("fullName", e.target.value)} disabled={!editing} />
            {editing && <div style={{ color: "#8b90a7", fontSize: 11, marginTop: 4 }}>Liên hệ admin nếu cần thay đổi họ tên.</div>}
          </div>
          <div style={rowSt}>
            <label style={labelSt}>Email</label>
            <input type="email" style={inputSt(editing)} value={infoForm.email} onChange={e => setInfo("email", e.target.value)} disabled={!editing} placeholder={editing ? "example@email.com" : "Chưa cập nhật"} />
          </div>
          <div style={rowSt}>
            <label style={labelSt}>Số điện thoại</label>
            <input type="tel" style={inputSt(editing)} value={infoForm.phone} onChange={e => setInfo("phone", e.target.value)} disabled={!editing} placeholder={editing ? "0xxxxxxxxx" : "Chưa cập nhật"} />
          </div>
          {empProfile && (
            <>
              <div style={rowSt}>
                <label style={labelSt}>Chức vụ</label>
                <div style={{ color: "#e8eaf0", fontSize: 14, padding: "10px 12px" }}>{empProfile.position || "—"}</div>
              </div>
              {empProfile.department && (
                <div style={rowSt}>
                  <label style={labelSt}>Phòng ban</label>
                  <div style={{ color: "#e8eaf0", fontSize: 14, padding: "10px 12px" }}>{empProfile.department}</div>
                </div>
              )}
              <div>
                <label style={labelSt}>Loại nhân viên</label>
                <div style={{ padding: "10px 12px" }}>
                  <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 10, fontWeight: 600, background: empProfile.salaryType === "hourly" ? "rgba(245,158,11,.15)" : "rgba(91,124,246,.15)", color: empProfile.salaryType === "hourly" ? "#f59e0b" : "#a5b4fc" }}>
                    {empProfile.salaryType === "hourly" ? "⏱️ Part-time" : "📅 Full-time"}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Tài khoản ngân hàng ── */}
      <div style={{ background: "#1a1d2e", border: "1px solid #2d3154", borderRadius: 16, padding: isMobile ? "18px 16px" : "22px 24px", marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ color: "#e8eaf0", fontWeight: 700, fontSize: 14 }}>🏦 Tài khoản ngân hàng</div>
            <div style={{ color: "#8b90a7", fontSize: 11, marginTop: 2 }}>Dùng để nhận lương chuyển khoản</div>
          </div>
          {!editingBank ? (
            <button onClick={() => setEditingBank(true)}
              style={{ padding: "6px 14px", background: "rgba(91,124,246,.15)", color: "#5b7cf6", border: "1px solid rgba(91,124,246,.3)", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              {hasBankInfo ? "✏️ Sửa" : "+ Thêm"}
            </button>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setEditingBank(false); setBankForm({ bankName: empProfile?.bankName || "", bankAccount: empProfile?.bankAccount || "", bankAccountName: empProfile?.bankAccountName || "", bankBin: empProfile?.bankBin || "" }); }}
                style={{ padding: "6px 12px", background: "transparent", color: "#8b90a7", border: "1px solid #2d3154", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>Hủy</button>
              <button onClick={saveBank} disabled={savingBank}
                style={{ padding: "6px 14px", background: "#5b7cf6", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                {savingBank ? "Đang lưu..." : "💾 Lưu"}
              </button>
            </div>
          )}
        </div>

        {editingBank ? (
          /* ── Form chỉnh sửa ── */
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <label style={labelSt}>Ngân hàng *</label>
              <select
                style={{ width: "100%", background: "#0f1117", border: "1px solid #2d3154", borderRadius: 8, padding: "10px 12px", color: "#e8eaf0", fontSize: 16, boxSizing: "border-box" }}
                value={bankForm.bankName}
                onChange={e => handleBankSelect(e.target.value)}>
                <option value="">— Chọn ngân hàng —</option>
                {BANKS.map(b => <option key={b.bin} value={b.name}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelSt}>Số tài khoản *</label>
              <input type="text" inputMode="numeric"
                style={{ width: "100%", background: "#0f1117", border: "1px solid #2d3154", borderRadius: 8, padding: "10px 12px", color: "#e8eaf0", fontSize: 16, boxSizing: "border-box" }}
                value={bankForm.bankAccount}
                onChange={e => setBank("bankAccount", e.target.value.replace(/\D/g, ""))}
                placeholder="Nhập số tài khoản" />
            </div>
            <div>
              <label style={labelSt}>Tên chủ tài khoản *</label>
              <input type="text"
                style={{ width: "100%", background: "#0f1117", border: "1px solid #2d3154", borderRadius: 8, padding: "10px 12px", color: "#e8eaf0", fontSize: 16, boxSizing: "border-box" }}
                value={bankForm.bankAccountName}
                onChange={e => setBank("bankAccountName", e.target.value.toUpperCase())}
                placeholder="VD: NGUYEN VAN A" />
              <div style={{ color: "#8b90a7", fontSize: 11, marginTop: 4 }}>Nhập IN HOA, đúng tên trên tài khoản ngân hàng.</div>
            </div>
          </div>
        ) : hasBankInfo ? (
          /* ── Hiển thị thông tin ── */
          <div style={{ display: "flex", gap: isMobile ? 14 : 20, alignItems: "flex-start", flexWrap: isMobile ? "wrap" : "nowrap" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "grid", gap: 10 }}>
                {[
                  ["Ngân hàng",     empProfile?.bankName],
                  ["Số tài khoản",  empProfile?.bankAccount],
                  ["Chủ tài khoản", empProfile?.bankAccountName],
                ].map(([label, val]) => (
                  <div key={label}>
                    <div style={{ color: "#8b90a7", fontSize: 11, fontWeight: 600 }}>{label}</div>
                    <div style={{ color: "#e8eaf0", fontSize: 14, fontWeight: 600, marginTop: 2 }}>{val || "—"}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* VietQR */}
            {vietQrUrl && (
              <div style={{ flexShrink: 0, textAlign: "center" }}>
                <img src={vietQrUrl} alt="VietQR" style={{ width: isMobile ? 100 : 120, height: isMobile ? 100 : 120, borderRadius: 10, background: "#fff", padding: 4 }}
                  onError={e => { e.target.style.display = "none"; }} />
                <div style={{ color: "#8b90a7", fontSize: 10, marginTop: 4 }}>VietQR</div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: "center", color: "#8b90a7", padding: "20px 0", fontSize: 13 }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>🏦</div>
            Chưa có thông tin ngân hàng.
            <br /><span style={{ fontSize: 12 }}>Thêm để nhận lương qua chuyển khoản.</span>
          </div>
        )}
      </div>

      {/* ── Actions ── */}
      <div style={{ display: "grid", gap: 10 }}>
        <button onClick={() => setShowPwdModal(true)}
          style={{ width: "100%", padding: isMobile ? "15px 20px" : "14px 20px", background: "#1a1d2e", color: "#e8eaf0", border: "1px solid #2d3154", borderRadius: 14, cursor: "pointer", fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20 }}>🔑</span>
          <span>Đổi mật khẩu</span>
          <span style={{ marginLeft: "auto", color: "#8b90a7" }}>›</span>
        </button>
        <button onClick={logout}
          style={{ width: "100%", padding: isMobile ? "15px 20px" : "14px 20px", background: "rgba(239,68,68,.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,.2)", borderRadius: 14, cursor: "pointer", fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20 }}>🚪</span>
          <span>Đăng xuất</span>
        </button>
      </div>

      {showPwdModal && <PasswordModal onClose={() => setShowPwdModal(false)} />}
    </div>
  );
};

export default EmployeeProfile;
