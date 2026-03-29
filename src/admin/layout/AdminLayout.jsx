import React from "react";
import { Outlet, Navigate } from "react-router-dom";
import AdminSidebar from "../components/AdminSidebar";

export default function AdminLayout() {
  const token = localStorage.getItem("mc_admin_token");
  if (!token) return <Navigate to="/admin/login" replace />;

  return (
    <div className="adm-layout">
      <AdminSidebar />
      <main className="adm-main">
        <Outlet />
      </main>
    </div>
  );
}