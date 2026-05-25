import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import "../../styles/admin/admin.css";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

const LEAVE_TYPE_MAP = {
  annual:    { label:"Nghỉ phép năm",    color:"#5b7cf6" },
  sick:      { label:"Nghỉ bệnh",        color:"#f59e0b" },
  unpaid:    { label:"Nghỉ không lương", color:"#ef4444" },
  maternity: { label:"Thai sản",         color:"#ec4899" },
  other:     { label:"Khác",             color:"#6b7280" },
};

const STATUS_MAP = {
  pending:  { label:"Chờ duyệt", color:"#f59e0b", bg:"#2d1d00" },
  approved: { label:"Đã duyệt",  color:"#22c55e", bg:"#052e16" },
  rejected: { label:"Từ chối",   color:"#ef4444", bg:"#2d0f0f" },
};

const fmtDate = (dt) => dt ? new Date(dt).toLocaleDateString("vi-VN") : "–";

const btnPrimary   = { padding:"8px 18px",background:"#5b7cf6",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:600 };
const btnSecondary = { padding:"8px 18px",background:"transparent",color:"#8b90a7",border:"1px solid #2d3154",borderRadius:8,cursor:"pointer",fontSize:13 };
const inputStyle   = { width:"100%",background:"#0f1117",border:"1px solid #2d3154",borderRadius:8,padding:"8px 12px",color:"#e8eaf0",fontSize:14,boxSizing:"border-box" };

// ── Modal Từ chối ─────────────────────────────────────────────
const RejectModal = ({ leaveId, token, onClose, onDone }) => {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${API_BASE}/leave/${leaveId}/reject`, {
        method:"PUT",
        headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` },
        body: JSON.stringify({ rejectReason: reason }),
      });
      const d = await r.json();
      if (r.ok) { toast.success("Đã từ chối đơn nghỉ"); onDone(d); }
      else toast.error(d.error || "Từ chối thất bại");
    } catch { toast.error("Mất kết nối server"); }
    setSaving(false);
  };
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000 }}>
      <div style={{ background:"#1a1d2e",border:"1px solid #2d3154",borderRadius:16,padding:28,width:420 }}>
        <h3 style={{ color:"#e8eaf0",margin:"0 0 16px" }}>❌ Lý do từ chối</h3>
        <textarea
          style={{ ...inputStyle,minHeight:90,resize:"vertical" }}
          placeholder="Nhập lý do từ chối..."
          value={reason} onChange={e => setReason(e.target.value)}
        />
        <div style={{ display:"flex",gap:10,marginTop:16,justifyContent:"flex-end" }}>
          <button onClick={onClose} style={btnSecondary}>Hủy</button>
          <button onClick={submit} disabled={saving || !reason.trim()} style={{ ...btnPrimary,background:"#ef4444" }}>
            {saving ? "Đang gửi..." : "Từ chối"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Detail Modal ──────────────────────────────────────────────
const DetailModal = ({ leave, onClose }) => (
  <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000 }}>
    <div style={{ background:"#1a1d2e",border:"1px solid #2d3154",borderRadius:16,padding:32,width:480 }}>
      <h3 style={{ color:"#e8eaf0",margin:"0 0 20px" }}>📋 Chi tiết đơn nghỉ #{leave.id}</h3>
      <div style={{ display:"grid",gap:12 }}>
        {[
          ["Nhân viên", leave.employee?.user?.fullName],
          ["Loại nghỉ", LEAVE_TYPE_MAP[leave.leaveType]?.label || leave.leaveType],
          ["Từ ngày",   fmtDate(leave.startDate)],
          ["Đến ngày",  fmtDate(leave.endDate)],
          ["Số ngày",   leave.totalDays + " ngày"],
          ["Lý do",     leave.reason],
          ["Trạng thái",STATUS_MAP[leave.status]?.label || leave.status],
          ...(leave.rejectReason ? [["Lý do từ chối", leave.rejectReason]] : []),
          ...(leave.approvedAt ? [["Duyệt lúc", fmtDate(leave.approvedAt)]] : []),
        ].map(([k,v]) => (
          <div key={k} style={{ display:"grid",gridTemplateColumns:"140px 1fr",gap:8,borderBottom:"1px solid #1e2138",paddingBottom:10 }}>
            <span style={{ color:"#8b90a7",fontSize:13,fontWeight:600 }}>{k}</span>
            <span style={{ color:"#e8eaf0",fontSize:13 }}>{v || "–"}</span>
          </div>
        ))}
      </div>
      <button onClick={onClose} style={{ ...btnSecondary,marginTop:20,width:"100%",textAlign:"center" }}>Đóng</button>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════
