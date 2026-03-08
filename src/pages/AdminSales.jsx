import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "../pages/components/AdminSidebar";
import { adminAPI } from "../hooks/useProducts";
import "../styles/admin.css";
import "../styles/admin-sales.css";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

const fmt = (n) => (n || 0).toLocaleString("vi-VN") + "đ";

const emptyCustomer = () => ({ name: "", phone: "", address: "" });

// ── LineItem row ──────────────────────────────────────────────────────────────
const LineItem = ({ products, item, onChange, onRemove }) => {
  const product  = products.find((p) => p.id === item.productId) || null;
  const variants = product?.variants || [];

  return (
    <div className="sl-line">
      {/* Product select */}
      <div className="sl-line-product">
        <select
          className="sl-select"
          value={item.productId || ""}
          onChange={(e) => {
            const pid = parseInt(e.target.value);
            const p   = products.find((x) => x.id === pid);
            onChange({
              ...item,
              productId:   pid,
              productName: p?.name || "",
              variantName: p?.variants[0]?.name || "",
              price:       p?.variants[0]?.price || 0,
              qty:         1,
            });
          }}
        >
          <option value="">— Chọn sản phẩm —</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Variant select */}
      <div className="sl-line-variant">
        <select
          className="sl-select"
          value={item.variantName || ""}
          disabled={!product}
          onChange={(e) => {
            const v = variants.find((x) => x.name === e.target.value);
            onChange({ ...item, variantName: v?.name || "", price: v?.price || 0 });
          }}
        >
          {variants.map((v) => (
            <option key={v.name} value={v.name}>{v.name}</option>
          ))}
        </select>
      </div>

      {/* Qty */}
      <div className="sl-line-qty">
        <button className="sl-qty-btn" onClick={() => onChange({ ...item, qty: Math.max(1, item.qty - 1) })}>−</button>
        <input
          className="sl-qty-input"
          type="number" min="1"
          value={item.qty}
          onChange={(e) => onChange({ ...item, qty: Math.max(1, parseInt(e.target.value) || 1) })}
        />
        <button className="sl-qty-btn" onClick={() => onChange({ ...item, qty: item.qty + 1 })}>+</button>
      </div>

      {/* Unit price (editable) */}
      <div className="sl-line-price">
        <input
          className="sl-price-input"
          type="number" min="0" step="1000"
          value={item.price}
          onChange={(e) => onChange({ ...item, price: parseInt(e.target.value) || 0 })}
        />
        <span className="sl-price-unit">đ</span>
      </div>

      {/* Subtotal */}
      <div className="sl-line-sub">{fmt(item.price * item.qty)}</div>

      {/* Remove */}
      <button className="sl-line-remove" onClick={onRemove}>✕</button>
    </div>
  );
};

