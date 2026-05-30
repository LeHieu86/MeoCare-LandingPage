import React, { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import authService from "../backend/services/authService";
import { AuthProvider } from "./client/components/auth/AuthContext";
import PrivateRoute from "./client/components/auth/PrivateRoute";
import { ConfirmProvider } from "./hooks/useConfirm";
import usePWAUpdate from "./hooks/usePWAUpdate";

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
const ClientChat   = lazy(() => import("./client/components/common/ClientChat"));
const PaymentQR = lazy(() => import("./client/components/shopping/PaymentQR"));

// ── Employee Portal ───────────────────────────────────────────
const EmployeeLayout     = lazy(() => import("./employee/layout/EmployeeLayout"));
const EmployeeDashboard  = lazy(() => import("./employee/pages/EmployeeDashboard"));
const EmployeeShifts     = lazy(() => import("./employee/pages/EmployeeShifts"));
const EmployeeAttendance = lazy(() => import("./employee/pages/EmployeeAttendance"));
const EmployeeLeave      = lazy(() => import("./employee/pages/EmployeeLeave"));
const EmployeeSalary     = lazy(() => import("./employee/pages/EmployeeSalary"));
const EmployeeProfile    = lazy(() => import("./employee/pages/EmployeeProfile"));

const Loader = () => (
  <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#0f1117", color:"#8b90a7", fontSize:14 }}>
    Đang tải...
  </div>
);

function ConditionalClientChat({ userPhone }) {
  const { pathname } = useLocation();
  if (pathname.startsWith("/employee")) return null;
  return <ClientChat userPhone={userPhone} />;
}

function App() {
  const currentUser = authService.getUser();
  usePWAUpdate();
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
        <Route path="/dashboard" element={
          <PrivateRoute roles={["customer"]}>
            <Dashboard />
          </PrivateRoute>
        } />
        <Route path="/menu"   element={<Menu />} />
        <Route path="/portal" element={
          <PrivateRoute roles={["customer"]}>
            <ClientPortal />
          </PrivateRoute>
        } />
        <Route path="/payment/:orderId" element={
          <PrivateRoute roles={["customer"]}>
            <PaymentQR />
          </PrivateRoute>
        } />

        {/* ── Employee Portal ── */}
        <Route path="/employee" element={<EmployeeLayout />}>
          <Route index              element={<EmployeeDashboard />} />
          <Route path="shifts"      element={<EmployeeShifts />} />
          <Route path="attendance"  element={<EmployeeAttendance />} />
          <Route path="leave"       element={<EmployeeLeave />} />
          <Route path="salary"      element={<EmployeeSalary />} />
          <Route path="profile"     element={<EmployeeProfile />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

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
