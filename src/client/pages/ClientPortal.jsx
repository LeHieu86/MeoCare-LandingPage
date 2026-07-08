import React, { useState, useCallback } from "react";
import toast from "react-hot-toast";
import "../../styles/client/client_portal.css";

// Đặt lịch giữ mèo. (Luồng "Quan sát" cũ theo SĐT đã gỡ — xem camera giờ ở tài khoản
// đã đăng nhập qua ActiveServices, có auth.)
import ClientBooking from "../components/store-services/ClientBooking";
// Chat FAB do App.jsx render toàn cục (ConditionalClientChat) — KHÔNG nhúng lại ở đây để tránh trùng

export default function ClientPortal() {
  const [tab, setTab] = useState("booking");

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
      </nav>

      <main className="cp-content">
        {/* Đặt lịch */}
        {tab === "booking" && (
          <ClientBooking
            onSuccess={showToast}
          />
        )}
      </main>

      {/* Toast qua react-hot-toast global */}
    </div>
  );
}