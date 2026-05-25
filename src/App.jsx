import React, { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import authService from "../backend/services/authService";
import { AuthProvider } from "./client/components/auth/AuthContext";
import { ConfirmProvider } from "./hooks/useConfirm";

class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error("[ErrorBoundary]", error, info); }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#0f1117", color:"#e8eaf0", gap:16, fontFamily:"sans-serif" }}>
        <div style={{ fontSize:48 }}>⚠️</div>
        <div style={{ fontSize:18, fontWeight:700 }}>Đã xảy ra lỗi không mong muốn</div>
        <div style={{ fontSize:13, color:"#8b90a7", maxWidth:400, textAlign:"center" }}>{this.state.error?.message}</div>
        <button onClick={() => location.reload()} style={{ marginTop:8, padding:"10px 24px", background:"#5b7cf6", color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontSize:14, fontWeight:600 }}>
          Tải lại trang
        </button>
      </div>
    );
  }
}

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
const BackupManagement = lazy(() => import("./admin/pages/BackupManagement"));
// ── HR Admin ──────────────────────────────────────────────────
const AdminEmployees = lazy(() => import("./admin/pages/AdminEmployees"));
const AdminShifts    = lazy(() => import("./admin/pages/AdminShifts"));
const AdminAttendance= lazy(() => import("./admin/pages/AdminAttendance"));
const AdminLeave     = lazy(() => import("./admin/pages/AdminLeave"));
const AdminSalary    = lazy(() => import("./admin/pages/AdminSalary"));

// ── Employee Portal ───────────────────────────────────────────
const EmployeeLayout     = lazy(() => import("./employee/layout/EmployeeLayout"));
const EmployeeDashboard  = lazy(() => import("./employee/pages/EmployeeDashboard"));
const EmployeeShifts     = lazy(() => import("./employee/pages/EmployeeShifts"));
const EmployeeAttendance = lazy(() => import("./employee/pages/EmployeeAttendance"));
const EmployeeLeave      = lazy(() => import("./employee/pages/EmployeeLeave"));
const EmployeeSalary     = lazy(() => import("./employee/pages/EmployeeSalary"));

const Loader = () => (
  <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#0f1117", color:"#8b90a7", fontSize:14 }}>
    Đang tải...
  </div>
);

// Chỉ hiện nút chat nổi cho khách hàng — ẩn hoàn toàn trên admin & employee portal
function ConditionalClientChat({ userPhone }) {
  const { pathname } = useLocation();
  if (pathname.startsWith("/admin") || pathname.startsWith("/employee")) return null;
  return <ClientChat userPhone={userPhone} />;
}

function App() {
  const currentUser = authService.getUser();
  return (
    <ErrorBoundary>
    <Suspense fallback={<Loader />}>
      <ConfirmProvider>
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

        {/* InvoicePrint mở tab mới để in — không kèm sidebar/topbar admin */}
        <Route path="/admin/invoice" element={<InvoicePrint />} />

        <Route path="/admin" element={<AdminLayout />}>
          <Route index        element={<AdminPanel />} />
          <Route path="sales"  element={<AdminSales />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="rooms"  element={<AdminRooms />} />
          <Route path="cameras" element={<AdminCamera />} />
          <Route path="bookings" element={<AdminBookingManager />} />
          <Route path="nas"    element={<NASManager />} />
          <Route path="chat"    element={<AdminChat />} />
          <Route path="purchase-orders" element={<AdminPurchaseOrders />} />
          <Route path="backup" element={<BackupManagement />} />
          {/* ── HR Module ── */}
          <Route path="employees"  element={<AdminEmployees />} /> 
          <Route path="shifts"     element={<AdminShifts />} />
          <Route path="attendance" element={<AdminAttendance />} />
          <Route path="leave"      element={<AdminLeave />} />
          <Route path="salary"     element={<AdminSalary />} />
        </Route>

        {/* ── Employee Portal ── */}
        <Route path="/employee" element={<EmployeeLayout />}>
          <Route index              element={<EmployeeDashboard />} />
          <Route path="shifts"      element={<EmployeeShifts />} />
          <Route path="attendance"  element={<EmployeeAttendance />} />
          <Route path="leave"       element={<EmployeeLeave />} />
          <Route path="salary"      element={<EmployeeSalary />} />
        </Route>

        <Route path="/verify/:invoiceNo" element={<VerifyInvoice />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* ================= GLOBAL CHAT ==================== */}
      {/* Chỉ hiện với khách hàng — ẩn trên /admin và /employee */}
      <ConditionalClientChat userPhone={currentUser?.phone} />
      </AuthProvider>
      </ConfirmProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { fontFamily: "'Nunito', sans-serif", borderRadius: "12px", fontSize: "14px" },
          duration: 3500,
        }}
      />
    </Suspense>
    </ErrorBoundary>
  );
}

export default App;