import React, { useState, useEffect, useCallback, useRef } from "react";
import { io } from "socket.io-client";
import { getToken, getUser } from "../../utils/api";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useConfirm } from "../../../hooks/useConfirm";
import authService from "../../utils/authService";
import api from "../../utils/api";
import { VN_BANKS } from "../../utils/bankList";

const API = "/api";

/* ── ĐỒNG BỘ VỚI BACKEND STATUS_FLOW ── */
const STATUS_MAP = {
  pending: { label: "Chờ xác nhận", color: "#f59e0b", bg: "#fffbeb" },
  confirmed: { label: "Đã xác nhận", color: "#3b82f6", bg: "#eff6ff" },
  shipping: { label: "Đang giao", color: "#a855f7", bg: "#f5f3ff" },
  delivered: { label: "Đã nhận hàng", color: "#22c55e", bg: "#f0fdf4" },
  cancelled: { label: "Đã hủy", color: "#ef4444", bg: "#fef2f2" },
};

const CUSTOMER_CANCEL_REASONS = ["Đổi ý", "Đặt nhầm", "Trùng đơn", "Khác"];

// Modal khi khách gửi yêu cầu hủy (đơn paid bắt buộc kèm STK)
const CancelOrderModal = ({ order, profile, onClose, onConfirm }) => {
  const [reason, setReason] = useState(CUSTOMER_CANCEL_REASONS[0]);
  const [customReason, setCustomReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  const needsRefundInfo = order.payment_method === "bank" && order.payment_status === "paid";

  // Bank form: prefill từ profile nếu có
  const [bankCode, setBankCode] = useState(
    VN_BANKS.find(b => b.name === profile?.bank_name)?.code || ""
  );
  const [bankAccount, setBankAccount] = useState(profile?.bank_account || "");
  const [bankHolder, setBankHolder] = useState(profile?.bank_holder || "");

  const handleSubmit = async () => {
    const finalReason = reason === "Khác" ? customReason.trim() : reason;
    if (!finalReason) { setErr("Vui lòng nhập lý do"); return; }

    let refundAccount = null;
    if (needsRefundInfo) {
      const bank = VN_BANKS.find(b => b.code === bankCode);
      if (!bank) { setErr("Chọn ngân hàng nhận hoàn tiền"); return; }
      if (!/^\d{6,20}$/.test(bankAccount.trim())) { setErr("STK phải là 6-20 chữ số"); return; }
      if (!bankHolder.trim()) { setErr("Nhập tên chủ tài khoản"); return; }
      refundAccount = {
        bank_name: bank.name,
        bank_account: bankAccount.trim(),
        bank_holder: bankHolder.trim().toUpperCase(),
        bank_bin: bank.bin,
      };
    }

    setSubmitting(true); setErr("");
    const ok = await onConfirm(finalReason, refundAccount);
    if (!ok) setSubmitting(false);
  };

  return (
    <div className="mo-cancel-backdrop" onClick={onClose}>
      <div className="mo-cancel-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mo-cancel-header">
          <h3>Gửi yêu cầu hủy đơn</h3>
          <button className="mo-cancel-close" onClick={onClose}>✕</button>
        </div>
        <p className="mo-cancel-sub">
          Đơn <strong>{order.invoice_no}</strong> · Shop sẽ duyệt yêu cầu trong vài giờ.
        </p>
        <div className="mo-cancel-options">
          {CUSTOMER_CANCEL_REASONS.map((r) => (
            <label key={r} className={`mo-cancel-opt ${reason === r ? "active" : ""}`}>
              <input type="radio" name="cancel-reason" value={r} checked={reason === r} onChange={(e) => setReason(e.target.value)} />
              <span>{r}</span>
            </label>
          ))}
        </div>
        {reason === "Khác" && (
          <textarea
            className="mo-cancel-textarea"
            rows={3}
            maxLength={300}
            placeholder="Nhập lý do cụ thể..."
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
          />
        )}

        {needsRefundInfo && (
          <div className="mo-refund-form">
            <div className="mo-refund-title">
              💰 Tài khoản nhận hoàn tiền ({order.total.toLocaleString("vi-VN")}đ)
            </div>
            <p className="mo-refund-hint">
              Đơn đã thanh toán — chúng tôi cần STK để chuyển khoản hoàn tiền cho bạn.
            </p>
            <select
              className="mo-refund-input"
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value)}
            >
              <option value="">— Chọn ngân hàng —</option>
              {VN_BANKS.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
            </select>
            <input
              className="mo-refund-input"
              type="text"
              inputMode="numeric"
              placeholder="Số tài khoản"
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value.replace(/\D/g, ""))}
            />
            <input
              className="mo-refund-input"
              type="text"
              placeholder="Tên chủ tài khoản (in hoa)"
              value={bankHolder}
              onChange={(e) => setBankHolder(e.target.value)}
              style={{ textTransform: "uppercase" }}
            />
          </div>
        )}

        {err && <div className="mo-msg error">{err}</div>}
        <div className="mo-cancel-actions">
          <button className="mo-btn-ghost" onClick={onClose} disabled={submitting}>Đóng</button>
          <button className="mo-btn-danger" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Đang gửi..." : "Gửi yêu cầu hủy"}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ── Helper lấy auth header ── */
