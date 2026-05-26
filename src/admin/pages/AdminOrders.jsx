import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useConfirm } from "../../hooks/useConfirm";
import { adminAPI } from "../../hooks/useProducts";
import { signOrder } from "../utils/signature";
import RefundFlowModal from "../components/RefundFlowModal";
import { useRealtimeEvents } from "../../hooks/useRealtimeEvents";
import { useAdminNotif } from "../../contexts/AdminNotifContext";
import "../../styles/admin/admin.css";
import "../../styles/admin/admin-orders.css";

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const fmt = (n) => (n || 0).toLocaleString("vi-VN") + "đ";

const STATUS_CONFIG = {
  pending:   { label: "Chờ xác nhận", icon: "🕐", color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)" },
  confirmed: { label: "Đã xác nhận", icon: "✅", color: "#3b82f6", bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.3)" },
  shipping:  { label: "Đang giao",   icon: "🚚", color: "#a855f7", bg: "rgba(168,85,247,0.1)", border: "rgba(168,85,247,0.3)" },
  delivered: { label: "Đã giao",     icon: "📦", color: "#22c55e", bg: "rgba(34,197,94,0.1)",  border: "rgba(34,197,94,0.3)" },
  cancelled: { label: "Đã hủy",      icon: "❌", color: "#ef4444", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.3)" },
};

const ADMIN_CANCEL_REASONS = [
  "Hết hàng",
  "Shop tạm nghỉ",
  "Không liên hệ được khách",
  "Khác",
];

