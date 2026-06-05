import React, { useState, useEffect, useCallback } from "react";
import { useIsMobile } from "../hooks/useIsMobile";

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const getToken = () => localStorage.getItem("token");
const fmt = (n) => (n || 0).toLocaleString("vi-VN") + "đ";

const STATUS_MAP = {
  draft:     { label: "Nháp",        color: "var(--emp-muted)" },
  confirmed: { label: "Đã xác nhận", color: "var(--emp-primary)" },
  paid:      { label: "Đã chi",      color: "var(--emp-success)" },
};

// ── Chi tiết 1 kỳ lương ──────────────────────────────────────────────────────
const SalaryDetail = ({ record, onBack }) => {
  const st = STATUS_MAP[record.status] || STATUS_MAP.draft;

  const rows = [
    ["💼 Lương cơ bản",
      record.salaryType === "hourly"
        ? `${fmt(record.baseSalary)}/giờ`
        : fmt(record.baseSalary),
      "var(--emp-text)"],
    record.salaryType === "hourly"
      ? ["⏱️ Tổng giờ làm", `${(record.totalWorkHours || 0).toFixed(1)} giờ`, "var(--emp-text)"]
      : ["📅 Ngày công",    `${record.workedDays}/${record.standardDays} ngày`, "var(--emp-text)"],
    ["🔥 Tăng ca",          record.overtimeHours > 0 ? `${record.overtimeHours}h → ${fmt(record.overtimePay)}` : "–", "var(--emp-warn)"],
    ["🎁 Thưởng",           record.bonus > 0     ? fmt(record.bonus)     : "–", "var(--emp-success)"],
    ["🚗 Phụ cấp",          record.allowance > 0 ? fmt(record.allowance) : "–", "var(--emp-primary)"],
    ["➖ Khấu trừ",         record.deduction > 0 ? fmt(record.deduction) : "–", "var(--emp-danger)"],
    ...(record.salaryType !== "hourly"
      ? [["🏖️ Nghỉ không lương", record.unpaidLeaveDays > 0 ? `${record.unpaidLeaveDays} ngày` : "–", "var(--emp-danger)"]]
      : []),
  ];

  return (
    <div className="emp-salary-detail">
      {/* Back button — mobile only */}
      {onBack && (
        <button onClick={onBack} className="emp-link" style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", fontSize: 14, cursor: "pointer", padding: "0 0 16px" }}>
          ← Quay lại
        </button>
      )}

      {/* Title row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 12 }}>
        <div>
          <h2 style={{ color: "var(--emp-text)", margin: 0, fontSize: 20 }}>
            Tháng {record.month}/{record.year}
          </h2>
          <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span className="emp-dot-status" style={{ color: st.color }}>● {st.label}</span>
            {record.paidAt && (
              <span style={{ color: "var(--emp-faint)", fontSize: 12 }}>
                ({new Date(record.paidAt).toLocaleDateString("vi-VN")})
              </span>
            )}
            <span className={`emp-badge sm ${record.salaryType === "hourly" ? "is-warn" : "is-primary"}`}>
              {record.salaryType === "hourly" ? "Part-time" : "Full-time"}
            </span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "var(--emp-muted)", fontSize: 11 }}>Thực nhận</div>
          <div className="emp-salary-net" style={{ fontSize: 28 }}>{fmt(record.netSalary)}</div>
        </div>
      </div>

      {/* Breakdown rows */}
      <div style={{ borderTop: "1px solid var(--emp-border)", paddingTop: 16, display: "grid", gap: 10 }}>
        {rows.map(([label, value, color]) => (
          <div key={label} className="emp-salary-row">
            <span style={{ color: "var(--emp-muted)", fontSize: 13 }}>{label}</span>
            <span style={{ color, fontSize: 13, fontWeight: 600 }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Net salary highlight */}
      <div className="emp-salary-highlight">
        <span style={{ color: "var(--emp-text)", fontWeight: 600, fontSize: 15 }}>= Lương thực nhận</span>
        <span className="emp-salary-net" style={{ fontSize: 24 }}>{fmt(record.netSalary)}</span>
      </div>

      {record.note && (
        <div style={{ marginTop: 12, color: "var(--emp-muted)", fontSize: 13, background: "var(--emp-inset)", padding: "10px 14px", borderRadius: 8 }}>
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
    <div className="emp-page">
      <div className="emp-skeleton-card"><div className="emp-skeleton emp-skeleton-line" style={{ width: "40%" }} /></div>
      {[0, 1, 2].map(i => (
        <div key={i} className="emp-skeleton-card">
          <div className="emp-skeleton emp-skeleton-line" style={{ width: "50%" }} />
          <div className="emp-skeleton emp-skeleton-line" style={{ width: "30%" }} />
        </div>
      ))}
    </div>
  );

  return (
    <div className="emp-page">

      {/* ── Header ── */}
      <div className="emp-page-header">
        <div>
          <h1 className="emp-page-title">💰 Bảng Lương</h1>
          <p className="emp-page-sub">{records.length} kỳ</p>
        </div>
        <button onClick={load} className="emp-icon-btn">🔄</button>
      </div>

      {records.length === 0 ? (
        <div className="emp-empty">
          <div className="emp-empty-icon">💰</div>
          <p>Chưa có dữ liệu lương.</p>
        </div>
      ) : isMobile ? (
        /* ══ MOBILE: single-view navigation ══════════════════════════════════ */
        showingDetail && selected ? (
          /* Detail view */
          <SalaryDetail
            record={selected}
            onBack={() => setShowingDetail(false)}
          />
        ) : (
          /* Month list */
          <div className="emp-salary-list">
            {records.map(r => {
              const st = STATUS_MAP[r.status] || STATUS_MAP.draft;
              return (
                <div key={r.id} onClick={() => openDetail(r)} className="emp-salary-item">
                  <div>
                    <div style={{ fontWeight: 700, color: "var(--emp-text)", fontSize: 15 }}>
                      Tháng {r.month}/{r.year}
                    </div>
                    <div style={{ marginTop: 4, display: "flex", gap: 8, alignItems: "center" }}>
                      <span className="emp-dot-status" style={{ color: st.color }}>● {st.label}</span>
                      <span className={`emp-badge sm ${r.salaryType === "hourly" ? "is-warn" : "is-primary"}`}>
                        {r.salaryType === "hourly" ? "Part-time" : "Full-time"}
                      </span>
                    </div>
                    <div style={{ color: "var(--emp-muted)", fontSize: 12, marginTop: 3 }}>
                      {r.salaryType === "hourly"
                        ? `${(r.totalWorkHours || 0).toFixed(1)} giờ làm`
                        : `${r.workedDays}/${r.standardDays} ngày công`}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                    <div className="emp-salary-net" style={{ fontSize: 18 }}>{fmt(r.netSalary)}</div>
                    <div style={{ color: "var(--emp-muted)", fontSize: 12, marginTop: 2 }}>›</div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* ══ DESKTOP: 2-column layout ════════════════════════════════════════ */
        <div className="emp-salary-layout">
          {/* Month list */}
          <div>
            {records.map(r => {
              const st = STATUS_MAP[r.status] || STATUS_MAP.draft;
              const isSelected = selected?.id === r.id;
              return (
                <div key={r.id} onClick={() => setSelected(r)}
                  className={`emp-salary-item ${isSelected ? "selected" : ""}`}
                  style={{ display: "block", marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 700, color: "var(--emp-text)" }}>Tháng {r.month}/{r.year}</div>
                    <span className={`emp-badge sm ${r.salaryType === "hourly" ? "is-warn" : "is-primary"}`}>
                      {r.salaryType === "hourly" ? "Part-time" : "Full-time"}
                    </span>
                  </div>
                  <div className="emp-salary-net" style={{ fontSize: 18, margin: "4px 0" }}>{fmt(r.netSalary)}</div>
                  <span className="emp-dot-status" style={{ color: st.color }}>● {st.label}</span>
                </div>
              );
            })}
          </div>

          {/* Detail */}
          {selected && (
            <SalaryDetail record={selected} onBack={null} />
          )}
        </div>
      )}
    </div>
  );
};

export default EmployeeSalary;
