// src/services/authService.js
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

const authService = {
  /**
   * Đăng nhập
   * @param {string} username
   * @param {string} password
   * @returns {{ token, user }}
   */
  login: async (username, password) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Đăng nhập thất bại.");
    // Lưu token vào localStorage
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    return data;
  },

  /**
   * Đăng ký
   * @param {{ fullName, username, email, phone, password }} payload
   * @returns {{ token, user }}
   */
  register: async (payload) => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Đăng ký thất bại.");
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    return data;
  },

  /**
   * Đăng xuất
   */
  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  },

  /**
   * Lấy token hiện tại
   */
  getToken: () => localStorage.getItem("token"),

  /**
   * Lấy user đang đăng nhập
   */
  getUser: () => {
    const u = localStorage.getItem("user");
    return u ? JSON.parse(u) : null;
  },

  /**
   * Kiểm tra đã đăng nhập chưa
   */
  isAuthenticated: () => !!localStorage.getItem("token"),
};

export default authService;