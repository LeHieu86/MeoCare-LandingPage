import React from "react";

const ProgressTimeline = ({ stages, currentIndex, accentColor = "#FF9B71" }) => {
  return (
    <div className="pt-wrap">
      <div className="pt-line-bg">
        <div
          className="pt-line-fill"
          style={{
            width: stages.length > 1 ? `${(currentIndex / (stages.length - 1)) * 100}%` : "0%",
            background: accentColor,
          }}
        />
      </div>

      <div className="pt-steps">
        {stages.map((stage, i) => {
          const state = i < currentIndex ? "done" : i === currentIndex ? "active" : "upcoming";
          return (
            <div key={i} className={`pt-step ${state}`}>
              <div
                className="pt-dot"
                style={{
                  background: state !== "upcoming" ? accentColor : "#fff",
                  borderColor: state !== "upcoming" ? accentColor : "#e5e7eb",
                }}
              >
                {state === "done" ? "✓" : i + 1}
              </div>
              <span className="pt-label">{stage.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProgressTimeline;
