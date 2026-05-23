import React, { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const getToken = () => localStorage.getItem("mc_employee_token") || localStorage.getItem("mc_admin_token");
const fmt = (n) => (n||0).toLocaleString("vi-VN") + "đ";

const STATUS_MAP = {
  draft:     { label:"Nháp",        color:"#8b90a7" },
  confirmed: { label:"Đã xác nhận", color:"#5b7cf6" },
  paid:      { label:"Đã chi",      color:"#22c55e" },
};

const EmployeeSalary = () => {
  const [records, setRecords] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    fetch(`${API_BASE}/salary/my`, { headers:{ Authorization:`Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        const arr = Array.isArray(d) ? d : [];
        setRecords(arr);
        if (arr.length > 0) setSelected(arr[0]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"80vh",color:"#8b90a7" }}>Đang tải...</div>;

  return (
    <div style={{ padding:28 }}>
      <h1 style={{ color:"#e8eaf0",fontSize:22,fontWeight:700,margin:"0 0 24px" }}>💰 Bảng Lương</h1>

      {records.length === 0 ? (
        <div style={{ textAlign:"center",color:"#8b90a7",padding:60 }}>Chưa có dữ liệu lương.</div>
      ) : (
        <div style={{ display:"grid",gridTemplateColumns:"260px 1fr",gap:20 }}>
          {/* ── Month list ── */}
          <div>
            {records.map(r => {
              const st = STATUS_MAP[r.status] || STATUS_MAP.draft;
              const isSelected = selected?.id === r.id;
              return (
                <div key={r.id}
                  onClick={() => setSelected(r)}
                  style={{ background: isSelected?"rgba(91,124,246,.15)":"#1a1d2e",border:`1px solid ${isSelected?"#5b7cf6":"#2d3154"}`,borderRadius:12,padding:"14px 16px",marginBottom:10,cursor:"pointer" }}>
                  <div style={{ fontWeight:700,color:"#e8eaf0" }}>Tháng {r.month}/{r.year}</div>
                  <div style={{ color:"#22c55e",fontWeight:800,fontSize:18,margin:"4px 0" }}>{fmt(r.netSalary)}</div>
                  <span style={{ fontSize:11,color:st.color,fontWeight:600 }}>● {st.label}</span>
                </div>
              );
            })}
          </div>

          {/* ── Detail ── */}
          {selected && (
            <div style={{ background:"#1a1d2e",border:"1px solid #2d3154",borderRadius:16,padding:28 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20 }}>
                <div>
                  <h2 style={{ color:"#e8eaf0",margin:0,fontSize:20 }}>Tháng {selected.month}/{selected.year}</h2>
                  <span style={{ fontSize:13,color:STATUS_MAP[selected.status]?.color || "#8b90a7",fontWeight:600 }}>
                    ● {STATUS_MAP[selected.status]?.label || selected.status}
                    {selected.paidAt && <span style={{ color:"#6b7280",fontWeight:400,marginLeft:8 }}>({new Date(selected.paidAt).toLocaleDateString("vi-VN")})</span>}
                  </span>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ color:"#8b90a7",fontSize:13 }}>Lương thực nhận</div>
                  <div style={{ color:"#22c55e",fontWeight:900,fontSize:28 }}>{fmt(selected.netSalary)}</div>
                </div>
              </div>

              <div style={{ borderTop:"1px solid #2d3154",paddingTop:20 }}>
                <div style={{ display:"grid",gap:12 }}>
                  {[
                    ["💼 Lương cơ bản",    fmt(selected.baseSalary),      "#e8eaf0"],
                    ["📅 Ngày công",        `${selected.workedDays}/${selected.standardDays} ngày`, "#e8eaf0"],
                    ["🔥 Tăng ca",          selected.overtimeHours > 0 ? `${selected.overtimeHours}h → ${fmt(selected.overtimePay)}` : "–", "#f59e0b"],
                    ["🎁 Thưởng",           selected.bonus > 0     ? fmt(selected.bonus)     : "–",  "#22c55e"],
                    ["🚗 Phụ cấp",          selected.allowance > 0 ? fmt(selected.allowance) : "–",  "#5b7cf6"],
                    ["➖ Khấu trừ",         selected.deduction > 0 ? fmt(selected.deduction) : "–",  "#ef4444"],
                    ["🏖️ Nghỉ không lương", selected.unpaidLeaveDays > 0 ? `${selected.unpaidLeaveDays} ngày` : "–", "#ef4444"],
                  ].map(([label, value, color]) => (
                    <div key={label} style={{ display:"grid",gridTemplateColumns:"200px 1fr",gap:8,paddingBottom:10,borderBottom:"1px solid #1e2138" }}>
                      <span style={{ color:"#8b90a7",fontSize:14 }}>{label}</span>
                      <span style={{ color,fontSize:14,fontWeight:600 }}>{value}</span>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop:20,background:"rgba(34,197,94,.08)",border:"1px solid rgba(34,197,94,.3)",borderRadius:12,padding:"16px 20px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                  <span style={{ color:"#e8eaf0",fontWeight:600,fontSize:15 }}>= Lương thực nhận</span>
                  <span style={{ color:"#22c55e",fontWeight:900,fontSize:24 }}>{fmt(selected.netSalary)}</span>
                </div>

                {selected.note && (
                  <div style={{ marginTop:14,color:"#8b90a7",fontSize:13,background:"#0f1117",padding:"10px 14px",borderRadius:8 }}>
                    📝 {selected.note}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EmployeeSalary;
