import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/admin/admin.css";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

const STATUS_MAP = {
  present:     { label:"Có mặt",    color:"#22c55e", bg:"#052e16" },
  absent:      { label:"Vắng mặt",  color:"#ef4444", bg:"#2d0f0f" },
  late:        { label:"Đi trễ",    color:"#f59e0b", bg:"#2d1d00" },
  early_leave: { label:"Về sớm",    color:"#f97316", bg:"#2d1500" },
  on_leave:    { label:"Nghỉ phép", color:"#8b5cf6", bg:"#1e0a3c" },
};

// ── Date helpers (timezone-safe) ─────────────────────────────────────────────
const padZ    = (n) => String(n).padStart(2, "0");
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${padZ(d.getMonth()+1)}-${padZ(d.getDate())}`;
};
const fmtTime = (dt) => dt ? new Date(dt).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"}) : "–";
// Parse date without timezone shift: "2026-05-25T00:00:00Z" → 25/05/2026 (not 24/05)
const fmtDate = (isoStr) => {
  if (!isoStr) return "–";
  const [y,m,d] = isoStr.split("T")[0].split("-").map(Number);
  return new Date(y, m-1, d).toLocaleDateString("vi-VN");
};

const inputStyle   = { width:"100%",background:"#0f1117",border:"1px solid #2d3154",borderRadius:8,padding:"8px 12px",color:"#e8eaf0",fontSize:14,boxSizing:"border-box" };
const btnSecondary = { padding:"8px 16px",background:"transparent",color:"#8b90a7",border:"1px solid #2d3154",borderRadius:8,cursor:"pointer",fontSize:13 };
const btnPrimary   = { padding:"8px 16px",background:"#5b7cf6",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:600 };
const labelStyle   = { display:"block",color:"#8b90a7",fontSize:12,marginBottom:6,fontWeight:600 };

// ── Modal Chỉnh sửa / Nhập thủ công ─────────────────────────────────────────
const EditModal = ({ record, employees, token, onClose, onSaved }) => {
  const isNew = !record?.id;
  const [form, setForm] = useState({
    employeeId: record?.employeeId || "",
    date:       record?.date ? record.date.split("T")[0] : todayISO(),
    checkIn:    record?.checkIn  ? new Date(record.checkIn).toISOString().slice(0,16)  : "",
    checkOut:   record?.checkOut ? new Date(record.checkOut).toISOString().slice(0,16) : "",
    status:     record?.status || "present",
    note:       record?.note || "",
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErr(""); };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const url    = isNew ? `${API_BASE}/attendance/manual` : `${API_BASE}/attendance/${record.id}`;
    const method = isNew ? "POST" : "PUT";
    const r = await fetch(url, {
      method,
      headers: { "Content-Type":"application/json", Authorization:`Bearer ${token}` },
      body: JSON.stringify(form),
    });
    const d = await r.json();
    if (!r.ok) { setErr(d.error || "Lỗi server"); setSaving(false); return; }
    onSaved(d, isNew);
  };

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000 }}>
      <div style={{ background:"#1a1d2e",border:"1px solid #2d3154",borderRadius:16,padding:32,width:460 }}>
        <h3 style={{ color:"#e8eaf0",margin:"0 0 20px",fontSize:18 }}>
          {isNew ? "➕ Nhập chấm công thủ công" : "✏️ Sửa bản ghi chấm công"}
        </h3>
        <form onSubmit={submit}>
          <div style={{ display:"grid",gap:14 }}>
            {isNew && (
              <div>
                <label style={labelStyle}>Nhân viên *</label>
                <select style={inputStyle} value={form.employeeId} onChange={e => set("employeeId",e.target.value)} required>
                  <option value="">-- Chọn nhân viên --</option>
                  {employees.map(e => <option key={e.id} value={e.id}>[{e.employeeCode}] {e.user?.fullName}</option>)}
                </select>
              </div>
            )}
            <div>
              <label style={labelStyle}>Ngày</label>
              <input type="date" style={inputStyle} value={form.date} onChange={e => set("date",e.target.value)} />
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
              <div>
                <label style={labelStyle}>Giờ vào</label>
                <input type="datetime-local" style={inputStyle} value={form.checkIn} onChange={e => set("checkIn",e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Giờ ra</label>
                <input type="datetime-local" style={inputStyle} value={form.checkOut} onChange={e => set("checkOut",e.target.value)} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Trạng thái</label>
              <select style={inputStyle} value={form.status} onChange={e => set("status",e.target.value)}>
                {Object.entries(STATUS_MAP).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Ghi chú</label>
              <input style={inputStyle} value={form.note} onChange={e => set("note",e.target.value)} />
            </div>
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

// ═══════════════════════════════════════════════════════════════════════════════
const AdminAttendance = () => {
  const navigate = useNavigate();
  const [token,       setToken]       = useState("");
  const [records,     setRecords]     = useState([]);
  const [employees,   setEmployees]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [filterEmp,   setFilterEmp]   = useState("");
  const [filterFrom,  setFilterFrom]  = useState(todayISO());
  const [filterTo,    setFilterTo]    = useState(todayISO());
  const [modal,       setModal]       = useState(null); // null | "new" | record
  const [lastUpdated, setLastUpdated] = useState(null);
  const timerRef = useRef(null);

  // ── Auth check ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = localStorage.getItem("token");
    if (!t) { navigate("/login"); return; }
    setToken(t);
    fetch(`${API_BASE}/auth/verify`, { method:"POST", headers:{ Authorization:`Bearer ${t}` } })
      .then(r => r.json())
      .then(d => { if (!d.valid) { localStorage.removeItem("token"); localStorage.removeItem("user"); navigate("/login"); } });
  }, [navigate]);

  // ── Load employees once ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/employees`, { headers:{ Authorization:`Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setEmployees(Array.isArray(d) ? d : []));
  }, [token]);

  // ── Load attendance records ───────────────────────────────────────────────────
  const load = useCallback((quiet = false) => {
    if (!token) return;
    if (!quiet) setLoading(true);
    const params = new URLSearchParams({ from: filterFrom, to: filterTo });
    if (filterEmp) params.set("employeeId", filterEmp);
    fetch(`${API_BASE}/attendance?${params}`, { headers:{ Authorization:`Bearer ${token}` } })
      .then(r => r.json())
      .then(att => {
        setRecords(Array.isArray(att) ? att : []);
        setLastUpdated(new Date());
        if (!quiet) setLoading(false);
      })
      .catch(() => { if (!quiet) setLoading(false); });
  }, [token, filterFrom, filterTo, filterEmp]);

  useEffect(() => { load(); }, [load]);

  // ── Auto-refresh 30s khi đang xem hôm nay ────────────────────────────────────
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    const isToday = filterFrom === todayISO() && filterTo === todayISO();
    if (isToday && token) {
      timerRef.current = setInterval(() => load(true), 30_000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [filterFrom, filterTo, token, load]);

  const isViewingToday = filterFrom === todayISO() && filterTo === todayISO();

  // ── Summary stats ─────────────────────────────────────────────────────────────
  const stats = records.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    acc.totalHours = (acc.totalHours || 0) + (r.workHours || 0);
    if (r.checkIn && !r.checkOut) acc.working = (acc.working || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ padding:24 }}>

      {/* ── Header ── */}
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24,flexWrap:"wrap",gap:12 }}>
        <div>
          <h1 style={{ color:"#e8eaf0",fontSize:22,fontWeight:700,margin:0 }}>⏰ Chấm Công</h1>
          <div style={{ display:"flex",alignItems:"center",gap:10,marginTop:4,flexWrap:"wrap" }}>
            <span style={{ color:"#8b90a7",fontSize:13 }}>{records.length} bản ghi</span>
            {isViewingToday && (
              <span style={{ fontSize:11,color:"#22c55e",background:"rgba(34,197,94,.12)",padding:"2px 8px",borderRadius:20,border:"1px solid rgba(34,197,94,.3)" }}>
                🔴 Tự động cập nhật 30s
              </span>
            )}
            {lastUpdated && (
              <span style={{ fontSize:11,color:"#6b7280" }}>
                · {lastUpdated.toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}
              </span>
            )}
          </div>
        </div>
        <div style={{ display:"flex",gap:10 }}>
          <button style={btnSecondary} onClick={() => load()}>🔄 Làm mới</button>
          <button style={btnPrimary}   onClick={() => setModal("new")}>+ Nhập thủ công</button>
        </div>
      </div>

      {/* ── Stats Cards ── */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:14,marginBottom:24 }}>
        {[
          { key:"working",     icon:"🟢", label:"Đang làm việc" },
          { key:"present",     icon:"✅", label:"Có mặt"        },
          { key:"absent",      icon:"❌", label:"Vắng mặt"      },
          { key:"late",        icon:"⏰", label:"Đi trễ"        },
          { key:"on_leave",    icon:"🏖️", label:"Nghỉ phép"     },
        ].map(({ key, icon, label }) => (
          <div key={key} style={{ background:"#1a1d2e",border:"1px solid #2d3154",borderRadius:12,padding:"14px 18px" }}>
            <div style={{ fontSize:20 }}>{icon}</div>
            <div style={{ color:"#e8eaf0",fontWeight:700,fontSize:22,marginTop:4 }}>{stats[key]||0}</div>
            <div style={{ color:"#8b90a7",fontSize:12 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div style={{ display:"flex",gap:12,marginBottom:20,flexWrap:"wrap",alignItems:"flex-end" }}>
        <div>
          <div style={{ color:"#8b90a7",fontSize:12,marginBottom:6 }}>Từ ngày</div>
          <input type="date" style={{ ...inputStyle,width:160 }} value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
        </div>
        <div>
          <div style={{ color:"#8b90a7",fontSize:12,marginBottom:6 }}>Đến ngày</div>
          <input type="date" style={{ ...inputStyle,width:160 }} value={filterTo}   onChange={e => setFilterTo(e.target.value)}   />
        </div>
        <div>
          <div style={{ color:"#8b90a7",fontSize:12,marginBottom:6 }}>Nhân viên</div>
          <select style={{ ...inputStyle,width:200 }} value={filterEmp} onChange={e => setFilterEmp(e.target.value)}>
            <option value="">Tất cả</option>
            {employees.map(e => <option key={e.id} value={e.id}>[{e.employeeCode}] {e.user?.fullName}</option>)}
          </select>
        </div>
        <button style={btnPrimary}   onClick={() => load()}>Lọc</button>
        <button style={btnSecondary} onClick={() => { setFilterFrom(todayISO()); setFilterTo(todayISO()); setFilterEmp(""); }}>
          Hôm nay
        </button>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div style={{ textAlign:"center",color:"#8b90a7",padding:60 }}>Đang tải...</div>
      ) : records.length === 0 ? (
        <div style={{ textAlign:"center",color:"#8b90a7",padding:60 }}>Không có dữ liệu chấm công.</div>
      ) : (
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%",borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ borderBottom:"1px solid #2d3154" }}>
                {["Nhân viên","Ngày","Ca làm","Giờ vào","Giờ ra","Giờ công","OT","Trạng thái",""].map(h => (
                  <th key={h} style={{ textAlign:"left",color:"#8b90a7",fontSize:12,fontWeight:600,padding:"10px 12px",whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map(rec => {
                const isWorking = rec.checkIn && !rec.checkOut;
                const st = isWorking
                  ? { label:"🟢 Đang làm", color:"#34d399", bg:"rgba(34,197,94,.1)" }
                  : (STATUS_MAP[rec.status] || STATUS_MAP.absent);
                return (
                  <tr
                    key={rec.id}
                    style={{
                      borderBottom:"1px solid #1e2138",
                      background: isWorking ? "rgba(34,197,94,0.03)" : undefined,
                    }}
                  >
                    <td style={td}>
                      <div style={{ fontWeight:600,color:"#e8eaf0" }}>{rec.employee?.user?.fullName}</div>
                      <div style={{ fontSize:11,color:"#8b90a7" }}>{rec.employee?.employeeCode}</div>
                    </td>
                    <td style={td}>{fmtDate(rec.date)}</td>
                    <td style={td}>{rec.shiftAssignment?.shift?.name || <span style={{ color:"#6b7280" }}>–</span>}</td>
                    <td style={td}>{fmtTime(rec.checkIn)}</td>
                    <td style={td}>
                      {isWorking
                        ? <span style={{ color:"#34d399",fontSize:11,fontStyle:"italic" }}>Chưa ra</span>
                        : fmtTime(rec.checkOut)
                      }
                    </td>
                    <td style={td}>{rec.workHours ? rec.workHours.toFixed(1) + "h" : "–"}</td>
                    <td style={td}>{rec.overtimeHours > 0 ? <span style={{ color:"#f59e0b" }}>+{rec.overtimeHours.toFixed(1)}h</span> : "–"}</td>
                    <td style={td}>
                      <span style={{
                        background:st.bg, color:st.color,
                        padding:"3px 10px", borderRadius:20,
                        fontSize:12, fontWeight:600, whiteSpace:"nowrap",
                      }}>
                        {st.label}
                      </span>
                    </td>
                    <td style={td}>
                      <button onClick={() => setModal(rec)} style={{ ...btnSecondary,padding:"5px 12px",fontSize:12 }}>Sửa</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Edit / New Modal ── */}
      {modal && (
        <EditModal
          record={modal === "new" ? null : modal}
          employees={employees}
          token={token}
          onClose={() => setModal(null)}
          onSaved={(d, isNew) => {
            setModal(null);
            if (isNew) setRecords(prev => [d, ...prev]);
            else       setRecords(prev => prev.map(r => r.id===d.id ? { ...r, ...d } : r));
          }}
        />
      )}
    </div>
  );
};

const td = { padding:"12px",color:"#c8cad8",fontSize:13,verticalAlign:"middle" };

export default AdminAttendance;
