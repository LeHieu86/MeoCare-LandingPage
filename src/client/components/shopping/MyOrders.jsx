import React, { useState, useEffect, useCallback } from "react";
import authService from "../../../../backend/services/authService";

const API = import.meta.env.VITE_API_URL || "/api";

/* ── ĐỒNG BỘ VỚI BACKEND STATUS_FLOW ── */
const STATUS_MAP = {
  pending:   { label: "Chờ xác nhận",  color: "#f59e0b", bg: "#fffbeb" },
  confirmed: { label: "Đã xác nhận",   color: "#3b82f6", bg: "#eff6ff" },
  shipping:  { label: "Đang giao",     color: "#a855f7", bg: "#f5f3ff" },
  delivered: { label: "Đã nhận hàng",  color: "#22c55e", bg: "#f0fdf4" },
};

/* ── Helper lấy auth header ── */
function authHeaders() {
  const token = authService.getToken?.() || localStorage.getItem("mc_token");
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

const OrderCard = ({ order, phone, onConfirm }) => {
  const [confirming, setConfirming] = useState(false);
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
        alert(data.message || "Xác nhận thất bại");
      }
    } catch (e) {
      console.error(e);
      alert("Lỗi kết nối");
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

        {/* Chỉ hiện nút xác nhận khi đơn ĐANG GIAO (shipping) */}
        {order.status === "shipping" && (
          <button
            className="mo-btn-confirm"
            onClick={handleConfirm}
            disabled={confirming}
          >
            {confirming ? "Đang xác nhận..." : "✓ Đã nhận hàng"}
          </button>
        )}
      </div>
    </div>
  );
};

const MyOrders = () => {
  const user = authService.getUser();
  const phone = user?.phone || "";

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    if (!phone) { setLoading(false); return; }
    setLoading(true);
    try {
      /* Gọi /orders/my với auth token — backend tự lấy phone từ token */
      const res = await fetch(`${API}/orders/my`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.success) setOrders(data.orders);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [phone]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

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
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default MyOrders;