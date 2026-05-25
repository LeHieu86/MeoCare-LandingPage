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

// ── Date helpers (local-timezone-safe, không dùng toISOString) ───────────────
const padZ = (n) => String(n).padStart(2, "0");
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${padZ(d.getMonth()+1)}-${padZ(d.getDate())}`;
};
const addDays = (iso, n) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);   // local date math, không UTC
  return `${dt.getFullYear()}-${padZ(dt.getMonth()+1)}-${padZ(dt.getDate())}`;
};
const fmtDate = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("vi-VN", { weekday:"short", day:"2-digit", month:"2-digit" });
};
// Chuyển ISO datetime string → "YYYY-MM-DD" local (tránh UTC shift khi so sánh)
const toLocalISO = (isoStr) => {
  const d = new Date(isoStr);
  return `${d.getFullYear()}-${padZ(d.getMonth()+1)}-${padZ(d.getDate())}`;
};
// Số ngày trong khoảng [from, to] (inclusive)
const countDays = (from, to) => {
  if (!from || !to || from > to) return 0;
  const [fy,fm,fd] = from.split("-").map(Number);
  const [ty,tm,td] = to.split("-").map(Number);
  return Math.round((new Date(ty,tm-1,td) - new Date(fy,fm-1,fd)) / 86400000) + 1;
};

const inputStyle = { width:"100%",background:"#0f1117",border:"1px solid #2d3154",borderRadius:8,padding:"8px 12px",color:"#e8eaf0",fontSize:14,boxSizing:"border-box" };
const btnPrimary   = { padding:"10px 20px",background:"#5b7cf6",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontSize:14,fontWeight:600 };
const btnSecondary = { padding:"8px 16px",background:"transparent",color:"#8b90a7",border:"1px solid #2d3154",borderRadius:8,cursor:"pointer",fontSize:13 };
const labelStyle   = { display:"block",color:"#8b90a7",fontSize:12,marginBottom:6,fontWeight:600 };

// ── Modal: tạo / sửa shift template ──────────────────────────
const ShiftModal = ({ shift, onClose, onSaved, token }) => {
  const isEdit = !!shift?.id;
  const [form, setForm] = useState({
    name:              shift?.name              || "",
    startTime:         shift?.startTime         || "08:00",
    endTime:           shift?.endTime           || "16:00",
    maxSlots:          shift?.maxSlots          || 10,
    // Nghỉ trưa (để trống = không có)
    lunchBreakStart:   shift?.lunchBreakStart   || "",
    lunchBreakEnd:     shift?.lunchBreakEnd     || "",
    // Biên độ chấm công (phút)
    lateGraceMinutes:  shift?.lateGraceMinutes  ?? 10,
    earlyGraceMinutes: shift?.earlyGraceMinutes ?? 10,
    note:              shift?.note              || "",
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErr(""); };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      maxSlots:          parseInt(form.maxSlots),
      lateGraceMinutes:  parseInt(form.lateGraceMinutes),
      earlyGraceMinutes: parseInt(form.earlyGraceMinutes),
      lunchBreakStart:   form.lunchBreakStart || null,
      lunchBreakEnd:     form.lunchBreakEnd   || null,
    };
    const r = await fetch(`${API_BASE}/shifts${isEdit ? "/" + shift.id : ""}`, {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type":"application/json", Authorization:`Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const d = await r.json();
    if (!r.ok) { setErr(d.error || "Lỗi server"); setSaving(false); return; }
    toast.success(isEdit ? "Đã cập nhật ca làm" : "Đã thêm ca làm mới");
    onSaved(d, isEdit);
  };

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000 }}>
      <div style={{ background:"#1a1d2e",border:"1px solid #2d3154",borderRadius:16,padding:32,width:480,maxHeight:"90vh",overflowY:"auto" }}>
        <h3 style={{ color:"#e8eaf0",margin:"0 0 24px",fontSize:18 }}>
          {isEdit ? "✏️ Sửa ca làm" : "➕ Thêm ca làm mới"}
        </h3>
        <form onSubmit={submit}>
          <div style={{ display:"grid",gap:14 }}>

            {/* ── Thông tin cơ bản ── */}
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

            {/* ── Biên độ chấm công ── */}
            <div style={{ borderTop:"1px solid #2d3154",paddingTop:14 }}>
              <div style={{ color:"#8b90a7",fontSize:12,fontWeight:600,marginBottom:10 }}>⏱️ Biên độ chấm công</div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
                <div>
                  <label style={labelStyle}>Trễ cho phép (phút)</label>
                  <input type="number" style={inputStyle} value={form.lateGraceMinutes} min={0} max={60}
                    onChange={e => set("lateGraceMinutes", e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Về sớm cho phép (phút)</label>
                  <input type="number" style={inputStyle} value={form.earlyGraceMinutes} min={0} max={60}
                    onChange={e => set("earlyGraceMinutes", e.target.value)} />
                </div>
              </div>
            </div>

            {/* ── Nghỉ trưa (full-time) ── */}
            <div style={{ borderTop:"1px solid #2d3154",paddingTop:14 }}>
              <div style={{ color:"#8b90a7",fontSize:12,fontWeight:600,marginBottom:4 }}>🍱 Nghỉ trưa (full-time)</div>
              <div style={{ color:"#6b7280",fontSize:11,marginBottom:10 }}>Để trống nếu ca không có nghỉ trưa. Giờ nghỉ trưa sẽ bị trừ khỏi giờ công.</div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
                <div>
                  <label style={labelStyle}>Bắt đầu nghỉ</label>
                  <input type="time" style={inputStyle} value={form.lunchBreakStart}
                    onChange={e => set("lunchBreakStart", e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Kết thúc nghỉ</label>
                  <input type="time" style={inputStyle} value={form.lunchBreakEnd}
                    onChange={e => set("lunchBreakEnd", e.target.value)} />
                </div>
              </div>
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

// ── Modal: phân ca cho nhiều nhân viên, nhiều ngày ───────────
const AssignModal = ({ shifts, employees, onClose, onSaved, token }) => {
  const [form,     setForm]    = useState({ shiftId:"", dateFrom: todayISO(), dateTo: todayISO(), note:"" });
  const [selected, setSelected] = useState(new Set());
  const [search,   setSearch]  = useState("");
  const [saving,   setSaving]  = useState(false);
  const [err,      setErr]     = useState("");
  const [results,  setResults] = useState(null);

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErr(""); };

  // Tự động giữ dateTo >= dateFrom
  const setDateFrom = (v) => {
    setForm(f => ({ ...f, dateFrom: v, dateTo: f.dateTo < v ? v : f.dateTo }));
    setErr("");
  };

  const days         = countDays(form.dateFrom, form.dateTo);
  const totalToCreate = selected.size * days;

  const activeEmps = employees.filter(e => e.status === "active");
  const filtered   = activeEmps.filter(e => {
    const q = search.toLowerCase();
    return !q || e.user?.fullName?.toLowerCase().includes(q) || e.employeeCode?.toLowerCase().includes(q);
  });

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const toggleAll = () => {
    if (filtered.every(e => selected.has(e.id))) setSelected(new Set());
    else setSelected(new Set(filtered.map(e => e.id)));
  };
  const allChecked = filtered.length > 0 && filtered.every(e => selected.has(e.id));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.shiftId)        { setErr("Vui lòng chọn ca làm."); return; }
    if (selected.size === 0)  { setErr("Vui lòng chọn ít nhất 1 nhân viên."); return; }
    if (form.dateFrom > form.dateTo) { setErr("Ngày bắt đầu không được sau ngày kết thúc."); return; }
    setSaving(true); setErr("");
    const r = await fetch(`${API_BASE}/shift-assignments/batch`, {
      method: "POST",
      headers: { "Content-Type":"application/json", Authorization:`Bearer ${token}` },
      body: JSON.stringify({
        shiftId:     parseInt(form.shiftId),
        employeeIds: [...selected],
        dateFrom:    form.dateFrom,
        dateTo:      form.dateTo,
        note:        form.note,
      }),
    });
    const d = await r.json();
    setSaving(false);
    if (!r.ok) { setErr(d.error || "Lỗi server"); return; }
    setResults(d);
  };

  // ── View kết quả (nhóm theo ngày) ─────────────────────────
  if (results) {
    const shift = shifts.find(s => s.id === parseInt(form.shiftId));
    // Group by date
    const allDates = [...new Set([...results.success, ...results.failed].map(r => r.date))].sort();
    return (
      <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000 }}>
        <div style={{ background:"#1a1d2e",border:"1px solid #2d3154",borderRadius:16,padding:28,width:520,maxHeight:"84vh",display:"flex",flexDirection:"column" }}>
          {/* Header tóm tắt */}
          <div style={{ flexShrink:0,marginBottom:16 }}>
            <h3 style={{ color:"#e8eaf0",margin:"0 0 6px",fontSize:18 }}>📋 Kết quả phân ca</h3>
            <div style={{ display:"flex",gap:16,fontSize:13 }}>
              <span style={{ color:"#8b90a7" }}>{shift?.name}</span>
              <span style={{ color:"#8b90a7" }}>
                {results.totalDays > 1 ? `${fmtDate(form.dateFrom)} – ${fmtDate(form.dateTo)}` : fmtDate(form.dateFrom)}
              </span>
            </div>
            <div style={{ display:"flex",gap:20,marginTop:10 }}>
              <div style={{ background:"rgba(34,197,94,.1)",border:"1px solid rgba(34,197,94,.25)",borderRadius:10,padding:"8px 16px",textAlign:"center" }}>
                <div style={{ color:"#22c55e",fontWeight:700,fontSize:20 }}>{results.success.length}</div>
                <div style={{ color:"#22c55e",fontSize:11 }}>Thành công</div>
              </div>
              <div style={{ background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.25)",borderRadius:10,padding:"8px 16px",textAlign:"center" }}>
                <div style={{ color:"#ef4444",fontWeight:700,fontSize:20 }}>{results.failed.length}</div>
                <div style={{ color:"#ef4444",fontSize:11 }}>Thất bại</div>
              </div>
              <div style={{ background:"rgba(91,124,246,.1)",border:"1px solid rgba(91,124,246,.25)",borderRadius:10,padding:"8px 16px",textAlign:"center" }}>
                <div style={{ color:"#5b7cf6",fontWeight:700,fontSize:20 }}>{results.total}</div>
                <div style={{ color:"#5b7cf6",fontSize:11 }}>Tổng cộng</div>
              </div>
            </div>
          </div>

          {/* Chi tiết theo ngày */}
          <div style={{ flex:1,overflowY:"auto",minHeight:0 }}>
            {allDates.map(date => {
              const daySuccess = results.success.filter(r => r.date === date);
              const dayFailed  = results.failed.filter(r => r.date === date);
              return (
                <div key={date} style={{ marginBottom:14 }}>
                  <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:6 }}>
                    <span style={{ color:"#5b7cf6",fontWeight:700,fontSize:13 }}>📅 {fmtDate(date)}</span>
                    <span style={{ color:"#22c55e",fontSize:11 }}>✓{daySuccess.length}</span>
                    {dayFailed.length > 0 && <span style={{ color:"#ef4444",fontSize:11 }}>✗{dayFailed.length}</span>}
                  </div>
                  {daySuccess.map(r => (
                    <div key={r.employeeId} style={{ display:"flex",alignItems:"center",gap:8,padding:"5px 12px",marginBottom:3,borderRadius:7,background:"rgba(34,197,94,.06)" }}>
                      <span style={{ color:"#22c55e",fontSize:12 }}>✓</span>
                      <span style={{ color:"#e8eaf0",fontSize:13 }}>{r.employeeName}</span>
                    </div>
                  ))}
                  {dayFailed.map(r => (
                    <div key={r.employeeId} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"5px 12px",marginBottom:3,borderRadius:7,background:"rgba(239,68,68,.06)" }}>
                      <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                        <span style={{ color:"#ef4444",fontSize:12 }}>✗</span>
                        <span style={{ color:"#c8cad8",fontSize:13 }}>{r.employeeName}</span>
                      </div>
                      <span style={{ color:"#6b7280",fontSize:11 }}>{r.reason}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          <div style={{ display:"flex",gap:10,justifyContent:"flex-end",flexShrink:0,marginTop:16 }}>
            <button style={btnSecondary} onClick={() => { setResults(null); setSelected(new Set()); setSearch(""); }}>
              ← Phân tiếp
            </button>
            <button style={btnPrimary} onClick={onSaved}>Xong ✓</button>
          </div>
        </div>
      </div>
    );
  }

  // ── View form ────────────────────────────────────────────
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000 }}>
      <div style={{ background:"#1a1d2e",border:"1px solid #2d3154",borderRadius:16,padding:28,width:540,maxHeight:"90vh",display:"flex",flexDirection:"column" }}>
        <h3 style={{ color:"#e8eaf0",margin:"0 0 18px",fontSize:18,flexShrink:0 }}>📅 Phân ca nhân viên</h3>

        <form onSubmit={submit} style={{ display:"flex",flexDirection:"column",flex:1,overflow:"hidden" }}>

          {/* ── Ca làm ── */}
          <div style={{ marginBottom:12,flexShrink:0 }}>
            <label style={labelStyle}>Ca làm *</label>
            <select style={inputStyle} value={form.shiftId} onChange={e => set("shiftId",e.target.value)} required>
              <option value="">-- Chọn ca --</option>
              {shifts.filter(s => s.isActive).map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</option>
              ))}
            </select>
          </div>

          {/* ── Khoảng ngày ── */}
          <div style={{ display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:8,alignItems:"end",marginBottom:12,flexShrink:0 }}>
            <div>
              <label style={labelStyle}>Từ ngày *</label>
              <input type="date" style={inputStyle} value={form.dateFrom} onChange={e => setDateFrom(e.target.value)} required />
            </div>
            <div style={{ color:"#6b7280",fontSize:18,paddingBottom:10,textAlign:"center" }}>→</div>
            <div>
              <label style={labelStyle}>Đến ngày *</label>
              <input type="date" style={inputStyle} value={form.dateTo} min={form.dateFrom} onChange={e => set("dateTo",e.target.value)} required />
            </div>
          </div>

          {/* ── Preview số ca ── */}
          {form.shiftId && selected.size > 0 && days > 0 && (
            <div style={{ background:"rgba(91,124,246,.1)",border:"1px solid rgba(91,124,246,.25)",borderRadius:10,padding:"10px 14px",marginBottom:12,flexShrink:0,display:"flex",alignItems:"center",gap:8 }}>
              <span style={{ fontSize:16 }}>⚡</span>
              <span style={{ color:"#c8cad8",fontSize:13 }}>
                <b style={{ color:"#5b7cf6" }}>{selected.size}</b> nhân viên ×{" "}
                <b style={{ color:"#5b7cf6" }}>{days}</b> ngày ={" "}
                <b style={{ color:"#e8eaf0" }}>{totalToCreate} ca</b> sẽ được tạo
              </span>
            </div>
          )}

          {/* ── Ghi chú ── */}
          <div style={{ marginBottom:12,flexShrink:0 }}>
            <label style={labelStyle}>Ghi chú</label>
            <input style={inputStyle} value={form.note} onChange={e => set("note",e.target.value)} placeholder="(tuỳ chọn)" />
          </div>

          {/* ── Danh sách nhân viên ── */}
          <div style={{ flexShrink:0,marginBottom:6 }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8 }}>
              <label style={{ ...labelStyle,margin:0 }}>
                Chọn nhân viên *
                {selected.size > 0 && (
                  <span style={{ marginLeft:8,background:"#5b7cf633",color:"#5b7cf6",borderRadius:10,padding:"1px 8px",fontSize:11 }}>
                    {selected.size} đã chọn
                  </span>
                )}
              </label>
              <button type="button" onClick={toggleAll}
                style={{ background:"none",border:"none",color:"#5b7cf6",fontSize:12,cursor:"pointer",fontWeight:600 }}>
                {allChecked ? "Bỏ chọn tất cả" : "Chọn tất cả"}
              </button>
            </div>
            <input style={{ ...inputStyle,marginBottom:6 }} placeholder="🔍 Tìm tên / mã nhân viên..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {/* ── Danh sách scroll ── */}
          <div style={{ flex:1,overflowY:"auto",border:"1px solid #2d3154",borderRadius:10,minHeight:80 }}>
            {filtered.length === 0 ? (
              <div style={{ color:"#8b90a7",textAlign:"center",padding:24,fontSize:13 }}>Không tìm thấy nhân viên</div>
            ) : filtered.map(emp => (
              <label key={emp.id} style={{
                display:"flex",alignItems:"center",gap:12,padding:"9px 14px",cursor:"pointer",
                borderBottom:"1px solid #1e2138",
                background: selected.has(emp.id) ? "rgba(91,124,246,.08)" : "transparent",
                transition:"background .12s",
              }}>
                <input type="checkbox" checked={selected.has(emp.id)} onChange={() => toggle(emp.id)}
                  style={{ width:16,height:16,accentColor:"#5b7cf6",cursor:"pointer",flexShrink:0 }} />
                <div>
                  <div style={{ color:"#e8eaf0",fontSize:13,fontWeight:600 }}>{emp.user?.fullName}</div>
                  <div style={{ color:"#6b7280",fontSize:11 }}>{emp.employeeCode} · {emp.position || "Nhân viên"}</div>
                </div>
              </label>
            ))}
          </div>

          {err && <p style={{ color:"#ef4444",fontSize:13,margin:"8px 0 0" }}>{err}</p>}

          <div style={{ display:"flex",gap:12,marginTop:14,justifyContent:"flex-end",flexShrink:0 }}>
            <button type="button" onClick={onClose} style={btnSecondary}>Hủy</button>
            <button type="submit" disabled={saving || selected.size === 0 || days === 0} style={{
              ...btnPrimary, opacity:(saving || selected.size===0 || days===0) ? .5 : 1,
            }}>
              {saving
                ? "Đang tạo ca..."
                : totalToCreate > 0
                  ? `📋 Tạo ${totalToCreate} ca`
                  : "📋 Phân ca"}
            </button>
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
    const t = localStorage.getItem("token");
    if (!t) { navigate("/login"); return; }
    setToken(t);
    fetch(`${API_BASE}/auth/verify`, { method:"POST", headers:{ Authorization:`Bearer ${t}` } })
      .then(r => r.json())
      .then(d => { if (!d.valid) { localStorage.removeItem("token"); localStorage.removeItem("user"); navigate("/login"); } });
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
          <button style={btnSecondary} onClick={loadData}>🔄 Làm mới</button>
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
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12 }}>
                  <div>
                    <div style={{ color:"#e8eaf0",fontWeight:700,fontSize:16 }}>{s.name}</div>
                    <div style={{ color:"#5b7cf6",fontSize:14,marginTop:4 }}>🕐 {s.startTime} – {s.endTime}</div>
                    <div style={{ color:"#8b90a7",fontSize:12,marginTop:4 }}>👥 Tối đa {s.maxSlots} người</div>
                  </div>
                  <span style={{ fontSize:12,padding:"3px 10px",borderRadius:6,background:"#1e2138",color:s.isActive?"#22c55e":"#6b7280",border:"1px solid #2d3154" }}>
                    {s.isActive ? "Hoạt động" : "Vô hiệu"}
                  </span>
                </div>

                {/* ── Thông tin quy định ── */}
                <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginBottom:10 }}>
                  <span style={{ fontSize:11,padding:"2px 8px",borderRadius:20,background:"rgba(91,124,246,.12)",color:"#a5b4fc",border:"1px solid rgba(91,124,246,.2)" }}>
                    ⏱️ Trễ ≤{s.lateGraceMinutes ?? 10}p
                  </span>
                  <span style={{ fontSize:11,padding:"2px 8px",borderRadius:20,background:"rgba(91,124,246,.12)",color:"#a5b4fc",border:"1px solid rgba(91,124,246,.2)" }}>
                    ⏱️ Về sớm ≤{s.earlyGraceMinutes ?? 10}p
                  </span>
                  {s.lunchBreakStart && s.lunchBreakEnd && (
                    <span style={{ fontSize:11,padding:"2px 8px",borderRadius:20,background:"rgba(34,197,94,.1)",color:"#4ade80",border:"1px solid rgba(34,197,94,.2)" }}>
                      🍱 Nghỉ trưa {s.lunchBreakStart}–{s.lunchBreakEnd}
                    </span>
                  )}
                </div>

                {s.note && <div style={{ color:"#8b90a7",fontSize:12,marginBottom:10 }}>📝 {s.note}</div>}

                <div style={{ display:"flex",gap:8,marginTop:8 }}>
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
                      const cells = schedule.filter(a => a.shiftId===shift.id && toLocalISO(a.date)===d);
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
