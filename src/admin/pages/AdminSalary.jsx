import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/admin/admin.css";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

const STATUS_MAP = {
  draft:     { label:"Nháp",        color:"#8b90a7", bg:"#1e2138" },
  confirmed: { label:"Đã xác nhận", color:"#5b7cf6", bg:"#1a1d3e" },
  paid:      { label:"Đã chi",      color:"#22c55e", bg:"#052e16" },
};

const fmt  = (n) => (n||0).toLocaleString("vi-VN") + "đ";
const now  = new Date();
const inputStyle  = { width:"100%",background:"#0f1117",border:"1px solid #2d3154",borderRadius:8,padding:"8px 12px",color:"#e8eaf0",fontSize:14,boxSizing:"border-box" };
const btnPrimary  = { padding:"9px 20px",background:"#5b7cf6",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:600 };
const btnSecondary= { padding:"9px 20px",background:"transparent",color:"#8b90a7",border:"1px solid #2d3154",borderRadius:8,cursor:"pointer",fontSize:13 };
const labelStyle  = { display:"block",color:"#8b90a7",fontSize:12,marginBottom:6,fontWeight:600 };

// ── Modal chỉnh sửa chi tiết lương ───────────────────────────
const EditSalaryModal = ({ record, token, onClose, onSaved }) => {
  const [form, setForm] = useState({
    workedDays:   record.workedDays   || 0,
    overtimeHours:record.overtimeHours|| 0,
    overtimePay:  record.overtimePay  || 0,
    bonus:        record.bonus        || 0,
    allowance:    record.allowance    || 0,
    deduction:    record.deduction    || 0,
    note:         record.note         || "",
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Tính lương net ngay khi form thay đổi
  const dailySalary = Math.round(record.baseSalary / record.standardDays);
  const netPreview  = Math.max(0, Math.round(
    form.workedDays * dailySalary
    + parseInt(form.overtimePay||0)
    + parseInt(form.bonus||0)
    + parseInt(form.allowance||0)
    - parseInt(form.deduction||0)
    - (record.unpaidLeaveDays * dailySalary)
  ));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const r = await fetch(`${API_BASE}/salary/${record.id}`, {
      method:"PUT",
      headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` },
      body: JSON.stringify(form),
    });
    const d = await r.json();
    if (!r.ok) { setErr(d.error||"Lỗi server"); setSaving(false); return; }
    onSaved(d);
  };

  const Row = ({ label, field, type="number" }) => (
    <div>
      <label style={labelStyle}>{label}</label>
      <input type={type} style={inputStyle} value={form[field]}
        onChange={e => set(field, type==="number" ? parseFloat(e.target.value)||0 : e.target.value)} />
    </div>
  );

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000 }}>
      <div style={{ background:"#1a1d2e",border:"1px solid #2d3154",borderRadius:16,padding:32,width:520,maxHeight:"90vh",overflowY:"auto" }}>
        <h3 style={{ color:"#e8eaf0",margin:"0 0 4px",fontSize:18 }}>✏️ Sửa bảng lương</h3>
        <p style={{ color:"#8b90a7",fontSize:13,margin:"0 0 20px" }}>
          {record.employee?.user?.fullName} — Tháng {record.month}/{record.year}
        </p>

        <div style={{ background:"#0f1117",borderRadius:10,padding:"14px 18px",marginBottom:20 }}>
          <div style={{ color:"#8b90a7",fontSize:12,marginBottom:4 }}>Lương cơ bản / ngày công chuẩn</div>
          <div style={{ color:"#e8eaf0",fontSize:15,fontWeight:700 }}>
            {fmt(record.baseSalary)} / {record.standardDays} ngày = {fmt(dailySalary)}/ngày
          </div>
        </div>

        <form onSubmit={submit}>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>
            <Row label="Ngày thực tế làm" field="workedDays" />
            <Row label="Giờ tăng ca"      field="overtimeHours" />
            <Row label="Lương tăng ca (đ)" field="overtimePay" />
            <Row label="Thưởng (đ)"        field="bonus" />
            <Row label="Phụ cấp (đ)"       field="allowance" />
            <Row label="Khấu trừ (đ)"      field="deduction" />
            <Row label="Ghi chú" field="note" type="text" />
          </div>

          <div style={{ background:"#0f1117",borderRadius:10,padding:"14px 18px",marginTop:16,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
            <span style={{ color:"#8b90a7",fontSize:13 }}>Lương thực nhận (dự tính)</span>
            <span style={{ color:"#22c55e",fontSize:20,fontWeight:800 }}>{fmt(netPreview)}</span>
          </div>

          {err && <p style={{ color:"#ef4444",fontSize:13,marginTop:10 }}>{err}</p>}
          <div style={{ display:"flex",gap:12,marginTop:20,justifyContent:"flex-end" }}>
            <button type="button" onClick={onClose} style={btnSecondary}>Hủy</button>
            <button type="submit" disabled={saving} style={btnPrimary}>{saving?"Đang lưu...":"Lưu"}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
const AdminSalary = () => {
  const navigate = useNavigate();
  const [token,      setToken]      = useState("");
  const [records,    setRecords]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [generating, setGenerating] = useState(false);
  const [month,      setMonth]      = useState(now.getMonth()+1);
  const [year,       setYear]       = useState(now.getFullYear());
  const [filterStatus,setFilterStatus]=useState("");
  const [editModal,  setEditModal]  = useState(null);

  useEffect(() => {
    const t = localStorage.getItem("mc_admin_token");
    if (!t) { navigate("/admin/login"); return; }
    setToken(t);
    fetch(`${API_BASE}/auth/verify`, { method:"POST", headers:{ Authorization:`Bearer ${t}` } })
      .then(r => r.json())
      .then(d => { if (!d.valid) { localStorage.removeItem("mc_admin_token"); navigate("/admin/login"); } });
  }, [navigate]);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams({ month, year });
    if (filterStatus) params.set("status", filterStatus);
    fetch(`${API_BASE}/salary?${params}`, { headers:{ Authorization:`Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setRecords(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token, month, year, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    if (!confirm(`Tính lương tự động cho tất cả nhân viên tháng ${month}/${year}?`)) return;
    setGenerating(true);
    const r = await fetch(`${API_BASE}/salary/generate`, {
      method:"POST",
      headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` },
      body: JSON.stringify({ month, year }),
    });
    setGenerating(false);
    if (r.ok) { load(); } else alert("Lỗi khi tính lương. Vui lòng thử lại.");
  };

  const handleAction = async (id, action) => {
    const labels = { confirm:"xác nhận", pay:"đánh dấu đã chi" };
    if (!confirm(`Bạn muốn ${labels[action]} bảng lương này?`)) return;
    const r = await fetch(`${API_BASE}/salary/${id}/${action}`, {
      method:"PUT", headers:{ Authorization:`Bearer ${token}` },
    });
    if (r.ok) { const d = await r.json(); setRecords(prev => prev.map(rec => rec.id===d.id ? d : rec)); }
  };

  // Summary
  const totalNet = records.reduce((s, r) => s + (r.netSalary || 0), 0);
  const paidCount = records.filter(r => r.status === "paid").length;

  return (
    <div style={{ padding:24 }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24 }}>
        <div>
          <h1 style={{ color:"#e8eaf0",fontSize:22,fontWeight:700,margin:0 }}>💰 Bảng Lương</h1>
          <p style={{ color:"#8b90a7",fontSize:13,margin:"4px 0 0" }}>Tháng {month}/{year} — {records.length} nhân viên</p>
        </div>
        <button style={btnPrimary} onClick={handleGenerate} disabled={generating}>
          {generating ? "⏳ Đang tính..." : "⚙️ Tính lương tự động"}
        </button>
      </div>

      {/* ── Summary ── */}
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,marginBottom:24 }}>
        <div style={{ background:"#1a1d2e",border:"1px solid #2d3154",borderRadius:12,padding:"16px 20px" }}>
          <div style={{ color:"#8b90a7",fontSize:12 }}>Tổng lương phải trả</div>
          <div style={{ color:"#22c55e",fontWeight:800,fontSize:20,marginTop:4 }}>{fmt(totalNet)}</div>
        </div>
        <div style={{ background:"#1a1d2e",border:"1px solid #2d3154",borderRadius:12,padding:"16px 20px" }}>
          <div style={{ color:"#8b90a7",fontSize:12 }}>Đã chi trả</div>
          <div style={{ color:"#5b7cf6",fontWeight:800,fontSize:20,marginTop:4 }}>{paidCount}/{records.length} người</div>
        </div>
        <div style={{ background:"#1a1d2e",border:"1px solid #2d3154",borderRadius:12,padding:"16px 20px" }}>
          <div style={{ color:"#8b90a7",fontSize:12 }}>Chờ xử lý</div>
          <div style={{ color:"#f59e0b",fontWeight:800,fontSize:20,marginTop:4 }}>
            {records.filter(r => r.status==="draft" || r.status==="confirmed").length} người
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div style={{ display:"flex",gap:12,marginBottom:20,alignItems:"flex-end",flexWrap:"wrap" }}>
        <div>
          <div style={{ color:"#8b90a7",fontSize:12,marginBottom:6 }}>Tháng</div>
          <select style={{ ...inputStyle,width:100 }} value={month} onChange={e => setMonth(parseInt(e.target.value))}>
            {Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>Tháng {i+1}</option>)}
          </select>
        </div>
        <div>
          <div style={{ color:"#8b90a7",fontSize:12,marginBottom:6 }}>Năm</div>
          <select style={{ ...inputStyle,width:110 }} value={year} onChange={e => setYear(parseInt(e.target.value))}>
            {[2024,2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <div style={{ color:"#8b90a7",fontSize:12,marginBottom:6 }}>Trạng thái</div>
          <select style={{ ...inputStyle,width:160 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Tất cả</option>
            {Object.entries(STATUS_MAP).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <button style={btnSecondary} onClick={load}>Lọc</button>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div style={{ textAlign:"center",color:"#8b90a7",padding:60 }}>Đang tải...</div>
      ) : records.length === 0 ? (
        <div style={{ textAlign:"center",color:"#8b90a7",padding:60 }}>
          Chưa có bảng lương. Nhấn "Tính lương tự động" để tạo.
        </div>
      ) : (
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%",borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ borderBottom:"1px solid #2d3154" }}>
                {["Nhân viên","Ngày công","Lương CB","Tăng ca","Thưởng","Phụ cấp","Khấu trừ","Thực nhận","Trạng thái",""].map(h => (
                  <th key={h} style={{ textAlign:"left",color:"#8b90a7",fontSize:12,fontWeight:600,padding:"10px 12px",whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map(rec => {
                const st = STATUS_MAP[rec.status] || STATUS_MAP.draft;
                return (
                  <tr key={rec.id} style={{ borderBottom:"1px solid #1e2138" }}>
                    <td style={td}>
                      <div style={{ fontWeight:600,color:"#e8eaf0" }}>{rec.employee?.user?.fullName}</div>
                      <div style={{ fontSize:11,color:"#8b90a7" }}>{rec.employee?.employeeCode}</div>
                    </td>
                    <td style={td}>{rec.workedDays}/{rec.standardDays}</td>
                    <td style={td}>{fmt(rec.baseSalary)}</td>
                    <td style={td}>{rec.overtimeHours > 0 ? <span style={{ color:"#f59e0b" }}>+{rec.overtimeHours}h · {fmt(rec.overtimePay)}</span> : "–"}</td>
                    <td style={td}>{rec.bonus > 0 ? <span style={{ color:"#22c55e" }}>+{fmt(rec.bonus)}</span> : "–"}</td>
                    <td style={td}>{rec.allowance > 0 ? fmt(rec.allowance) : "–"}</td>
                    <td style={td}>{rec.deduction > 0 ? <span style={{ color:"#ef4444" }}>-{fmt(rec.deduction)}</span> : "–"}</td>
                    <td style={td}><strong style={{ color:"#22c55e",fontSize:15 }}>{fmt(rec.netSalary)}</strong></td>
                    <td style={td}>
                      <span style={{ background:st.bg,color:st.color,padding:"3px 10px",borderRadius:20,fontSize:12,fontWeight:600 }}>{st.label}</span>
                    </td>
                    <td style={td}>
                      <div style={{ display:"flex",gap:6 }}>
                        {rec.status !== "paid" && (
                          <button onClick={() => setEditModal(rec)} style={{ ...btnSecondary,padding:"5px 10px",fontSize:11 }}>Sửa</button>
                        )}
                        {rec.status === "draft" && (
                          <button onClick={() => handleAction(rec.id,"confirm")} style={{ ...btnSecondary,padding:"5px 10px",fontSize:11,color:"#5b7cf6",borderColor:"#5b7cf6" }}>
                            Xác nhận
                          </button>
                        )}
                        {rec.status === "confirmed" && (
                          <button onClick={() => handleAction(rec.id,"pay")} style={{ ...btnSecondary,padding:"5px 10px",fontSize:11,color:"#22c55e",borderColor:"#22c55e" }}>
                            ✓ Đã chi
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editModal && (
        <EditSalaryModal
          record={editModal}
          token={token}
          onClose={() => setEditModal(null)}
          onSaved={(d) => {
            setEditModal(null);
            setRecords(prev => prev.map(r => r.id===d.id ? d : r));
          }}
        />
      )}
    </div>
  );
};

const td = { padding:"12px",color:"#c8cad8",fontSize:13,verticalAlign:"middle" };

export default AdminSalary;
