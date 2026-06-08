import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import api, { getUser, getToken, setToken, setUser, clearAuth, refreshAccessToken } from "../../utils/api";
import LoginPopup from "../common/LoginPopup";

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUserState] = useState(() => getUser());
  const [showLogin, setShowLogin] = useState(false);
  // true cho tới khi thử khôi phục phiên từ cookie xong → để route CHỜ, không vội đá ra login
  const [initializing, setInitializing] = useState(true);

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

  // Đồng bộ user khi đăng nhập/đăng xuất ở trang Login (auth:changed)
  // hoặc khi login/logout ở tab khác (storage event) — tránh hiển thị tên phiên cũ.
  useEffect(() => {
    const sync = () => setUserState(getUser());
    window.addEventListener("auth:changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("auth:changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Lúc mở app: (1) nếu không còn access token nhưng còn cookie refresh → khôi phục phiên
  // (giữ đăng nhập sau khi đóng/mở lại trình duyệt); (2) tải hồ sơ mới nhất, tự sửa tên cũ.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!getToken()) {
          // Không còn access token → thử khôi phục từ cookie refresh (giữ đăng nhập)
          try { await refreshAccessToken(); } catch { return; }
          if (cancelled) return;
          setUserState(getUser());
        }
        if (!getToken()) return;
        const data = await api.get("/account/profile");
        if (cancelled || !data?.user) return;
        const merged = { ...(getUser() || {}), ...data.user }; // giữ role/store_id, cập nhật tên
        setUser(merged);
        setUserState(merged);
      } catch { /* 401 đã được api.js xử lý; lỗi khác bỏ qua */ }
      finally { if (!cancelled) setInitializing(false); } // dù thế nào cũng kết thúc "đang khởi tạo"
    })();
    return () => { cancelled = true; };
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

  // Logout — thu hồi refresh phía server (xoá cookie) rồi xoá phía client
  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch { /* vẫn xoá phía client dù lỗi mạng */ }
    clearAuth();
    setUserState(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        initializing,
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