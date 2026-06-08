import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

/**
 * PrivateRoute — Bảo vệ route theo role.
 *
 * @param {React.ReactNode} children  - Component con cần bảo vệ
 * @param {string[]}        roles     - Role được phép. Bỏ trống = chỉ cần đăng nhập.
 *
 * Logic:
 *  0. ĐANG khôi phục phiên (từ cookie refresh) mà CHƯA có user → hiện loader, KHÔNG vội đá ra
 *     /login. Đây là điểm mấu chốt để "giữ đăng nhập": chờ refresh xong rồi mới quyết.
 *  1. Khôi phục xong vẫn không có phiên → /login.
 *  2. Sai role → về đúng portal của role.
 *  3. Hợp lệ → render children.
 */
export default function PrivateRoute({ children, roles }) {
  const { user, initializing } = useAuth();

  // Đang thử khôi phục phiên & chưa có user → chờ (tránh chớp sang /login rồi mới đăng nhập lại)
  if (initializing && !user) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", color: "#FF6B9D", fontWeight: 600,
        fontFamily: "system-ui, sans-serif",
      }}>
        Đang tải…
      </div>
    );
  }

  // Chưa đăng nhập (đã thử khôi phục mà vẫn không có phiên)
  if (!user) return <Navigate to="/login" replace />;

  // Kiểm tra role (nếu có yêu cầu)
  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    if (user.role === "admin") return <Navigate to="/admin" replace />;
    if (["employee", "manager", "stock-manager"].includes(user.role)) return <Navigate to="/employee" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
