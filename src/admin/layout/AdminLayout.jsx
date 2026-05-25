import React, { useState, useEffect } from "react";
import { Outlet, Navigate } from "react-router-dom";
import AdminSidebar from "../components/AdminSidebar";
import AdminSessionModal from "../components/AdminSessionModal";
import { AdminNotifProvider } from "../../contexts/AdminNotifContext";

/**
 * AdminLayout
 * - Guard route: redirect về /login nếu chưa có token
 * - Global 401 interceptor: patch window.fetch khi layout mount,
 *   bắt mọi response 401 từ BẤT KỲ page nào trong /admin
 *   → hiện AdminSessionModal để đăng nhập lại tại chỗ
 *
 * ⚠️ useEffect PHẢI đặt TRƯỚC các conditional early-return
 *    để React không thay đổi số lượng hook giữa các lần render.
 */
export default function AdminLayout() {
  const [sessionExpired, setSessionExpired] = useState(false);

  // ── Global 401 interceptor ────────────────────────────────────────────────
  // Phải đặt TRƯỚC early-return để hook order luôn nhất quán
  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = async function (...args) {
      const response = await originalFetch.apply(this, args);

      const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
      const isAuthCall = url.includes("/auth/login") || url.includes("/auth/verify");

      if (response.status === 401 && !isAuthCall) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.dispatchEvent(new CustomEvent("auth:admin-expired"));
      }

      return response;
    };

    const handleExpired = () => setSessionExpired(true);
    window.addEventListener("auth:admin-expired", handleExpired);

    return () => {
      window.fetch = originalFetch;
      window.removeEventListener("auth:admin-expired", handleExpired);
    };
  }, []);

  // ── Auth guard ────────────────────────────────────────────────────────────
  const token = localStorage.getItem("token");
  const user  = (() => { try { return JSON.parse(localStorage.getItem("user")); } catch { return null; } })();

  if (!token || !user) return <Navigate to="/login" replace />;
  if (!["admin", "manager"].includes(user.role)) return <Navigate to="/" replace />;

  return (
    <AdminNotifProvider>
      <div className="adm-layout">
        <AdminSidebar />
        <main className="adm-main">
          <Outlet />
        </main>

        {/* Re-login popup khi token hết hạn */}
        {sessionExpired && (
          <AdminSessionModal onSuccess={() => setSessionExpired(false)} />
        )}
      </div>
    </AdminNotifProvider>
  );
}
