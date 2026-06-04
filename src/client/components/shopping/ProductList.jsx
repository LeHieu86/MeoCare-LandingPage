import React, { useState, useEffect } from "react";

const getViewerCount = (id) => {
  const base = (id * 7 + 13) % 11;
  return base + 3;
};

const ProductList = ({ products, loading, error, refetch, categories, category, setCategory, keyword, setKeyword, onSelectProduct }) => {
  const [viewerCounts, setViewerCounts] = useState({});

  useEffect(() => {
    if (products.length === 0) return;
    const initial = {};
    products.forEach(p => { initial[p.id] = getViewerCount(p.id); });
    setViewerCounts(initial);

    const interval = setInterval(() => {
      setViewerCounts(prev => {
        const next = { ...prev };
        products.forEach(p => {
          const delta = Math.random() < 0.3 ? (Math.random() < 0.5 ? 1 : -1) : 0;
          next[p.id] = Math.max(1, (next[p.id] ?? getViewerCount(p.id)) + delta);
        });
        return next;
      });
    }, 8000);
    return () => clearInterval(interval);
  }, [products]);

  return (
    <div className="product-list-view">
      {/* Search bar */}
      <div className="sp-filter-bar">
        <div className="sp-search-box">
          <span className="sp-search-icon">🔍</span>
          <input
            type="text"
            placeholder="Tìm kiếm sản phẩm..."
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
          />
          {keyword && (
            <button className="sp-search-clear" onClick={() => setKeyword('')}>✕</button>
          )}
        </div>
      </div>

      {/* Category pills */}
      <div className="sp-categories">
        {categories.map(c => (
          <button
            key={c.id}
            className={`sp-cat-btn ${category === c.id ? 'active' : ''}`}
            onClick={() => setCategory(c.id)}
          >
            <span>{c.icon}</span>
            <span>{c.label}</span>
          </button>
        ))}
      </div>

      {/* Product grid */}
      {loading ? (
        <div className="sp-loading">
          <div className="sp-loading-spinner" />
          <span>Đang tải sản phẩm...</span>
        </div>
      ) : error ? (
        <div className="sp-error">
          <span>⚠️</span>
          <p>Không thể tải sản phẩm</p>
          <button onClick={refetch}>Thử lại</button>
        </div>
      ) : (
        <div className="sp-grid">
          {products.map(p => (
            <div key={p.id} className="sp-card" onClick={() => onSelectProduct(p)}>
              <div className="sp-card-img">
                <img src={p.image || "https://via.placeholder.com/150"} alt={p.name} />
                {p.sold >= 50 ? (
                  <span className="sp-badge-hot">🔥 Bán chạy</span>
                ) : p.variants?.length > 1 ? (
                  <span className="sp-badge-variant">Nhiều lựa chọn</span>
                ) : null}
                <div className="sp-card-overlay">
                  <span className="sp-card-overlay-text">Xem chi tiết →</span>
                </div>
              </div>
              <div className="sp-card-info">
                <h3 className="sp-card-name">{p.name}</h3>
                <div className="sp-card-price">
                  <span className="sp-price-from">Từ </span>
                  {Math.min(...p.variants.map(v => v.price)).toLocaleString("vi-VN")}đ
                </div>
                <div className="sp-card-stats">
                  <span className="sp-card-stat sp-card-rating">
                    ⭐ {(p.rating_avg ?? 0).toFixed(1)}
                  </span>
                  <span className="sp-card-dot">·</span>
                  <span className="sp-card-stat sp-card-sold">
                    Đã bán {p.sold ?? 0}
                  </span>
                </div>
                {(viewerCounts[p.id] ?? 0) > 0 && (
                  <div className="sp-card-viewers">
                    <span className="sp-viewer-dot" />
                    <span>{viewerCounts[p.id]} người đang xem</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          {products.length === 0 && (
            <div className="sp-empty-state">
              <span>🛍️</span>
              <p>Không tìm thấy sản phẩm nào</p>
              {keyword && (
                <button onClick={() => setKeyword('')}>Xóa bộ lọc</button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProductList;
