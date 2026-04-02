import React, { useState, useCallback } from "react";
import "../../styles/client/client_portal.css";

// Import 2 tab tách ra
import ClientBooking from "./ClientBooking";
import ClientObserve from "./ClientObserve";

export default function ClientPortal() {
  const [tab, setTab] = useState("booking");
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  return (
    <div className="cp-root">
      {/* Header cũ nếu có thì giữ nguyên ở đây */}
      
      <nav className="cp-tabs">
        <button className={`cp-tab ${tab === "booking" ? "active" : ""}`} onClick={() => setTab("booking")}>
          <span className="cp-tab-icon">📅</span> Đặt lịch
        </button>
        <button className={`cp-tab ${tab === "observe" ? "active" : ""}`} onClick={() => setTab("observe")}>
          <span className="cp-tab-icon">👀</span> Quan sát
        </button>
      </nav>

      <main className="cp-content">
        {tab === "booking" && <ClientBooking onSuccess={showToast} />}
        {tab === "observe" && <ClientObserve />}
      </main>

      {toast && (
        <div className={`cp-toast ${toast.type}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}