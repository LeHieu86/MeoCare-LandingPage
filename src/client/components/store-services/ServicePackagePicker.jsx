/**
 * ServicePackagePicker.jsx
 * Hiển thị danh sách gói/ca để khách chọn (grooming / medical)
 */
import React from "react";

const fmt = (n) => Number(n || 0).toLocaleString("vi-VN");

const ServicePackagePicker = ({ packages, selectedId, onSelect, accent, pricingType }) => {
  if (!packages || packages.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "24px 0", color: "#94a3b8" }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
        <p>Chưa có {pricingType === "procedure" ? "ca dịch vụ" : "gói"} nào. Vui lòng liên hệ cửa hàng.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {packages.map((pkg) => {
        const isSelected = selectedId === pkg.id;
        return (
          <button
            key={pkg.id}
            type="button"
            onClick={() => onSelect(pkg)}
            style={{
              textAlign: "left",
              background: isSelected ? `${accent}14` : "var(--ss-card-bg, #1e2130)",
              border: `2px solid ${isSelected ? accent : "rgba(255,255,255,0.07)"}`,
              borderRadius: 12,
              padding: "14px 16px",
              cursor: "pointer",
              transition: "all 0.18s",
              position: "relative",
              width: "100%",
            }}
          >
            {pkg.isPopular && (
              <span style={{
                position: "absolute", top: 10, right: 12,
                fontSize: 10, fontWeight: 700, padding: "2px 8px",
                background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.4)",
                color: "#fbbf24", borderRadius: 20,
              }}>⭐ Phổ biến</span>
            )}

            {/* Tên + giá */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: isSelected ? accent : "#e8eaf0" }}>
                {isSelected && <span style={{ marginRight: 6 }}>✓</span>}
                {pkg.name}
              </span>
              <span style={{ fontWeight: 800, fontSize: 16, color: accent, flexShrink: 0, marginLeft: 12 }}>
                {fmt(pkg.price)}đ
              </span>
            </div>

            {/* Duration */}
            {pkg.duration && (
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>⏱ {pkg.duration}</div>
            )}

            {/* Description */}
            {pkg.description && (
              <p style={{ fontSize: 12.5, color: "#94a3b8", margin: "0 0 8px", lineHeight: 1.5 }}>
                {pkg.description}
              </p>
            )}

            {/* Includes */}
            {Array.isArray(pkg.includes) && pkg.includes.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {pkg.includes.map((item, i) => (
                  <span key={i} style={{
                    fontSize: 11, padding: "3px 8px",
                    background: isSelected ? `${accent}22` : "rgba(255,255,255,0.06)",
                    border: `1px solid ${isSelected ? `${accent}44` : "rgba(255,255,255,0.1)"}`,
                    color: isSelected ? accent : "#94a3b8",
                    borderRadius: 20,
                  }}>✓ {item}</span>
                ))}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default ServicePackagePicker;