/* ── REJECT CANCEL REQUEST MODAL ── */
const RejectCancelModal = ({ order, onClose, onConfirm }) => {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) { toast.error("Vui lòng nhập lý do từ chối"); return; }
    setSubmitting(true);
    const ok = await onConfirm(reason.trim());
    if (!ok) setSubmitting(false);
  };

  return (
    <div className="ord-modal-backdrop" onClick={onClose}>
      <div className="ord-modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="ord-modal-header">
          <div>
            <div className="ord-modal-title">❌ Từ chối yêu cầu hủy</div>
            <div className="ord-modal-sub">#{order.invoice_no}</div>
          </div>
          <button className="ord-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="ord-modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 13, color: "var(--adm-text-2)", margin: 0 }}>
            Lý do khách yêu cầu hủy: <strong style={{ color: "var(--adm-text)" }}>{order.cancel_request_reason}</strong>
          </p>
          <label className="rf-label">Lý do từ chối (khách sẽ thấy)</label>
          <textarea
            className="rf-input"
            rows={3}
            maxLength={300}
            placeholder="VD: Đơn đã đóng gói chuẩn bị giao, không thể hủy..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="adm-btn-ghost" onClick={onClose} disabled={submitting}>Đóng</button>
            <button
              className="adm-btn-primary"
              style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)" }}
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "Đang gửi..." : "Xác nhận từ chối"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── CANCEL MODAL ── */
const CancelModal = ({ order, onClose, onConfirm }) => {
  const [reason, setReason] = useState(ADMIN_CANCEL_REASONS[0]);
  const [customReason, setCustomReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const finalReason = reason === "Khác" ? customReason.trim() : reason;
    if (!finalReason) { toast.error("Vui lòng nhập lý do hủy"); return; }
    setSubmitting(true);
    await onConfirm(finalReason);
    setSubmitting(false);
  };

  return (
    <div className="ord-modal-backdrop" onClick={onClose}>
      <div className="ord-modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="ord-modal-header">
          <div>
            <div className="ord-modal-title">❌ Hủy đơn hàng</div>
            <div className="ord-modal-sub">#{order.invoice_no}</div>
          </div>
          <button className="ord-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="ord-modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 13, color: "var(--adm-text-2)", margin: 0 }}>
            Chọn lý do hủy đơn (sẽ hiển thị cho khách hàng):
          </p>
          {ADMIN_CANCEL_REASONS.map((r) => (
            <label key={r} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: 8, borderRadius: 6, background: reason === r ? "var(--adm-surface-2)" : "transparent" }}>
              <input type="radio" name="reason" value={r} checked={reason === r} onChange={(e) => setReason(e.target.value)} />
              <span>{r}</span>
            </label>
          ))}
          {reason === "Khác" && (
            <textarea
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Nhập lý do cụ thể..."
              rows={3}
              maxLength={300}
              style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--adm-border)", background: "var(--adm-surface-2)", color: "var(--adm-text)", fontSize: 13, resize: "vertical" }}
            />
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
            <button className="adm-btn-ghost" onClick={onClose} disabled={submitting}>Đóng</button>
            <button
              className="adm-btn-primary"
              style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)" }}
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "Đang hủy..." : "Xác nhận hủy đơn"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const TABS = [
  { id: "all",            label: "Tất cả",        icon: "📋" },
  { id: "pending",        label: "Chờ xác nhận",  icon: "🕐" },
  { id: "confirmed",      label: "Đã xác nhận",   icon: "✅" },
  { id: "shipping",       label: "Đang giao",     icon: "🚚" },
  { id: "delivered",      label: "Đã giao",       icon: "📦" },
  { id: "cancel_request", label: "Yêu cầu hủy",   icon: "⏳" },
  { id: "cancelled",      label: "Đã hủy",        icon: "❌" },
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
const OrderModal = ({ order, onClose, onStatusChange, onRequestCancel, onApproveCancel, onRejectCancel }) => {
  const confirm = useConfirm();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState("");
  const keyInputRef = useRef(null);

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
    if (!await confirm(`Bạn muốn chuyển đơn sang "${labels[newStatus]}"?`)) return;

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
        toast.error(data.message || "Cập nhật thất bại");
      }
    } catch {
      toast.error("Lỗi kết nối");
    } finally {
      setUpdating(false);
    }
  };

  const handleSignClick = () => {
    setSignError("");
    keyInputRef.current?.click();
  };

  const handleKeySelected = async (e) => {
    const keyFile = e.target.files?.[0];
    e.target.value = "";
    if (!keyFile || !detail) return;

    setSigning(true);
    setSignError("");
    try {
      const result = await signOrder(detail.invoice_no, keyFile, API_BASE);
      setDetail((prev) => prev ? { ...prev, signature: result.signature } : prev);
    } catch (err) {
      setSignError(err.message || "Ký thất bại");
    } finally {
      setSigning(false);
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
                  {currentStatus === "cancelled" && (
                    <span style={{ fontSize: 13, color: "#ef4444", padding: "8px 0" }}>
                      ❌ Đơn hàng đã bị hủy
                    </span>
                  )}
                  {(currentStatus === "pending" || currentStatus === "confirmed") && onRequestCancel && (
                    <button
                      className="adm-btn-ghost"
                      onClick={onRequestCancel}
                      style={{ fontSize: 13, color: "#ef4444", border: "1px solid rgba(239,68,68,0.4)" }}
                    >
                      ❌ Hủy đơn
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Yêu cầu hủy đang chờ duyệt */}
            {detail.cancel_requested_at && currentStatus !== "cancelled" && (
              <div className="ord-detail-section">
                <div className="ord-detail-label">⏳ Yêu cầu hủy đang chờ duyệt</div>
                <div className="ord-detail-card" style={{ borderColor: "rgba(245,158,11,0.4)" }}>
                  <div className="ord-detail-row">
                    <span>Lý do khách đưa ra</span>
                    <strong style={{ color: "#f59e0b" }}>{detail.cancel_request_reason}</strong>
                  </div>
                  <div className="ord-detail-row">
                    <span>Gửi lúc</span>
                    <strong>{new Date(detail.cancel_requested_at).toLocaleString("vi-VN")}</strong>
                  </div>
                  {detail.refund_bank_account && (
                    <>
                      <div className="ord-detail-divider" />
                      <div className="ord-detail-row"><span>STK hoàn tiền</span><strong>{detail.refund_bank_account}</strong></div>
                      <div className="ord-detail-row"><span>Ngân hàng</span><strong>{detail.refund_bank_name}</strong></div>
                      <div className="ord-detail-row"><span>Chủ TK</span><strong>{detail.refund_bank_holder}</strong></div>
                    </>
                  )}
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    {onApproveCancel && (
                      <button
                        className="adm-btn-primary"
                        style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", fontSize: 13, flex: 1 }}
                        onClick={() => onApproveCancel(detail)}
                      >
                        ✅ Duyệt hủy đơn
                      </button>
                    )}
                    {onRejectCancel && (
                      <button
                        className="adm-btn-ghost"
                        style={{ color: "#ef4444", border: "1px solid rgba(239,68,68,0.4)", fontSize: 13, flex: 1 }}
                        onClick={() => onRejectCancel(detail)}
                      >
                        ❌ Từ chối
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Yêu cầu hủy đã bị từ chối (lưu để khách thấy) */}
            {detail.cancel_rejected_reason && currentStatus !== "cancelled" && !detail.cancel_requested_at && (
              <div className="ord-detail-section">
                <div className="ord-detail-label">❌ Đã từ chối yêu cầu hủy</div>
                <div className="ord-detail-card">
                  <div className="ord-detail-row">
                    <span>Lý do từ chối</span>
                    <strong>{detail.cancel_rejected_reason}</strong>
                  </div>
                  {detail.cancel_rejected_at && (
                    <div className="ord-detail-row">
                      <span>Từ chối lúc</span>
                      <strong>{new Date(detail.cancel_rejected_at).toLocaleString("vi-VN")}</strong>
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentStatus === "cancelled" && detail.cancel_reason && (
              <div className="ord-detail-section">
                <div className="ord-detail-label">❌ Thông tin hủy đơn</div>
                <div className="ord-detail-card" style={{ borderColor: "rgba(239,68,68,0.3)" }}>
                  <div className="ord-detail-row">
                    <span>Lý do</span>
                    <strong style={{ color: "#ef4444" }}>{detail.cancel_reason}</strong>
                  </div>
                  <div className="ord-detail-row">
                    <span>Hủy bởi</span>
                    <strong>{detail.cancelled_by === "admin" ? "🛍 Shop" : "👤 Khách hàng"}</strong>
                  </div>
                  {detail.cancelled_at && (
                    <div className="ord-detail-row">
                      <span>Thời điểm</span>
                      <strong>{new Date(detail.cancelled_at).toLocaleString("vi-VN")}</strong>
                    </div>
                  )}
                </div>
              </div>
            )}

            {(detail.payment_status === "refund_pending" || detail.payment_status === "refunded") && (
              <div className="ord-detail-section">
                <div className="ord-detail-label">
                  {detail.payment_status === "refunded" ? "✅ Đã hoàn tiền" : "⏳ Chờ hoàn tiền"}
                </div>
                <div className="ord-detail-card">
                  <div className="ord-detail-row"><span>Ngân hàng</span><strong>{detail.refund_bank_name}</strong></div>
                  <div className="ord-detail-row"><span>STK</span><strong>{detail.refund_bank_account}</strong></div>
                  <div className="ord-detail-row"><span>Chủ TK</span><strong>{detail.refund_bank_holder}</strong></div>
                  {detail.payment_status === "refunded" && (
                    <>
                      <div className="ord-detail-divider" />
                      <div className="ord-detail-row"><span>Mã GD</span><strong>{detail.refund_tx_ref}</strong></div>
                      {detail.refunded_at && (
                        <div className="ord-detail-row">
                          <span>Hoàn lúc</span>
                          <strong>{new Date(detail.refunded_at).toLocaleString("vi-VN")}</strong>
                        </div>
                      )}
                      {detail.refund_proof_url && (
                        <div style={{ marginTop: 8 }}>
                          <a href={detail.refund_proof_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#22c55e" }}>
                            🧾 Xem biên lai
                          </a>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

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
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div className="ord-sig-none">⚠️ Chưa ký số</div>
                    <button
                      className="adm-btn-primary"
                      onClick={handleSignClick}
                      disabled={signing}
                      style={{ fontSize: 13 }}
                    >
                      {signing ? "Đang ký..." : "🔏 Ký số ngay"}
                    </button>
                  </div>
                )}
                {signError && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "var(--adm-danger)" }}>
                    ⚠ {signError}
                  </div>
                )}
                <input
                  ref={keyInputRef}
                  type="file"
                  accept=".pem,.key"
                  onChange={handleKeySelected}
                  style={{ display: "none" }}
                />
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
  const confirm = useConfirm();
  const { clearCount } = useAdminNotif();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [refundTarget, setRefundTarget] = useState(null); // { order, mode }
  const [rejectTarget, setRejectTarget] = useState(null);

  const requestCancel = (order) => {
    const isPaid = order.payment_method === "bank" && order.payment_status === "paid";
    if (isPaid) setRefundTarget({ order, mode: "cancel-paid" });
    else setCancelTarget(order);
  };

  const handleRefundDone = (updatedOrder) => {
    setOrders((prev) => prev.map((o) => o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o));
    setRefundTarget(null);
    setSelectedOrder(null);
  };

  // Duyệt yêu cầu hủy của khách
  const handleApproveCancel = async (order) => {
    if (!await confirm(`Duyệt yêu cầu hủy đơn ${order.invoice_no}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/orders/${order.id}/cancel-request/approve`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, ...data.order } : o));
      } else {
        toast.error(data.message || "Duyệt thất bại");
      }
    } catch { toast.error("Lỗi kết nối"); }
  };

  // Từ chối yêu cầu hủy
  const handleRejectCancel = async (reason) => {
    if (!rejectTarget) return false;
    try {
      const res = await fetch(`${API_BASE}/orders/${rejectTarget.id}/cancel-request/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (data.success) {
        setOrders((prev) => prev.map((o) => o.id === rejectTarget.id ? { ...o, ...data.order } : o));
        setRejectTarget(null);
        return true;
      }
      toast.error(data.message || "Từ chối thất bại");
      return false;
    } catch { toast.error("Lỗi kết nối"); return false; }
  };
  const [activeTab, setActiveTab] = useState("all");

  const handleCancelOrder = async (orderId, reason) => {
    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, by: "admin" }),
      });
      const data = await res.json();
      if (data.success) {
        setOrders((prev) => prev.map((o) => o.id === orderId
          ? { ...o, status: "cancelled", cancel_reason: reason, cancelled_by: "admin", cancelled_at: new Date().toISOString() }
          : o
        ));
        setCancelTarget(null);
        setSelectedOrder(null);
      } else {
        toast.error(data.message || "Hủy thất bại");
      }
    } catch {
      toast.error("Lỗi kết nối");
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { navigate("/login"); return; }
    adminAPI.verifyToken().then((r) => {
      if (!r.valid) { localStorage.removeItem("token"); localStorage.removeItem("user"); navigate("/login"); }
    });
  }, [navigate]);

  const fetchOrders = () => {
    const token = localStorage.getItem("token");
    setLoading(true);
    fetch(`${API_BASE}/orders`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((d) => { setOrders(d.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchOrders(); }, []);

  /* ── Realtime: nhận đơn mới từ bất kỳ kênh nào (web, POS, app) ── */
  useRealtimeEvents({
    "order:new": (data) => {
      toast.success(`🛒 Đơn mới #${data.invoiceNo} — ${data.customerName}`, {
        duration: 6000,
        icon: "🔔",
      });
      fetchOrders(); // tải lại danh sách
    },
  }, []);

  /* Xoá badge khi admin mở trang này */
  useEffect(() => {
    clearCount("orders");
  }, [clearCount]);

  // Cập nhật trạng thái local (không cần re-fetch)
  const handleStatusChange = (orderId, newStatus) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );
  };

  // Quick action từ table (không cần mở modal)
  const handleQuickAction = async (orderId, newStatus) => {
    const labels = { confirmed: "xác nhận đơn", shipping: "giao hàng" };
    if (!await confirm(`Chuyển đơn #${orderId} sang "${labels[newStatus]}"?`)) return;

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
        toast.error(data.message || "Cập nhật thất bại");
      }
    } catch {
      toast.error("Lỗi kết nối");
    }
  };

  // Đơn có yêu cầu hủy đang chờ duyệt (status chưa cancelled)
  const hasPendingCancel = (o) => o.cancel_requested_at && o.status !== "cancelled";

  // Filter orders theo tab
  const filtered = activeTab === "all"
    ? orders
    : activeTab === "cancel_request"
      ? orders.filter(hasPendingCancel)
      : orders.filter((o) => o.status === activeTab);

  // Đếm số đơn theo trạng thái
  const counts = {
    all: orders.length,
    pending: orders.filter((o) => o.status === "pending").length,
    confirmed: orders.filter((o) => o.status === "confirmed").length,
    shipping: orders.filter((o) => o.status === "shipping").length,
    delivered: orders.filter((o) => o.status === "delivered").length,
    cancel_request: orders.filter(hasPendingCancel).length,
    cancelled: orders.filter((o) => o.status === "cancelled").length,
  };

  const totalRevenue = orders.reduce((s, o) => s + (o.total || 0), 0);

  return (
    <div>
      <div className="adm-topbar">
        <div>
          <h1 className="adm-page-title">📋 Đơn hàng</h1>
          <p className="adm-page-sub">Quản lý và xử lý đơn hàng</p>
        </div>
        <button className="adm-btn-ghost" onClick={fetchOrders}>🔄 Làm mới</button>
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
                        {o.status === "cancelled" && o.payment_status === "refund_pending" && (
                          <button
                            className="adm-action-btn"
                            style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", fontWeight: 600 }}
                            onClick={() => setRefundTarget({ order: o, mode: "refund-only" })}
                            title="Xử lý hoàn tiền"
                          >
                            💰 Hoàn tiền
                          </button>
                        )}
                        {o.status === "cancelled" && o.payment_status === "refunded" && (
                          <span style={{ fontSize: 12, color: "#22c55e", padding: "4px 8px" }}>
                            Đã hoàn ✓
                          </span>
                        )}
                        {o.status === "cancelled" && o.payment_status !== "refund_pending" && o.payment_status !== "refunded" && (
                          <span style={{ fontSize: 12, color: "#ef4444", padding: "4px 8px" }}>
                            Đã hủy
                          </span>
                        )}
                        {hasPendingCancel(o) && (
                          <>
                            <button
                              className="adm-action-btn"
                              style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", fontWeight: 600 }}
                              onClick={() => handleApproveCancel(o)}
                              title="Duyệt yêu cầu hủy"
                            >
                              ✅ Duyệt
                            </button>
                            <button
                              className="adm-action-btn adm-delete"
                              onClick={() => setRejectTarget(o)}
                              title="Từ chối yêu cầu"
                            >
                              ❌ Từ chối
                            </button>
                          </>
                        )}
                        {(o.status === "pending" || o.status === "confirmed") && !hasPendingCancel(o) && (
                          <button
                            className="adm-action-btn adm-delete"
                            onClick={() => requestCancel(o)}
                            title="Hủy đơn"
                          >
                            ❌ Hủy
                          </button>
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
          onRequestCancel={() => requestCancel(selectedOrder)}
          onApproveCancel={(o) => { handleApproveCancel(o); setSelectedOrder(null); }}
          onRejectCancel={(o) => { setRejectTarget(o); setSelectedOrder(null); }}
        />
      )}

      {cancelTarget && (
        <CancelModal
          order={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onConfirm={(reason) => handleCancelOrder(cancelTarget.id, reason)}
        />
      )}

      {refundTarget && (
        <RefundFlowModal
          order={refundTarget.order}
          mode={refundTarget.mode}
          onClose={() => setRefundTarget(null)}
          onDone={handleRefundDone}
        />
      )}

      {rejectTarget && (
        <RejectCancelModal
          order={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onConfirm={handleRejectCancel}
        />
      )}
    </div>
  );
};

export default AdminOrders;