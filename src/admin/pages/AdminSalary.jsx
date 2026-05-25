import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
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
  const isHourly = record.salaryType === "hourly";

  const [form, setForm] = useState({
    workedDays:    record.workedDays    || 0,
    totalWorkHours:record.totalWorkHours|| 0,
    overtimeHours: record.overtimeHours || 0,
    overtimePay:   record.overtimePay   || 0,
    bonus:         record.bonus         || 0,
    allowance:     record.allowance     || 0,
    deduction:     record.deduction     || 0,
    note:          record.note          || "",
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Tính lương net dự tính (live preview)
  let netPreview;
  if (isHourly) {
    netPreview = Math.max(0, Math.round(
      parseFloat(form.totalWorkHours||0) * record.baseSalary
      + parseInt(form.overtimePay||0)
      + parseInt(form.bonus||0)
      + parseInt(form.allowance||0)
      - parseInt(form.deduction||0)
    ));
  } else {
    const dailySalary = record.standardDays > 0 ? Math.round(record.baseSalary / record.standardDays) : 0;
    netPreview = Math.max(0, Math.round(
      parseFloat(form.workedDays||0) * dailySalary
      + parseInt(form.overtimePay||0)
      + parseInt(form.bonus||0)
      + parseInt(form.allowance||0)
      - parseInt(form.deduction||0)
      - (record.unpaidLeaveDays * dailySalary)
    ));
  }

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
          {isHourly ? (
            <>
              <div style={{ color:"#f59e0b",fontSize:11,fontWeight:600,marginBottom:4 }}>🕐 Part-time · Lương theo giờ</div>
              <div style={{ color:"#e8eaf0",fontSize:15,fontWeight:700 }}>{fmt(record.baseSalary)}/giờ</div>
            </>
          ) : (
            <>
              <div style={{ color:"#8b90a7",fontSize:12,marginBottom:4 }}>Lương cơ bản / ngày công chuẩn</div>
              <div style={{ color:"#e8eaf0",fontSize:15,fontWeight:700 }}>
                {fmt(record.baseSalary)} / {record.standardDays} ngày = {fmt(Math.round(record.baseSalary / (record.standardDays||26)))}/ngày
              </div>
            </>
          )}
        </div>

        <form onSubmit={submit}>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>
            {isHourly ? (
              <Row label="Tổng giờ thực làm" field="totalWorkHours" />
            ) : (
              <Row label="Ngày thực tế làm" field="workedDays" />
            )}
            <Row label="Giờ tăng ca"       field="overtimeHours" />
            <Row label="Lương tăng ca (đ)"  field="overtimePay" />
            <Row label="Thưởng (đ)"         field="bonus" />
            <Row label="Phụ cấp (đ)"        field="allowance" />
            <Row label="Khấu trừ (đ)"       field="deduction" />
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

// ── Modal xác nhận chi lương + thông tin chuyển khoản ────────────────────────
const PayModal = ({ record, token, onClose, onPaid }) => {
  const [paying, setPaying] = useState(false);
  const emp  = record.employee;
  const user = emp?.user;
  const fmt_ = (n) => (n || 0).toLocaleString("vi-VN") + "đ";

  const hasBankInfo = emp?.bankName && emp?.bankAccount;
  const vietQrUrl = emp?.bankBin && emp?.bankAccount
    ? `https://img.vietqr.io/image/${emp.bankBin}-${emp.bankAccount}-compact2.png?amount=${record.netSalary}&addInfo=${encodeURIComponent(`Luong T${record.month}/${record.year}`)}&accountName=${encodeURIComponent(emp.bankAccountName || "")}`
    : null;

  const doPay = async () => {
    setPaying(true);
    const r = await fetch(`${API_BASE}/salary/${record.id}/pay`, {
      method:"PUT", headers:{ Authorization:`Bearer ${token}` },
    });
    if (r.ok) { const d = await r.json(); onPaid(d); }
    else       toast.error("Lỗi đánh dấu đã chi.");
    setPaying(false);
  };

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16 }}>
      <div style={{ background:"#1a1d2e",border:"1px solid #2d3154",borderRadius:20,padding:28,width:"100%",maxWidth:460,maxHeight:"90vh",overflowY:"auto" }}>
        {/* Header */}
        <h3 style={{ color:"#e8eaf0",margin:"0 0 4px",fontSize:18 }}>✅ Xác nhận chi lương</h3>
        <p style={{ color:"#8b90a7",fontSize:13,margin:"0 0 20px" }}>
          {user?.fullName} — Tháng {record.month}/{record.year}
        </p>

        {/* Amount highlight */}
        <div style={{ background:"rgba(34,197,94,.08)",border:"1px solid rgba(34,197,94,.25)",borderRadius:12,padding:"16px 20px",marginBottom:20,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <span style={{ color:"#e8eaf0",fontWeight:600 }}>Số tiền cần chuyển</span>
          <span style={{ color:"#22c55e",fontWeight:900,fontSize:22 }}>{fmt_(record.netSalary)}</span>
        </div>

        {/* Bank info */}
        {hasBankInfo ? (
          <div style={{ display:"flex",gap:16,alignItems:"flex-start",background:"#0f1117",borderRadius:12,padding:16,marginBottom:20 }}>
            <div style={{ flex:1 }}>
              <div style={{ color:"#8b90a7",fontSize:11,fontWeight:600,marginBottom:12 }}>THÔNG TIN CHUYỂN KHOẢN</div>
              {[
                ["Ngân hàng",      emp.bankName],
                ["Số tài khoản",   emp.bankAccount],
                ["Chủ tài khoản",  emp.bankAccountName],
              ].map(([label, val]) => (
                <div key={label} style={{ marginBottom:10 }}>
                  <div style={{ color:"#8b90a7",fontSize:11 }}>{label}</div>
                  <div style={{ color:"#e8eaf0",fontSize:15,fontWeight:700,marginTop:2,letterSpacing: label==="Số tài khoản" ? 1 : 0 }}>{val || "—"}</div>
                </div>
              ))}
              <div style={{ marginTop:8 }}>
                <div style={{ color:"#8b90a7",fontSize:11 }}>Nội dung chuyển khoản</div>
                <div style={{ color:"#5b7cf6",fontSize:13,fontWeight:600,marginTop:2 }}>
                  Luong T{record.month}/{record.year} {emp?.employeeCode}
                </div>
              </div>
            </div>
            {vietQrUrl && (
              <div style={{ flexShrink:0,textAlign:"center" }}>
                <img src={vietQrUrl} alt="VietQR"
                  style={{ width:120,height:120,borderRadius:10,background:"#fff",padding:4,display:"block" }}
                  onError={e => { e.target.style.display = "none"; }} />
                <div style={{ color:"#8b90a7",fontSize:10,marginTop:4 }}>Quét để chuyển</div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.2)",borderRadius:10,padding:"12px 16px",marginBottom:20 }}>
            <span style={{ color:"#f59e0b",fontSize:13 }}>⚠️ Nhân viên chưa cập nhật thông tin ngân hàng. Bạn vẫn có thể đánh dấu đã chi (trả tiền mặt).</span>
          </div>
        )}

        <div style={{ display:"flex",gap:10 }}>
          <button onClick={onClose}
            style={{ flex:1,padding:"12px 0",background:"transparent",color:"#8b90a7",border:"1px solid #2d3154",borderRadius:10,cursor:"pointer",fontSize:14 }}>
            Hủy
          </button>
          <button onClick={doPay} disabled={paying}
            style={{ flex:1,padding:"12px 0",background:"#22c55e",color:"#fff",border:"none",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:14 }}>
            {paying ? "Đang xử lý..." : "✓ Xác nhận đã chi"}
          </button>
        </div>
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
  const [editModal,    setEditModal]    = useState(null);
  const [payModal,     setPayModal]     = useState(null);
  const [selectedIds,  setSelectedIds]  = useState(new Set());
  const [bulkPaying,   setBulkPaying]   = useState(false);

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
    if (r.ok) { toast.success("Đã tính lương thành công!"); load(); } else { const d = await r.json().catch(() => ({})); toast.error(d.error || "Lỗi khi tính lương. Vui lòng thử lại."); }
  };

  const handleAction = async (id, action) => {
    if (action === "pay") return; // handled by PayModal
    const labels = { confirm:"xác nhận" };
    if (!confirm(`Bạn muốn ${labels[action]} bảng lương này?`)) return;
    const r = await fetch(`${API_BASE}/salary/${id}/${action}`, {
      method:"PUT", headers:{ Authorization:`Bearer ${token}` },
    });
    if (r.ok) { const d = await r.json(); setRecords(prev => prev.map(rec => rec.id===d.id ? d : rec)); }
  };

  // ── Chọn / bỏ chọn ────────────────────────────────────────────────────────
  const confirmedRecords = records.filter(r => r.status === "confirmed");
  const allConfirmedSelected = confirmedRecords.length > 0 && confirmedRecords.every(r => selectedIds.has(r.id));

  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleAllConfirmed = () => {
    if (allConfirmedSelected) {
      setSelectedIds(prev => { const n = new Set(prev); confirmedRecords.forEach(r => n.delete(r.id)); return n; });
    } else {
      setSelectedIds(prev => { const n = new Set(prev); confirmedRecords.forEach(r => n.add(r.id)); return n; });
    }
  };

  // ── Export Excel MB BIZ (hỗn hợp nội bộ + liên ngân hàng) ────────────────
  const exportMBBiz = () => {
    const targets = records.filter(r => selectedIds.has(r.id));
    if (targets.length === 0) { toast.error("Chưa chọn nhân viên nào."); return; }

    const missing = targets.filter(r => !r.employee?.bankAccount);
    if (missing.length > 0) {
      toast(`⚠️ ${missing.length} nhân viên chưa có thông tin ngân hàng sẽ bị bỏ qua.`, { icon: "⚠️" });
    }

    const rows = targets
      .filter(r => r.employee?.bankAccount)
      .map((r, i) => ({
        "STT":                        i + 1,
        "Số TK người thụ hưởng":     r.employee.bankAccount,
        "Tên người thụ hưởng":        r.employee.bankAccountName || r.employee.user?.fullName || "",
        "Ngân hàng thụ hưởng":        r.employee.bankName || "",
        "Mã ngân hàng (BIN)":         r.employee.bankBin  || "",
        "Số tiền":                     r.netSalary,
        "Nội dung chuyển khoản":      `Luong T${r.month}/${r.year} ${r.employee.employeeCode || ""}`.trim(),
      }));

    if (rows.length === 0) { toast.error("Không có nhân viên nào đủ thông tin ngân hàng."); return; }

    const ws = XLSX.utils.json_to_sheet(rows);
    // Định dạng cột số tiền → số (không phải text)
    rows.forEach((_, i) => {
      const cell = ws[XLSX.utils.encode_cell({ r: i + 1, c: 5 })];
      if (cell) cell.t = "n";
    });
    // Độ rộng cột
    ws["!cols"] = [{ wch:5 },{ wch:22 },{ wch:28 },{ wch:18 },{ wch:12 },{ wch:14 },{ wch:36 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Luong T${month}-${year}`);
    XLSX.writeFile(wb, `MBBiz_ChiLuong_T${month}_${year}.xlsx`);
    toast.success(`✅ Đã xuất ${rows.length} bản ghi`);
  };

  // ── Bulk pay ───────────────────────────────────────────────────────────────
  const handleBulkPay = async () => {
    const ids = [...selectedIds].filter(id => records.find(r => r.id === id)?.status === "confirmed");
    if (ids.length === 0) { toast.error("Chọn ít nhất 1 bản ghi đã xác nhận."); return; }
    if (!confirm(`Đánh dấu đã chi lương cho ${ids.length} nhân viên?`)) return;
    setBulkPaying(true);
    const r = await fetch(`${API_BASE}/salary/bulk-pay`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ids }),
    });
    const d = await r.json();
    if (r.ok && d.success) {
      toast.success(`✅ Đã chi lương ${d.updated} nhân viên!`);
      setSelectedIds(new Set());
      load();
    } else {
      toast.error(d.error || "Lỗi cập nhật.");
    }
    setBulkPaying(false);
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
        <div style={{ display:"flex",gap:10,flexWrap:"wrap" }}>
          <button style={btnSecondary} onClick={load}>🔄 Làm mới</button>
          <button style={btnPrimary} onClick={handleGenerate} disabled={generating}>
            {generating ? "⏳ Đang tính..." : "⚙️ Tính lương tự động"}
          </button>
        </div>
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

      {/* ── Bulk Action Bar ── */}
      {selectedIds.size > 0 && (
        <div style={{ display:"flex",alignItems:"center",gap:12,background:"rgba(91,124,246,.12)",border:"1px solid rgba(91,124,246,.3)",borderRadius:12,padding:"12px 18px",marginBottom:16,flexWrap:"wrap" }}>
          <span style={{ color:"#a5b4fc",fontWeight:600,fontSize:14 }}>
            ☑️ Đã chọn {selectedIds.size} nhân viên
          </span>
          <div style={{ display:"flex",gap:8,marginLeft:"auto" }}>
            <button onClick={() => setSelectedIds(new Set())}
              style={{ ...btnSecondary,padding:"7px 14px",fontSize:13 }}>
              Bỏ chọn tất cả
            </button>
            <button onClick={exportMBBiz}
              style={{ padding:"7px 14px",background:"rgba(34,197,94,.15)",color:"#22c55e",border:"1px solid rgba(34,197,94,.3)",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:600 }}>
              📥 Xuất Excel MB BIZ
            </button>
            <button onClick={handleBulkPay} disabled={bulkPaying}
              style={{ padding:"7px 14px",background:"#22c55e",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:700 }}>
              {bulkPaying ? "⏳ Đang xử lý..." : "✅ Đánh dấu đã chi"}
            </button>
          </div>
        </div>
      )}

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
                {/* Checkbox chọn tất cả confirmed */}
                <th style={{ padding:"10px 12px",width:36 }}>
                  <input type="checkbox"
                    checked={allConfirmedSelected}
                    onChange={toggleAllConfirmed}
                    title="Chọn tất cả đã xác nhận"
                    style={{ cursor:"pointer",width:15,height:15,accentColor:"#5b7cf6" }} />
                </th>
                {["Nhân viên","Loại","Ngày/Giờ công","Lương CB","Tăng ca","Thưởng","Phụ cấp","Khấu trừ","Thực nhận","Ngân hàng","Trạng thái",""].map(h => (
                  <th key={h} style={{ textAlign:"left",color:"#8b90a7",fontSize:12,fontWeight:600,padding:"10px 12px",whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map(rec => {
                const st = STATUS_MAP[rec.status] || STATUS_MAP.draft;
                return (
                  <tr key={rec.id} style={{ borderBottom:"1px solid #1e2138", background: selectedIds.has(rec.id) ? "rgba(91,124,246,.06)" : "transparent" }}>
                    {/* Checkbox — chỉ cho phép chọn confirmed */}
                    <td style={{ ...td, width:36 }}>
                      {rec.status === "confirmed" && (
                        <input type="checkbox"
                          checked={selectedIds.has(rec.id)}
                          onChange={() => toggleSelect(rec.id)}
                          style={{ cursor:"pointer",width:15,height:15,accentColor:"#5b7cf6" }} />
                      )}
                    </td>
                    <td style={td}>
                      <div style={{ fontWeight:600,color:"#e8eaf0" }}>{rec.employee?.user?.fullName}</div>
                      <div style={{ fontSize:11,color:"#8b90a7" }}>{rec.employee?.employeeCode}</div>
                    </td>
                    <td style={td}>
                      {rec.salaryType === "hourly"
                        ? <span style={{ background:"rgba(245,158,11,.12)",color:"#f59e0b",border:"1px solid rgba(245,158,11,.3)",borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:600 }}>Part-time</span>
                        : <span style={{ background:"rgba(91,124,246,.12)",color:"#a5b4fc",border:"1px solid rgba(91,124,246,.3)",borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:600 }}>Full-time</span>
                      }
                    </td>
                    <td style={td}>
                      {rec.salaryType === "hourly"
                        ? <span style={{ color:"#e8eaf0" }}>{rec.totalWorkHours?.toFixed(1)}h</span>
                        : <span>{rec.workedDays}/{rec.standardDays} ngày</span>
                      }
                    </td>
                    <td style={td}>
                      <div style={{ fontSize:13 }}>{fmt(rec.baseSalary)}</div>
                      <div style={{ fontSize:11,color:"#6b7280" }}>{rec.salaryType==="hourly" ? "/giờ" : "/tháng"}</div>
                    </td>
                    <td style={td}>{rec.overtimeHours > 0 ? <span style={{ color:"#f59e0b" }}>+{rec.overtimeHours}h · {fmt(rec.overtimePay)}</span> : "–"}</td>
                    <td style={td}>{rec.bonus > 0 ? <span style={{ color:"#22c55e" }}>+{fmt(rec.bonus)}</span> : "–"}</td>
                    <td style={td}>{rec.allowance > 0 ? fmt(rec.allowance) : "–"}</td>
                    <td style={td}>{rec.deduction > 0 ? <span style={{ color:"#ef4444" }}>-{fmt(rec.deduction)}</span> : "–"}</td>
                    <td style={td}><strong style={{ color:"#22c55e",fontSize:15 }}>{fmt(rec.netSalary)}</strong></td>
                    {/* Ngân hàng */}
                    <td style={td}>
                      {rec.employee?.bankAccount ? (
                        <div>
                          <div style={{ color:"#e8eaf0",fontSize:12,fontWeight:600 }}>{rec.employee.bankName}</div>
                          <div style={{ color:"#8b90a7",fontSize:11 }}>{rec.employee.bankAccount}</div>
                        </div>
                      ) : (
                        <span style={{ color:"#4b5563",fontSize:12 }}>—</span>
                      )}
                    </td>
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
                          <button onClick={() => setPayModal(rec)} style={{ ...btnSecondary,padding:"5px 10px",fontSize:11,color:"#22c55e",borderColor:"#22c55e" }}>
                            💸 Chi lương
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
      {payModal && (
        <PayModal
          record={payModal}
          token={token}
          onClose={() => setPayModal(null)}
          onPaid={(d) => {
            setPayModal(null);
            toast.success("✅ Đã đánh dấu chi lương!");
            setRecords(prev => prev.map(r => r.id===d.id ? d : r));
          }}
        />
      )}
    </div>
  );
};

const td = { padding:"12px",color:"#c8cad8",fontSize:13,verticalAlign:"middle" };

export default AdminSalary;
