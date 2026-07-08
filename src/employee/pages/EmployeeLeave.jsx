import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useConfirm } from "../../hooks/useConfirm";

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const getToken = () => localStorage.getItem("token");

const LEAVE_TYPES = [
  { value: "annual",    label: "🌴 Nghỉ phép năm"   },
  { value: "sick",      label: "🤒 Nghỉ bệnh"        },
  { value: "unpaid",    label: "💸 Nghỉ không lương" },
  { value: "maternity", label: "👶 Thai sản"          },
  { value: "other",     label: "📋 Khác"             },
];

/* status → class badge (.emp-badge.is-* trong employee.css) */
const STATUS_MAP = {
  pending:  { label: "Chờ duyệt", cls: "is-warn"    },
  approved: { label: "Đã duyệt",  cls: "is-success" },
  rejected: { label: "Từ chối",   cls: "is-danger"  },
};

const fmtDate = (dt) => dt ? new Date(dt).toLocaleDateString("vi-VN") : "–";

// ── Form gửi đơn nghỉ (slide-up on mobile) ─────────────────────────────────
const LeaveForm = ({ onDone }) => {
  const todayStr = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    leaveType: "annual",
    startDate: todayStr,
    endDate:   todayStr,
    startTime: "08:00",
    endTime:   "12:00",
    reason: "",
  });
  const [byHour, setByHour] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const isUnpaid = form.leaveType === "unpaid";

  // Khi đổi sang loại khác hoặc tắt byHour, reset trạng thái
  const handleTypeChange = (v) => {
    set("leaveType", v);
    if (v !== "unpaid") setByHour(false);
  };

  // Khi bật byHour, khóa endDate = startDate
  const handleByHour = (checked) => {
    setByHour(checked);
    if (checked) set("endDate", form.startDate);
  };

  const handleStartDate = (v) => {
    set("startDate", v);
    if (byHour) set("endDate", v); // giữ same-day
    else if (form.endDate < v) set("endDate", v);
  };

  // Tính tổng hiển thị
  const totalDays = byHour
    ? (() => {
        const [sh, sm] = form.startTime.split(":").map(Number);
        const [eh, em] = form.endTime.split(":").map(Number);
        const hrs = ((eh * 60 + em) - (sh * 60 + sm)) / 60;
        return hrs > 0 ? hrs : 0;
      })()
    : Math.max(1, Math.round((new Date(form.endDate) - new Date(form.startDate)) / 86400000) + 1);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.reason.trim()) { toast.error("Vui lòng nhập lý do nghỉ."); return; }
    if (byHour) {
      const [sh, sm] = form.startTime.split(":").map(Number);
      const [eh, em] = form.endTime.split(":").map(Number);
      if ((sh * 60 + sm) >= (eh * 60 + em)) { toast.error("Giờ bắt đầu phải nhỏ hơn giờ kết thúc."); return; }
    }
    setSaving(true);
    const body = {
      leaveType: form.leaveType,
      startDate: form.startDate,
      endDate:   byHour ? form.startDate : form.endDate,
      reason:    form.reason,
      ...(byHour ? { startTime: form.startTime, endTime: form.endTime } : {}),
    };
    const r = await fetch(`${API_BASE}/leave`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (r.ok) { toast.success("✅ Gửi đơn nghỉ thành công!"); onDone(d); }
    else        toast.error(d.error || "Lỗi gửi đơn.");
    setSaving(false);
  };

  return (
    <div className="emp-card" style={{ marginBottom: 20 }}>
      <h3 style={{ color: "var(--emp-text)", margin: "0 0 16px", fontSize: 16 }}>📝 Gửi đơn xin nghỉ</h3>
      <form onSubmit={submit}>
        <div style={{ display: "grid", gap: 14 }}>
          {/* Loại nghỉ */}
          <div>
            <label className="emp-form-label">Loại nghỉ</label>
            <select className="emp-select" value={form.leaveType} onChange={e => handleTypeChange(e.target.value)}>
              {LEAVE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* Toggle nghỉ theo giờ — chỉ hiện khi unpaid */}
          {isUnpaid && (
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
              <div
                onClick={() => handleByHour(!byHour)}
                style={{
                  width: 40, height: 22, borderRadius: 11, position: "relative", flexShrink: 0,
                  background: byHour ? "var(--emp-primary)" : "var(--emp-border)",
                  transition: "background .2s", cursor: "pointer",
                }}
              >
                <div style={{
                  position: "absolute", top: 3, left: byHour ? 21 : 3,
                  width: 16, height: 16, borderRadius: "50%", background: "#fff",
                  transition: "left .2s",
                }} />
              </div>
              <span style={{ color: "var(--emp-text-2)", fontSize: 13 }}>
                Nghỉ theo giờ <span style={{ color: "var(--emp-muted)", fontSize: 11 }}>(bán ngày)</span>
              </span>
            </label>
          )}

          {/* Ngày */}
          <div className="emp-leave-form-grid">
            <div>
              <label className="emp-form-label">Từ ngày *</label>
              <input type="date" className="emp-date-input" value={form.startDate}
                onChange={e => handleStartDate(e.target.value)} required />
            </div>
            {!byHour && (
              <div>
                <label className="emp-form-label">Đến ngày *</label>
                <input type="date" className="emp-date-input" value={form.endDate} min={form.startDate}
                  onChange={e => set("endDate", e.target.value)} required />
              </div>
            )}
          </div>

          {/* Chọn giờ — chỉ hiện khi byHour */}
          {byHour && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label className="emp-form-label">Từ giờ *</label>
                <input type="time" className="emp-date-input" value={form.startTime}
                  onChange={e => set("startTime", e.target.value)} required />
              </div>
              <div>
                <label className="emp-form-label">Đến giờ *</label>
                <input type="time" className="emp-date-input" value={form.endTime}
                  min={form.startTime}
                  onChange={e => set("endTime", e.target.value)} required />
              </div>
            </div>
          )}

          {/* Lý do */}
          <div>
            <label className="emp-form-label">Lý do *</label>
            <textarea className="emp-textarea"
              value={form.reason} onChange={e => set("reason", e.target.value)}
              placeholder="Nhập lý do xin nghỉ..." required />
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, gap: 12, flexWrap: "wrap" }}>
          <div style={{ color: "var(--emp-muted)", fontSize: 13 }}>
            Tổng:{" "}
            <strong style={{ color: "var(--emp-text)" }}>{totalDays} {byHour ? "giờ" : "ngày"}</strong>
            {form.leaveType === "unpaid" && <span style={{ color: "var(--emp-danger)", marginLeft: 8 }}>⚠️ Không lương</span>}
          </div>
          <button type="submit" disabled={saving} className="emp-btn-primary">
            {saving ? "Đang gửi..." : "📤 Gửi đơn"}
          </button>
        </div>
      </form>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
