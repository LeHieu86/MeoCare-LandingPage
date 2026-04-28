import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminAPI } from "../../hooks/useProducts";
import "../../styles/admin/admin.css";
import "../../styles/admin/admin-orders.css";

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const fmt = (n) => (n || 0).toLocaleString("vi-VN") + "đ";

const STATUS_CONFIG = {
  pending:   { label: "Chờ xác nhận", icon: "🕐", color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)" },
  confirmed: { label: "Đã xác nhận", icon: "✅", color: "#3b82f6", bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.3)" },
  shipping:  { label: "Đang giao",   icon: "🚚", color: "#a855f7", bg: "rgba(168,85,247,0.1)", border: "rgba(168,85,247,0.3)" },
  delivered: { label: "Đã giao",     icon: "📦", color: "#22c55e", bg: "rgba(34,197,94,0.1)",  border: "rgba(34,197,94,0.3)" },
};

const TABS = [
  { id: "all",       label: "Tất cả",        icon: "📋" },
  { id: "pending",   label: "Chờ xác nhận",  icon: "🕐" },
  { id: "confirmed", label: "Đã xác nhận",   icon: "✅" },
  { id: "shipping",  label: "Đang giao",     icon: "🚚" },
  { id: "delivered", label: "Đã giao",       icon: "📦" },
];

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        fontSize: 12, fontWeight: 600, color: cfg.color,
        background: cfg.bg, padding: "4px 10px", borderRadius: 20,
        border: `1px solid ${cfg.border}`, whiteSpace: "nowrap",
      }}
    >
      {cfg.icon} {cfg.label}
    </span>
  );
};

