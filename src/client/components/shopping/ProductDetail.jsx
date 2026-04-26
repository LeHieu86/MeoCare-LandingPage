import React, { useState, useMemo, useEffect, useCallback } from "react";

const API = import.meta.env.VITE_API_URL || "/api";

const parseVariantGroups = (variants) => {
  if (!variants || variants.length === 0) return { isGrouped: false, options: [] };
  const hasSeparator = variants.some(v => v.name.includes(" - "));
  if (!hasSeparator) return { isGrouped: false, options: variants };

  const flavorsSet = new Set();
  const weightsSet = new Set();
  variants.forEach(v => {
    const parts = v.name.split(" - ");
    if (parts.length >= 2) {
      flavorsSet.add(parts[0].trim());
      weightsSet.add(parts.slice(1).join(" - ").trim());
    }
  });
  const flavors = Array.from(flavorsSet);
  const weights = Array.from(weightsSet);
  if (flavors.length > 1 && weights.length > 1) return { isGrouped: true, flavors, weights };
  return { isGrouped: false, options: variants };
};

const Stars = ({ value, size = 14, interactive = false, onChange }) => {
  const [hovered, setHovered] = useState(0);
  return (
    <span className="pd-stars" style={{ fontSize: size }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span
          key={i}
          className={i <= (interactive ? (hovered || value) : value) ? "star filled" : "star"}
          onClick={() => interactive && onChange?.(i)}
          onMouseEnter={() => interactive && setHovered(i)}
          onMouseLeave={() => interactive && setHovered(0)}
          style={interactive ? { cursor: "pointer" } : {}}
        >
          {i <= (interactive ? (hovered || value) : Math.round(value)) ? "★" : "☆"}
        </span>
      ))}
    </span>
  );
};

