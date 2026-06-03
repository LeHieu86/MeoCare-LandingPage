import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useIsMobile } from "../hooks/useIsMobile";

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const getToken = () => localStorage.getItem("token");

const LEAVE_TYPES = [
  { value: "annual",    label: "🌴 Nghỉ phép năm"   },
  { value: "sick",      label: "🤒 Nghỉ bệnh"        },
  { value: "unpaid",    label: "💸 Nghỉ không lương" },
  { value: "maternity", label: "👶 Thai sản"          },
  { value: "other",     label: "📋 Khác"             },
];

const STATUS_MAP = {
  pending:  { label: "Chờ duyệt", color: "#f59e0b", bg: "rgba(245,158,11,.15)" },
  approved: { label: "Đã duyệt",  color: "#22c55e", bg: "rgba(34,197,94,.12)"  },
  rejected: { label: "Từ chối",   color: "#ef4444", bg: "rgba(239,68,68,.12)"  },
};

const fmtDate = (dt) => dt ? new Date(dt).toLocaleDateString("vi-VN") : "–";

// ── Form gửi đơn nghỉ (slide-up on mobile) ─────────────────────────────────
const LeaveForm = ({ onDone, isMobile }) => {
  const [form, setForm] = useState({
    leaveType: "annual",
    startDate: new Date().toISOString().split("T")[0],
    endDate:   new Date().toISOString().split("T")[0],
    reason: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const totalDays = Math.max(1,
    Math.round((new Date(form.endDate) - new Date(form.startDate)) / 86400000) + 1
  );

  const submit = async (e) => {
    e.preventDefault();
    if (!form.reason.trim()) { toast.error("Vui lòng nhập lý do nghỉ."); return; }
    setSaving(true);
    const r = await fetch(`${API_BASE}/leave`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(form),
    });
    const d = await r.json();
    if (r.ok) { toast.success("✅ Gửi đơn nghỉ thành công!"); onDone(d); }
    else        toast.error(d.error || "Lỗi gửi đơn.");
    setSaving(false);
  };

  const inputSt = {
    width: "100%", background: "#0f1117", border: "1px solid #2d3154",
    borderRadius: 8, padding: "10px 12px", color: "#e8eaf0",
    fontSize: 16, boxSizing: "border-box",
  };
  const labelSt = { display: "block", color: "#8b90a7", fontSize: 12, marginBottom: 6, fontWeight: 600 };

  return (
    <div style={{ background: "#1a1d2e", border: "1px solid #2d3154", borderRadius: 16, padding: isMobile ? 18 : 24, marginBottom: 20 }}>
      <h3 style={{ color: "#e8eaf0", margin: "0 0 16px", fontSize: 16 }}>📝 Gửi đơn xin nghỉ</h3>
      <form onSubmit={submit}>
        <div style={{ display: "grid", gap: 14 }}>
          {/* Loại nghỉ */}
          <div>
            <label style={labelSt}>Loại nghỉ</label>
            <select style={inputSt} value={form.leaveType} onChange={e => set("leaveType", e.target.value)}>
              {LEAVE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* Ngày — 2 cột trên desktop, 1 cột trên mobile */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelSt}>Từ ngày *</label>
              <input type="date" style={inputSt} value={form.startDate}
                onChange={e => set("startDate", e.target.value)} required />
            </div>
            <div>
              <label style={labelSt}>Đến ngày *</label>
              <input type="date" style={inputSt} value={form.endDate} min={form.startDate}
                onChange={e => set("endDate", e.target.value)} required />
            </div>
          </div>

          {/* Lý do */}
          <div>
            <label style={labelSt}>Lý do *</label>
            <textarea style={{ ...inputSt, minHeight: 80, resize: "vertical" }}
              value={form.reason} onChange={e => set("reason", e.target.value)}
              placeholder="Nhập lý do xin nghỉ..." required />
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
          <div style={{ color: "#8b90a7", fontSize: 13 }}>
            Tổng: <strong style={{ color: "#e8eaf0" }}>{totalDays} ngày</strong>
            {form.leaveType === "unpaid" && <span style={{ color: "#ef4444", marginLeft: 8 }}>⚠️ Không lương</span>}
          </div>
          <button type="submit" disabled={saving}
            style={{ padding: isMobile ? "12px 20px" : "10px 24px", background: "#5b7cf6", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 15 }}>
            {saving ? "Đang gửi..." : "📤 Gửi đơn"}
          </button>
        </div>
      </form>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
const EmployeeLeave = () => {
  const isMobile = useIsMobile();
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
    if (!confirm("Hủy đơn nghỉ này?")) return;
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

  const btnGhost = { padding:"8px 14px",background:"transparent",color:"#8b90a7",border:"1px solid #2d3154",borderRadius:8,cursor:"pointer",fontSize:13 };

  return (
    <div className="emp-page">

      {/* ── Header ── */}
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:isMobile?14:20 }}>
        <div>
          <h1 style={{ color:"#e8eaf0",fontSize:isMobile?19:22,fontWeight:700,margin:0 }}>🏖️ Nghỉ Phép</h1>
          <p style={{ color:"#8b90a7",fontSize:12,margin:"3px 0 0" }}>{leaves.length} đơn</p>
        </div>
        <div style={{ display:"flex",gap:8 }}>
          <button style={btnGhost} onClick={load}>🔄</button>
          <button onClick={() => setShowForm(f => !f)}
            style={{ padding:"9px 16px",background:showForm?"transparent":"#5b7cf6",color:showForm?"#8b90a7":"#fff",border:showForm?"1px solid #2d3154":"none",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:700 }}>
            {showForm ? "✕ Đóng" : "+ Gửi đơn"}
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16 }}>
        {/* Phép năm */}
        <div style={{ background:"#1a1d2e",border:"1px solid #2d3154",borderRadius:12,padding:isMobile?"12px 10px":"16px 18px",textAlign:"center" }}>
          <div style={{ fontSize:isMobile?18:22 }}>🌴</div>
          <div style={{ marginTop:4 }}>
            <span style={{ color: stats.annualRemain > 0 ? "#22c55e" : "#ef4444", fontWeight:800, fontSize:isMobile?16:20 }}>
              {stats.annualRemain}
            </span>
            <span style={{ color:"#4b5563", fontSize:isMobile?11:13 }}>/{stats.annualTotal} ngày</span>
          </div>
          <div style={{ color:"#8b90a7",fontSize:isMobile?10:12,marginTop:2 }}>Phép năm còn lại</div>
        </div>
        {/* Phép bệnh */}
        <div style={{ background:"#1a1d2e",border:"1px solid #2d3154",borderRadius:12,padding:isMobile?"12px 10px":"16px 18px",textAlign:"center" }}>
          <div style={{ fontSize:isMobile?18:22 }}>🤒</div>
          <div style={{ marginTop:4 }}>
            <span style={{ color: stats.sickRemain > 0 ? "#f59e0b" : "#ef4444", fontWeight:800, fontSize:isMobile?16:20 }}>
              {stats.sickRemain}
            </span>
            <span style={{ color:"#4b5563", fontSize:isMobile?11:13 }}>/{stats.sickTotal} ngày</span>
          </div>
          <div style={{ color:"#8b90a7",fontSize:isMobile?10:12,marginTop:2 }}>Phép bệnh còn lại</div>
        </div>
        {/* Đơn chờ */}
        <div style={{ background:"#1a1d2e",border:"1px solid #2d3154",borderRadius:12,padding:isMobile?"12px 10px":"16px 18px",textAlign:"center" }}>
          <div style={{ fontSize:isMobile?18:22 }}>⏳</div>
          <div style={{ color: stats.pending > 0 ? "#f59e0b" : "#e8eaf0", fontWeight:800, fontSize:isMobile?16:20, marginTop:4 }}>
            {stats.pending}
          </div>
          <div style={{ color:"#8b90a7",fontSize:isMobile?10:12,marginTop:2 }}>Đơn chờ duyệt</div>
        </div>
      </div>

      {/* ── Form ── */}
      {showForm && (
        <LeaveForm
          isMobile={isMobile}
          onDone={(d) => { setShowForm(false); setLeaves(prev => [d, ...prev]); }}
        />
      )}

      {/* ── Leave list ── */}
      {loading ? (
        <div style={{ textAlign:"center",color:"#8b90a7",padding:40 }}>Đang tải...</div>
      ) : leaves.length === 0 ? (
        <div style={{ textAlign:"center",color:"#8b90a7",padding:60 }}>
          <div style={{ fontSize:40,marginBottom:12 }}>🏖️</div>
          Chưa có đơn nghỉ nào.
        </div>
      ) : (
        <div style={{ display:"grid",gap:10 }}>
          {leaves.map(l => {
            const st = STATUS_MAP[l.status] || STATUS_MAP.pending;
            const lt = LEAVE_TYPES.find(t => t.value === l.leaveType) || LEAVE_TYPES[4];
            return (
              <div key={l.id} style={{ background:"#1a1d2e",border:"1px solid #2d3154",borderRadius:14,padding:isMobile?"14px 16px":20 }}>
                {/* Top row */}
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10 }}>
                  <div>
                    <div style={{ color:"#e8eaf0",fontWeight:700,fontSize:14 }}>{lt.label}</div>
                    <div style={{ color:"#8b90a7",fontSize:12,marginTop:3 }}>
                      📅 {fmtDate(l.startDate)} – {fmtDate(l.endDate)}
                      <strong style={{ color:"#e8eaf0",marginLeft:6 }}>({l.totalDays} ngày)</strong>
                    </div>
                  </div>
                  <span style={{ background:st.bg,color:st.color,padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,whiteSpace:"nowrap",marginLeft:8 }}>
                    {st.label}
                  </span>
                </div>

                {/* Reason */}
                <div style={{ color:"#8b90a7",fontSize:13,marginBottom: l.rejectReason||l.status==="pending" ? 10 : 0 }}>
                  💬 {l.reason}
                </div>

                {/* Reject reason */}
                {l.rejectReason && (
                  <div style={{ color:"#ef4444",fontSize:12,background:"rgba(239,68,68,.08)",padding:"8px 10px",borderRadius:8,marginBottom:8,border:"1px solid rgba(239,68,68,.2)" }}>
                    ❌ Lý do từ chối: {l.rejectReason}
                  </div>
                )}

                {/* Cancel button */}
                {l.status === "pending" && (
                  <button onClick={() => handleCancel(l.id)}
                    style={{ padding:"7px 16px",background:"transparent",color:"#ef4444",border:"1px solid rgba(239,68,68,.4)",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:600 }}>
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