const EmployeeLeave = () => {
  const confirm = useConfirm();
  const [searchParams] = useSearchParams();

  const [leaves,   setLeaves]   = useState([]);
  const [balances, setBalances] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(searchParams.get("action") === "new");

  const load = useCallback(() => {
    const token = getToken();
    setLoading(true);
    fetch(`${API_BASE}/leave/my`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        // API trả về { leaves, balances } hoặc array (legacy)
        if (Array.isArray(d)) { setLeaves(d); }
        else { setLeaves(d.leaves || []); setBalances(d.balances || []); }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Real-time: reload khi HR duyệt hoặc từ chối đơn
  useEffect(() => {
    const handler = (e) => {
      const { event } = e.detail;
      if (['leave:approved', 'leave:rejected', 'leave:manager_approved'].includes(event)) {
        load();
      }
    };
    window.addEventListener('emp:socket', handler);
    return () => window.removeEventListener('emp:socket', handler);
  }, [load]);

  const handleCancel = async (id) => {
    if (!await confirm("Hủy đơn nghỉ này?")) return;
    const r = await fetch(`${API_BASE}/leave/${id}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${getToken()}` },
    });
    const d = await r.json();
    if (r.ok) { toast.success("Đã hủy đơn."); setLeaves(prev => prev.filter(l => l.id !== id)); }
    else        toast.error(d.error || "Không thể hủy.");
  };

  const getBal = (type) => balances.find(b => b.leave_type === type) || { total_days: 0, used_days: 0 };
  const annualBal = getBal("annual");
  const sickBal   = getBal("sick");
  const stats = {
    annualRemain: Math.max(0, annualBal.total_days - annualBal.used_days),
    annualTotal:  annualBal.total_days,
    sickRemain:   Math.max(0, sickBal.total_days - sickBal.used_days),
    sickTotal:    sickBal.total_days,
    pending:      leaves.filter(l => l.status === "pending").length,
  };

  return (
    <div className="emp-page">

      {/* ── Header ── */}
      <div className="emp-page-header">
        <div>
          <h1 className="emp-page-title">🏖️ Nghỉ Phép</h1>
          <p className="emp-page-sub">{leaves.length} đơn</p>
        </div>
        <div className="emp-page-actions">
          <button className="emp-icon-btn" onClick={load}>🔄</button>
          <button onClick={() => setShowForm(f => !f)}
            className={showForm ? "emp-btn-ghost" : "emp-btn-primary"}
            style={{ padding: "9px 16px", fontSize: 13 }}>
            {showForm ? "✕ Đóng" : "+ Gửi đơn"}
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="emp-stats-grid">
        {/* Phép năm */}
        <div className="emp-stat" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 22 }}>🌴</div>
          <div style={{ marginTop: 4 }}>
            <span style={{ color: stats.annualRemain > 0 ? "var(--emp-success)" : "var(--emp-danger)", fontWeight: 800, fontSize: 20 }}>
              {stats.annualRemain}
            </span>
            <span style={{ color: "var(--emp-faint-2)", fontSize: 13 }}>/{stats.annualTotal} ngày</span>
          </div>
          <div className="emp-stat-label">Phép năm còn lại</div>
        </div>
        {/* Phép bệnh */}
        <div className="emp-stat" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 22 }}>🤒</div>
          <div style={{ marginTop: 4 }}>
            <span style={{ color: stats.sickRemain > 0 ? "var(--emp-warn)" : "var(--emp-danger)", fontWeight: 800, fontSize: 20 }}>
              {stats.sickRemain}
            </span>
            <span style={{ color: "var(--emp-faint-2)", fontSize: 13 }}>/{stats.sickTotal} ngày</span>
          </div>
          <div className="emp-stat-label">Phép bệnh còn lại</div>
        </div>
        {/* Đơn chờ */}
        <div className="emp-stat" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 22 }}>⏳</div>
          <div style={{ color: stats.pending > 0 ? "var(--emp-warn)" : "var(--emp-text)", fontWeight: 800, fontSize: 20, marginTop: 4 }}>
            {stats.pending}
          </div>
          <div className="emp-stat-label">Đơn chờ duyệt</div>
        </div>
      </div>

      {/* ── Form ── */}
      {showForm && (
        <LeaveForm
          onDone={(d) => { setShowForm(false); setLeaves(prev => [d, ...prev]); }}
        />
      )}

      {/* ── Leave list ── */}
      {loading ? (
        <div>
          {[0, 1].map(i => (
            <div key={i} className="emp-skeleton-card">
              <div className="emp-skeleton emp-skeleton-line" style={{ width: "45%" }} />
              <div className="emp-skeleton emp-skeleton-line" style={{ width: "75%" }} />
            </div>
          ))}
        </div>
      ) : leaves.length === 0 ? (
        <div className="emp-empty">
          <div className="emp-empty-icon">🏖️</div>
          <p>Chưa có đơn nghỉ nào.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {leaves.map(l => {
            const st = STATUS_MAP[l.status] || STATUS_MAP.pending;
            const lt = LEAVE_TYPES.find(t => t.value === l.leaveType) || LEAVE_TYPES[4];
            return (
              <div key={l.id} className="emp-leave-card">
                {/* Top row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, gap: 8 }}>
                  <div>
                    <div style={{ color: "var(--emp-text)", fontWeight: 700, fontSize: 14 }}>{lt.label}</div>
                    <div style={{ color: "var(--emp-muted)", fontSize: 12, marginTop: 3 }}>
                      📅 {fmtDate(l.startDate)}
                      {l.startTime && l.endTime
                        ? <span> · <strong style={{ color: "var(--emp-purple)" }}>⏰ {l.startTime} – {l.endTime}</strong></span>
                        : l.endDate !== l.startDate ? ` – ${fmtDate(l.endDate)}` : ""
                      }
                      <strong style={{ color: "var(--emp-text)", marginLeft: 6 }}>
                        ({l.startTime ? `${l.totalDays * 8}h` : `${l.totalDays} ngày`})
                      </strong>
                    </div>
                  </div>
                  <span className={`emp-badge ${st.cls}`} style={{ marginLeft: 8 }}>{st.label}</span>
                </div>

                {/* Reason */}
                <div style={{ color: "var(--emp-muted)", fontSize: 13, marginBottom: l.rejectReason || l.status === "pending" ? 10 : 0 }}>
                  💬 {l.reason}
                </div>

                {/* Reject reason */}
                {l.rejectReason && (
                  <div style={{ color: "var(--emp-danger)", fontSize: 12, background: "rgba(239,68,68,.08)", padding: "8px 10px", borderRadius: 8, marginBottom: 8, border: "1px solid rgba(239,68,68,.2)" }}>
                    ❌ Lý do từ chối: {l.rejectReason}
                  </div>
                )}

                {/* Cancel button */}
                {l.status === "pending" && (
                  <button onClick={() => handleCancel(l.id)} className="emp-btn-danger" style={{ padding: "7px 16px", fontSize: 13, fontWeight: 600 }}>
                    Hủy đơn
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EmployeeLeave;
