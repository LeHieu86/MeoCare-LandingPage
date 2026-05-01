import React from "react";
import ProgressTimeline from "./ProgressTimeline";
import TimeProgressBar from "./TimeProgressBar";

const SERVICE_META = {
  boarding: {
    icon: "🏠",
    name: "Giữ mèo",
    accent: "#FF9B71",
    bgAccent: "linear-gradient(135deg, #FFB899 0%, #FF9B71 100%)",
    useTimeProgress: true, // ← dùng thanh tiến trình theo thời gian
    stages: [
      { key: "pending", label: "Chờ nhận" },
      { key: "received", label: "Đã nhận" },
      { key: "active", label: "Đang chăm sóc" },
      { key: "almost_done", label: "Sắp trả" },
      { key: "completed", label: "Hoàn tất" },
    ],
  },
  grooming: {
    icon: "✂️",
    name: "Grooming",
    accent: "#9F8FD9",
    bgAccent: "linear-gradient(135deg, #C7B8EA 0%, #9F8FD9 100%)",
    stages: [
      { key: "pending", label: "Chờ" },
      { key: "active", label: "Đang grooming" },
      { key: "ready", label: "Sẵn sàng nhận" },
      { key: "completed", label: "Hoàn tất" },
    ],
  },
  medical: {
    icon: "🏥",
    name: "Khám bệnh",
    accent: "#7BB6E0",
    bgAccent: "linear-gradient(135deg, #A8D8EA 0%, #7BB6E0 100%)",
    stages: [
      { key: "pending", label: "Chờ khám" },
      { key: "active", label: "Đang khám" },
      { key: "treatment", label: "Điều trị" },
      { key: "completed", label: "Hoàn tất" },
    ],
  },
};

const STATUS_LABEL = {
  pending: "Chờ",
  received: "Đã nhận",
  active: "Đang dùng",
  almost_done: "Sắp xong",
  ready: "Sẵn sàng",
  treatment: "Điều trị",
  completed: "Hoàn tất",
};

const ServiceCard = ({ service, onViewCamera, onContact }) => {
  const meta = SERVICE_META[service.type];
  if (!meta) return null;

  const currentIndex = meta.stages.findIndex(s => s.key === service.status);
  const safeIndex = currentIndex === -1 ? 0 : currentIndex;
  const isCompleted = service.status === "completed";

  const canViewCamera =
    service.type === "boarding" &&
    (service.status === "received" || service.status === "active" || service.status === "almost_done");

  return (
    <div className="svc-card" style={{ borderTopColor: meta.accent }}>
      <div className="svc-card-head">
        <div className="svc-icon-wrap" style={{ background: meta.bgAccent }}>
          <span>{meta.icon}</span>
        </div>
        <div className="svc-head-info">
          <div className="svc-head-row">
            <h3 className="svc-name">{meta.name}</h3>
            <span
              className={`svc-status-badge ${isCompleted ? "completed" : "active"}`}
              style={!isCompleted ? { background: meta.accent } : undefined}
            >
              {STATUS_LABEL[service.status] || service.status}
            </span>
          </div>
          <p className="svc-pet-name">
            🐱 {service.petName}
            {service.petBreed && <span className="svc-pet-breed"> · {service.petBreed}</span>}
          </p>
          <p className="svc-code">Mã DV: #{service.code}</p>
        </div>
      </div>

      {/* ── PROGRESS: chọn component theo loại dịch vụ ── */}
      <div className="svc-card-progress">
        {meta.useTimeProgress ? (
          <TimeProgressBar
            startDate={service.startDate}
            endDate={service.endDate}
            status={service.status}
            accentColor={meta.accent}
          />
        ) : (
          <ProgressTimeline
            stages={meta.stages}
            currentIndex={safeIndex}
            accentColor={meta.accent}
          />
        )}
      </div>

      {/* ── META INFO (chỉ hiện room + price, ngày đã có trong TimeProgressBar) ── */}
      <div className="svc-card-meta">
        {!meta.useTimeProgress && service.startDate && (
          <div className="svc-meta-item">
            <span className="svc-meta-icon">📅</span>
            <span>
              {formatDate(service.startDate)}
              {service.endDate && ` - ${formatDate(service.endDate)}`}
            </span>
          </div>
        )}
        {service.room && (
          <div className="svc-meta-item">
            <span className="svc-meta-icon">🚪</span>
            <span>{service.room}</span>
          </div>
        )}
        {service.totalPrice != null && (
          <div className="svc-meta-item">
            <span className="svc-meta-icon">💰</span>
            <span>{service.totalPrice.toLocaleString("vi-VN")}đ</span>
          </div>
        )}
      </div>

      {!isCompleted && (
        <div className="svc-card-actions">
          {canViewCamera && (
            <button
              className="svc-btn svc-btn-primary"
              onClick={() => onViewCamera?.(service)}
              style={{ background: meta.bgAccent }}
            >
              📹 Xem camera
            </button>
          )}
          <button
            className="svc-btn svc-btn-outline"
            onClick={() => onContact?.(service)}
          >
            💬 Liên hệ
          </button>
        </div>
      )}
    </div>
  );
};

/* ── Helper (chỉ dùng cho dịch vụ non-boarding) ── */
const formatDate = (str) => {
  if (!str) return "";
  const d = new Date(str);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export default ServiceCard;