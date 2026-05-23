import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const getToken = () => localStorage.getItem("mc_employee_token") || localStorage.getItem("mc_admin_token");

const LEAVE_TYPES = [
  { value:"annual",    label:"🌴 Nghỉ phép năm"    },
  { value:"sick",      label:"🤒 Nghỉ bệnh"         },
  { value:"unpaid",    label:"💸 Nghỉ không lương"  },
  { value:"maternity", label:"👶 Thai sản"           },
  { value:"other",     label:"📋 Khác"              },
];

const STATUS_MAP = {
  pending:  { label:"Chờ duyệt", color:"#f59e0b", bg:"#2d1d00" },
  approved: { label:"Đã duyệt",  color:"#22c55e", bg:"#052e16" },
  rejected: { label:"Từ chối",   color:"#ef4444", bg:"#2d0f0f" },
};

const fmtDate = (dt) => dt ? new Date(dt).toLocaleDateString("vi-VN") : "–";

const inputStyle  = { width:"100%",background:"#0f1117",border:"1px solid #2d3154",borderRadius:8,padding:"8px 12px",color:"#e8eaf0",fontSize:14,boxSizing:"border-box" };
const btnPrimary  = { padding:"10px 24px",background:"#5b7cf6",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontSize:14,fontWeight:600 };
const btnSecondary= { padding:"10px 24px",background:"transparent",color:"#8b90a7",border:"1px solid #2d3154",borderRadius:8,cursor:"pointer",fontSize:14 };
const labelStyle  = { display:"block",color:"#8b90a7",fontSize:12,marginBottom:6,fontWeight:600 };

// ── Form gửi đơn ──────────────────────────────────────────────
const LeaveForm = ({ onDone }) => {
  const [form, setForm] = useState({
    leaveType: "annual",
    startDate: new Date().toISOString().split("T")[0],
    endDate:   new Date().toISOString().split("T")[0],
    reason:    "",
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
      method:"POST",
      headers:{ "Content-Type":"application/json", Authorization:`Bearer ${getToken()}` },
      body: JSON.stringify(form),
    });
    const d = await r.json();
    if (r.ok) { toast.success("✅ Gửi đơn nghỉ thành công! Vui lòng chờ duyệt."); onDone(d); }
    else        toast.error(d.error || "Lỗi gửi đơn.");
    setSaving(false);
  };

  return (
    <div style={{ background:"#1a1d2e",border:"1px solid #2d3154",borderRadius:16,padding:24,marginBottom:24 }}>
      <h3 style={{ color:"#e8eaf0",margin:"0 0 18px",fontSize:16 }}>📝 Gửi đơn xin nghỉ</h3>
      <form onSubmit={submit}>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>
          <div style={{ gridColumn:"span 2" }}>
            <label style={labelStyle}>Loại nghỉ</label>
            <select style={inputStyle} value={form.leaveType} onChange={e => set("leaveType",e.target.value)}>
              {LEAVE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Từ ngày *</label>
            <input type="date" style={inputStyle} value={form.startDate}
              onChange={e => set("startDate",e.target.value)} required />
          </div>
          <div>
            <label style={labelStyle}>Đến ngày *</label>
            <input type="date" style={inputStyle} value={form.endDate} min={form.startDate}
              onChange={e => set("endDate",e.target.value)} required />
          </div>
          <div style={{ gridColumn:"span 2" }}>
            <label style={labelStyle}>Lý do *</label>
            <textarea style={{ ...inputStyle,minHeight:80,resize:"vertical" }}
              value={form.reason} onChange={e => set("reason",e.target.value)}
              placeholder="Nhập lý do xin nghỉ..." required />
          </div>
        </div>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:16 }}>
          <div style={{ color:"#8b90a7",fontSize:13 }}>
            Tổng: <strong style={{ color:"#e8eaf0" }}>{totalDays} ngày</strong>
            {form.leaveType === "unpaid" && <span style={{ color:"#ef4444",marginLeft:8 }}>⚠️ Không lương</span>}
          </div>
          <button type="submit" disabled={saving} style={btnPrimary}>
            {saving ? "Đang gửi..." : "📤 Gửi đơn"}
          </button>
        </div>
      </form>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
