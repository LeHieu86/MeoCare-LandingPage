import React, { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

// BrowserRouter đã có trong main.jsx — KHÔNG bọc thêm ở đây
const Landing    = lazy(() => import("./pages/Landing"));
const Menu       = lazy(() => import("./pages/Menu"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const AdminSales = lazy(() => import("./pages/AdminSales"));
const InvoicePrint = lazy(() => import("./pages/InvoicePrint"));

const Loader = () => (
  <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#0f1117", color:"#8b90a7", fontSize:14 }}>
    Đang tải...
  </div>
);

function App() {
  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        {/* Public */}
        <Route path="/"     element={<Landing />} />
        <Route path="/menu" element={<Menu />} />

        {/* Admin */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin"       element={<AdminPanel />} />
        <Route path="/admin/sales" element={<AdminSales />} />
        <Route path="/admin/invoice" element={<InvoicePrint />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;