/* ── ORDER DETAIL MODAL ───────────────────────────── */
const OrderModal = ({ order, onClose, onStatusChange }) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/orders/${order.id}`)
      .then((r) => r.json())
      .then((d) => { setDetail(d); setLoading(false); })
      .catch(() => setLoading(false));

    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [order.id]);

  const handleUpdateStatus = async (newStatus) => {
    if (updating) return;
    const labels = { confirmed: "xác nhận", shipping: "giao hàng" };
    if (!window.confirm(`Bạn muốn chuyển đơn sang "${labels[newStatus]}"?`)) return;

    setUpdating(true);
    try {
      const res = await fetch(`${API_BASE}/orders/${order.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        // Cập nhật detail local
        setDetail((prev) => prev ? { ...prev, status: newStatus } : prev);
        onStatusChange(order.id, newStatus);
      } else {
        alert(data.message || "Cập nhật thất bại");
      }
    } catch {
      alert("Lỗi kết nối");
    } finally {
      setUpdating(false);
    }
  };

  const reopenInvoice = () => {
    if (!detail) return;
    const invoiceData = {
      invoiceNo: detail.invoice_no,
      createdAt: new Date(detail.created_at).toLocaleString("vi-VN"),
      customer: {
        name: detail.customer_name || "",
        phone: detail.customer_phone || "",
        address: detail.customer_address || "",
      },
      lines: (detail.items || []).map((i) => ({
        productName: i.product_name || `Sản phẩm #${i.product_id}`,
        variantName: i.variant_name,
        qty: i.qty,
        price: i.price,
        subtotal: i.subtotal,
      })),
      subtotal: detail.subtotal,
      shipFee: detail.ship_fee,
      discount: detail.discount,
      total: detail.total,
      note: detail.note || "",
    };
    localStorage.setItem("mc_invoice_data", JSON.stringify(invoiceData));
    window.open("/admin/invoice", "_blank");
  };

  const currentStatus = detail?.status || order.status;

  return (
    <div className="ord-modal-backdrop" onClick={onClose}>
      <div className="ord-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ord-modal-header">
          <div>
            <div className="ord-modal-title">Chi tiết đơn hàng</div>
            <div className="ord-modal-sub">#{order.invoice_no}</div>
          </div>
          <div className="ord-modal-actions">
            <button className="adm-btn-ghost" onClick={reopenInvoice} disabled={!detail}>🖨️ In lại</button>
            <button className="ord-modal-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {loading ? (
          <div className="ord-modal-loading">⏳ Đang tải...</div>
        ) : !detail ? (
          <div className="ord-modal-loading">⚠️ Không thể tải chi tiết</div>
        ) : (
          <div className="ord-modal-body">
            {/* ── TRẠNG THÁI + TIMELINE ── */}
            <div className="ord-detail-section">
              <div className="ord-detail-label">📊 Trạng thái đơn hàng</div>
              <div className="ord-detail-card">
                <div className="ord-status-timeline">
                  {["pending", "confirmed", "shipping", "delivered"].map((step, idx) => {
                    const cfg = STATUS_CONFIG[step];
                    const currentIdx = ["pending", "confirmed", "shipping", "delivered"].indexOf(currentStatus);
                    const isActive = idx <= currentIdx;
                    const isCurrent = step === currentStatus;
                    return (
                      <div key={step} className={`ord-timeline-step ${isActive ? "active" : ""} ${isCurrent ? "current" : ""}`}>
                        <div
                          className="ord-timeline-dot"
                          style={{
                            background: isActive ? cfg.color : "var(--adm-surface-2)",
                            boxShadow: isCurrent ? `0 0 8px ${cfg.color}` : "none",
                          }}
                        >
                          {isActive ? cfg.icon : idx + 1}
                        </div>
                        <span className="ord-timeline-label" style={{ color: isActive ? cfg.color : "var(--adm-text-2)" }}>
                          {cfg.label}
                        </span>
                        {idx < 3 && (
                          <div
                            className="ord-timeline-line"
                            style={{ background: idx < currentIdx ? cfg.color : "var(--adm-surface-2)" }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "center" }}>
                  {currentStatus === "pending" && (
                    <button
                      className="adm-btn-primary"
                      onClick={() => handleUpdateStatus("confirmed")}
                      disabled={updating}
                      style={{ fontSize: 13 }}
                    >
                      {updating ? "Đang xử lý..." : "✅ Xác nhận đơn"}
                    </button>
                  )}
                  {currentStatus === "confirmed" && (
                    <button
                      className="adm-btn-primary"
                      onClick={() => handleUpdateStatus("shipping")}
                      disabled={updating}
                      style={{ fontSize: 13, background: "linear-gradient(135deg, #a855f7, #7c3aed)" }}
                    >
                      {updating ? "Đang xử lý..." : "🚚 Xác nhận giao hàng"}
                    </button>
                  )}
                  {currentStatus === "shipping" && (
                    <span style={{ fontSize: 13, color: "var(--adm-text-2)", padding: "8px 0" }}>
                      ⏳ Đang chờ khách xác nhận nhận hàng...
                    </span>
                  )}
                  {currentStatus === "delivered" && (
                    <span style={{ fontSize: 13, color: "#22c55e", padding: "8px 0" }}>
                      ✅ Đơn hàng hoàn tất
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* ── KHÁCH HÀNG ── */}
            <div className="ord-detail-section">
              <div className="ord-detail-label">👤 Khách hàng</div>
              <div className="ord-detail-card">
                <div className="ord-detail-row"><span>Tên</span><strong>{detail.customer_name || "—"}</strong></div>
                {detail.customer_phone && <div className="ord-detail-row"><span>Điện thoại</span><strong>{detail.customer_phone}</strong></div>}
                {detail.customer_address && <div className="ord-detail-row"><span>Địa chỉ</span><strong>{detail.customer_address}</strong></div>}
                <div className="ord-detail-row"><span>Ngày tạo</span><strong>{new Date(detail.created_at).toLocaleString("vi-VN")}</strong></div>
              </div>
            </div>

            {/* ── SẢN PHẨM ── */}
            <div className="ord-detail-section">
              <div className="ord-detail-label">🛒 Sản phẩm</div>
              <div className="ord-items-table">
                <div className="ord-items-head">
                  <span>Sản phẩm</span><span>SL</span><span>Đơn giá</span><span>Thành tiền</span>
                </div>
                {(detail.items || []).map((item, idx) => (
                  <div className="ord-items-row" key={idx}>
                    <div>
                      <div className="ord-item-name">{item.product_name || `Sản phẩm #${item.product_id}`}</div>
                      <div className="ord-item-variant">{item.variant_name}</div>
                    </div>
                    <span className="ord-item-qty">{item.qty}</span>
                    <span className="ord-item-price">{fmt(item.price)}</span>
                    <span className="ord-item-sub">{fmt(item.subtotal)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── TỔNG KẾT ── */}
            <div className="ord-detail-section">
              <div className="ord-detail-label">💰 Tổng kết</div>
              <div className="ord-detail-card">
                <div className="ord-detail-row"><span>Tiền hàng</span><span>{fmt(detail.subtotal)}</span></div>
                {detail.ship_fee > 0 && <div className="ord-detail-row"><span>Phí ship</span><span>{fmt(detail.ship_fee)}</span></div>}
                {detail.discount > 0 && <div className="ord-detail-row" style={{ color: "var(--adm-danger)" }}><span>Giảm giá</span><span>−{fmt(detail.discount)}</span></div>}
                <div className="ord-detail-divider" />
                <div className="ord-detail-row ord-detail-total"><span>TỔNG CỘNG</span><strong>{fmt(detail.total)}</strong></div>
              </div>
            </div>

            {detail.note && (
              <div className="ord-detail-section">
                <div className="ord-detail-label">📝 Ghi chú</div>
                <div className="ord-detail-card"><p style={{ margin: 0, fontSize: 14 }}>{detail.note}</p></div>
              </div>
            )}

            <div className="ord-detail-section">
              <div className="ord-detail-label">🔏 Chữ ký số</div>
              <div className="ord-detail-card">
                {detail.signature ? (
                  <div className="ord-sig-ok">
                    <span>✅ Đã ký số</span>
                    <span className="ord-sig-hash">{detail.signature.slice(0, 32)}...</span>
                  </div>
                ) : (
                  <div className="ord-sig-none">⚠️ Chưa ký số</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ── MAIN ADMIN ORDERS PAGE ──────────────────────── */
const AdminOrders = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    const token = localStorage.getItem("mc_admin_token");
    if (!token) { navigate("/admin/login"); return; }
    adminAPI.verifyToken().then((r) => {
      if (!r.valid) { localStorage.removeItem("mc_admin_token"); navigate("/admin/login"); }
    });
  }, [navigate]);

  const fetchOrders = () => {
    fetch(`${API_BASE}/orders`)
      .then((r) => r.json())
      .then((d) => { setOrders(d.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchOrders(); }, []);

  // Cập nhật trạng thái local (không cần re-fetch)
  const handleStatusChange = (orderId, newStatus) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );
  };

  // Quick action từ table (không cần mở modal)
  const handleQuickAction = async (orderId, newStatus) => {
    const labels = { confirmed: "xác nhận đơn", shipping: "giao hàng" };
    if (!window.confirm(`Chuyển đơn #${orderId} sang "${labels[newStatus]}"?`)) return;

    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        handleStatusChange(orderId, newStatus);
      } else {
        alert(data.message || "Cập nhật thất bại");
      }
    } catch {
      alert("Lỗi kết nối");
    }
  };

  // Filter orders theo tab
  const filtered = activeTab === "all" ? orders : orders.filter((o) => o.status === activeTab);

  // Đếm số đơn theo trạng thái
  const counts = {
    all: orders.length,
    pending: orders.filter((o) => o.status === "pending").length,
    confirmed: orders.filter((o) => o.status === "confirmed").length,
    shipping: orders.filter((o) => o.status === "shipping").length,
    delivered: orders.filter((o) => o.status === "delivered").length,
  };

  const totalRevenue = orders.reduce((s, o) => s + (o.total || 0), 0);

  return (
    <div>
      <div className="adm-topbar">
        <div>
          <h1 className="adm-page-title">📋 Đơn hàng</h1>
          <p className="adm-page-sub">Quản lý và xử lý đơn hàng</p>
        </div>
      </div>

      {/* ── STATS ── */}
      <div className="ord-stats">
        <div className="ord-stat-card">
          <div className="ord-stat-icon">🧾</div>
          <div>
            <div className="ord-stat-val">{orders.length}</div>
            <div className="ord-stat-label">Tổng đơn</div>
          </div>
        </div>
        <div className="ord-stat-card">
          <div className="ord-stat-icon">🕐</div>
          <div>
            <div className="ord-stat-val" style={{ color: "#f59e0b" }}>{counts.pending}</div>
            <div className="ord-stat-label">Chờ xử lý</div>
          </div>
        </div>
        <div className="ord-stat-card">
          <div className="ord-stat-icon">🚚</div>
          <div>
            <div className="ord-stat-val" style={{ color: "#a855f7" }}>{counts.shipping}</div>
            <div className="ord-stat-label">Đang giao</div>
          </div>
        </div>
        <div className="ord-stat-card">
          <div className="ord-stat-icon">💰</div>
          <div>
            <div className="ord-stat-val ord-stat-green">{fmt(totalRevenue)}</div>
            <div className="ord-stat-label">Doanh thu</div>
          </div>
        </div>
      </div>

      {/* ── FILTER TABS ── */}
      <div className="ord-filter-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`ord-filter-tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {counts[tab.id] > 0 && (
              <span className="ord-tab-count">{counts[tab.id]}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── TABLE ── */}
      <div className="ord-card">
        <div className="ord-card-header">
          <span>Danh sách đơn hàng</span>
          <span className="ord-count-badge">{filtered.length} đơn</span>
        </div>
        {loading ? (
          <div className="ord-empty"><div className="ord-empty-icon">⏳</div><p>Đang tải...</p></div>
        ) : filtered.length === 0 ? (
          <div className="ord-empty"><div className="ord-empty-icon">📭</div><p>Không có đơn hàng nào</p></div>
        ) : (
          <div className="ord-table-wrap">
            <table className="ord-table">
              <thead>
                <tr>
                  <th>Hóa đơn</th>
                  <th>Khách hàng</th>
                  <th>Tổng tiền</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                  <th style={{ textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id} className="ord-row-clickable">
                    <td onClick={() => setSelectedOrder(o)}>
                      <span className="ord-invoice-no">{o.invoice_no}</span>
                    </td>
                    <td onClick={() => setSelectedOrder(o)}>
                      <div className="ord-name">{o.name}</div>
                      <div style={{ fontSize: 12, color: "var(--adm-text-2)" }}>{o.phone || ""}</div>
                    </td>
                    <td onClick={() => setSelectedOrder(o)}>
                      <span className="ord-total">{fmt(o.total)}</span>
                    </td>
                    <td onClick={() => setSelectedOrder(o)}>
                      <StatusBadge status={o.status} />
                    </td>
                    <td onClick={() => setSelectedOrder(o)} className="ord-date">
                      {new Date(o.created_at).toLocaleString("vi-VN")}
                    </td>
                    <td>
                      <div className="adm-actions" style={{ justifyContent: "flex-end" }}>
                        {o.status === "pending" && (
                          <button
                            className="adm-action-btn"
                            style={{ background: "rgba(59,130,246,0.1)", color: "#3b82f6", fontWeight: 600 }}
                            onClick={() => handleQuickAction(o.id, "confirmed")}
                          >
                            ✅ Xác nhận
                          </button>
                        )}
                        {o.status === "confirmed" && (
                          <button
                            className="adm-action-btn"
                            style={{ background: "rgba(168,85,247,0.1)", color: "#a855f7", fontWeight: 600 }}
                            onClick={() => handleQuickAction(o.id, "shipping")}
                          >
                            🚚 Giao hàng
                          </button>
                        )}
                        {o.status === "shipping" && (
                          <span style={{ fontSize: 12, color: "var(--adm-text-2)", padding: "4px 8px" }}>
                            Chờ khách nhận
                          </span>
                        )}
                        {o.status === "delivered" && (
                          <span style={{ fontSize: 12, color: "#22c55e", padding: "4px 8px" }}>
                            Hoàn tất ✓
                          </span>
                        )}
                        <button
                          className="adm-action-btn adm-edit"
                          onClick={() => setSelectedOrder(o)}
                        >
                          👁 Chi tiết
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedOrder && (
        <OrderModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
};

export default AdminOrders;