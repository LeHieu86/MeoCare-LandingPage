import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import "../../styles/admin/admin.css";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

const STATUS_COLORS = {
  scheduled:  { label: "Đã lên lịch",  color: "#5b7cf6" },
  completed:  { label: "Hoàn thành",    color: "#22c55e" },
  absent:     { label: "Vắng mặt",      color: "#ef4444" },
  cancelled:  { label: "Đã hủy",        color: "#6b7280" },
};

const todayISO = () => new Date().toISOString().split("T")[0];
const addDays  = (iso, n) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
};
const fmtDate = (iso) => new Date(iso).toLocaleDateString("vi-VN", { weekday:"short", day:"2-digit", month:"2-digit" });

const inputStyle = { width:"100%",background:"#0f1117",border:"1px solid #2d3154",borderRadius:8,padding:"8px 12px",color:"#e8eaf0",fontSize:14,boxSizing:"border-box" };
const btnPrimary   = { padding:"10px 20px",background:"#5b7cf6",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontSize:14,fontWeight:600 };
const btnSecondary = { padding:"8px 16px",background:"transparent",color:"#8b90a7",border:"1px solid #2d3154",borderRadius:8,cursor:"pointer",fontSize:13 };
const labelStyle   = { display:"block",color:"#8b90a7",fontSize:12,marginBottom:6,fontWeight:600 };

