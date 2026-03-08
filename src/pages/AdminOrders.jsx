import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "../pages/components/AdminSidebar";
import { adminAPI } from "../hooks/useProducts";
import "../styles/admin.css";
import "../styles/admin-orders.css";

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const fmt = (n) => (n || 0).toLocaleString("vi-VN") + "đ";

// ── Order Detail Modal ────────────────────────────────────────────────────────
const OrderModal = ({ order, onClose }) => {
  const [detail,  setDetail]  = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/orders/${order.id}`)
      .then((r) => r.json())
      .then((d) => { setDetail(d); setLoading(false); })
      .catch(() => setLoading(false));

    // Đóng bằng Escape
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [order.id]);

  const reopenInvoice = () => {
    if (!detail) return;
    const invoiceData = {
      invoiceNo: detail.invoice_no,
      createdAt: new Date(detail.created_at).toLocaleString("vi-VN"),
      customer: {
        name:    detail.customer_name    || "",
        phone:   detail.customer_phone   || "",
        address: detail.customer_address || "",
      },
      lines: (detail.items || []).map((i) => ({
        productName: i.product_name || `Sản phẩm #${i.product_id}`,
        variantName: i.variant_name,
        qty:         i.qty,
        price:       i.price,
        subtotal:    i.subtotal,
      })),
      subtotal: detail.subtotal,
      shipFee:  detail.ship_fee,
      discount: detail.discount,
      total:    detail.total,
      note:     detail.note || "",
    };
    localStorage.setItem("mc_invoice_data", JSON.stringify(invoiceData));
    window.open("/admin/invoice", "_blank");
  };

  return (
    <div className="ord-modal-backdrop" onClick={onClose}>
      <div className="ord-modal" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="ord-modal-header">
          <div>
            <div className="ord-modal-title">Chi tiết đơn hàng</div>
            <div className="ord-modal-sub">#{order.invoice_no}</div>
          </div>
          <div className="ord-modal-actions">
            <button className="adm-btn-ghost" onClick={reopenInvoice} disabled={!detail}>
              🖨️ In lại
            </button>
            <button className="ord-modal-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {loading ? (
          <div className="ord-modal-loading">⏳ Đang tải...</div>
        ) : !detail ? (
          <div className="ord-modal-loading">⚠️ Không thể tải chi tiết</div>
        ) : (
          <div className="ord-modal-body">

            {/* Khách hàng */}
            <div className="ord-detail-section">
              <div className="ord-detail-label">👤 Khách hàng</div>
              <div className="ord-detail-card">
                <div className="ord-detail-row">
                  <span>Tên</span>
                  <strong>{detail.customer_name || "—"}</strong>
                </div>
                {detail.customer_phone && (
                  <div className="ord-detail-row">
                    <span>Điện thoại</span>
                    <strong>{detail.customer_phone}</strong>
                  </div>
                )}
                {detail.customer_address && (
                  <div className="ord-detail-row">
                    <span>Địa chỉ</span>
                    <strong>{detail.customer_address}</strong>
                  </div>
                )}
                <div className="ord-detail-row">
                  <span>Ngày tạo</span>
                  <strong>{new Date(detail.created_at).toLocaleString("vi-VN")}</strong>
                </div>
              </div>
            </div>

            {/* Sản phẩm */}
            <div className="ord-detail-section">
              <div className="ord-detail-label">🛒 Sản phẩm</div>
              <div className="ord-items-table">
                <div className="ord-items-head">
                  <span>Sản phẩm</span>
                  <span>SL</span>
                  <span>Đơn giá</span>
                  <span>Thành tiền</span>
                </div>
                {(detail.items || []).map((item, idx) => (
                  <div className="ord-items-row" key={idx}>
                    <div>
                      <div className="ord-item-name">
                        {item.product_name || `Sản phẩm #${item.product_id}`}
                      </div>
                      <div className="ord-item-variant">{item.variant_name}</div>
                    </div>
                    <span className="ord-item-qty">{item.qty}</span>
                    <span className="ord-item-price">{fmt(item.price)}</span>
                    <span className="ord-item-sub">{fmt(item.subtotal)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tổng kết */}
            <div className="ord-detail-section">
              <div className="ord-detail-label">💰 Tổng kết</div>
              <div className="ord-detail-card">
                <div className="ord-detail-row">
                  <span>Tiền hàng</span>
                  <span>{fmt(detail.subtotal)}</span>
                </div>
                {detail.ship_fee > 0 && (
                  <div className="ord-detail-row">
                    <span>Phí ship</span>
                    <span>{fmt(detail.ship_fee)}</span>
                  </div>
                )}
                {detail.discount > 0 && (
                  <div className="ord-detail-row" style={{ color: "var(--adm-danger)" }}>
                    <span>Giảm giá</span>
                    <span>−{fmt(detail.discount)}</span>
                  </div>
                )}
                <div className="ord-detail-divider" />
                <div className="ord-detail-row ord-detail-total">
                  <span>TỔNG CỘNG</span>
                  <strong>{fmt(detail.total)}</strong>
                </div>
              </div>
            </div>

            {/* Ghi chú */}
            {detail.note && (
              <div className="ord-detail-section">
                <div className="ord-detail-label">📝 Ghi chú</div>
                <div className="ord-detail-card">
                  <p style={{ margin: 0, fontSize: 14 }}>{detail.note}</p>
                </div>
              </div>
            )}

            {/* Chữ ký số */}
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

// ── Main AdminOrders ──────────────────────────────────────────────────────────
const AdminOrders = () => {
  const navigate = useNavigate();
  const [orders,       setOrders]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Auth guard
  useEffect(() => {
    const token = localStorage.getItem("mc_admin_token");
    if (!token) { navigate("/admin/login"); return; }
    adminAPI.verifyToken().then((r) => {
      if (!r.valid) { localStorage.removeItem("mc_admin_token"); navigate("/admin/login"); }
    });
  }, [navigate]);

  useEffect(() => {
    fetch(`${API_BASE}/orders`)
      .then((r) => r.json())
      .then((d) => { setOrders(d.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const totalRevenue = orders.reduce((s, o) => s + (o.total || 0), 0);

  return (
    <div className="adm-layout">
      <AdminSidebar />

      <main className="adm-main">
        <div className="adm-topbar">
          <div>
            <h1 className="adm-page-title">📋 Đơn hàng</h1>
            <p className="adm-page-sub">Click vào đơn để xem chi tiết</p>
          </div>
        </div>

        {/* Stats */}
        <div className="ord-stats">
          <div className="ord-stat-card">
            <div className="ord-stat-icon">🧾</div>
            <div>
              <div className="ord-stat-val">{orders.length}</div>
              <div className="ord-stat-label">Tổng đơn</div>
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

        {/* Table */}
        <div className="ord-card">
          <div className="ord-card-header">
            <span>Danh sách đơn hàng</span>
            <span className="ord-count-badge">{orders.length} đơn</span>
          </div>

          {loading ? (
            <div className="ord-empty"><div className="ord-empty-icon">⏳</div><p>Đang tải...</p></div>
          ) : orders.length === 0 ? (
            <div className="ord-empty"><div className="ord-empty-icon">📭</div><p>Chưa có đơn hàng nào</p></div>
          ) : (
            <div className="ord-table-wrap">
              <table className="ord-table">
                <thead>
                  <tr>
                    <th>Hóa đơn</th>
                    <th>Khách hàng</th>
                    <th>Điện thoại</th>
                    <th>Tổng tiền</th>
                    <th>Chữ ký</th>
                    <th>Ngày tạo</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr
                      key={o.id}
                      className="ord-row-clickable"
                      onClick={() => setSelectedOrder(o)}
                    >
                      <td><span className="ord-invoice-no">{o.invoice_no}</span></td>
                      <td className="ord-name">{o.name}</td>
                      <td className="ord-phone">{o.phone || "—"}</td>
                      <td><span className="ord-total">{fmt(o.total)}</span></td>
                      <td>
                        {o.signature
                          ? <span className="ord-sig-badge-ok">✅ Đã ký</span>
                          : <span className="ord-sig-badge-no">— Chưa ký</span>
                        }
                      </td>
                      <td className="ord-date">{new Date(o.created_at).toLocaleString("vi-VN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      {selectedOrder && (
        <OrderModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
};

export default AdminOrders;