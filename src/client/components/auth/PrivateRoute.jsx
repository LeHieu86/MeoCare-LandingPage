import { Navigate } from "react-router-dom";
import authService from "../../utils/authService";

/**
 * PrivateRoute — Bảo vệ route theo role
 *
 * @param {React.ReactNode} children  - Component con cần bảo vệ
 * @param {string[]}        roles     - Danh sách role được phép truy cập.
 *                                      Bỏ trống / không truyền = chỉ cần đăng nhập.
 *
 * Logic:
 *  1. Chưa đăng nhập          → redirect /login
 *  2. Đã đăng nhập nhưng sai role → redirect về đúng portal của role đó
 *  3. Đúng role               → render children
 */
export default function PrivateRoute({ children, roles }) {
  const token = authService.getToken();
  const user  = authService.getUser();

  // Chưa đăng nhập
  if (!token || !user) return <Navigate to="/login" replace />;

  // Kiểm tra role (nếu có yêu cầu)
  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    // Redirect về đúng portal theo role thực tế
    if (user.role === "admin") return <Navigate to="/admin" replace />;
    if (["employee", "manager", "stock-manager"].includes(user.role)) return <Navigate to="/employee" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