const formatDate = (iso) => {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

const ProductDetail = ({ product, onAddToCart, allProducts = [], onSelectProduct }) => {
  const { isGrouped, options, flavors, weights } = useMemo(
    () => parseVariantGroups(product.variants),
    [product.variants]
  );

  const [selectedFlavor, setSelectedFlavor] = useState(flavors?.[0] || "");
  const [selectedWeight, setSelectedWeight] = useState(weights?.[0] || "");
  const [selectedFlatVariant, setSelectedFlatVariant] = useState(options?.[0] || {});
  const [quantity, setQuantity] = useState(1);

  // Reviews state
  const [reviewData, setReviewData] = useState(null);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [showAllReviews, setShowAllReviews] = useState(false);

  const loadReviews = useCallback(async () => {
    setReviewsLoading(true);
    try {
      const res = await fetch(`${API}/reviews/${product.id}`);
      const data = await res.json();
      if (data.success) setReviewData(data);
    } catch {
      // silent fail
    } finally {
      setReviewsLoading(false);
    }
  }, [product.id]);

  useEffect(() => {
    loadReviews();
    setShowAllReviews(false);
  }, [loadReviews]);

  const getSelectedVariant = () => {
    if (!isGrouped) return selectedFlatVariant;
    const fullName = `${selectedFlavor} - ${selectedWeight}`;
    return product.variants.find(v => v.name === fullName) || product.variants[0];
  };

  const handleAdd = () => onAddToCart(product, getSelectedVariant(), quantity);

  const minPrice = Math.min(...product.variants.map(v => v.price));
  const displayedReviews = showAllReviews
    ? (reviewData?.reviews || [])
    : (reviewData?.reviews || []).slice(0, 3);

  return (
    <div className="sp-detail-view">

      {/* ── ẢNH SẢN PHẨM ── */}
      <div className="sp-detail-img">
        <img src={product.image || "https://via.placeholder.com/400"} alt={product.name} />
      </div>

      {/* ── THÔNG TIN CHÍNH ── */}
      <div className="sp-detail-info">

        {/* Sold + rating summary nhỏ dưới tên */}
        <div className="pd-meta-row">
          {reviewData && reviewData.total > 0 && (
            <span className="pd-avg-inline">
              <Stars value={reviewData.avg} size={12} />
              <span>{reviewData.avg}</span>
              <span className="pd-dot">·</span>
              <span>{reviewData.total} đánh giá</span>
            </span>
          )}
          {product.sold > 0 && (
            <span className="pd-sold">Đã bán {product.sold.toLocaleString("vi-VN")}</span>
          )}
        </div>

        <h1>{product.name}</h1>
        <p className="sp-detail-desc">{product.description}</p>

        <div className="sp-detail-price">
          {getSelectedVariant().price?.toLocaleString("vi-VN")}đ
          <span className="sp-selected-type-name">/ {getSelectedVariant().name}</span>
        </div>

        {/* ── PHÂN LOẠI ── */}
        <div className="sp-detail-variants">
          {isGrouped ? (
            <>
              <div className="variant-group">
                <div className="variant-group-title">Mùi vị</div>
                <div className="variant-chips">
                  {flavors.map(f => (
                    <button key={f} className={`variant-chip ${selectedFlavor === f ? "active" : ""}`}
                      onClick={() => setSelectedFlavor(f)}>{f}</button>
                  ))}
                </div>
              </div>
              <div className="variant-group">
                <div className="variant-group-title">Khối lượng</div>
                <div className="variant-chips">
                  {weights.map(w => (
                    <button key={w} className={`variant-chip ${selectedWeight === w ? "active" : ""}`}
                      onClick={() => setSelectedWeight(w)}>{w}</button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="variant-group">
              <div className="variant-group-title">Phân loại</div>
              <div className="variant-chips">
                {options.map(opt => (
                  <button key={opt.name}
                    className={`variant-chip ${selectedFlatVariant.name === opt.name ? "active" : ""}`}
                    onClick={() => setSelectedFlatVariant(opt)}>{opt.name}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── CHỌN SỐ LƯỢNG + THÊM GIỎ ── */}
        <div className="sp-detail-actions">
          <div className="qty-selector">
            <button onClick={() => setQuantity(q => Math.max(1, q - 1))}>-</button>
            <span>{quantity}</span>
            <button onClick={() => setQuantity(q => q + 1)}>+</button>
          </div>
          <button className="btn-add-to-cart" onClick={handleAdd}>
            🛒 Thêm vào giỏ hàng
          </button>
        </div>

        {/* ── THÔNG TIN GIAO HÀNG & CHÍNH SÁCH ── */}
        <div className="pd-policy">
          <div className="pd-policy-row">
            <span className="pd-policy-icon">🚚</span>
            <div>
              <span className="pd-policy-title">Miễn phí giao hàng</span>
              <span className="pd-policy-sub">Đơn từ 300.000đ · Giao trong 1-3 ngày</span>
            </div>
          </div>
          <div className="pd-policy-row">
            <span className="pd-policy-icon">🔄</span>
            <div>
              <span className="pd-policy-title">Đổi trả trong 7 ngày</span>
              <span className="pd-policy-sub">Sản phẩm lỗi hoặc không đúng mô tả</span>
            </div>
          </div>
          <div className="pd-policy-row">
            <span className="pd-policy-icon">✅</span>
            <div>
              <span className="pd-policy-title">Hàng chính hãng 100%</span>
              <span className="pd-policy-sub">Cam kết chất lượng từ MeoCare</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── ĐÁNH GIÁ SẢN PHẨM ── */}
      <div className="pd-reviews">
        <div className="pd-reviews-header">
          <span className="pd-reviews-title">⭐ Đánh giá sản phẩm</span>
        </div>

        {reviewsLoading ? (
          <div className="pd-reviews-loading">Đang tải đánh giá...</div>
        ) : reviewData && reviewData.total > 0 ? (
          <>
            {/* Tổng quan điểm */}
            <div className="pd-rating-summary">
              <div className="pd-rating-big">
                <span className="pd-rating-number">{reviewData.avg}</span>
                <Stars value={reviewData.avg} size={20} />
                <span className="pd-rating-count">{reviewData.total} đánh giá</span>
              </div>
              <div className="pd-rating-bars">
                {reviewData.breakdown.map(({ star, count }) => (
                  <div key={star} className="pd-bar-row">
                    <span className="pd-bar-label">{star}★</span>
                    <div className="pd-bar-track">
                      <div
                        className="pd-bar-fill"
                        style={{ width: reviewData.total ? `${(count / reviewData.total) * 100}%` : "0%" }}
                      />
                    </div>
                    <span className="pd-bar-count">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Danh sách đánh giá */}
            <div className="pd-review-list">
              {displayedReviews.map(r => (
                <div key={r.id} className="pd-review-item">
                  <div className="pd-review-avatar">
                    {r.username[0]?.toUpperCase()}
                  </div>
                  <div className="pd-review-body">
                    <div className="pd-review-top">
                      <span className="pd-review-name">{r.username}</span>
                      <Stars value={r.rating} size={12} />
                    </div>
                    <p className="pd-review-comment">{r.comment}</p>
                    <span className="pd-review-date">{formatDate(r.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>

            {reviewData.reviews.length > 3 && (
              <button className="pd-show-more" onClick={() => setShowAllReviews(s => !s)}>
                {showAllReviews ? "Thu gọn ▲" : `Xem thêm ${reviewData.reviews.length - 3} đánh giá ▼`}
              </button>
            )}
          </>
        ) : (
          <div className="pd-reviews-empty">
            <span>💬</span>
            <p>Chưa có đánh giá nào. Hãy là người đầu tiên!</p>
          </div>
        )}

        {/* Gợi ý đánh giá từ Đơn hàng */}
        <div className="pd-review-hint">
          <span>📦</span>
          <p>Đã mua sản phẩm này? Vào <strong>Đơn Hàng</strong> để đánh giá sau khi xác nhận nhận hàng.</p>
        </div>
      </div>

      {/* ── SẢN PHẨM KHÁC ── */}
      {allProducts.length > 0 && (
        <div className="sp-related">
          <div className="sp-related-header">
            <span className="sp-related-icon">🏪</span>
            <h3>Sản phẩm khác của shop</h3>
          </div>
          <div className="sp-related-scroll">
            {allProducts.slice(0, 12).map(p => (
              <div key={p.id} className="sp-related-card" onClick={() => onSelectProduct?.(p)}>
                <div className="sp-related-img">
                  <img src={p.image || "https://via.placeholder.com/120"} alt={p.name} />
                </div>
                <div className="sp-related-info">
                  <p className="sp-related-name">{p.name}</p>
                  <span className="sp-related-price">
                    {Math.min(...p.variants.map(v => v.price)).toLocaleString("vi-VN")}đ
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductDetail;
