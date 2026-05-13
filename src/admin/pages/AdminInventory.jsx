import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { adminAPI } from "../../hooks/useProducts";
import "../../styles/admin/admin.css";

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const fmt = (n) => (n || 0).toLocaleString("vi-VN") + "đ";

const UNITS = ["hộp", "lon", "thùng", "kg", "g", "cái", "gói", "chai", "túi"];

/* ── Badge tồn kho ── */
const StockBadge = ({ item }) => {
  if (item.current_stock === 0) {
    return <span style={{ color: "#ef4444", fontWeight: 700, fontSize: 13 }}>Hết hàng</span>;
  }
  if (item.is_low_stock) {
    return (
      <span style={{ color: "#f59e0b", fontWeight: 600, fontSize: 13 }}>
        ⚠️ {item.current_stock} {item.unit}
      </span>
    );
  }
  return (
    <span style={{ color: "#22c55e", fontWeight: 600, fontSize: 13 }}>
      {item.current_stock} {item.unit}
    </span>
  );
};

/* ══════════════════════════════════════════════════════
   MODAL: THÊM / SỬA HÀNG HÓA
   ══════════════════════════════════════════════════════ */
const ItemModal = ({ item, onClose, onSaved, token }) => {
  const isEdit = !!item?.id;
  const [form, setForm] = useState({
    sku: item?.sku || "",
    name: item?.name || "",
    barcode: item?.barcode || "",
    unit: item?.unit || "hộp",
    min_stock_alert: item?.min_stock_alert || 0,
    note: item?.note || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.sku.trim()) return setError("SKU không được trống");
    if (!form.name.trim()) return setError("Tên không được trống");
    setSaving(true);
    try {
      const url    = isEdit ? `${API_BASE}/inventory/${item.id}` : `${API_BASE}/inventory`;
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          min_stock_alert: parseInt(form.min_stock_alert) || 0,
        }),
      });
      const data = await res.json();
      if (data.success) onSaved();
      else setError(data.message || "Lỗi xảy ra");
    } catch {
      setError("Lỗi kết nối");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="adm-modal-overlay" onClick={onClose}>
      <div className="adm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="adm-modal-header">
          <h2>{isEdit ? "✏️ Sửa hàng hóa" : "➕ Thêm hàng hóa mới"}</h2>
          <button className="adm-modal-close" onClick={onClose}>✕</button>
        </div>
        <form className="adm-modal-body" onSubmit={handleSubmit}>
          <div className="adm-field-row">
            <div className="adm-field">
              <label className="adm-label">SKU *</label>
              <input className="adm-input" value={form.sku} onChange={(e) => set("sku", e.target.value.toUpperCase())}
                placeholder="PATE-CATUN-170G" disabled={isEdit} />
            </div>
            <div className="adm-field">
              <label className="adm-label">Đơn vị *</label>
              <select className="adm-input adm-select" value={form.unit} onChange={(e) => set("unit", e.target.value)}>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div className="adm-field">
            <label className="adm-label">Tên hàng hóa *</label>
            <input className="adm-input" value={form.name} onChange={(e) => set("name", e.target.value)}
              placeholder="Pate Cá ngừ cua 170g" />
          </div>

          <div className="adm-field-row">
            <div className="adm-field">
              <label className="adm-label">Barcode</label>
              <input className="adm-input" value={form.barcode} onChange={(e) => set("barcode", e.target.value)}
                placeholder="8930000123456" />
            </div>
            <div className="adm-field">
              <label className="adm-label">Cảnh báo tồn thấp</label>
              <input className="adm-input" type="number" min="0" value={form.min_stock_alert}
                onChange={(e) => set("min_stock_alert", e.target.value)}
                placeholder="VD: 10 (để 0 = không cảnh báo)" />
            </div>
          </div>

          <div className="adm-field">
            <label className="adm-label">Ghi chú</label>
            <input className="adm-input" value={form.note} onChange={(e) => set("note", e.target.value)}
              placeholder="Ghi chú thêm..." />
          </div>

          {error && <div className="adm-error">{error}</div>}

          <div className="adm-modal-actions">
            <button type="button" className="adm-btn-ghost" onClick={onClose}>Hủy</button>
            <button type="submit" className="adm-btn-primary" disabled={saving}>
              {saving ? <span className="adm-spinner" /> : isEdit ? "Lưu thay đổi" : "Thêm hàng hóa"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════
   MODAL: ĐIỀU CHỈNH TỒN KHO
   ══════════════════════════════════════════════════════ */
const AdjustModal = ({ item, onClose, onSaved, token }) => {
  const [type, setType] = useState("adjustment");
  const [qtyChange, setQtyChange] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const ADJUST_TYPES = [
    { id: "adjustment", label: "Kiểm kê điều chỉnh", icon: "📋" },
    { id: "return",     label: "Hàng trả về",        icon: "↩️" },
    { id: "damaged",    label: "Hàng hỏng / thất thoát", icon: "⚠️" },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!qtyChange || qtyChange === "0") return setError("Nhập số lượng thay đổi");
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/inventory/${item.id}/adjust`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type, qty_change: parseInt(qtyChange), note }),
      });
      const data = await res.json();
      if (data.success) onSaved(`Tồn kho mới: ${data.new_stock} ${item.unit}`);
      else setError(data.message);
    } catch {
      setError("Lỗi kết nối");
    } finally {
      setSaving(false);
    }
  };

  const preview = item.current_stock + (parseInt(qtyChange) || 0);

  return (
    <div className="adm-modal-overlay" onClick={onClose}>
      <div className="adm-modal adm-modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="adm-modal-header">
          <h2>📦 Điều chỉnh tồn kho</h2>
          <button className="adm-modal-close" onClick={onClose}>✕</button>
        </div>
        <form className="adm-modal-body" onSubmit={handleSubmit}>
          <div style={{ padding: "12px 16px", background: "var(--adm-surface-2)", borderRadius: 10, marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: "var(--adm-text-2)" }}>{item.sku}</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{item.name}</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>
              Tồn hiện tại: <strong>{item.current_stock} {item.unit}</strong>
            </div>
          </div>

          <div className="adm-field">
            <label className="adm-label">Loại điều chỉnh</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {ADJUST_TYPES.map((t) => (
                <label key={t.id} style={{ display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px", border: `1.5px solid ${type === t.id ? "var(--adm-primary)" : "var(--adm-border)"}`,
                  borderRadius: 8, cursor: "pointer", background: type === t.id ? "rgba(59,130,246,0.06)" : "transparent" }}>
                  <input type="radio" name="type" value={t.id} checked={type === t.id}
                    onChange={() => setType(t.id)} style={{ accentColor: "var(--adm-primary)" }} />
                  <span>{t.icon} {t.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="adm-field">
            <label className="adm-label">
              Số lượng thay đổi
              <span style={{ fontSize: 11, color: "var(--adm-text-2)", marginLeft: 8 }}>
                (dùng số âm để trừ, ví dụ: -5)
              </span>
            </label>
            <input className="adm-input" type="number" value={qtyChange}
              onChange={(e) => { setQtyChange(e.target.value); setError(""); }}
              placeholder="-5 hoặc +10" />
            {qtyChange && (
              <div style={{ fontSize: 13, marginTop: 6, color: preview < 0 ? "#ef4444" : "#22c55e" }}>
                Sau điều chỉnh: <strong>{preview} {item.unit}</strong>
                {preview < 0 && " ⚠️ Không thể âm"}
              </div>
            )}
          </div>

          <div className="adm-field">
            <label className="adm-label">Lý do / Ghi chú</label>
            <input className="adm-input" value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Lý do điều chỉnh..." />
          </div>

          {error && <div className="adm-error">{error}</div>}

          <div className="adm-modal-actions">
            <button type="button" className="adm-btn-ghost" onClick={onClose}>Hủy</button>
            <button type="submit" className="adm-btn-primary" disabled={saving || preview < 0}>
              {saving ? <span className="adm-spinner" /> : "Xác nhận điều chỉnh"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════ */
const AdminInventory = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem("mc_admin_token");

  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!token) { navigate("/admin/login"); return; }
    adminAPI.verifyToken().then((r) => {
      if (!r.valid) { localStorage.removeItem("mc_admin_token"); navigate("/admin/login"); }
    });
  }, [navigate, token]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filter === "low") params.set("low_stock", "1");

      const [itemsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/inventory?${params}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/inventory/stats/overview`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [itemsData, statsData] = await Promise.all([itemsRes.json(), statsRes.json()]);

      if (itemsData.success) setItems(itemsData.items);
      if (statsData.success) setStats(statsData.stats);
    } catch {
      showToast("Không thể tải dữ liệu", "error");
    } finally {
      setLoading(false);
    }
  }, [search, filter, token]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaved = (message = "Đã lưu thành công!") => {
    setModal(null);
    showToast(message);
    fetchItems();
  };

  /* Filter items phía client */
  const filtered = items.filter((item) => {
    if (filter === "low") return item.is_low_stock;
    if (filter === "out") return item.current_stock === 0;
    return true;
  });

  return (
    <div>
      {/* ── TOPBAR ── */}
      <div className="adm-topbar">
        <div>
          <h1 className="adm-page-title">🗂️ Tồn kho</h1>
          <p className="adm-page-sub">Quản lý hàng hóa & biến động tồn kho</p>
        </div>
        <button className="adm-btn-primary" onClick={() => setModal({ mode: "create" })}>
          + Thêm hàng hóa
        </button>
      </div>

      {/* ── STATS ── */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { icon: "📦", label: "Mặt hàng", value: stats.totalItems, color: "var(--adm-text)" },
            { icon: "💰", label: "Giá trị kho", value: fmt(stats.totalStockValue), color: "#22c55e" },
            { icon: "⚠️", label: "Tồn thấp", value: stats.lowStockCount, color: "#f59e0b" },
            { icon: "🚫", label: "Hết hàng", value: stats.outOfStockCount, color: "#ef4444" },
          ].map((s) => (
            <div key={s.label} style={{ background: "var(--adm-surface)", borderRadius: 12,
              border: "1px solid var(--adm-border)", padding: "16px 18px" }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "var(--adm-text-2)" }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── FILTERS ── */}
      <div className="adm-filters">
        <input className="adm-input adm-search" placeholder="🔍 Tìm theo tên hoặc SKU..."
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="adm-cat-tabs">
          {[
            { id: "all", label: "Tất cả" },
            { id: "low", label: `⚠️ Tồn thấp${stats?.lowStockCount ? ` (${stats.lowStockCount})` : ""}` },
            { id: "out", label: `🚫 Hết hàng${stats?.outOfStockCount ? ` (${stats.outOfStockCount})` : ""}` },
          ].map((tab) => (
            <button key={tab.id} className={`adm-cat-tab ${filter === tab.id ? "active" : ""}`}
              onClick={() => setFilter(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── TABLE ── */}
      {loading ? (
        <div className="adm-loading"><span className="adm-spinner adm-spinner-lg" /><p>Đang tải...</p></div>
      ) : filtered.length === 0 ? (
        <div className="adm-empty"><div className="adm-empty-icon">🗂️</div><p>Không có hàng hóa nào</p></div>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Tên hàng hóa</th>
                <th>Đơn vị</th>
                <th>Tồn kho</th>
                <th>Giá vốn BQ</th>
                <th>Giá trị tồn</th>
                <th>Cảnh báo</th>
                <th>Combo</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} style={item.current_stock === 0 ? { opacity: 0.6 } : {}}>
                  <td>
                    <span style={{ fontFamily: "monospace", fontSize: 12,
                      background: "var(--adm-surface-2)", padding: "3px 8px", borderRadius: 6 }}>
                      {item.sku}
                    </span>
                  </td>
                  <td>
                    <div className="adm-product-name">{item.name}</div>
                    {item.barcode && <div style={{ fontSize: 11, color: "var(--adm-text-2)" }}>{item.barcode}</div>}
                  </td>
                  <td style={{ color: "var(--adm-text-2)", fontSize: 13 }}>{item.unit}</td>
                  <td><StockBadge item={item} /></td>
                  <td className="adm-td-price">{fmt(item.average_cost)}</td>
                  <td className="adm-td-price" style={{ color: "#22c55e" }}>
                    {fmt(item.current_stock * item.average_cost)}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--adm-text-2)" }}>
                    {item.min_stock_alert > 0 ? `< ${item.min_stock_alert} ${item.unit}` : "—"}
                  </td>
                  <td className="adm-td-center" style={{ fontSize: 12, color: "var(--adm-text-2)" }}>
                    {item.combo_count > 0 ? `${item.combo_count} combo` : "—"}
                  </td>
                  <td>
                    <div className="adm-actions">
                      <button className="adm-action-btn adm-edit"
                        onClick={() => setModal({ mode: "edit", item })}>
                        ✏️ Sửa
                      </button>
                      <button className="adm-action-btn"
                        style={{ background: "rgba(168,85,247,0.1)", color: "#a855f7" }}
                        onClick={() => setModal({ mode: "adjust", item })}>
                        📦 Điều chỉnh
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── MODALS ── */}
      {(modal?.mode === "create" || modal?.mode === "edit") && (
        <ItemModal item={modal.item} token={token}
          onClose={() => setModal(null)} onSaved={() => handleSaved()} />
      )}
      {modal?.mode === "adjust" && (
        <AdjustModal item={modal.item} token={token}
          onClose={() => setModal(null)} onSaved={(msg) => handleSaved(msg)} />
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div className={`adm-toast adm-toast-${toast.type}`}>{toast.message}</div>
      )}
    </div>
  );
};

export default AdminInventory;