const EmployeeLeave = () => {
  const [searchParams] = useSearchParams();
  const [leaves,  setLeaves]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm,setShowForm]= useState(searchParams.get("action")==="new");

  const load = useCallback(() => {
    const token = getToken();
    setLoading(true);
    fetch(`${API_BASE}/leave/my`, { headers:{ Authorization:`Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setLeaves(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCancel = async (id) => {
    if (!confirm("Hủy đơn nghỉ này?")) return;
    const r = await fetch(`${API_BASE}/leave/${id}`, {
      method:"DELETE", headers:{ Authorization:`Bearer ${getToken()}` },
    });
    const d = await r.json();
    if (r.ok) { toast.success("Đã hủy đơn."); setLeaves(prev => prev.filter(l => l.id!==id)); }
    else        toast.error(d.error || "Không thể hủy.");
  };

  const stats = {
    annual:  leaves.filter(l=>l.leaveType==="annual"&&l.status==="approved").reduce((s,l)=>s+l.totalDays,0),
    sick:    leaves.filter(l=>l.leaveType==="sick"&&l.status==="approved").reduce((s,l)=>s+l.totalDays,0),
    pending: leaves.filter(l=>l.status==="pending").length,
  };

  return (
    <div style={{ padding:28 }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24 }}>
        <div>
          <h1 style={{ color:"#e8eaf0",fontSize:22,fontWeight:700,margin:0 }}>🏖️ Nghỉ Phép</h1>
          <p style={{ color:"#8b90a7",fontSize:13,margin:"4px 0 0" }}>{leaves.length} đơn</p>
        </div>
        <button style={btnPrimary} onClick={() => setShowForm(f => !f)}>
          {showForm ? "✕ Đóng form" : "+ Gửi đơn nghỉ"}
        </button>
      </div>

      {/* ── Stats ── */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:24 }}>
        {[
          { icon:"🌴", label:"Đã dùng phép năm",     val:`${stats.annual} ngày` },
          { icon:"🤒", label:"Đã dùng phép bệnh",    val:`${stats.sick} ngày`  },
          { icon:"⏳", label:"Đơn chờ duyệt",         val:stats.pending         },
        ].map(({ icon, label, val }) => (
          <div key={label} style={{ background:"#1a1d2e",border:"1px solid #2d3154",borderRadius:12,padding:"16px 18px" }}>
            <div style={{ fontSize:22 }}>{icon}</div>
            <div style={{ color:"#e8eaf0",fontWeight:800,fontSize:20,marginTop:6 }}>{val}</div>
            <div style={{ color:"#8b90a7",fontSize:12,marginTop:2 }}>{label}</div>
          </div>
        ))}
      </div>

      {showForm && (
        <LeaveForm
          onDone={(d) => {
            setShowForm(false);
            setLeaves(prev => [d, ...prev]);
          }}
        />
      )}

      {/* ── Leave list ── */}
      {loading ? (
        <div style={{ textAlign:"center",color:"#8b90a7",padding:40 }}>Đang tải...</div>
      ) : leaves.length === 0 ? (
        <div style={{ textAlign:"center",color:"#8b90a7",padding:60 }}>Chưa có đơn nghỉ nào.</div>
      ) : (
        <div style={{ display:"grid",gap:12 }}>
          {leaves.map(l => {
            const st = STATUS_MAP[l.status] || STATUS_MAP.pending;
            const lt = LEAVE_TYPES.find(t => t.value===l.leaveType) || LEAVE_TYPES[4];
            return (
              <div key={l.id} style={{ background:"#1a1d2e",border:"1px solid #2d3154",borderRadius:14,padding:20,display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex",gap:10,alignItems:"center",marginBottom:8 }}>
                    <span style={{ fontSize:14,fontWeight:700,color:"#e8eaf0" }}>{lt.label}</span>
                    <span style={{ background:st.bg,color:st.color,padding:"2px 10px",borderRadius:20,fontSize:12,fontWeight:600 }}>{st.label}</span>
                  </div>
                  <div style={{ color:"#8b90a7",fontSize:13 }}>
                    📅 {fmtDate(l.startDate)} → {fmtDate(l.endDate)} · <strong style={{ color:"#e8eaf0" }}>{l.totalDays} ngày</strong>
                  </div>
                  <div style={{ color:"#8b90a7",fontSize:13,marginTop:4 }}>💬 {l.reason}</div>
                  {l.rejectReason && (
                    <div style={{ color:"#ef4444",fontSize:12,marginTop:6,background:"#2d0f0f",padding:"6px 10px",borderRadius:6 }}>
                      ❌ Lý do từ chối: {l.rejectReason}
                    </div>
                  )}
                </div>
                {l.status === "pending" && (
                  <button onClick={() => handleCancel(l.id)} style={{ ...btnSecondary,padding:"6px 14px",fontSize:12,color:"#ef4444",borderColor:"#ef4444",marginLeft:16 }}>
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