// ── Main AdminSales ───────────────────────────────────────────────────────────
const AdminSales = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false); // loading state khi POST
  const [error,    setError]    = useState("");     // hiện lỗi nếu POST thất bại

  const [customer, setCustomer] = useState(emptyCustomer());
  const [lines,    setLines]    = useState([]);
  const [shipFee,  setShipFee]  = useState(0);
  const [note,     setNote]     = useState("");
  const [discount, setDiscount] = useState(0);

  // Auth guard
  useEffect(() => {
    const token = localStorage.getItem("mc_admin_token");
    if (!token) { navigate("/admin/login"); return; }
    adminAPI.verifyToken().then((r) => {
      if (!r.valid) { localStorage.removeItem("mc_admin_token"); navigate("/admin/login"); }
    });
  }, [navigate]);

  // Load products
  useEffect(() => {
    fetch(`${API_BASE}/products`)
      .then((r) => r.json())
      .then((d) => { setProducts(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const addLine = () => {
    const first = products[0];
    setLines((prev) => [...prev, {
      id:          Date.now(),
      productId:   first?.id || null,
      productName: first?.name || "",
      variantName: first?.variants[0]?.name || "",
      price:       first?.variants[0]?.price || 0,
      qty:         1,
    }]);
  };

  const updateLine = (id, data) =>
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...data } : l)));

  const removeLine = (id) =>
    setLines((prev) => prev.filter((l) => l.id !== id));

  const subtotal   = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const total      = subtotal + shipFee - discount;
  const canInvoice = customer.name.trim() && lines.length > 0 && lines.every((l) => l.productId);

  // ── Lưu đơn vào DB, sau đó mở trang in ──────────────────────────────────
  const handlePrint = async () => {
    if (!canInvoice) return;

    setError("");
    setSaving(true);

    try {
      // Chuẩn bị payload đúng format order.js
      const payload = {
        customer: {
          name:    customer.name.trim(),
          phone:   customer.phone.trim(),
          address: customer.address.trim(),
        },
        items: lines.map((l) => ({
          product_id:   l.productId,
          product_name: l.productName,
          variant_name: l.variantName,
          price:        l.price,
          qty:          l.qty,
        })),
        ship_fee: shipFee,
        discount: discount,
        note:     note.trim(),
      };

      const res = await fetch(`${API_BASE}/orders`, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("mc_admin_token")}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const result = await res.json(); // { success, invoice_no, order_id }

      // Lưu dữ liệu in vào localStorage (invoice_no lấy từ server)
      const invoiceData = {
        invoiceNo:  result.invoice_no,
        orderId:    result.order_id,
        createdAt:  new Date().toLocaleString("vi-VN"),
        customer,
        lines: lines.map((l) => ({
          productName: l.productName,
          variantName: l.variantName,
          qty:         l.qty,
          price:       l.price,
          subtotal:    l.price * l.qty,
        })),
        subtotal,
        shipFee,
        discount,
        total,
        note,
      };

      localStorage.setItem("mc_invoice_data", JSON.stringify(invoiceData));
      window.open("/admin/invoice", "_blank");

    } catch (err) {
      setError(`Lưu đơn thất bại: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const setCust = (field, val) => setCustomer((c) => ({ ...c, [field]: val }));

  return (
    <div className="adm-layout">
      <AdminSidebar />

      <main className="adm-main">
        <div className="adm-topbar">
          <div>
            <h1 className="adm-page-title">🧾 Tạo đơn hàng</h1>
            <p className="adm-page-sub">Nhập thông tin và tạo hóa đơn in được</p>
          </div>
          <button
            className="adm-btn-primary"
            disabled={!canInvoice || saving}
            onClick={handlePrint}
          >
            {saving ? "⏳ Đang lưu..." : "🖨️ Xem & In hóa đơn"}
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="sl-error-banner">
            ⚠️ {error}
            <button onClick={() => setError("")}>✕</button>
          </div>
        )}

        <div className="sl-layout">
          {/* LEFT — Line items */}
          <div className="sl-left">
            <div className="sl-card">
              <div className="sl-card-header">
                <span>🛒 Sản phẩm đặt mua</span>
                <button className="adm-btn-primary sl-add-btn" onClick={addLine} disabled={loading}>
                  + Thêm dòng
                </button>
              </div>

              {lines.length === 0 ? (
                <div className="sl-empty">
                  <div className="sl-empty-icon">📦</div>
                  <p>Chưa có sản phẩm nào</p>
                  <button className="adm-btn-ghost" onClick={addLine}>+ Thêm sản phẩm</button>
                </div>
              ) : (
                <>
                  <div className="sl-line sl-line-header">
                    <div className="sl-line-product">Sản phẩm</div>
                    <div className="sl-line-variant">Phân loại</div>
                    <div className="sl-line-qty">SL</div>
                    <div className="sl-line-price">Đơn giá</div>
                    <div className="sl-line-sub">Thành tiền</div>
                    <div style={{ width: 28 }} />
                  </div>
                  {lines.map((l) => (
                    <LineItem
                      key={l.id}
                      products={products}
                      item={l}
                      onChange={(data) => updateLine(l.id, data)}
                      onRemove={() => removeLine(l.id)}
                    />
                  ))}
                </>
              )}
            </div>

            {/* Note */}
            <div className="sl-card sl-card-note">
              <label className="adm-label">📝 Ghi chú đơn hàng</label>
              <textarea
                className="sl-textarea"
                placeholder="Ghi chú thêm (tặng kèm, yêu cầu đặc biệt...)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          {/* RIGHT — Customer + Summary */}
          <div className="sl-right">
            {/* Customer */}
            <div className="sl-card">
              <div className="sl-card-header"><span>👤 Khách hàng</span></div>
              <div className="sl-fields">
                <div className="adm-field">
                  <label className="adm-label">Tên khách hàng *</label>
                  <input className="adm-input" placeholder="Nguyễn Văn A"
                    value={customer.name} onChange={(e) => setCust("name", e.target.value)} />
                </div>
                <div className="adm-field">
                  <label className="adm-label">Số điện thoại</label>
                  <input className="adm-input" placeholder="0901234567" type="tel"
                    value={customer.phone} onChange={(e) => setCust("phone", e.target.value)} />
                </div>
                <div className="adm-field">
                  <label className="adm-label">Địa chỉ giao</label>
                  <textarea className="sl-textarea" placeholder="Số nhà, đường, phường, quận, tỉnh..."
                    value={customer.address} onChange={(e) => setCust("address", e.target.value)} rows={2} />
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="sl-card sl-summary">
              <div className="sl-card-header"><span>💰 Tổng kết</span></div>
              <div className="sl-sum-rows">
                <div className="sl-sum-row">
                  <span>Tiền hàng</span>
                  <span>{fmt(subtotal)}</span>
                </div>

                <div className="sl-sum-row">
                  <span>Phí ship</span>
                  <div className="sl-sum-input-wrap">
                    <input
                      className="sl-sum-input"
                      type="number" min="0" step="1000"
                      value={shipFee}
                      onChange={(e) => setShipFee(parseInt(e.target.value) || 0)}
                    />
                    <span>đ</span>
                  </div>
                </div>

                <div className="sl-sum-row">
                  <span>Giảm giá</span>
                  <div className="sl-sum-input-wrap">
                    <input
                      className="sl-sum-input"
                      type="number" min="0" step="1000"
                      value={discount}
                      onChange={(e) => setDiscount(parseInt(e.target.value) || 0)}
                    />
                    <span>đ</span>
                  </div>
                </div>

                <div className="sl-sum-divider" />

                <div className="sl-sum-row sl-sum-total">
                  <span>TỔNG CỘNG</span>
                  <span className="sl-total-amt">{fmt(total)}</span>
                </div>
              </div>

              <button
                className="sl-print-btn"
                disabled={!canInvoice || saving}
                onClick={handlePrint}
              >
                {saving ? "⏳ Đang lưu..." : "🖨️ Xem & In hóa đơn"}
              </button>
              {!canInvoice && !saving && (
                <p className="sl-hint">Điền tên khách và thêm ít nhất 1 sản phẩm</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminSales;