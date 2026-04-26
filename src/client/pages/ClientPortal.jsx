import React, { useState, useCallback } from "react";
import "../../styles/client/client_portal.css";

// Import 2 tab tách ra
import ClientBooking from "../components/store-services/ClientBooking";
import ClientObserve from "../components/store-services/ClientObserve";
import ClientChat from "../components/common/ClientChat"; // Nhúng component Chat độc lập

export default function ClientPortal() {
  const [tab, setTab] = useState("booking");
  const [toast, setToast] = useState(null);

  // LIFT STATE SỐ ĐT
  const [userPhone, setUserPhone] = useState("");

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  return (
    <div className="cp-root">
      {/* Header */}
      <nav className="cp-tabs">
        <button
          className={`cp-tab ${tab === "booking" ? "active" : ""}`}
          onClick={() => setTab("booking")}
        >
          <span className="cp-tab-icon">📅</span> Đặt lịch
        </button>

        <button
          className={`cp-tab ${tab === "observe" ? "active" : ""}`}
          onClick={() => setTab("observe")}
        >
          <span className="cp-tab-icon">👀</span> Quan sát
        </button>
      </nav>

      {/* Chat luôn hiển thị */}
      <ClientChat userPhone={userPhone} />

      <main className="cp-content">
        {/* Tab Booking */}
        {tab === "booking" && (
          <ClientBooking
            userPhone={userPhone}
            onSuccess={showToast}
          />
        )}

        {/* Tab Observe */}
        {tab === "observe" && <ClientObserve />}
      </main>

      {/* Toast */}
      {toast && (
        <div className={`cp-toast ${toast.type}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}