function authHeaders() {
  const token = authService.getToken?.() || localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

const Stars = ({ value, interactive = false, onChange }) => {
  const [hovered, setHovered] = useState(0);
  return (
    <span className="mo-stars">
      {[1, 2, 3, 4, 5].map(i => (
        <span
          key={i}
          className={i <= (interactive ? (hovered || value) : Math.round(value)) ? "mo-star filled" : "mo-star"}
          onClick={() => interactive && onChange?.(i)}
          onMouseEnter={() => interactive && setHovered(i)}
          onMouseLeave={() => interactive && setHovered(0)}
          style={interactive ? { cursor: "pointer" } : {}}
        >★</span>
      ))}
    </span>
  );
};

const ReviewForm = ({ productId, orderId, phone, username, onDone }) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!comment.trim()) { setMsg({ type: "error", text: "Nhập nội dung đánh giá" }); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/reviews/${productId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, phone, rating, comment: comment.trim(), username }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg({ type: "success", text: "Cảm ơn bạn đã đánh giá! 🎉" });
        setTimeout(() => onDone(), 1200);
      } else {
        setMsg({ type: "error", text: data.message });
        setSubmitting(false);
      }
    } catch {
      setMsg({ type: "error", text: "Lỗi kết nối" });
      setSubmitting(false);
    }
  };

  return (
    <form className="mo-review-form" onSubmit={handleSubmit}>
      <div className="mo-review-stars-row">
        <span>Đánh giá:</span>
        <Stars value={rating} interactive onChange={setRating} />
      </div>
      <textarea
        rows={3}
        placeholder="Chia sẻ cảm nhận của bạn về sản phẩm..."
        value={comment}
        onChange={e => setComment(e.target.value)}
        maxLength={500}
      />
      {msg && <div className={`mo-msg ${msg.type}`}>{msg.text}</div>}
      <button type="submit" className="mo-btn-submit" disabled={submitting}>
        {submitting ? "Đang gửi..." : "Gửi đánh giá"}
      </button>
    </form>
  );
};

