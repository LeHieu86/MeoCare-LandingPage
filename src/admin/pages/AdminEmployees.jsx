import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/admin/admin.css";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

const DEPARTMENTS = [
  { value: "general", label: "Tổng hợp" },
  { value: "sales",   label: "Bán hàng" },
  { value: "care",    label: "Chăm sóc thú cưng" },
  { value: "admin",   label: "Hành chính" },
];

// employmentType maps 1:1 với salaryType:
//   full_time  → monthly (lương tháng)
//   part_time  → hourly  (lương giờ)
const EMPLOYMENT_TYPES = [
  { value: "full_time", salaryType: "monthly", label: "Full-time (lương tháng)" },
  { value: "part_time", salaryType: "hourly",  label: "Part-time (lương giờ)"  },
];

const ROLES = [
  { value: "employee", label: "Nhân viên" },
  { value: "manager",  label: "Quản lý" },
];

const STATUS_MAP = {
  active:     { label: "Đang làm",    color: "#22c55e" },
  inactive:   { label: "Tạm nghỉ",   color: "#f59e0b" },
  terminated: { label: "Đã nghỉ việc", color: "#ef4444" },
};

const fmt = (n) => (n || 0).toLocaleString("vi-VN") + "đ";

// ── Modal Tạo / Sửa Nhân Viên ─────────────────────────────────
const EmployeeModal = ({ emp, onClose, onSaved, token, currentUserRole }) => {
  const isEdit = !!emp?.id;

  // Tính employmentType từ salaryType hiện tại
  const initEmploymentType = emp?.salaryType === "hourly" ? "part_time" : "full_time";

  const [form, setForm] = useState({
    username:       emp?.user?.username   || "",
    password:       "",
    fullName:       emp?.user?.fullName   || "",
    email:          emp?.user?.email      || "",
    phone:          emp?.user?.phone === "Null" ? "" : (emp?.user?.phone || ""),
    role:           emp?.user?.role       || "employee",
    department:     emp?.department       || "general",
    position:       emp?.position         || "Nhân viên",
    startDate:      emp?.startDate ? emp.startDate.split("T")[0] : new Date().toISOString().split("T")[0],
    employmentType: initEmploymentType,
    baseSalary:     emp?.baseSalary       || 0,
    status:         emp?.status           || "active",
    note:           emp?.note             || "",
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErr(""); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setErr("");
    try {
      const url    = isEdit ? `${API_BASE}/employees/${emp.id}` : `${API_BASE}/employees`;
      const method = isEdit ? "PUT" : "POST";
      const body   = isEdit
        ? { fullName: form.fullName, email: form.email, phone: form.phone,
            role: form.role, department: form.department, position: form.position,
            startDate: form.startDate, employmentType: form.employmentType,
            baseSalary: form.baseSalary, status: form.status, note: form.note,
            ...(form.password ? { password: form.password } : {}) }
        : { ...form, employmentType: form.employmentType };

      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) { setErr(data.error || "Lỗi server"); setSaving(false); return; }
      onSaved(data, isEdit);
    } catch { setErr("Mất kết nối server."); setSaving(false); }
  };

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000 }}>
      <div style={{ background:"#1a1d2e",border:"1px solid #2d3154",borderRadius:16,padding:32,width:560,maxHeight:"90vh",overflowY:"auto" }}>
        <h3 style={{ color:"#e8eaf0",margin:"0 0 24px",fontSize:18 }}>
          {isEdit ? "✏️ Sửa thông tin nhân viên" : "➕ Thêm nhân viên mới"}
        </h3>

        <form onSubmit={handleSubmit}>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16 }}>
            {!isEdit && <>
              <Field label="Username *" value={form.username} onChange={v => set("username",v)} />
              <Field label="Mật khẩu *" type="password" value={form.password} onChange={v => set("password",v)} />
            </>}
            {isEdit && <Field label="Mật khẩu mới (để trống = không đổi)" type="password" value={form.password} onChange={v => set("password",v)} span={2} />}

            <Field label="Họ và tên *" value={form.fullName} onChange={v => set("fullName",v)} />
            <Field label="Email *"     value={form.email}    onChange={v => set("email",v)}    />
            <Field label="Số điện thoại" value={form.phone} onChange={v => set("phone",v)} />

            <div>
              <label style={labelStyle}>Vai trò</label>
              <select style={inputStyle} value={form.role} onChange={e => set("role",e.target.value)}
                disabled={form.role === "manager" && currentUserRole !== "admin"}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Phòng ban</label>
              <select style={inputStyle} value={form.department} onChange={e => set("department",e.target.value)}>
                {DEPARTMENTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>

            <Field label="Chức vụ" value={form.position} onChange={v => set("position",v)} />
            <Field label="Ngày bắt đầu" type="date" value={form.startDate} onChange={v => set("startDate",v)} />

            <div>
              <label style={labelStyle}>Loại nhân viên</label>
              <select style={inputStyle} value={form.employmentType} onChange={e => set("employmentType",e.target.value)}>
                {EMPLOYMENT_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>

            <Field
              label={form.employmentType === "part_time" ? "Đơn giá theo giờ (đ)" : "Lương cơ bản/tháng (đ)"}
              type="number"
              value={form.baseSalary}
              onChange={v => set("baseSalary", parseInt(v) || 0)}
            />

            {isEdit && <div>
              <label style={labelStyle}>Trạng thái</label>
              <select style={inputStyle} value={form.status} onChange={e => set("status",e.target.value)}>
                {Object.entries(STATUS_MAP).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>}

            <Field label="Ghi chú" value={form.note} onChange={v => set("note",v)} span={isEdit ? 1 : 2} />
          </div>

          {err && <p style={{ color:"#ef4444",marginTop:12,fontSize:13 }}>{err}</p>}

          <div style={{ display:"flex",gap:12,marginTop:24,justifyContent:"flex-end" }}>
            <button type="button" onClick={onClose} style={btnSecondary}>Hủy</button>
            <button type="submit" disabled={saving} style={btnPrimary}>
              {saving ? "Đang lưu..." : (isEdit ? "Lưu thay đổi" : "Tạo nhân viên")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Field = ({ label, type="text", value, onChange, span=1 }) => (
  <div style={{ gridColumn: span > 1 ? `span ${span}` : undefined }}>
    <label style={labelStyle}>{label}</label>
    <input type={type} style={inputStyle} value={value}
      onChange={e => onChange(e.target.value)} />
  </div>
);

const labelStyle = { display:"block",color:"#8b90a7",fontSize:12,marginBottom:6,fontWeight:600 };
const inputStyle = { width:"100%",background:"#0f1117",border:"1px solid #2d3154",borderRadius:8,padding:"8px 12px",color:"#e8eaf0",fontSize:14,boxSizing:"border-box" };
const btnPrimary   = { padding:"10px 24px",background:"#5b7cf6",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontSize:14,fontWeight:600 };
const btnSecondary = { padding:"10px 24px",background:"transparent",color:"#8b90a7",border:"1px solid #2d3154",borderRadius:8,cursor:"pointer",fontSize:14 };

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════
const AdminEmployees = () => {
  const navigate = useNavigate();
  const [token,       setToken]       = useState("");
  const [currentRole, setCurrentRole] = useState("admin");
  const [employees,   setEmployees]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [filterStatus,setFilterStatus]= useState("");
  const [filterDept,  setFilterDept]  = useState("");
  const [modal,       setModal]       = useState(null); // null | "create" | {emp}

  // ── Auth ──
  useEffect(() => {
    const t = localStorage.getItem("token");
    if (!t) { navigate("/login"); return; }
    setToken(t);
    fetch(`${API_BASE}/auth/verify`, { method:"POST", headers:{ Authorization:`Bearer ${t}` } })
      .then(r => r.json())
      .then(d => { if (!d.valid) { localStorage.removeItem("token"); localStorage.removeItem("user"); navigate("/login"); }
                   else setCurrentRole(d.user?.role || "admin"); });
  }, [navigate]);

  // ── Fetch ──
  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus) params.set("status", filterStatus);
    if (filterDept)   params.set("department", filterDept);
    if (search)       params.set("search", search);

    fetch(`${API_BASE}/employees?${params}`, { headers:{ Authorization:`Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setEmployees(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token, filterStatus, filterDept, search]);

  useEffect(() => { load(); }, [load]);

  const handleSaved = (data, isEdit) => {
    setModal(null);
    if (isEdit) setEmployees(prev => prev.map(e => e.id === data.id ? data : e));
    else        setEmployees(prev => [data, ...prev]);
  };

  const handleTerminate = async (emp) => {
    if (!confirm(`Vô hiệu hóa nhân viên ${emp.user.fullName}?`)) return;
    const r = await fetch(`${API_BASE}/employees/${emp.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.ok) setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, status: "terminated" } : e));
  };

  return (
    <div style={{ padding: 24 }}>
      {/* ── Header ── */}
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24 }}>
        <div>
          <h1 style={{ color:"#e8eaf0",fontSize:22,fontWeight:700,margin:0 }}>👥 Quản lý Nhân Viên</h1>
          <p style={{ color:"#8b90a7",fontSize:13,margin:"4px 0 0" }}>
            {employees.length} nhân viên
          </p>
        </div>
        <div style={{ display:"flex",gap:10 }}>
          <button style={btnSecondary} onClick={load}>🔄 Làm mới</button>
          <button style={btnPrimary}   onClick={() => setModal("create")}>+ Thêm nhân viên</button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div style={{ display:"flex",gap:12,marginBottom:20,flexWrap:"wrap" }}>
        <input
          placeholder="🔍 Tìm tên, mã NV, email..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, width:260 }}
          onKeyDown={e => e.key === "Enter" && load()}
        />
        <select style={{ ...inputStyle, width:160 }} value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          {Object.entries(STATUS_MAP).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select style={{ ...inputStyle, width:180 }} value={filterDept}
          onChange={e => setFilterDept(e.target.value)}>
          <option value="">Tất cả phòng ban</option>
          {DEPARTMENTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <button style={btnSecondary} onClick={load}>Lọc</button>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div style={{ textAlign:"center",color:"#8b90a7",padding:60 }}>Đang tải...</div>
      ) : employees.length === 0 ? (
        <div style={{ textAlign:"center",color:"#8b90a7",padding:60 }}>Chưa có nhân viên nào.</div>
      ) : (
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%",borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ borderBottom:"1px solid #2d3154" }}>
                {["Mã NV","Nhân viên","Phòng ban","Chức vụ","Loại NV","Lương CB","Vai trò","Trạng thái",""].map(h => (
                  <th key={h} style={{ textAlign:"left",color:"#8b90a7",fontSize:12,fontWeight:600,padding:"10px 12px",whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => {
                const st = STATUS_MAP[emp.status] || STATUS_MAP.inactive;
                return (
                  <tr key={emp.id} style={{ borderBottom:"1px solid #1e2138" }}>
                    <td style={td}><span style={{ fontFamily:"monospace",color:"#5b7cf6",fontWeight:700 }}>{emp.employeeCode}</span></td>
                    <td style={td}>
                      <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                        <div style={{ width:36,height:36,borderRadius:"50%",background:"#2d3154",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,overflow:"hidden" }}>
                          {emp.user.avatar ? <img src={emp.user.avatar} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} /> : "👤"}
                        </div>
                        <div>
                          <div style={{ color:"#e8eaf0",fontWeight:600,fontSize:14 }}>{emp.user.fullName}</div>
                          <div style={{ color:"#8b90a7",fontSize:12 }}>{emp.user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={td}>{DEPARTMENTS.find(d=>d.value===emp.department)?.label || emp.department}</td>
                    <td style={td}>{emp.position}</td>
                    <td style={td}>
                      {emp.salaryType === "hourly"
                        ? <span style={{ background:"rgba(245,158,11,.12)",color:"#f59e0b",border:"1px solid rgba(245,158,11,.3)",borderRadius:6,padding:"2px 10px",fontSize:11,fontWeight:600 }}>Part-time</span>
                        : <span style={{ background:"rgba(91,124,246,.12)",color:"#a5b4fc",border:"1px solid rgba(91,124,246,.3)",borderRadius:6,padding:"2px 10px",fontSize:11,fontWeight:600 }}>Full-time</span>
                      }
                    </td>
                    <td style={td}>
                      <div>
                        <div style={{ color:"#e8eaf0",fontSize:13,fontWeight:600 }}>{fmt(emp.baseSalary)}</div>
                        <div style={{ color:"#8b90a7",fontSize:11 }}>{emp.salaryType === "hourly" ? "/ giờ" : "/ tháng"}</div>
                      </div>
                    </td>
                    <td style={td}>
                      <span style={{ background:"#1e2138",border:"1px solid #2d3154",borderRadius:6,padding:"3px 10px",fontSize:12,color:"#a5b4fc" }}>
                        {ROLES.find(r=>r.value===emp.user.role)?.label || emp.user.role}
                      </span>
                    </td>
                    <td style={td}>
                      <span style={{ color:st.color,fontWeight:600,fontSize:13 }}>● {st.label}</span>
                    </td>
                    <td style={td}>
                      <div style={{ display:"flex",gap:8 }}>
                        <button onClick={() => setModal(emp)} style={{ ...btnSecondary,padding:"6px 14px",fontSize:12 }}>Sửa</button>
                        {emp.status !== "terminated" && (
                          <button onClick={() => handleTerminate(emp)} style={{ ...btnSecondary,padding:"6px 14px",fontSize:12,color:"#ef4444",borderColor:"#ef4444" }}>Vô hiệu</button>
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

      {/* ── Modal ── */}
      {modal && (
        <EmployeeModal
          emp={modal === "create" ? null : modal}
          token={token}
          currentUserRole={currentRole}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
};

const td = { padding:"12px",color:"#c8cad8",fontSize:14,verticalAlign:"middle" };

export default AdminEmployees;
