import React, { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

// ---------- Client pages ----------
const Landing      = lazy(() => import("./client/pages/Landing"));
const Menu         = lazy(() => import("./client/pages/Menu"));
const ClientPortal   = lazy(() => import("./client/pages/ClientPortal"));

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
const NASManager   = lazy(() => import("./admin/pages/NASManager")); // ← THÊM

const Loader = () => (
  <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#0f1117", color:"#8b90a7", fontSize:14 }}>
    Đang tải...
  </div>
);

function App() {
  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route path="/"     element={<Landing />} />
        <Route path="/menu" element={<Menu />} />
        <Route path="/portal" element={<ClientPortal />} />

        <Route path="/admin/login" element={<AdminLogin />} />

        <Route path="/admin" element={<AdminLayout />}>
          <Route index        element={<AdminPanel />} />
          <Route path="sales"  element={<AdminSales />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="rooms"  element={<AdminRooms />} />
          <Route path="cameras" element={<AdminCamera />} />
          <Route path="invoice" element={<InvoicePrint />} />
          <Route path="bookings" element={<AdminBookingManager />} />
          <Route path="nas"    element={<NASManager />} />         {/* ← THÊM */}
        </Route>

        <Route path="/verify/:invoiceNo" element={<VerifyInvoice />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;