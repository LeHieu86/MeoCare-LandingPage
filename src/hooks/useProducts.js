import { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export const useProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/products`);
      if (!res.ok) throw new Error("Không thể tải sản phẩm");
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  return { products, loading, error, refetch: fetchProducts };
};

// ── Admin API helpers (token-protected) ───────────────────────────────────────
const authFetch = (url, options = {}) => {
  const token = localStorage.getItem("mc_admin_token");
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
};

export const adminAPI = {
  login: (username, password) =>
    fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    }).then((r) => r.json()),

  verifyToken: () =>
    authFetch(`${API_BASE}/auth/verify`, { method: "POST" }).then((r) => r.json()),

  createProduct: (data) =>
    authFetch(`${API_BASE}/products`, {
      method: "POST",
      body: JSON.stringify(data),
    }).then((r) => r.json()),

  updateProduct: (id, data) =>
    authFetch(`${API_BASE}/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }).then((r) => r.json()),

  deleteProduct: (id) =>
    authFetch(`${API_BASE}/products/${id}`, {
      method: "DELETE",
    }).then((r) => r.json()),
};

export default API_BASE;