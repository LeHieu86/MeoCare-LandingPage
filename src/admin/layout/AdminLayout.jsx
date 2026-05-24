import React, { useState, useEffect } from "react";
import { Outlet, Navigate } from "react-router-dom";
import AdminSidebar from "../components/AdminSidebar";
import AdminSessionModal from "../components/AdminSessionModal";

/**
 * AdminLayout
 * - Guard route: redirect về /admin/login nếu chưa có token
 * - Global 401 interceptor: patch window.fetch khi layout mount,
 *   bắt mọi response 401 từ BẤT KỲ page nào trong /admin
 *   → hiện AdminSessionModal để đăng nhập lại tại chỗ
 */
export default function AdminLayout() {
  const [sessionExpired, setSessionExpired] = useState(false);

  const token = localStorage.getItem("token");
  const user  = (() => { try { return JSON.parse(localStorage.getItem("user")); } catch { return null; } })();

  // Chưa đăng nhập → về trang login chung
  if (!token || !user) return <Navigate to="/login" replace />;
  // Đã đăng nhập nhưng không phải admin/manager → về trang chủ
  if (!["admin", "manager"].includes(user.role)) return <Navigate to="/" replace />;

  useEffect(() => {
    const originalFetch = window.fetch;

    // Patch window.fetch — chỉ hoạt động khi AdminLayout đang mount
    window.fetch = async function (...args) {
      const response = await originalFetch.apply(this, args);

      // Nếu 401 và KHÔNG phải call login (tránh vòng lặp vô hạn)
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
      const isLoginCall = url.includes("/auth/login") || url.includes("/auth/verify");

      if (response.status === 401 && !isLoginCall) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.dispatchEvent(new CustomEvent("auth:admin-expired"));
      }

      return response;
    };

    const handleExpired = () => setSessionExpired(true);
    window.addEventListener("auth:admin-expired", handleExpired);

    return () => {
      // Restore original fetch khi admin layout unmount
      window.fetch = originalFetch;
      window.removeEventListener("auth:admin-expired", handleExpired);
    };
  }, []);

  return (
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
  );
}
