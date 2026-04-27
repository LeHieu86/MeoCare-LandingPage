/**
 * api.js — Helper fetch tự gắn JWT token vào mọi request
 *
 * Khi gặp 401:
 *  - Xóa token cũ
 *  - Bắn event "auth:expired" để AuthContext bắt và hiện LoginPopup
 *  - KHÔNG redirect, user ở lại trang hiện tại
 */

const BASE_URL = "/api";

// ==========================================
// TOKEN MANAGEMENT
// ==========================================
export const getToken = () => localStorage.getItem("token");
export const setToken = (token) => localStorage.setItem("token", token);
export const removeToken = () => localStorage.removeItem("token");

export const getUser = () => {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
export const setUser = (user) =>
  localStorage.setItem("user", JSON.stringify(user));
export const removeUser = () => localStorage.removeItem("user");

export const clearAuth = () => {
  removeToken();
  removeUser();
};

export const isLoggedIn = () => !!getToken();

// ==========================================
// FETCH WRAPPER
// ==========================================
const request = async (endpoint, options = {}) => {
  const token = getToken();

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // 401 → xóa token + bắn event để hiện popup login
  if (res.status === 401) {
    clearAuth();
    window.dispatchEvent(new CustomEvent("auth:expired"));
    throw new Error("Phiên đăng nhập đã hết hạn");
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || data.error || "Có lỗi xảy ra");
  }

  return data;
};

// ==========================================
// SHORTHAND METHODS
// ==========================================
const api = {
  get: (endpoint) => request(endpoint, { method: "GET" }),

  post: (endpoint, body) =>
    request(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  put: (endpoint, body) =>
    request(endpoint, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  delete: (endpoint) => request(endpoint, { method: "DELETE" }),
};

export default api;