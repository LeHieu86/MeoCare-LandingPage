import React, { useState, useMemo } from "react";
import { useProducts } from "../../hooks/useProducts";
import ShippingBanner from "../components/ShippingBanner";
import ProductCard    from "../components/ProductCard";
import OrderModal     from "../components/OrderModal";
import "../../styles/client/menu.css";
import "../../styles/client/order-modal.css";

const MESSENGER_URL = "https://m.me/557095840820970";

const Menu = () => {
  const { products, loading, error, refetch } = useProducts();
  const [category,      setCategory]     = useState("all");
  const [keyword,       setKeyword]      = useState("");
  const [selectedItems, setSelectedItems] = useState([]);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [orderModal,    setOrderModal]    = useState(null);

  const categories = [
    { id: "all",     label: "Tất cả",  icon: "🏠" },
    { id: "combo",   label: "Combo",   icon: "🎁" },
    { id: "food",    label: "Hạt",     icon: "🍚" },
    { id: "pate",    label: "Pate",    icon: "🥫" },
    { id: "hygiene", label: "Vệ sinh", icon: "🧼" },
  ];

  const list = useMemo(() => products.filter(p => {
    const byCat = category === "all" || p.category === category;
    const byKey = p.name.toLowerCase().includes(keyword.toLowerCase()) ||
                  p.description.toLowerCase().includes(keyword.toLowerCase());
    return byCat && byKey;
  }), [products, category, keyword]);

  const toggleSelect = (product, variant) => {
    const key = `${product.id}-${variant.name}`;
    setSelectedItems(prev => {
      const exists = prev.find(i => i.key === key);
      if (exists) return prev.filter(i => i.key !== key);
      return [...prev, { key, productName: product.name, variantName: variant.name, price: variant.price, category: product.category }];
    });
  };

  const bulkOrderTotal = selectedItems.reduce((s, i) => s + i.price, 0);

  return (
    <div className="menu-page">
      <header className="menu-header">
        <div className="container header-row">
          <div className="logo">
            <span className="logo-icon">🐱</span>
            <span className="logo-text">Meo Care</span>
          </div>
          {/* Đã xóa nút Messenger theo câu trước */}
        </div>
      </header>

      <section className="menu-hero">
        <div className="container">
          <h1>Bảng Giá Sản Phẩm</h1>
          <p className="hero-subtitle">Giá bán trực tiếp tại Meo Care (không phí sàn)</p>
          <p className="hero-note">💡 Giá Shopee có thể cao hơn do phí nền tảng</p>
        </div>
      </section>

      <ShippingBanner />

      <section className="menu-filter">
        <div className="container">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input placeholder="Tìm kiếm sản phẩm..." value={keyword}
              onChange={e => setKeyword(e.target.value)} />
            {keyword && <button className="clear-search" onClick={() => setKeyword("")}>✕</button>}
          </div>
          <div className="menu-tabs">
            {categories.map(c => (
              <button key={c.id} className={`tab-btn ${category === c.id ? "active" : ""}`}
                onClick={() => setCategory(c.id)}>
                <span className="tab-icon">{c.icon}</span>
                <span className="tab-label">{c.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="menu-list">
        <div className="container">
          {loading ? (
            <div className="empty-state"><div className="empty-icon">⏳</div><p>Đang tải sản phẩm...</p></div>
          ) : error ? (
            <div className="empty-state">
              <div className="empty-icon">⚠️</div>
              <p>Không thể tải sản phẩm.</p>
              <button className="reset-btn" onClick={refetch}>Thử lại</button>
            </div>
          ) : list.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <p>Không tìm thấy sản phẩm phù hợp</p>
              <button className="reset-btn" onClick={() => { setKeyword(""); setCategory("all"); }}>Xem tất cả</button>
            </div>
          ) : list.map(p => (
            <ProductCard key={p.id} product={p} selectedItems={selectedItems}
              toggleSelect={toggleSelect} setLightboxImage={setLightboxImage}
              openOrderModal={setOrderModal} />
          ))}
        </div>
      </section>

      {selectedItems.length > 0 && !orderModal && (
        <div className="bulk-bar">
          <div className="bulk-info">
            <div className="bulk-count">
              <span className="count-badge">{selectedItems.length}</span>
              <span className="count-text">sản phẩm</span>
            </div>
            <div className="bulk-total">
              <span className="total-label">Tạm tính:</span>
              <span className="total-amount">{bulkOrderTotal.toLocaleString("vi-VN")}đ</span>
            </div>
          </div>
          <button className="bulk-order-btn" onClick={() => setOrderModal(selectedItems)}>
            <span>Đặt qua Messenger</span><span className="btn-icon">🚀</span>
          </button>
        </div>
      )}

      {lightboxImage && (
        <div className="lightbox-overlay" onClick={() => setLightboxImage(null)} role="dialog">
          <div className="lightbox-content">
            <button className="lightbox-close" onClick={() => setLightboxImage(null)}>✕</button>
            <img src={lightboxImage.src} alt={lightboxImage.name} onClick={e => e.stopPropagation()} />
            <div className="lightbox-caption">{lightboxImage.name}</div>
          </div>
        </div>
      )}

      {orderModal && (
        <OrderModal items={orderModal}
          orderTotal={orderModal.reduce((s, i) => s + i.price, 0)}
          onClose={() => setOrderModal(null)} />
      )}
    </div>
  );
};

export default Menu;