const OrderCard = ({ order, phone, onConfirm, onCancel, onWithdraw }) => {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [confirming, setConfirming] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const handleWithdraw = async () => {
    if (!await confirm("Bạn chắc chắn muốn rút yêu cầu hủy đơn?")) return;
    setWithdrawing(true);
    await onWithdraw(order.id);
    setWithdrawing(false);
  };
  const [reviewingId, setReviewingId] = useState(null);
  const [reviewedSet, setReviewedSet] = useState(
    new Set(order.reviews?.map(r => r.productId) || [])
  );

  const statusInfo = STATUS_MAP[order.status] || STATUS_MAP.pending;
  const formatDate = iso => {
    const d = new Date(iso);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  };

  /* ── Xác nhận nhận hàng — dùng endpoint /received có auth ── */
  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const res = await fetch(`${API}/orders/${order.id}/received`, {
        method: "PUT",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        onConfirm(order.id);
      } else {
        toast.error(data.message || "Xác nhận thất bại");
      }
    } catch (e) {
      console.error(e);
      toast.error("Lỗi kết nối");
    } finally {
      setConfirming(false);
    }
  };

  const handleReviewDone = (productId) => {
    setReviewedSet(prev => new Set([...prev, productId]));
    setReviewingId(null);
  };

  const user = authService.getUser();

  return (
    <div className="mo-card">
      {/* Header đơn hàng */}
      <div className="mo-card-head">
        <div>
          <span className="mo-invoice">{order.invoice_no}</span>
          <span className="mo-date">{formatDate(order.created_at)}</span>
        </div>
        <span
          className="mo-status-badge"
          style={{ color: statusInfo.color, background: statusInfo.bg }}
        >
          {statusInfo.label}
        </span>
      </div>

      {/* Danh sách sản phẩm */}
      <div className="mo-items">
        {order.items.map(item => {
          const product = item.product;
          if (!product) return null;
          const productId = product.id;
          const isReviewed = reviewedSet.has(productId);
          const isReviewing = reviewingId === productId;

          return (
            <div key={item.id} className="mo-item">
              <img
                src={product.image || "https://via.placeholder.com/60"}
                alt={product.name}
                className="mo-item-img"
              />
              <div className="mo-item-info">
                <p className="mo-item-name">{product.name}</p>
                <span className="mo-item-variant">{item.variant_name}</span>
                <span className="mo-item-qty">x{item.qty}</span>
              </div>
              <div className="mo-item-right">
                <span className="mo-item-price">
                  {item.subtotal.toLocaleString("vi-VN")}đ
                </span>

                {order.status === "delivered" && (
                  isReviewed ? (
                    <span className="mo-reviewed-tag">✓ Đã đánh giá</span>
                  ) : (
                    <button
                      className={`mo-btn-review ${isReviewing ? "active" : ""}`}
                      onClick={() => setReviewingId(isReviewing ? null : productId)}
                    >
                      {isReviewing ? "Đóng ▲" : "Đánh giá ★"}
                    </button>
                  )
                )}
              </div>

              {/* Form đánh giá inline */}
              {isReviewing && (
                <div className="mo-review-wrap">
                  <ReviewForm
                    productId={productId}
                    orderId={order.id}
                    phone={phone}
                    username={user?.fullName}
                    onDone={() => handleReviewDone(productId)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer đơn hàng */}
      <div className="mo-card-foot">
        <span className="mo-total">
          Tổng: <strong>{order.total.toLocaleString("vi-VN")}đ</strong>
        </span>

        {/* Đơn bank chưa thanh toán + đang còn hoạt động → nút thanh toán */}
        {order.payment_method === "bank" && order.payment_status === "unpaid" && order.status !== "cancelled" && (
          <button
            className="mo-btn-confirm"
            style={{ background: "#2563eb" }}
            onClick={() => navigate(`/payment/${order.id}`)}
          >
            💳 Thanh toán ngay
          </button>
        )}

        {/* Đơn đang giao → nút xác nhận nhận hàng (như cũ) */}
        {order.status === "shipping" && (
          <button className="mo-btn-confirm" onClick={handleConfirm} disabled={confirming}>
            {confirming ? "Đang xác nhận..." : "✓ Đã nhận hàng"}
          </button>
        )}

        {/* Đơn chưa giao + chưa có yêu cầu hủy → cho phép gửi yêu cầu */}
        {(order.status === "pending" || order.status === "confirmed") && !order.cancel_requested_at && (
          <button className="mo-btn-cancel" onClick={() => onCancel(order)}>
            ❌ Yêu cầu hủy đơn
          </button>
        )}

        {/* Đang chờ shop duyệt → cho rút lại */}
        {order.cancel_requested_at && order.status !== "cancelled" && (
          <button className="mo-btn-ghost" onClick={handleWithdraw} disabled={withdrawing}>
            {withdrawing ? "Đang rút..." : "↩ Rút yêu cầu hủy"}
          </button>
        )}
      </div>

      {/* Banner: yêu cầu hủy đang chờ duyệt */}
      {order.cancel_requested_at && order.status !== "cancelled" && (
        <div className="mo-cancel-info" style={{ background: "#fffbeb", borderLeftColor: "#f59e0b", color: "#92400e" }}>
          ⏳ <strong>Đang chờ shop duyệt yêu cầu hủy</strong>
          {order.cancel_request_reason && <div style={{ marginTop: 4 }}>Lý do: {order.cancel_request_reason}</div>}
        </div>
      )}

      {/* Banner: yêu cầu hủy bị từ chối */}
      {order.cancel_rejected_reason && order.status !== "cancelled" && (
        <div className="mo-cancel-info">
          <strong>❌ Shop đã từ chối yêu cầu hủy:</strong> {order.cancel_rejected_reason}
        </div>
      )}

      {/* Hiển thị lý do hủy nếu đã bị hủy */}
      {order.status === "cancelled" && order.cancel_reason && (
        <div className="mo-cancel-info">
          <strong>Lý do hủy:</strong> {order.cancel_reason}
          {order.cancelled_by === "admin" && <span className="mo-cancel-by"> · Bởi shop</span>}
          {order.cancelled_by === "customer" && <span className="mo-cancel-by"> · Bạn đã hủy</span>}
        </div>
      )}

      {/* Trạng thái hoàn tiền */}
      {order.payment_status === "refund_pending" && (
        <div className="mo-refund-status pending">
          ⏳ <strong>Đang chờ hoàn tiền</strong> — shop sẽ chuyển khoản vào STK bạn đã cung cấp trong 1-2 ngày làm việc.
        </div>
      )}
      {order.payment_status === "refunded" && (
        <div className="mo-refund-status done">
          ✅ <strong>Đã hoàn tiền</strong>
          {order.refund_tx_ref && <span> · Mã GD: {order.refund_tx_ref}</span>}
        </div>
      )}
    </div>
  );
};

const MyOrders = () => {
  const user = authService.getUser();
  const phone = (user?.phone && user.phone !== "Null") ? user.phone : "";

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [profile, setProfile] = useState(null);

  // Load profile để prefill STK trong popup hủy
  useEffect(() => {
    (async () => {
      try {
        const data = await api.get("/account/profile");
        if (data.success) setProfile(data.user);
      } catch { /* ignore */ }
    })();
  }, []);

  const handleCancelOrder = async (reason, refundAccount) => {
    if (!cancelTarget) return false;
    try {
      const res = await fetch(`${API}/orders/${cancelTarget.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, by: "customer", phone, refund_account: refundAccount }),
      });
      const data = await res.json();
      if (data.success) {
        // Backend chỉ TẠO YÊU CẦU HỦY, status giữ nguyên, chờ admin duyệt
        setOrders((prev) => prev.map((o) => o.id === cancelTarget.id ? { ...o, ...data.order } : o));
        setCancelTarget(null);
        toast(data.message || "Đã gửi yêu cầu hủy. Chờ shop duyệt.");
        return true;
      }
      toast.error(data.message || "Gửi yêu cầu thất bại");
      return false;
    } catch {
      toast.error("Lỗi kết nối");
      return false;
    }
  };

  const handleWithdraw = async (orderId) => {
    try {
      const res = await fetch(`${API}/orders/${orderId}/cancel-request/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (data.success) {
        setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, ...data.order } : o));
      } else {
        toast.error(data.message || "Rút yêu cầu thất bại");
      }
    } catch {
      toast.error("Lỗi kết nối");
    }
  };

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get("/orders/my");
      if (data.success) setOrders(data.orders);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  // ── Socket: cập nhật status đơn real-time ──────────────────────────────────
  useEffect(() => {
    const token = getToken();
    const user  = getUser();
    if (!token || !user?.id) return;

    const socket = io('https://api.meomeocare.io.vn', {
      transports: ['websocket'],
      auth: { token },
    });

    socket.on('connect', () => {
      socket.emit('joinCustomerRoom', { userId: user.id });
    });

    socket.on('order:status_changed', ({ orderId, status, statusLabel }) => {
      setOrders(prev => prev.map(o =>
        o.id === orderId ? { ...o, status } : o
      ));
      // Toast thông báo ngay trong trang đơn hàng
      const icon = status === 'confirmed' ? '✅' : status === 'shipping' ? '🚚' : '📦';
      toast(`${icon} Đơn hàng đã ${statusLabel}`, { duration: 4000 });
    });

    return () => socket.disconnect();
  }, []);

  const handleConfirmed = (orderId) => {
    setOrders(prev =>
      prev.map(o => o.id === orderId ? { ...o, status: "delivered" } : o)
    );
  };

  if (!phone) {
    return (
      <div className="mo-container">
        <div className="mo-empty">
          <span>🔒</span>
          <p>Vui lòng cập nhật số điện thoại trong hồ sơ để xem đơn hàng</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mo-container">
      <div className="mo-header">
        <h2 className="mo-title">Đơn Hàng Của Tôi</h2>
        <p className="mo-subtitle">Xác nhận nhận hàng để mở khóa tính năng đánh giá</p>
      </div>

      {loading ? (
        <div className="mo-loading">
          <div className="mo-spinner" />
          <p>Đang tải...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="mo-empty">
          <span>📦</span>
          <p>Bạn chưa có đơn hàng nào</p>
        </div>
      ) : (
        <div className="mo-list">
          {orders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              phone={phone}
              onConfirm={handleConfirmed}
              onCancel={setCancelTarget}
              onWithdraw={handleWithdraw}
            />
          ))}
        </div>
      )}

      {cancelTarget && (
        <CancelOrderModal
          order={cancelTarget}
          profile={profile}
          onClose={() => setCancelTarget(null)}
          onConfirm={handleCancelOrder}
        />
      )}
    </div>
  );
};

export default MyOrders;