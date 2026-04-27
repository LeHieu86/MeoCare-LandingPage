import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getUser, getToken, setToken, setUser, clearAuth } from "../../utils/api";
import LoginPopup from "../common/LoginPopup";

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUserState] = useState(() => getUser());
  const [showLogin, setShowLogin] = useState(false);

  // Callback sau khi login thành công từ popup
  const [onLoginSuccess, setOnLoginSuccess] = useState(null);

  // Lắng nghe event "auth:expired" từ api.js
  useEffect(() => {
    const handleExpired = () => {
      setUserState(null);
      setShowLogin(true);
    };

    window.addEventListener("auth:expired", handleExpired);
    return () => window.removeEventListener("auth:expired", handleExpired);
  }, []);

  // Mở popup login thủ công (VD: bấm nút "Đăng nhập")
  const openLogin = useCallback((callback) => {
    setOnLoginSuccess(() => callback || null);
    setShowLogin(true);
  }, []);

  const closeLogin = useCallback(() => {
    setShowLogin(false);
    setOnLoginSuccess(null);
  }, []);

  // Xử lý sau khi login thành công
  const handleLoginSuccess = useCallback(
    (data) => {
      setToken(data.token);
      setUser(data.user);
      setUserState(data.user);
      setShowLogin(false);

      if (onLoginSuccess) {
        onLoginSuccess(data);
        setOnLoginSuccess(null);
      }
    },
    [onLoginSuccess]
  );

  // Logout
  const logout = useCallback(() => {
    clearAuth();
    setUserState(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!getToken(),
        openLogin,
        logout,
      }}
    >
      {children}

      {showLogin && (
        <LoginPopup onSuccess={handleLoginSuccess} onClose={closeLogin} />
      )}
    </AuthContext.Provider>
  );
};

export default AuthContext;