// ── Modal: tạo / sửa shift template ──────────────────────────
const ShiftModal = ({ shift, onClose, onSaved, token }) => {
  const isEdit = !!shift?.id;
  const [form, setForm] = useState({
    name:      shift?.name      || "",
    startTime: shift?.startTime || "08:00",
    endTime:   shift?.endTime   || "16:00",
    maxSlots:  shift?.maxSlots  || 10,
    note:      shift?.note      || "",
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErr(""); };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const r = await fetch(`${API_BASE}/shifts${isEdit ? "/" + shift.id : ""}`, {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type":"application/json", Authorization:`Bearer ${token}` },
      body: JSON.stringify({ ...form, maxSlots: parseInt(form.maxSlots) }),
    });
    const d = await r.json();
    if (!r.ok) { setErr(d.error || "Lỗi server"); setSaving(false); return; }
    toast.success(isEdit ? "Đã cập nhật ca làm" : "Đã thêm ca làm mới");
    onSaved(d, isEdit);
  };

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000 }}>
      <div style={{ background:"#1a1d2e",border:"1px solid #2d3154",borderRadius:16,padding:32,width:440 }}>
        <h3 style={{ color:"#e8eaf0",margin:"0 0 24px",fontSize:18 }}>
          {isEdit ? "✏️ Sửa ca làm" : "➕ Thêm ca làm mới"}
        </h3>
        <form onSubmit={submit}>
          <div style={{ display:"grid",gap:14 }}>
            <div>
              <label style={labelStyle}>Tên ca *</label>
              <input style={inputStyle} value={form.name} onChange={e => set("name",e.target.value)} placeholder="VD: Ca sáng" required />
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
              <div>
                <label style={labelStyle}>Giờ bắt đầu *</label>
                <input type="time" style={inputStyle} value={form.startTime} onChange={e => set("startTime",e.target.value)} required />
              </div>
              <div>
                <label style={labelStyle}>Giờ kết thúc *</label>
                <input type="time" style={inputStyle} value={form.endTime} onChange={e => set("endTime",e.target.value)} required />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Số chỗ tối đa</label>
              <input type="number" style={inputStyle} value={form.maxSlots} min={1} onChange={e => set("maxSlots",e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Ghi chú</label>
              <input style={inputStyle} value={form.note} onChange={e => set("note",e.target.value)} />
            </div>
          </div>
          {err && <p style={{ color:"#ef4444",fontSize:13,marginTop:10 }}>{err}</p>}
          <div style={{ display:"flex",gap:12,marginTop:20,justifyContent:"flex-end" }}>
            <button type="button" onClick={onClose} style={btnSecondary}>Hủy</button>
            <button type="submit" disabled={saving} style={btnPrimary}>{saving ? "Đang lưu..." : "Lưu"}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Modal: phân ca cho nhân viên ──────────────────────────────
const AssignModal = ({ shifts, employees, onClose, onSaved, token }) => {
  const [form, setForm] = useState({ shiftId:"", employeeId:"", date: todayISO(), note:"" });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErr(""); };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.shiftId || !form.employeeId) { setErr("Vui lòng chọn ca và nhân viên."); return; }
    setSaving(true);
    const r = await fetch(`${API_BASE}/shift-assignments`, {
      method: "POST",
      headers: { "Content-Type":"application/json", Authorization:`Bearer ${token}` },
      body: JSON.stringify({ ...form, shiftId: parseInt(form.shiftId), employeeId: parseInt(form.employeeId) }),
    });
    const d = await r.json();
    if (!r.ok) { setErr(d.error || "Lỗi server"); setSaving(false); return; }
    toast.success("Đã phân ca thành công");
    onSaved(d);
  };

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000 }}>
      <div style={{ background:"#1a1d2e",border:"1px solid #2d3154",borderRadius:16,padding:32,width:440 }}>
        <h3 style={{ color:"#e8eaf0",margin:"0 0 24px",fontSize:18 }}>📅 Phân ca cho nhân viên</h3>
        <form onSubmit={submit}>
          <div style={{ display:"grid",gap:14 }}>
            <div>
              <label style={labelStyle}>Ca làm *</label>
              <select style={inputStyle} value={form.shiftId} onChange={e => set("shiftId",e.target.value)} required>
                <option value="">-- Chọn ca --</option>
                {shifts.filter(s => s.isActive).map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Nhân viên *</label>
              <select style={inputStyle} value={form.employeeId} onChange={e => set("employeeId",e.target.value)} required>
                <option value="">-- Chọn nhân viên --</option>
                {employees.filter(e => e.status === "active").map(e => (
                  <option key={e.id} value={e.id}>[{e.employeeCode}] {e.user?.fullName}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Ngày làm *</label>
              <input type="date" style={inputStyle} value={form.date} onChange={e => set("date",e.target.value)} required />
            </div>
            <div>
              <label style={labelStyle}>Ghi chú</label>
              <input style={inputStyle} value={form.note} onChange={e => set("note",e.target.value)} />
            </div>
          </div>
          {err && <p style={{ color:"#ef4444",fontSize:13,marginTop:10 }}>{err}</p>}
          <div style={{ display:"flex",gap:12,marginTop:20,justifyContent:"flex-end" }}>
            <button type="button" onClick={onClose} style={btnSecondary}>Hủy</button>
            <button type="submit" disabled={saving} style={btnPrimary}>{saving ? "Đang lưu..." : "Phân ca"}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════
const AdminShifts = () => {
  const navigate = useNavigate();
  const [token,       setToken]       = useState("");
  const [tab,         setTab]         = useState("schedule"); // "schedule" | "templates"
  const [shifts,      setShifts]      = useState([]);
  const [employees,   setEmployees]   = useState([]);
  const [schedule,    setSchedule]    = useState([]);
  const [weekFrom,    setWeekFrom]    = useState(todayISO());
  const [loading,     setLoading]     = useState(true);
  const [shiftModal,  setShiftModal]  = useState(null);   // null | "new" | shift
  const [assignModal, setAssignModal] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("mc_admin_token");
    if (!t) { navigate("/admin/login"); return; }
    setToken(t);
    fetch(`${API_BASE}/auth/verify`, { method:"POST", headers:{ Authorization:`Bearer ${t}` } })
      .then(r => r.json())
      .then(d => { if (!d.valid) { localStorage.removeItem("mc_admin_token"); navigate("/admin/login"); } });
  }, [navigate]);

  const loadData = useCallback(() => {
    if (!token) return;
    setLoading(true);
    const to = addDays(weekFrom, 6);
    Promise.all([
      fetch(`${API_BASE}/shifts`, { headers:{ Authorization:`Bearer ${token}` } }).then(r => r.json()),
      fetch(`${API_BASE}/employees?status=active`, { headers:{ Authorization:`Bearer ${token}` } }).then(r => r.json()),
      fetch(`${API_BASE}/shifts/schedule?from=${weekFrom}&to=${to}`, { headers:{ Authorization:`Bearer ${token}` } }).then(r => r.json()),
    ]).then(([sh, emp, sched]) => {
      setShifts(Array.isArray(sh) ? sh : []);
      setEmployees(Array.isArray(emp) ? emp : []);
      setSchedule(Array.isArray(sched) ? sched : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [token, weekFrom]);

  useEffect(() => { loadData(); }, [loadData]);

  // Build 7-ngày từ weekFrom
  const weekDays = Array.from({ length:7 }, (_, i) => addDays(weekFrom, i));

  const handleDeleteAssignment = async (id) => {
    if (!confirm("Hủy phân ca này?")) return;
    try {
      const r = await fetch(`${API_BASE}/shift-assignments/${id}`, {
        method:"DELETE", headers:{ Authorization:`Bearer ${token}` },
      });
      if (r.ok) {
        toast.success("Đã hủy phân ca");
        setSchedule(prev => prev.filter(a => a.id !== id));
      } else {
        toast.error("Hủy phân ca thất bại");
      }
    } catch { toast.error("Mất kết nối server"); }
  };

  return (
    <div style={{ padding:24 }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24 }}>
        <div>
          <h1 style={{ color:"#e8eaf0",fontSize:22,fontWeight:700,margin:0 }}>📅 Ca Làm Việc</h1>
          <p style={{ color:"#8b90a7",fontSize:13,margin:"4px 0 0" }}>Lịch phân ca & quản lý ca làm</p>
        </div>
        <div style={{ display:"flex",gap:10 }}>
          <button style={btnSecondary} onClick={() => setShiftModal("new")}>+ Ca mới</button>
          <button style={btnPrimary}   onClick={() => setAssignModal(true)}>📋 Phân ca</button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display:"flex",gap:4,marginBottom:20,background:"#0f1117",borderRadius:10,padding:4,width:"fit-content" }}>
        {[["schedule","🗓️ Lịch tuần"],["templates","⚙️ Mẫu ca"]].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding:"8px 20px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,
            background: tab===k ? "#5b7cf6" : "transparent",
            color:      tab===k ? "#fff"    : "#8b90a7",
          }}>{l}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:"center",color:"#8b90a7",padding:60 }}>Đang tải...</div>
      ) : tab === "templates" ? (
        /* ── Tab: Mẫu Ca ── */
        <div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:16 }}>
            {shifts.map(s => (
              <div key={s.id} style={{ background:"#1a1d2e",border:"1px solid #2d3154",borderRadius:14,padding:20 }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
                  <div>
                    <div style={{ color:"#e8eaf0",fontWeight:700,fontSize:16 }}>{s.name}</div>
                    <div style={{ color:"#5b7cf6",fontSize:14,marginTop:4 }}>🕐 {s.startTime} – {s.endTime}</div>
                    <div style={{ color:"#8b90a7",fontSize:12,marginTop:4 }}>👥 Tối đa {s.maxSlots} người</div>
                    {s.note && <div style={{ color:"#8b90a7",fontSize:12,marginTop:4 }}>📝 {s.note}</div>}
                  </div>
                  <span style={{ fontSize:12,padding:"3px 10px",borderRadius:6,background:"#1e2138",color:s.isActive?"#22c55e":"#6b7280",border:"1px solid #2d3154" }}>
                    {s.isActive ? "Hoạt động" : "Vô hiệu"}
                  </span>
                </div>
                <div style={{ display:"flex",gap:8,marginTop:14 }}>
                  <button onClick={() => setShiftModal(s)} style={{ ...btnSecondary,padding:"6px 14px",fontSize:12 }}>Sửa</button>
                </div>
              </div>
            ))}
            {shifts.length === 0 && <div style={{ color:"#8b90a7",textAlign:"center",padding:40 }}>Chưa có mẫu ca nào.</div>}
          </div>
        </div>
      ) : (
        /* ── Tab: Lịch Tuần ── */
        <div>
          <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:16 }}>
            <button style={btnSecondary} onClick={() => setWeekFrom(addDays(weekFrom,-7))}>◀ Tuần trước</button>
            <input type="date" style={{ ...inputStyle,width:160 }} value={weekFrom} onChange={e => setWeekFrom(e.target.value)} />
            <button style={btnSecondary} onClick={() => setWeekFrom(addDays(weekFrom,7))}>Tuần sau ▶</button>
            <button style={btnSecondary} onClick={() => setWeekFrom(todayISO())}>Hôm nay</button>
          </div>

          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%",borderCollapse:"collapse",minWidth:900 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle,width:120 }}>Ca làm</th>
                  {weekDays.map(d => (
                    <th key={d} style={{ ...thStyle,background: d===todayISO()?"#1e2138":"transparent" }}>
                      {fmtDate(d)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shifts.filter(s => s.isActive).map(shift => (
                  <tr key={shift.id} style={{ borderBottom:"1px solid #1e2138" }}>
                    <td style={{ ...tdStyle,background:"#1a1d2e" }}>
                      <div style={{ fontWeight:700,color:"#e8eaf0",fontSize:13 }}>{shift.name}</div>
                      <div style={{ color:"#5b7cf6",fontSize:11 }}>{shift.startTime}–{shift.endTime}</div>
                    </td>
                    {weekDays.map(d => {
                      const cells = schedule.filter(a => a.shiftId===shift.id && a.date.split("T")[0]===d);
                      const isFull = cells.length >= shift.maxSlots;
                      return (
                        <td key={d} style={{ ...tdStyle,background: d===todayISO()?"rgba(91,124,246,.05)":"transparent",verticalAlign:"top",minWidth:120 }}>
                          {cells.map(a => {
                            const sc = STATUS_COLORS[a.status] || STATUS_COLORS.scheduled;
                            return (
                              <div key={a.id} style={{ background:"#1e2138",border:`1px solid ${sc.color}33`,borderRadius:8,padding:"6px 8px",marginBottom:6,fontSize:12 }}>
                                <div style={{ color:sc.color,fontWeight:600 }}>{a.employee?.user?.fullName}</div>
                                <div style={{ color:"#8b90a7",fontSize:11 }}>{sc.label}</div>
                                {a.attendance && <div style={{ color:"#22c55e",fontSize:11 }}>✓ {a.attendance.workHours?.toFixed(1)}h</div>}
                                <button onClick={() => handleDeleteAssignment(a.id)}
                                  style={{ color:"#ef4444",background:"none",border:"none",cursor:"pointer",fontSize:10,marginTop:2,padding:0 }}>✕ Hủy</button>
                              </div>
                            );
                          })}
                          <div style={{ fontSize:11,color: isFull?"#ef4444":"#6b7280",marginTop:2 }}>
                            {cells.length}/{shift.maxSlots} chỗ {isFull?"(đầy)":""}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {shiftModal && (
        <ShiftModal
          shift={shiftModal === "new" ? null : shiftModal}
          token={token}
          onClose={() => setShiftModal(null)}
          onSaved={(d, isEdit) => {
            setShiftModal(null);
            if (isEdit) setShifts(prev => prev.map(s => s.id===d.id ? d : s));
            else        setShifts(prev => [...prev, d]);
          }}
        />
      )}
      {assignModal && (
        <AssignModal
          shifts={shifts} employees={employees} token={token}
          onClose={() => setAssignModal(false)}
          onSaved={(d) => { setAssignModal(false); loadData(); }}
        />
      )}
    </div>
  );
};

const thStyle = { padding:"10px 12px",color:"#8b90a7",fontSize:12,fontWeight:600,textAlign:"left",borderBottom:"1px solid #2d3154" };
const tdStyle = { padding:"10px 12px",color:"#c8cad8",fontSize:13 };

export default AdminShifts;
