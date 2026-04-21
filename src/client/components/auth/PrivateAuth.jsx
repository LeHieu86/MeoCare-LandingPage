// src/components/PrivateRoute.jsx
import { Navigate } from "react-router-dom";
import authService from "../services/authService";

/**
 * Bảo vệ các route yêu cầu đăng nhập.
 * Nếu chưa có token → redirect về /login.
 */
const PrivateRoute = ({ children }) => {
  return authService.isAuthenticated() ? children : <Navigate to="/login" replace />;
};

export default PrivateRoute;