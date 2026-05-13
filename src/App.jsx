import React, { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import authService from "../backend/services/authService";
import { AuthProvider } from "./client/components/auth/AuthContext";

// ---------- Client pages ----------
const Landing      = lazy(() => import("./client/pages/Landing"));
const Login        = lazy(() => import("./client/components/auth/Login"));
const Register     = lazy(() => import("./client/components/auth/Register"));
const Dashboard    = lazy(() => import("./client/pages/Dashboard"));
const Menu         = lazy(() => import("./client/pages/Menu"));
const ClientPortal   = lazy(() => import("./client/pages/ClientPortal"));
const ClientChat   = lazy(() => import("./client/components/common/ClientChat")); // Đã có sẵn
const PaymentQR = lazy(() => import("./client/components/shopping/PaymentQR"));

// ---------- Admin pages ----------
const AdminLogin   = lazy(() => import("./admin/pages/AdminLogin"));
const AdminPanel   = lazy(() => import("./admin/pages/AdminPanel"));
const AdminSales   = lazy(() => import("./admin/pages/AdminSales"));
const AdminOrders  = lazy(() => import("./admin/pages/AdminOrders"));
const AdminRooms   = lazy(() => import("./admin/pages/AdminRooms"));
const AdminCamera  = lazy(() => import("./admin/pages/AdminCamera"));
const InvoicePrint = lazy(() => import("./admin/pages/InvoicePrint"));
const VerifyInvoice = lazy(() => import("./admin/pages/VerifyInvoice"));
const AdminLayout  = lazy(() => import("./admin/layout/AdminLayout"));
const AdminBookingManager = lazy(() => import("./admin/pages/AdminBookingManager"));
const NASManager   = lazy(() => import("./admin/pages/NASManager"));
const AdminChat  = lazy(() => import("./admin/pages/AdminChat"));
const AdminPurchaseOrders = lazy(() => import("./admin/pages/AdminPurchaseOrders"));

const Loader = () => (
  <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#0f1117", color:"#8b90a7", fontSize:14 }}>
    Đang tải...
  </div>
);

function App() {
  const currentUser = authService.getUser();
  return (
    <Suspense fallback={<Loader />}>
      <AuthProvider>
      <Routes>
        {/* ================= CLIENT ==================== */}
        <Route path="/"     element={<Landing />} />
        <Route path="/login"  element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/menu"   element={<Menu />} />
        <Route path="/portal" element={<ClientPortal />} />
        <Route path="/payment/:orderId" element={<PaymentQR />} />

        {/* ================= ADMIN ==================== */}
        <Route path="/admin/login" element={<AdminLogin />} />

        <Route path="/admin" element={<AdminLayout />}>
          <Route index        element={<AdminPanel />} />
          <Route path="sales"  element={<AdminSales />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="rooms"  element={<AdminRooms />} />
          <Route path="cameras" element={<AdminCamera />} />
          <Route path="invoice" element={<InvoicePrint />} />
          <Route path="bookings" element={<AdminBookingManager />} />
          <Route path="nas"    element={<NASManager />} />
          <Route path="chat"    element={<AdminChat />} />
          <Route path="purchase-orders" element={<AdminPurchaseOrders />} />
        </Route>

        <Route path="/verify/:invoiceNo" element={<VerifyInvoice />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* ================= GLOBAL CHAT ==================== */}
      {/* Đặt ở ngoài Routes để cái nút chat luôn nổi trên cùng, dù khách đang xem trang nào */}
      <ClientChat userPhone={currentUser?.phone} />
      </AuthProvider>
    </Suspense>
  );
}

export default App;