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

// Refresh token DỰ PHÒNG trong localStorage — để PWA/mobile vẫn giữ phiên khi cookie
// httpOnly bị mất (iOS PWA hay xoá cookie khi kill app). Cookie vẫn là kênh chính ở
// trình duyệt thường; cái này chỉ là phao cứu sinh. Backend đọc refresh từ cookie HOẶC body.
export const getRefreshToken = () => localStorage.getItem("rt");
export const setRefreshToken = (t) => { if (t) localStorage.setItem("rt", t); };
export const removeRefreshToken = () => localStorage.removeItem("rt");

export const clearAuth = () => {
  removeToken();
  removeUser();
  removeRefreshToken();
};

export const isLoggedIn = () => !!getToken();

// ==========================================
// REFRESH TOKEN (xoay vòng — single-flight)
// ==========================================
// Access token ngắn hạn; khi hết hạn (401) → gọi /auth/refresh (cookie httpOnly tự gửi)
// để lấy access mới rồi thử lại request. Gom nhiều 401 đồng thời vào 1 lần refresh.
let refreshPromise = null;

export const refreshAccessToken = () => {
  if (!refreshPromise) {
    refreshPromise = fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // gửi cookie (kênh chính)
      // Kèm refresh dự phòng từ localStorage cho PWA/mobile (backend ưu tiên cookie nếu có)
      body: JSON.stringify({ refreshToken: getRefreshToken() || undefined }),
    })
      .then(async (r) => {
        // 409 = phiên nhập nhằng (cookie ≠ rt khác user) → xoá sạch phía client, buộc đăng nhập lại
        if (r.status === 409) { clearAuth(); throw new Error("session conflict"); }
        if (!r.ok) throw new Error("refresh failed");
        const d = await r.json();
        if (d.token) setToken(d.token);
        if (d.user) setUser(d.user);
        if (d.refreshToken) setRefreshToken(d.refreshToken); // lưu token đã xoay vòng
        return d.token;
      })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
};

// ==========================================
// FETCH WRAPPER
// ==========================================
const request = async (endpoint, options = {}, timeoutMs = 15000) => {
  const token = getToken();

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: "include",
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === "AbortError") throw new Error("Yêu cầu quá thời gian chờ, vui lòng thử lại");
    throw new Error("Không thể kết nối đến máy chủ");
  } finally {
    clearTimeout(timer);
  }

  // 401 → thử refresh 1 lần rồi retry; thất bại mới coi là hết phiên
  if (res.status === 401 && !options._retry && endpoint !== "/auth/refresh") {
    let newToken = null;
    try { newToken = await refreshAccessToken(); } catch { /* refresh fail */ }
    if (newToken) {
      return request(endpoint, { ...options, _retry: true }, timeoutMs);
    }
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

  upload: async (endpoint, formData, timeoutMs = 30000, _retry = false) => {
    const token = getToken();
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res;
    try {
      res = await fetch(`${BASE_URL}${endpoint}`, {
        method: "POST",
        headers,
        body: formData,
        credentials: "include",
        signal: controller.signal,
      });
    } catch (err) {
      if (err.name === "AbortError") throw new Error("Upload quá thời gian chờ (30s), vui lòng thử lại");
      throw new Error("Không thể kết nối đến máy chủ");
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 401 && !_retry) {
      let newToken = null;
      try { newToken = await refreshAccessToken(); } catch { /* refresh fail */ }
      if (newToken) return api.upload(endpoint, formData, timeoutMs, true);
      clearAuth();
      window.dispatchEvent(new CustomEvent("auth:expired"));
      throw new Error("Phiên đăng nhập đã hết hạn");
    }
    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error(`Lỗi máy chủ (${res.status}), vui lòng thử lại`);
    }
    if (!res.ok) throw new Error(data.message || data.error || "Có lỗi xảy ra");
    return data;
  },
};

export default api;