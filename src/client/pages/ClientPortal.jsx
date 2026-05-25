import React, { useState, useCallback } from "react";
import toast from "react-hot-toast";
import "../../styles/client/client_portal.css";

// Import 2 tab tách ra
import ClientBooking from "../components/store-services/ClientBooking";
import ClientObserve from "../components/store-services/ClientObserve";
import ClientChat from "../components/common/ClientChat"; // Nhúng component Chat độc lập

export default function ClientPortal() {
  const [tab, setTab] = useState("booking");

  // LIFT STATE SỐ ĐT
  const [userPhone, setUserPhone] = useState("");

  const showToast = useCallback((msg, type = "success") =>
    type === "error" ? toast.error(msg) : toast.success(msg), []);

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

      {/* Toast qua react-hot-toast global */}
    </div>
  );
}