const AdminLeave = () => {
  const navigate = useNavigate();
  const [token,        setToken]        = useState("");
  const [leaves,       setLeaves]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [filterStatus, setFilterStatus] = useState("pending");
  const [detailModal,  setDetailModal]  = useState(null);
  const [rejectModal,  setRejectModal]  = useState(null);

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (!t) { navigate("/login"); return; }
    setToken(t);
    fetch(`${API_BASE}/auth/verify`, { method:"POST", headers:{ Authorization:`Bearer ${t}` } })
      .then(r => r.json())
      .then(d => { if (!d.valid) { localStorage.removeItem("token"); localStorage.removeItem("user"); navigate("/login"); } });
  }, [navigate]);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus) params.set("status", filterStatus);
    fetch(`${API_BASE}/leave?${params}`, { headers:{ Authorization:`Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setLeaves(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id) => {
    if (!confirm("Duyệt đơn nghỉ này?")) return;
    try {
      const r = await fetch(`${API_BASE}/leave/${id}/approve`, {
        method:"PUT", headers:{ Authorization:`Bearer ${token}` },
      });
      const d = await r.json();
      if (r.ok) {
        toast.success("Đã duyệt đơn nghỉ thành công");
        setLeaves(prev => prev.map(l => l.id===id ? { ...l, ...d } : l));
      } else {
        toast.error(d.error || "Duyệt thất bại");
      }
    } catch { toast.error("Mất kết nối server"); }
  };

  const counts = leaves.reduce((a, l) => { a[l.status] = (a[l.status]||0)+1; return a; }, {});

  return (
    <div style={{ padding:24 }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24 }}>
        <div>
          <h1 style={{ color:"#e8eaf0",fontSize:22,fontWeight:700,margin:0 }}>🏖️ Quản lý Nghỉ Phép</h1>
          <p style={{ color:"#8b90a7",fontSize:13,margin:"4px 0 0" }}>{leaves.length} đơn</p>
        </div>
        <button style={btnSecondary} onClick={load}>🔄 Làm mới</button>
      </div>

      {/* ── Summary ── */}
      <div style={{ display:"flex",gap:12,marginBottom:20 }}>
        {Object.entries(STATUS_MAP).map(([k,v]) => (
          <div key={k} style={{ background:"#1a1d2e",border:`1px solid ${v.color}44`,borderRadius:12,padding:"14px 20px",flex:1,textAlign:"center",cursor:"pointer" }}
            onClick={() => setFilterStatus(k)}>
            <div style={{ color:v.color,fontWeight:700,fontSize:22 }}>{counts[k]||0}</div>
            <div style={{ color:"#8b90a7",fontSize:12,marginTop:2 }}>{v.label}</div>
          </div>
        ))}
      </div>

      {/* ── Filter ── */}
      <div style={{ display:"flex",gap:10,marginBottom:16 }}>
        <select style={{ ...inputStyle,width:200 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Tất cả</option>
          {Object.entries(STATUS_MAP).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button style={btnSecondary} onClick={load}>Làm mới</button>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div style={{ textAlign:"center",color:"#8b90a7",padding:60 }}>Đang tải...</div>
      ) : leaves.length === 0 ? (
        <div style={{ textAlign:"center",color:"#8b90a7",padding:60 }}>Không có đơn nghỉ.</div>
      ) : (
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%",borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ borderBottom:"1px solid #2d3154" }}>
                {["#","Nhân viên","Loại nghỉ","Từ ngày","Đến ngày","Số ngày","Lý do","Trạng thái","Thao tác"].map(h => (
                  <th key={h} style={{ textAlign:"left",color:"#8b90a7",fontSize:12,fontWeight:600,padding:"10px 12px",whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leaves.map(l => {
                const st = STATUS_MAP[l.status] || STATUS_MAP.pending;
                const lt = LEAVE_TYPE_MAP[l.leaveType] || LEAVE_TYPE_MAP.other;
                return (
                  <tr key={l.id} style={{ borderBottom:"1px solid #1e2138" }}>
                    <td style={td}>#{l.id}</td>
                    <td style={td}>
                      <div style={{ fontWeight:600,color:"#e8eaf0" }}>{l.employee?.user?.fullName}</div>
                      <div style={{ fontSize:11,color:"#8b90a7" }}>{l.employee?.employeeCode}</div>
                    </td>
                    <td style={td}><span style={{ color:lt.color,fontWeight:600 }}>{lt.label}</span></td>
                    <td style={td}>{fmtDate(l.startDate)}</td>
                    <td style={td}>{fmtDate(l.endDate)}</td>
                    <td style={td}><strong style={{ color:"#e8eaf0" }}>{l.totalDays}</strong> ngày</td>
                    <td style={td}><span style={{ color:"#8b90a7",fontSize:12,display:"block",maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{l.reason}</span></td>
                    <td style={td}>
                      <span style={{ background:st.bg,color:st.color,padding:"3px 10px",borderRadius:20,fontSize:12,fontWeight:600 }}>{st.label}</span>
                    </td>
                    <td style={td}>
                      <div style={{ display:"flex",gap:6,flexWrap:"nowrap" }}>
                        <button onClick={() => setDetailModal(l)} style={{ ...btnSecondary,padding:"5px 10px",fontSize:11 }}>Chi tiết</button>
                        {l.status === "pending" && <>
                          <button onClick={() => handleApprove(l.id)} style={{ ...btnSecondary,padding:"5px 10px",fontSize:11,color:"#22c55e",borderColor:"#22c55e" }}>✓ Duyệt</button>
                          <button onClick={() => setRejectModal(l.id)} style={{ ...btnSecondary,padding:"5px 10px",fontSize:11,color:"#ef4444",borderColor:"#ef4444" }}>✕ Từ chối</button>
                        </>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {detailModal && <DetailModal leave={detailModal} onClose={() => setDetailModal(null)} />}
      {rejectModal && (
        <RejectModal
          leaveId={rejectModal}
          token={token}
          onClose={() => setRejectModal(null)}
          onDone={(d) => {
            setRejectModal(null);
            setLeaves(prev => prev.map(l => l.id===d.id ? { ...l, ...d } : l));
          }}
        />
      )}
    </div>
  );
};

const td = { padding:"12px",color:"#c8cad8",fontSize:13,verticalAlign:"middle" };

export default AdminLeave;
