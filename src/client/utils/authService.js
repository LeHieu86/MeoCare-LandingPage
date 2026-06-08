const API_BASE = import.meta.env.VITE_API_URL || "/api";

const authService = {
  login: async (username, password, remember = false) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // nhận cookie refresh (httpOnly)
      body: JSON.stringify({ username, password, remember }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Đăng nhập thất bại.");
    // Chỉ lưu ACCESS token (ngắn hạn) ở JS; refresh nằm trong cookie httpOnly
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    // Báo cho AuthContext đồng bộ lại user ngay (tránh hiển thị tên của phiên cũ)
    window.dispatchEvent(new CustomEvent("auth:changed"));
    return data;
  },

  forgotPassword: async (identifier, email, newPassword) => {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, email, newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Không đặt lại được mật khẩu. Vui lòng thử lại.");
    return data;
  },

  register: async (payload) => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Đăng ký thất bại.");
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    window.dispatchEvent(new CustomEvent("auth:changed"));
    return data;
  },

  logout: async () => {
    // Thu hồi refresh token phía server (xoá cookie) — bỏ qua lỗi mạng
    try {
      await fetch(`${API_BASE}/auth/logout`, { method: "POST", credentials: "include" });
    } catch { /* vẫn xoá phía client dù lỗi */ }
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.dispatchEvent(new CustomEvent("auth:changed"));
  },

  getToken: () => localStorage.getItem("token"),

  getUser: () => {
    const u = localStorage.getItem("user");
    return u ? JSON.parse(u) : null;
  },

  isAuthenticated: () => !!localStorage.getItem("token"),
};

export default authService;
