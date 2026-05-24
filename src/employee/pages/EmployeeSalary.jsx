import React, { useState, useEffect, useCallback } from "react";
import { useIsMobile } from "../hooks/useIsMobile";

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const getToken = () => localStorage.getItem("token");
const fmt = (n) => (n || 0).toLocaleString("vi-VN") + "đ";

const STATUS_MAP = {
  draft:     { label: "Nháp",        color: "#8b90a7" },
  confirmed: { label: "Đã xác nhận", color: "#5b7cf6" },
  paid:      { label: "Đã chi",      color: "#22c55e" },
};

// ── Chi tiết 1 kỳ lương ──────────────────────────────────────────────────────
const SalaryDetail = ({ record, onBack, isMobile }) => {
  const st = STATUS_MAP[record.status] || STATUS_MAP.draft;

  const rows = [
    ["💼 Lương cơ bản",
      record.salaryType === "hourly"
        ? `${fmt(record.baseSalary)}/giờ`
        : fmt(record.baseSalary),
      "#e8eaf0"],
    record.salaryType === "hourly"
      ? ["⏱️ Tổng giờ làm", `${(record.totalWorkHours || 0).toFixed(1)} giờ`, "#e8eaf0"]
      : ["📅 Ngày công",    `${record.workedDays}/${record.standardDays} ngày`, "#e8eaf0"],
    ["🔥 Tăng ca",          record.overtimeHours > 0 ? `${record.overtimeHours}h → ${fmt(record.overtimePay)}` : "–", "#f59e0b"],
    ["🎁 Thưởng",           record.bonus > 0     ? fmt(record.bonus)     : "–", "#22c55e"],
    ["🚗 Phụ cấp",          record.allowance > 0 ? fmt(record.allowance) : "–", "#5b7cf6"],
    ["➖ Khấu trừ",         record.deduction > 0 ? fmt(record.deduction) : "–", "#ef4444"],
    ...(record.salaryType !== "hourly"
      ? [["🏖️ Nghỉ không lương", record.unpaidLeaveDays > 0 ? `${record.unpaidLeaveDays} ngày` : "–", "#ef4444"]]
      : []),
  ];

  return (
    <div style={{ background: "#1a1d2e", border: "1px solid #2d3154", borderRadius: 16, padding: isMobile ? "18px 16px" : 28 }}>
      {/* Back button — mobile only */}
      {onBack && (
        <button onClick={onBack}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: "#5b7cf6", fontSize: 14, cursor: "pointer", padding: "0 0 16px", fontWeight: 600 }}>
          ← Quay lại
        </button>
      )}

      {/* Title row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <h2 style={{ color: "#e8eaf0", margin: 0, fontSize: isMobile ? 17 : 20 }}>
            Tháng {record.month}/{record.year}
          </h2>
          <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: st.color, fontWeight: 600 }}>● {st.label}</span>
            {record.paidAt && (
              <span style={{ color: "#6b7280", fontSize: 12 }}>
                ({new Date(record.paidAt).toLocaleDateString("vi-VN")})
              </span>
            )}
            <span style={{
              fontSize: 10, padding: "1px 7px", borderRadius: 10, fontWeight: 600,
              background: record.salaryType === "hourly" ? "rgba(245,158,11,.15)" : "rgba(91,124,246,.15)",
              color: record.salaryType === "hourly" ? "#f59e0b" : "#a5b4fc",
            }}>
              {record.salaryType === "hourly" ? "Part-time" : "Full-time"}
            </span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "#8b90a7", fontSize: 11 }}>Thực nhận</div>
          <div style={{ color: "#22c55e", fontWeight: 900, fontSize: isMobile ? 22 : 28 }}>{fmt(record.netSalary)}</div>
        </div>
      </div>

      {/* Breakdown rows */}
      <div style={{ borderTop: "1px solid #2d3154", paddingTop: 16, display: "grid", gap: 10 }}>
        {rows.map(([label, value, color]) => (
          <div key={label} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            paddingBottom: 10, borderBottom: "1px solid #1e2138",
          }}>
            <span style={{ color: "#8b90a7", fontSize: 13 }}>{label}</span>
            <span style={{ color, fontSize: 13, fontWeight: 600 }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Net salary highlight */}
      <div style={{
        marginTop: 16,
        background: "rgba(34,197,94,.08)", border: "1px solid rgba(34,197,94,.3)",
        borderRadius: 12, padding: isMobile ? "14px 16px" : "16px 20px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ color: "#e8eaf0", fontWeight: 600, fontSize: isMobile ? 14 : 15 }}>= Lương thực nhận</span>
        <span style={{ color: "#22c55e", fontWeight: 900, fontSize: isMobile ? 20 : 24 }}>{fmt(record.netSalary)}</span>
      </div>

      {record.note && (
        <div style={{ marginTop: 12, color: "#8b90a7", fontSize: 13, background: "#0f1117", padding: "10px 14px", borderRadius: 8 }}>
          📝 {record.note}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
const EmployeeSalary = () => {
  const isMobile = useIsMobile();

  const [records,       setRecords]       = useState([]);
  const [selected,      setSelected]      = useState(null);
  const [showingDetail, setShowingDetail] = useState(false); // mobile: is detail view open?
  const [loading,       setLoading]       = useState(true);

  const load = useCallback(() => {
    const token = getToken();
    setLoading(true);
    fetch(`${API_BASE}/salary/my`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        const arr = Array.isArray(d) ? d : [];
        setRecords(arr);
        if (arr.length > 0)
          setSelected(prev => arr.find(r => r.id === prev?.id) || arr[0]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // On mobile: tap a card → open detail
  const openDetail = (r) => {
    setSelected(r);
    if (isMobile) setShowingDetail(true);
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "80vh", color: "#8b90a7" }}>
      Đang tải...
    </div>
  );

  return (
    <div className="emp-page">

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: isMobile ? 14 : 20 }}>
        <div>
          <h1 style={{ color: "#e8eaf0", fontSize: isMobile ? 19 : 22, fontWeight: 700, margin: 0 }}>💰 Bảng Lương</h1>
          <p style={{ color: "#8b90a7", fontSize: 12, margin: "3px 0 0" }}>{records.length} kỳ</p>
        </div>
        <button
          onClick={load}
          style={{ padding: "8px 14px", background: "transparent", color: "#8b90a7", border: "1px solid #2d3154", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
          🔄
        </button>
      </div>

      {records.length === 0 ? (
        <div style={{ textAlign: "center", color: "#8b90a7", padding: 60 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💰</div>
          Chưa có dữ liệu lương.
        </div>
      ) : isMobile ? (
        /* ══ MOBILE: single-view navigation ══════════════════════════════════ */
        showingDetail && selected ? (
          /* Detail view */
          <SalaryDetail
            record={selected}
            isMobile={true}
            onBack={() => setShowingDetail(false)}
          />
        ) : (
          /* Month list */
          <div style={{ display: "grid", gap: 10 }}>
            {records.map(r => {
              const st = STATUS_MAP[r.status] || STATUS_MAP.draft;
              return (
                <div key={r.id}
                  onClick={() => openDetail(r)}
                  style={{
                    background: "#1a1d2e", border: "1px solid #2d3154",
                    borderRadius: 14, padding: "16px", cursor: "pointer",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    WebkitTapHighlightColor: "transparent",
                  }}>
                  <div>
                    <div style={{ fontWeight: 700, color: "#e8eaf0", fontSize: 15 }}>
                      Tháng {r.month}/{r.year}
                    </div>
                    <div style={{ marginTop: 4, display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: st.color, fontWeight: 600 }}>● {st.label}</span>
                      <span style={{
                        fontSize: 10, padding: "1px 7px", borderRadius: 10, fontWeight: 600,
                        background: r.salaryType === "hourly" ? "rgba(245,158,11,.15)" : "rgba(91,124,246,.15)",
                        color: r.salaryType === "hourly" ? "#f59e0b" : "#a5b4fc",
                      }}>
                        {r.salaryType === "hourly" ? "Part-time" : "Full-time"}
                      </span>
                    </div>
                    <div style={{ color: "#8b90a7", fontSize: 12, marginTop: 3 }}>
                      {r.salaryType === "hourly"
                        ? `${(r.totalWorkHours || 0).toFixed(1)} giờ làm`
                        : `${r.workedDays}/${r.standardDays} ngày công`}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                    <div style={{ color: "#22c55e", fontWeight: 800, fontSize: 18 }}>{fmt(r.netSalary)}</div>
                    <div style={{ color: "#8b90a7", fontSize: 12, marginTop: 2 }}>›</div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* ══ DESKTOP: 2-column layout ════════════════════════════════════════ */
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 20 }}>
          {/* Month list */}
          <div>
            {records.map(r => {
              const st = STATUS_MAP[r.status] || STATUS_MAP.draft;
              const isSelected = selected?.id === r.id;
              return (
                <div key={r.id}
                  onClick={() => setSelected(r)}
                  style={{
                    background: isSelected ? "rgba(91,124,246,.15)" : "#1a1d2e",
                    border: `1px solid ${isSelected ? "#5b7cf6" : "#2d3154"}`,
                    borderRadius: 12, padding: "14px 16px", marginBottom: 10, cursor: "pointer",
                  }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 700, color: "#e8eaf0" }}>Tháng {r.month}/{r.year}</div>
                    <span style={{
                      fontSize: 10, padding: "1px 7px", borderRadius: 10, fontWeight: 600,
                      background: r.salaryType === "hourly" ? "rgba(245,158,11,.15)" : "rgba(91,124,246,.15)",
                      color: r.salaryType === "hourly" ? "#f59e0b" : "#a5b4fc",
                    }}>
                      {r.salaryType === "hourly" ? "Part-time" : "Full-time"}
                    </span>
                  </div>
                  <div style={{ color: "#22c55e", fontWeight: 800, fontSize: 18, margin: "4px 0" }}>{fmt(r.netSalary)}</div>
                  <span style={{ fontSize: 11, color: st.color, fontWeight: 600 }}>● {st.label}</span>
                </div>
              );
            })}
          </div>

          {/* Detail */}
          {selected && (
            <SalaryDetail record={selected} isMobile={false} onBack={null} />
          )}
        </div>
      )}
    </div>
  );
};

export default EmployeeSalary;
