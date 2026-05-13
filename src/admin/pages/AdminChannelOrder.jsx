import React, { useState, useEffect } from "react";
import "../../styles/admin/admin.css";

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const fmt = (n) => (n || 0).toLocaleString("vi-VN") + "đ";

const CHANNELS = [
  { id: "shopee",  label: "Shopee",      icon: "🛒", color: "#ee4d2d" },
  { id: "tiktok",  label: "TikTok Shop", icon: "🎵", color: "#000000" },
  { id: "store",   label: "Tại cửa hàng", icon: "🏪", color: "#22c55e" },
];

const AdminChannelOrder = ({ onCreated }) => {
  const [products, setProducts] = useState([]);
  const [channel, setChannel] = useState("shopee");
  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    externalOrderId: "",
    note: "",
  });
  const [items, setItems] = useState([
    { product_id: "", variant_id: "", variant_name: "", price: "", qty: "1" },
  ]);
  const [shipFee, setShipFee] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [saving, setSaving] = useState(false);

  const token = localStorage.getItem("mc_admin_token");

  useEffect(() => {
    fetch(`${API_BASE}/products`).then((r) => r.json()).then(setProducts);
  }, []);

  const updateItem = (idx, field, value) => {
    const next = [...items];
    next[idx] = { ...next[idx], [field]: value };

    if (field === "product_id") {
      const prod = products.find((p) => p.id === parseInt(value));
      if (prod && prod.variants.length === 1) {
        next[idx].variant_id = String(prod.variants[0].id);
        next[idx].variant_name = prod.variants[0].name;
        next[idx].price = String(prod.variants[0].price);
      } else {
        next[idx].variant_id = "";
        next[idx].variant_name = "";
        next[idx].price = "";
      }
    }

    if (field === "variant_id") {
      const prod = products.find((p) => p.id === parseInt(next[idx].product_id));
      const variant = prod?.variants.find((v) => v.id === parseInt(value));
      if (variant) {
        next[idx].variant_name = variant.name;
        next[idx].price = String(variant.price);
      }
    }

    setItems(next);
  };

  const addItem = () => setItems([...items, { product_id: "", variant_id: "", variant_name: "", price: "", qty: "1" }]);
  const removeItem = (idx) => items.length > 1 && setItems(items.filter((_, i) => i !== idx));

  const subtotal = items.reduce((sum, i) => sum + (parseInt(i.price) || 0) * (parseInt(i.qty) || 0), 0);
  const total = subtotal + (parseInt(shipFee) || 0) - (parseInt(discount) || 0);

  const handleSubmit = async () => {
    if (!form.customerName.trim()) return alert("Nhập tên khách hàng");
    for (const item of items) {
      if (!item.product_id) return alert("Chưa chọn sản phẩm");
      if (!item.price || parseInt(item.price) <= 0) return alert("Giá bán phải > 0");
      if (!item.qty || parseInt(item.qty) <= 0) return alert("Số lượng phải > 0");
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          customer: {
            name: form.customerName,
            phone: form.customerPhone || "",
            address: form.customerAddress || "",
          },
          items: items.map((i) => ({
            product_id: parseInt(i.product_id),
            variant_name: i.variant_name,
            price: parseInt(i.price),
            qty: parseInt(i.qty),
          })),
          ship_fee: parseInt(shipFee) || 0,
          discount: parseInt(discount) || 0,
          note: [
            form.externalOrderId ? `Mã đơn ${channel}: ${form.externalOrderId}` : "",
            form.note,
          ].filter(Boolean).join(" | "),
          channel,
          payment_method: "cod",
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Ghi nhận đơn ${channel.toUpperCase()} thành công! Mã: ${data.invoice_no}`);
        if (onCreated) onCreated();
        /* Reset form */
        setForm({ customerName: "", customerPhone: "", customerAddress: "", externalOrderId: "", note: "" });
        setItems([{ product_id: "", variant_id: "", variant_name: "", price: "", qty: "1" }]);
        setShipFee("0");
        setDiscount("0");
      } else {
        alert(data.error || "Tạo đơn thất bại");
      }
    } catch { alert("Lỗi kết nối"); }
    finally { setSaving(false); }
  };

  const selectedChannel = CHANNELS.find((c) => c.id === channel);

  return (
    <div style={{ background: "var(--adm-surface)", borderRadius: 12, padding: 24, border: "1px solid var(--adm-border)" }}>
      <h3 style={{ margin: "0 0 20px", fontSize: 16 }}>📝 Ghi nhận đơn hàng ngoài</h3>

      {/* Channel selector */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        {CHANNELS.map((ch) => (
          <button key={ch.id}
            onClick={() => setChannel(ch.id)}
            style={{
              flex: 1,
              padding: "12px 16px",
              border: channel === ch.id ? `2px solid ${ch.color}` : "2px solid var(--adm-border)",
              borderRadius: 10,
              background: channel === ch.id ? `${ch.color}15` : "transparent",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: 600,
              color: channel === ch.id ? ch.color : "var(--adm-text-2)",
              transition: "all 0.15s",
            }}>
            {ch.icon} {ch.label}
          </button>
        ))}
      </div>

      {/* Customer info */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
        <div>
          <label className="adm-label">Tên khách hàng *</label>
          <input className="adm-input" placeholder="Nguyễn Văn A" value={form.customerName}
            onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
        </div>
        <div>
          <label className="adm-label">SĐT</label>
          <input className="adm-input" placeholder="0912345678" value={form.customerPhone}
            onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} />
        </div>
        <div>
          <label className="adm-label">Mã đơn {selectedChannel?.label}</label>
          <input className="adm-input" placeholder={`VD: ${channel === "shopee" ? "SP240503ABC" : "TT240503XYZ"}`}
            value={form.externalOrderId}
            onChange={(e) => setForm({ ...form, externalOrderId: e.target.value })} />
        </div>
        <div>
          <label className="adm-label">Địa chỉ</label>
          <input className="adm-input" placeholder="Địa chỉ giao hàng" value={form.customerAddress}
            onChange={(e) => setForm({ ...form, customerAddress: e.target.value })} />
        </div>
      </div>

      {/* Items */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <label className="adm-label" style={{ margin: 0 }}>Sản phẩm</label>
          <button className="adm-add-variant" onClick={addItem}>+ Thêm dòng</button>
        </div>

        {items.map((item, idx) => {
          const prod = products.find((p) => p.id === parseInt(item.product_id));
          const variants = prod?.variants || [];

          return (
            <div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 0.8fr auto", gap: 10, marginBottom: 10, alignItems: "end" }}>
              <div>
                {idx === 0 && <label className="adm-label" style={{ fontSize: 11 }}>Sản phẩm</label>}
                <select className="adm-input adm-select" value={item.product_id}
                  onChange={(e) => updateItem(idx, "product_id", e.target.value)}>
                  <option value="">-- Chọn SP --</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                {idx === 0 && <label className="adm-label" style={{ fontSize: 11 }}>Phân loại</label>}
                <select className="adm-input adm-select" value={item.variant_id}
                  onChange={(e) => updateItem(idx, "variant_id", e.target.value)} disabled={variants.length === 0}>
                  <option value="">-- Chọn --</option>
                  {variants.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div>
                {idx === 0 && <label className="adm-label" style={{ fontSize: 11 }}>Giá bán</label>}
                <input className="adm-input" type="number" min="0" value={item.price}
                  onChange={(e) => updateItem(idx, "price", e.target.value)} />
              </div>
              <div>
                {idx === 0 && <label className="adm-label" style={{ fontSize: 11 }}>SL</label>}
                <input className="adm-input" type="number" min="1" value={item.qty}
                  onChange={(e) => updateItem(idx, "qty", e.target.value)} />
              </div>
              <div>
                {items.length > 1 && (
                  <button className="adm-remove-variant" onClick={() => removeItem(idx)}>✕</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Ship + Discount + Note */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 14, marginBottom: 16 }}>
        <div>
          <label className="adm-label">Phí ship</label>
          <input className="adm-input" type="number" min="0" value={shipFee}
            onChange={(e) => setShipFee(e.target.value)} />
        </div>
        <div>
          <label className="adm-label">Giảm giá</label>
          <input className="adm-input" type="number" min="0" value={discount}
            onChange={(e) => setDiscount(e.target.value)} />
        </div>
        <div>
          <label className="adm-label">Ghi chú</label>
          <input className="adm-input" placeholder="Ghi chú thêm..." value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </div>
      </div>

      {/* Tổng + Submit */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 16, borderTop: "1px solid var(--adm-border)" }}>
        <div>
          <div style={{ fontSize: 13, color: "var(--adm-text-2)" }}>Tạm tính: {fmt(subtotal)}</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            Tổng: <span style={{ color: selectedChannel?.color || "#22c55e" }}>{fmt(total)}</span>
          </div>
        </div>
        <button className="adm-btn-primary" onClick={handleSubmit} disabled={saving}
          style={{ background: selectedChannel?.color || "var(--adm-primary)" }}>
          {saving ? "Đang tạo..." : `${selectedChannel?.icon} Ghi nhận đơn ${selectedChannel?.label}`}
        </button>
      </div>
    </div>
  );
};

export default AdminChannelOrder;