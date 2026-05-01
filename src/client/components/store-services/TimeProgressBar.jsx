import React from "react";
import "../../../styles/client/time-progress.css";

const formatShortDate = (str) => {
  if (!str) return "";
  const d = new Date(str + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const formatFullDate = (str) => {
  if (!str) return "";
  const d = new Date(str + "T00:00:00");
  const days = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  return `${days[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const TimeProgressBar = ({ startDate, endDate, status, accentColor = "#FF9B71" }) => {
  if (!startDate || !endDate) return null;

  const start = new Date(startDate + "T00:00:00").getTime();
  const end = new Date(endDate + "T00:00:00").getTime();
  const now = Date.now();
  const totalMs = end - start;
  const totalDays = Math.max(1, Math.ceil(totalMs / (1000 * 60 * 60 * 24)));

  /* ── Tính progress ── */
  let percent = 0;
  let statusText = "";
  let statusIcon = "";
  let daysInfo = "";

  const isBeforeStart = now < start;
  const isAfterEnd = now >= end;
  const elapsedMs = now - start;
  const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
  const remainDays = totalDays - elapsedDays;

  if (status === "completed") {
    percent = 100;
    statusText = "Hoàn tất";
    statusIcon = "✅";
    daysInfo = `${totalDays} ngày`;
  } else if (status === "pending") {
    percent = 0;
    statusText = "Chờ nhận mèo";
    statusIcon = "🕐";
    daysInfo = `${totalDays} ngày`;
  } else if (isBeforeStart) {
    percent = 0;
    statusText = "Chưa bắt đầu";
    statusIcon = "📅";
    daysInfo = `${totalDays} ngày`;
  } else if (isAfterEnd) {
    percent = 100;
    const overDays = Math.ceil((now - end) / (1000 * 60 * 60 * 24));
    statusText = `Quá hạn ${overDays} ngày`;
    statusIcon = "⚠️";
    daysInfo = `+${overDays} ngày`;
  } else {
    percent = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));
    if (remainDays <= 1) {
      statusText = "Ngày cuối";
      statusIcon = "🔔";
    } else {
      statusText = `Ngày ${elapsedDays + 1}/${totalDays}`;
      statusIcon = "🐾";
    }
    daysInfo = `Còn ${remainDays} ngày`;
  }

  /* ── Tạo day markers ── */
  const markers = [];
  if (totalDays <= 10) {
    for (let i = 0; i <= totalDays; i++) {
      markers.push(i);
    }
  } else {
    markers.push(0, Math.floor(totalDays / 2), totalDays);
  }

  const isOverdue = status !== "completed" && isAfterEnd && status !== "pending";

  return (
    <div className="tpb-wrap">
      {/* ── Status text ── */}
      <div className="tpb-status-row">
        <span className="tpb-status-text">
          <span className="tpb-status-icon">{statusIcon}</span>
          {statusText}
        </span>
        <span className={`tpb-days-info ${isOverdue ? "overdue" : ""}`}>
          {daysInfo}
        </span>
      </div>

      {/* ── Progress bar ── */}
      <div className="tpb-bar-wrap">
        <div className="tpb-bar-bg">
          <div
            className={`tpb-bar-fill ${isOverdue ? "overdue" : ""}`}
            style={{
              width: `${percent}%`,
              background: isOverdue
                ? "linear-gradient(90deg, #ef4444, #dc2626)"
                : `linear-gradient(90deg, ${accentColor}, ${accentColor}dd)`,
            }}
          />

          {/* Current position indicator */}
          {status !== "pending" && status !== "completed" && !isOverdue && (
            <div
              className="tpb-current-dot"
              style={{
                left: `${percent}%`,
                background: accentColor,
                boxShadow: `0 0 8px ${accentColor}80`,
              }}
            >
              <span className="tpb-current-icon">🐱</span>
            </div>
          )}
        </div>

        {/* ── Day markers ── */}
        {totalDays <= 10 && (
          <div className="tpb-markers">
            {markers.map((day) => {
              const pos = (day / totalDays) * 100;
              const isCurrent = elapsedDays === day && status !== "pending" && status !== "completed";
              return (
                <div
                  key={day}
                  className={`tpb-marker ${isCurrent ? "current" : ""}`}
                  style={{ left: `${pos}%` }}
                >
                  <div className="tpb-marker-tick" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Date labels ── */}
      <div className="tpb-dates">
        <div className="tpb-date-start">
          <span className="tpb-date-label">Nhận</span>
          <span className="tpb-date-value">{formatFullDate(startDate)}</span>
        </div>
        <div className="tpb-date-end">
          <span className="tpb-date-label">Trả</span>
          <span className="tpb-date-value">{formatFullDate(endDate)}</span>
        </div>
      </div>
    </div>
  );
};

export default TimeProgressBar;