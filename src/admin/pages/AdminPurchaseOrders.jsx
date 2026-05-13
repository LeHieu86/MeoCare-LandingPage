import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { adminAPI } from "../../hooks/useProducts";
import "../../styles/admin/admin.css";

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const fmt = (n) => (n || 0).toLocaleString("vi-VN") + "đ";

const STATUS_CONFIG = {
  draft:     { label: "Nháp",    icon: "📝", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  confirmed: { label: "Đã nhập", icon: "✅", color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
  cancelled: { label: "Đã hủy", icon: "❌", color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
};

const TABS = [
  { id: "list",      label: "Phiếu nhập",     icon: "📋" },
  { id: "create",    label: "Tạo phiếu mới",  icon: "➕" },
  { id: "suppliers", label: "Nhà cung cấp",   icon: "🏭" },
];

/* ══════════════════════════════════════════════════════
   SUPPLIER MANAGER
   ══════════════════════════════════════════════════════ */
const SupplierManager = ({ token }) => {
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState({ name: "", phone: "", address: "", note: "" });
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchSuppliers = useCallback(async () => {
    const res = await fetch(`${API_BASE}/suppliers`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.success) setSuppliers(data.suppliers);
  }, [token]);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  const resetForm = () => { setForm({ name: "", phone: "", address: "", note: "" }); setEditingId(null); };

  const handleSave = async () => {
    if (!form.name.trim()) return alert("Tên NCC không được trống");
    setSaving(true);
    try {
      const url    = editingId ? `${API_BASE}/suppliers/${editingId}` : `${API_BASE}/suppliers`;
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) { resetForm(); fetchSuppliers(); }
      else alert(data.message);
    } catch { alert("Lỗi kết nối"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Xóa nhà cung cấp này?")) return;
    const res = await fetch(`${API_BASE}/suppliers/${id}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) fetchSuppliers();
    else alert(data.message);
  };

  return (
    <div>
      <div style={{ background: "var(--adm-surface)", borderRadius: 12, padding: 20, border: "1px solid var(--adm-border)", marginBottom: 20 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15 }}>{editingId ? "✏️ Sửa NCC" : "➕ Thêm NCC mới"}</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <input className="adm-input" placeholder="Tên NCC *" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="adm-input" placeholder="Số điện thoại" value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className="adm-input" placeholder="Địa chỉ" value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <input className="adm-input" placeholder="Ghi chú" value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "flex-end" }}>
          {editingId && <button className="adm-btn-ghost" onClick={resetForm}>Hủy</button>}
          <button className="adm-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Đang lưu..." : editingId ? "Cập nhật" : "Thêm NCC"}
          </button>
        </div>
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr><th>Tên NCC</th><th>SĐT</th><th>Địa chỉ</th><th>Số phiếu</th><th>Thao tác</th></tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id}>
                <td><strong>{s.name}</strong></td>
                <td>{s.phone || "—"}</td>
                <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{s.address || "—"}</td>
                <td className="adm-td-center">{s.totalOrders}</td>
                <td>
                  <div className="adm-actions">
                    <button className="adm-action-btn adm-edit"
                      onClick={() => { setEditingId(s.id); setForm({ name: s.name, phone: s.phone || "", address: s.address || "", note: s.note || "" }); }}>
                      ✏️ Sửa
                    </button>
                    <button className="adm-action-btn adm-delete" onClick={() => handleDelete(s.id)}>
                      🗑️ Xóa
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════
   CREATE PO FORM — dùng InventoryItem, không phải Variant
   ══════════════════════════════════════════════════════ */
const BLANK_ITEM = { mode: "manual", inventory_item_id: "", name: "", sku: "", unit: "hộp", unit_cost: "", qty: "1" };

const CreatePoForm = ({ token, onCreated }) => {
  const [suppliers, setSuppliers]   = useState([]);
  const [inventory, setInventory]   = useState([]);
  const [supplierId, setSupplierId] = useState("");
  const [note, setNote]             = useState("");
  const [items, setItems]           = useState([{ ...BLANK_ITEM }]);
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/suppliers`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((d) => d.success && setSuppliers(d.suppliers));
    fetch(`${API_BASE}/inventory`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((d) => d.success && setInventory(d.items));
  }, [token]);

  const updateItem = (idx, field, value) => {
    const next = [...items];
    next[idx] = { ...next[idx], [field]: value };
    if (field === "inventory_item_id" && value) {
      const inv = inventory.find((i) => i.id === parseInt(value));
      if (inv) {
        next[idx].unit = inv.unit;
        if (inv.average_cost > 0) next[idx].unit_cost = String(inv.average_cost);
      }
    }
    setItems(next);
  };

  const switchMode = (idx, mode) => {
    const next = [...items];
    next[idx] = { ...BLANK_ITEM, mode, unit_cost: next[idx].unit_cost, qty: next[idx].qty };
    setItems(next);
  };

  const addItem    = () => setItems([...items, { ...BLANK_ITEM }]);
  const removeItem = (idx) => items.length > 1 && setItems(items.filter((_, i) => i !== idx));

  const totalCost = items.reduce((sum, i) => sum + (parseInt(i.unit_cost) || 0) * (parseInt(i.qty) || 0), 0);

  const getInvItem = (id) => inventory.find((i) => i.id === parseInt(id));

  const handleSubmit = async () => {
    if (!supplierId) return alert("Chưa chọn nhà cung cấp");
    for (const item of items) {
      if (item.mode === "manual" && !item.name.trim()) return alert("Tên hàng hóa không được trống");
      if (item.mode === "existing" && !item.inventory_item_id) return alert("Chưa chọn hàng hóa từ kho");
      if (!item.unit_cost || parseInt(item.unit_cost) <= 0) return alert("Giá nhập phải > 0");
      if (!item.qty || parseInt(item.qty) <= 0) return alert("Số lượng phải > 0");
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/purchase-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          supplier_id: parseInt(supplierId),
          note,
          items: items.map((i) =>
            i.mode === "existing"
              ? { inventory_item_id: parseInt(i.inventory_item_id), unit_cost: parseInt(i.unit_cost), qty: parseInt(i.qty) }
              : { name: i.name.trim(), sku: i.sku.trim() || undefined, unit: i.unit.trim() || "hộp", unit_cost: parseInt(i.unit_cost), qty: parseInt(i.qty) }
          ),
        }),
      });
      const data = await res.json();
      if (data.success) { alert(`Tạo phiếu ${data.po_number} thành công!`); onCreated(); }
      else alert(data.message);
    } catch { alert("Lỗi kết nối"); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ background: "var(--adm-surface)", borderRadius: 12, padding: 24, border: "1px solid var(--adm-border)" }}>
      <h3 style={{ margin: "0 0 20px", fontSize: 16 }}>📝 Tạo phiếu nhập hàng</h3>

      {/* NCC + Ghi chú */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
        <div>
          <label className="adm-label">Nhà cung cấp *</label>
          <select className="adm-input adm-select" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">-- Chọn NCC --</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}{s.phone ? ` (${s.phone})` : ""}</option>)}
          </select>
        </div>
        <div>
          <label className="adm-label">Ghi chú</label>
          <input className="adm-input" placeholder="Ghi chú phiếu nhập..." value={note}
            onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>

      {/* Items */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <label className="adm-label" style={{ margin: 0 }}>Hàng hóa nhập</label>
          <button className="adm-add-variant" onClick={addItem}>+ Thêm dòng</button>
        </div>

        {items.map((item, idx) => {
          const inv = item.mode === "existing" ? getInvItem(item.inventory_item_id) : null;
          return (
            <div key={idx} style={{ background: "var(--adm-surface-2)", borderRadius: 10,
              padding: "12px 14px", marginBottom: 10, border: "1px solid var(--adm-border)" }}>

              {/* Mode toggle */}
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button onClick={() => switchMode(idx, "manual")}
                  style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, border: "1px solid",
                    cursor: "pointer",
                    background: item.mode === "manual" ? "#f59e0b" : "transparent",
                    color: item.mode === "manual" ? "#000" : "var(--adm-text-2)",
                    borderColor: item.mode === "manual" ? "#f59e0b" : "var(--adm-border)" }}>
                  ✏️ Nhập thủ công
                </button>
                <button onClick={() => switchMode(idx, "existing")}
                  style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, border: "1px solid",
                    cursor: "pointer",
                    background: item.mode === "existing" ? "#6366f1" : "transparent",
                    color: item.mode === "existing" ? "#fff" : "var(--adm-text-2)",
                    borderColor: item.mode === "existing" ? "#6366f1" : "var(--adm-border)" }}>
                  📦 Chọn từ kho
                </button>
                {items.length > 1 && (
                  <button className="adm-remove-variant" style={{ marginLeft: "auto" }}
                    onClick={() => removeItem(idx)}>✕ Xóa dòng</button>
                )}
              </div>

              {/* Fields */}
              {item.mode === "manual" ? (
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 0.8fr 1fr 0.8fr", gap: 10 }}>
                  <div>
                    <div className="adm-label" style={{ fontSize: 11 }}>Tên hàng hóa *</div>
                    <input className="adm-input" placeholder="VD: Thức ăn hạt Royal Canin..."
                      value={item.name} onChange={(e) => updateItem(idx, "name", e.target.value)} />
                  </div>
                  <div>
                    <div className="adm-label" style={{ fontSize: 11 }}>SKU (để trống tự sinh)</div>
                    <input className="adm-input" placeholder="VD: RC-001"
                      value={item.sku} onChange={(e) => updateItem(idx, "sku", e.target.value)} />
                  </div>
                  <div>
                    <div className="adm-label" style={{ fontSize: 11 }}>Đơn vị</div>
                    <input className="adm-input" placeholder="hộp / gói / kg..."
                      value={item.unit} onChange={(e) => updateItem(idx, "unit", e.target.value)} />
                  </div>
                  <div>
                    <div className="adm-label" style={{ fontSize: 11 }}>Giá nhập (đ) *</div>
                    <input className="adm-input" type="number" min="0" placeholder="VNĐ"
                      value={item.unit_cost} onChange={(e) => updateItem(idx, "unit_cost", e.target.value)} />
                  </div>
                  <div>
                    <div className="adm-label" style={{ fontSize: 11 }}>Số lượng *</div>
                    <input className="adm-input" type="number" min="1"
                      value={item.qty} onChange={(e) => updateItem(idx, "qty", e.target.value)} />
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "2.5fr 0.8fr 1fr 0.8fr", gap: 10 }}>
                  <div>
                    <div className="adm-label" style={{ fontSize: 11 }}>Hàng hóa trong kho</div>
                    <select className="adm-input adm-select" value={item.inventory_item_id}
                      onChange={(e) => updateItem(idx, "inventory_item_id", e.target.value)}>
                      <option value="">-- Chọn hàng hóa --</option>
                      {inventory.map((i) => (
                        <option key={i.id} value={i.id}>[{i.sku}] {i.name}</option>
                      ))}
                    </select>
                    {inv && (
                      <div style={{ fontSize: 11, color: "var(--adm-text-2)", marginTop: 4 }}>
                        Tồn kho: {inv.current_stock} {inv.unit} · Giá vốn BQ: {fmt(inv.average_cost)}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="adm-label" style={{ fontSize: 11 }}>ĐVT</div>
                    <div className="adm-input" style={{ background: "var(--adm-surface)", color: "var(--adm-text-2)",
                      display: "flex", alignItems: "center", height: 38 }}>
                      {inv?.unit || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="adm-label" style={{ fontSize: 11 }}>Giá nhập (đ) *</div>
                    <input className="adm-input" type="number" min="0" placeholder="VNĐ"
                      value={item.unit_cost} onChange={(e) => updateItem(idx, "unit_cost", e.target.value)} />
                    {inv && item.unit_cost && parseInt(item.unit_cost) !== inv.average_cost && (
                      <div style={{ fontSize: 11, marginTop: 4,
                        color: parseInt(item.unit_cost) > inv.average_cost ? "#ef4444" : "#22c55e" }}>
                        {parseInt(item.unit_cost) > inv.average_cost ? "▲" : "▼"} so với BQ {fmt(inv.average_cost)}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="adm-label" style={{ fontSize: 11 }}>Số lượng *</div>
                    <input className="adm-input" type="number" min="1"
                      value={item.qty} onChange={(e) => updateItem(idx, "qty", e.target.value)} />
                  </div>
                </div>
              )}

              {/* Thành tiền dòng */}
              {item.unit_cost && item.qty && (
                <div style={{ textAlign: "right", marginTop: 8, fontSize: 13, color: "#f59e0b", fontWeight: 600 }}>
                  {item.mode === "manual" ? item.name || "Hàng hóa" : inv?.name || "—"}
                  {" "}× {item.qty} = {fmt((parseInt(item.unit_cost) || 0) * (parseInt(item.qty) || 0))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Total + Submit */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
        paddingTop: 16, borderTop: "2px solid var(--adm-border)" }}>
        <div>
          <div style={{ fontSize: 13, color: "var(--adm-text-2)" }}>Tổng giá trị phiếu nhập</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#f59e0b" }}>{fmt(totalCost)}</div>
        </div>
        <button className="adm-btn-primary" onClick={handleSubmit} disabled={saving}>
          {saving ? "Đang tạo..." : "📝 Tạo phiếu nhập"}
        </button>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════
   PO DETAIL MODAL
   ══════════════════════════════════════════════════════ */
const PoDetailModal = ({ token, poId, onClose }) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/purchase-orders/${poId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { if (d.success) setDetail(d.order); })
      .finally(() => setLoading(false));
  }, [token, poId]);

  const cfg = detail ? (STATUS_CONFIG[detail.status] || STATUS_CONFIG.draft) : null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={onClose}>
      <div style={{ background: "var(--adm-surface)", borderRadius: 16, padding: 28, width: "100%",
        maxWidth: 680, maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}
        onClick={(e) => e.stopPropagation()}>

        {loading ? (
          <div className="adm-loading"><span className="adm-spinner adm-spinner-lg" /></div>
        ) : !detail ? (
          <p>Không tìm thấy phiếu</p>
        ) : (
          <>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#f59e0b", fontFamily: "monospace" }}>
                  {detail.po_number}
                </div>
                <div style={{ fontSize: 13, color: "var(--adm-text-2)", marginTop: 4 }}>
                  NCC: <strong>{detail.supplier?.name}</strong>
                  {detail.supplier?.phone && ` · ${detail.supplier.phone}`}
                </div>
                {detail.note && (
                  <div style={{ fontSize: 13, color: "var(--adm-text-2)", marginTop: 2 }}>Ghi chú: {detail.note}</div>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="adm-badge" style={{ background: cfg.bg, color: cfg.color, border: "none" }}>
                  {cfg.icon} {cfg.label}
                </span>
                <button className="adm-btn-ghost" style={{ padding: "6px 12px" }} onClick={onClose}>✕ Đóng</button>
              </div>
            </div>

            {/* Items table */}
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr><th>SKU</th><th>Tên hàng hóa</th><th>ĐVT</th><th>Giá nhập</th><th>SL</th><th>Thành tiền</th></tr>
                </thead>
                <tbody>
                  {detail.items.map((item) => (
                    <tr key={item.id}>
                      <td><code style={{ fontSize: 12 }}>{item.inventoryItem.sku}</code></td>
                      <td><strong>{item.inventoryItem.name}</strong></td>
                      <td className="adm-td-center">{item.inventoryItem.unit}</td>
                      <td className="adm-td-price">{fmt(item.unit_cost)}</td>
                      <td className="adm-td-center">{item.qty}</td>
                      <td className="adm-td-price" style={{ color: "#f59e0b", fontWeight: 700 }}>{fmt(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16, paddingTop: 12,
              borderTop: "2px solid var(--adm-border)" }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, color: "var(--adm-text-2)" }}>Tổng giá trị</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#f59e0b" }}>{fmt(detail.total_cost)}</div>
              </div>
            </div>

            {/* Dates */}
            <div style={{ display: "flex", gap: 24, marginTop: 12, fontSize: 12, color: "var(--adm-text-2)" }}>
              <span>Tạo lúc: {new Date(detail.created_at).toLocaleString("vi-VN")}</span>
              {detail.confirmed_at && (
                <span>Nhập kho: {new Date(detail.confirmed_at).toLocaleString("vi-VN")}</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════
   PO LIST
   ══════════════════════════════════════════════════════ */
const PoList = ({ token, onRefresh }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [profitStats, setProfitStats] = useState(null);
  const [detailPoId, setDetailPoId] = useState(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const [poRes, profitRes] = await Promise.all([
        fetch(`${API_BASE}/purchase-orders`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/purchase-orders/stats/profit`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [poData, profitData] = await Promise.all([poRes.json(), profitRes.json()]);
      if (poData.success) setOrders(poData.orders);
      if (profitData.success) setProfitStats(profitData.stats);
    } catch (err) { console.error("Lỗi tải phiếu nhập:", err); } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchOrders(); }, [fetchOrders, onRefresh]);

  const handleAction = async (id, action) => {
    const labels = { confirm: "xác nhận nhập kho", cancel: "hủy phiếu" };
    if (!window.confirm(`Bạn muốn ${labels[action]} phiếu này?`)) return;
    const res = await fetch(`${API_BASE}/purchase-orders/${id}/${action}`, {
      method: "PUT", headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) { alert(data.message); fetchOrders(); }
    else alert(data.message);
  };

  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  return (
    <div>
      {/* Profit stats */}
      {profitStats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Doanh thu (đã giao)", value: fmt(profitStats.revenue), color: "#3b82f6" },
            { label: "COGS thực tế",        value: fmt(profitStats.cogs),    color: "#f59e0b" },
            { label: "Lợi nhuận",           value: fmt(profitStats.profit),  color: profitStats.profit >= 0 ? "#22c55e" : "#ef4444" },
            { label: "Biên lợi nhuận",      value: `${profitStats.margin}%`, color: profitStats.margin >= 30 ? "#22c55e" : "#f59e0b" },
          ].map((s) => (
            <div key={s.label} style={{ background: "var(--adm-surface)", borderRadius: 12,
              border: "1px solid var(--adm-border)", padding: "14px 18px" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "var(--adm-text-2)", marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter */}
      <div className="adm-cat-tabs" style={{ marginBottom: 16 }}>
        {[
          { id: "all", label: "Tất cả" },
          { id: "draft", label: "📝 Nháp" },
          { id: "confirmed", label: "✅ Đã nhập" },
          { id: "cancelled", label: "❌ Đã hủy" },
        ].map((tab) => (
          <button key={tab.id} className={`adm-cat-tab ${filter === tab.id ? "active" : ""}`}
            onClick={() => setFilter(tab.id)}>{tab.label}</button>
        ))}
      </div>

      {loading ? (
        <div className="adm-loading"><span className="adm-spinner adm-spinner-lg" /></div>
      ) : filtered.length === 0 ? (
        <div className="adm-empty"><div className="adm-empty-icon">📦</div><p>Không có phiếu nhập nào</p></div>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr><th>Mã phiếu</th><th>NCC</th><th>Mặt hàng</th><th>Tổng giá vốn</th><th>Trạng thái</th><th>Ngày tạo</th><th>Thao tác</th></tr>
            </thead>
            <tbody>
              {filtered.map((po) => {
                const cfg = STATUS_CONFIG[po.status] || STATUS_CONFIG.draft;
                return (
                  <tr key={po.id}>
                    <td>
                      <span style={{ color: "#f59e0b", fontWeight: 600, fontSize: 13, fontFamily: "monospace" }}>
                        {po.po_number}
                      </span>
                    </td>
                    <td>
                      <strong>{po.supplier_name}</strong>
                      {po.supplier_phone && <div style={{ fontSize: 11, color: "var(--adm-text-2)" }}>{po.supplier_phone}</div>}
                    </td>
                    <td className="adm-td-center">{po.item_count} mặt hàng</td>
                    <td className="adm-td-price">{fmt(po.total_cost)}</td>
                    <td>
                      <span className="adm-badge" style={{ background: cfg.bg, color: cfg.color, border: "none" }}>
                        {cfg.icon} {cfg.label}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--adm-text-2)" }}>
                      {new Date(po.created_at).toLocaleString("vi-VN")}
                      {po.confirmed_at && (
                        <div>Nhập: {new Date(po.confirmed_at).toLocaleDateString("vi-VN")}</div>
                      )}
                    </td>
                    <td>
                      <div className="adm-actions">
                        <button className="adm-action-btn"
                          style={{ background: "rgba(99,102,241,0.1)", color: "#6366f1" }}
                          onClick={() => setDetailPoId(po.id)}>
                          🔍 Chi tiết
                        </button>
                        {po.status === "draft" && (
                          <>
                            <button className="adm-action-btn"
                              style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}
                              onClick={() => handleAction(po.id, "confirm")}>
                              ✅ Nhập kho
                            </button>
                            <button className="adm-action-btn adm-delete"
                              onClick={() => handleAction(po.id, "cancel")}>
                              ❌ Hủy
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {detailPoId && (
        <PoDetailModal token={token} poId={detailPoId} onClose={() => setDetailPoId(null)} />
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════ */
const AdminPurchaseOrders = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("list");
  const [refresh, setRefresh] = useState(0);
  const token = localStorage.getItem("mc_admin_token");

  useEffect(() => {
    if (!token) { navigate("/admin/login"); return; }
    adminAPI.verifyToken().then((r) => {
      if (!r.valid) { localStorage.removeItem("mc_admin_token"); navigate("/admin/login"); }
    });
  }, [navigate, token]);

  return (
    <div>
      <div className="adm-topbar">
        <div>
          <h1 className="adm-page-title">📦 Nhập hàng</h1>
          <p className="adm-page-sub">Phiếu nhập · Tồn kho · Lợi nhuận thật</p>
        </div>
      </div>

      <div className="adm-filters">
        <div className="adm-cat-tabs">
          {TABS.map((tab) => (
            <button key={tab.id} className={`adm-cat-tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "list" && <PoList token={token} onRefresh={refresh} />}
      {activeTab === "create" && (
        <CreatePoForm token={token} onCreated={() => { setActiveTab("list"); setRefresh((r) => r + 1); }} />
      )}
      {activeTab === "suppliers" && <SupplierManager token={token} />}
    </div>
  );
};

export default AdminPurchaseOrders;