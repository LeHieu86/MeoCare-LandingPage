import React, { useState, useMemo } from "react";
import PRODUCTS from "../data/products";
import "../styles/menu.css";

const ZALO_PHONE = "0942768652";

const Menu = () => {
  const [category, setCategory] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);
  const [lightboxImage, setLightboxImage] = useState(null);

  const categories = [
    { id: "all", label: "Tất cả", icon: "🏠" },
    { id: "combo", label: "Combo", icon: "🎁" },
    { id: "food", label: "Hạt", icon: "🍚" },
    { id: "pate", label: "Pate", icon: "🥫" },
    { id: "hygiene", label: "Vệ sinh", icon: "🧼" },
  ];

  const list = useMemo(() => {
    return PRODUCTS.filter((p) => {
      const byCat = category === "all" || p.category === category;
      const byKey =
        p.name.toLowerCase().includes(keyword.toLowerCase()) ||
        p.description.toLowerCase().includes(keyword.toLowerCase());
      return byCat && byKey;
    });
  }, [category, keyword]);

  const toggleSelect = (product, variant) => {
    const key = `${product.id}-${variant.name}`;
    setSelectedItems((prev) => {
      const exists = prev.find((i) => i.key === key);
      if (exists) return prev.filter((i) => i.key !== key);

      return [
        ...prev,
        {
          key,
          productName: product.name,
          variantName: variant.name,
          price: variant.price,
        },
      ];
    });
  };

  const buildSingleZalo = (product, variant) => {
    const msg = `
Meo Care ơi, mình muốn hỏi:
• ${product.name}
• Loại: ${variant.name}
• Giá: ${variant.price.toLocaleString("vi-VN")}đ
    `;
    return `https://zalo.me/${ZALO_PHONE}?chat=${encodeURIComponent(msg)}`;
  };

  const buildBulkZalo = () => {
    if (selectedItems.length === 0) return "#";

    const lines = selectedItems.map(
      (i, idx) =>
        `${idx + 1}. ${i.productName} – ${i.variantName} – ${i.price.toLocaleString("vi-VN")}đ`
    );

    const total = selectedItems.reduce((s, i) => s + i.price, 0);

    const msg = `
Meo Care ơi, mình muốn hỏi các món sau:
${lines.join("\n")}

Tổng tạm tính: ${total.toLocaleString("vi-VN")}đ
    `;

    return `https://zalo.me/${ZALO_PHONE}?chat=${encodeURIComponent(msg)}`;
  };

  const totalSelected = selectedItems.reduce((s, i) => s + i.price, 0);

  return (
    <div className="menu-page">
      {/* HEADER */}
      <header className="menu-header">
        <div className="container header-row">
          <div className="logo">
            <span className="logo-icon">🐱</span>
            <span className="logo-text">Meo Care</span>
          </div>
          <a
            className="zalo-header"
            href={`https://zalo.me/${ZALO_PHONE}`}
            target="_blank"
            rel="noreferrer"
          >
            <span className="zalo-icon">💬</span>
            <span>Chat Zalo</span>
          </a>
        </div>
      </header>

      {/* HERO */}
      <section className="menu-hero">
        <div className="container">
          <h1>Bảng Giá Sản Phẩm</h1>
          <p className="hero-subtitle">
            Giá bán trực tiếp tại Meo Care (không phí sàn)
          </p>
          <p className="hero-note">
            💡 Giá Shopee có thể cao hơn do phí nền tảng
          </p>
        </div>
      </section>

      {/* FILTER */}
      <section className="menu-filter">
        <div className="container">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              placeholder="Tìm kiếm sản phẩm..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            {keyword && (
              <button 
                className="clear-search"
                onClick={() => setKeyword("")}
              >
                ✕
              </button>
            )}
          </div>

          <div className="menu-tabs">
            {categories.map((c) => (
              <button
                key={c.id}
                className={`tab-btn ${category === c.id ? "active" : ""}`}
                onClick={() => setCategory(c.id)}
              >
                <span className="tab-icon">{c.icon}</span>
                <span className="tab-label">{c.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* MENU LIST */}
      <section className="menu-list">
        <div className="container">
          {list.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <p>Không tìm thấy sản phẩm phù hợp</p>
              <button 
                className="reset-btn"
                onClick={() => {
                  setKeyword("");
                  setCategory("all");
                }}
              >
                Xem tất cả sản phẩm
              </button>
            </div>
          ) : (
            list.map((p) => (
              <div className="product-card" key={p.id}>
                <div 
                  className="product-image"
                  onClick={() => setLightboxImage({ src: p.image, name: p.name })}
                  role="button"
                  tabIndex={0}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') setLightboxImage({ src: p.image, name: p.name });
                  }}
                >
                  <img src={p.image} alt={p.name} loading="lazy" />
                  <div className="image-overlay">
                    <span className="zoom-icon">🔍</span>
                    <span className="zoom-text">Click để phóng to</span>
                  </div>
                </div>

                <div className="product-body">
                  <div className="product-header">
                    <h3 className="product-name">{p.name}</h3>
                    <p className="product-desc">{p.description}</p>
                  </div>

                  <div className="product-variants">
                    <div className="variants-label">
                      <span>📦</span>
                      <span>Chọn loại sản phẩm:</span>
                    </div>
                    <div className="variants-scroll">
                      {p.variants.map((v) => {
                        const key = `${p.id}-${v.name}`;
                        const checked = selectedItems.some((i) => i.key === key);

                        return (
                          <div 
                            className={`variant-item ${checked ? "checked" : ""}`} 
                            key={key}
                          >
                            <label className="variant-label">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleSelect(p, v)}
                                className="variant-checkbox"
                              />
                              <div className="variant-info">
                                <span className="variant-name">{v.name}</span>
                                <span className="variant-price">
                                  {v.price.toLocaleString("vi-VN")}đ
                                </span>
                              </div>
                            </label>

                            <a
                              href={buildSingleZalo(p, v)}
                              target="_blank"
                              rel="noreferrer"
                              className="order-btn"
                            >
                              <span>Đặt ngay</span>
                              <span>→</span>
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* BULK BAR */}
      {selectedItems.length > 0 && (
        <div className="bulk-bar">
          <div className="bulk-info">
            <div className="bulk-count">
              <span className="count-badge">{selectedItems.length}</span>
              <span className="count-text">sản phẩm</span>
            </div>
            <div className="bulk-total">
              <span className="total-label">Tạm tính:</span>
              <span className="total-amount">
                {totalSelected.toLocaleString("vi-VN")}đ
              </span>
            </div>
          </div>
          <a
            href={buildBulkZalo()}
            target="_blank"
            rel="noreferrer"
            className="bulk-order-btn"
          >
            <span>Đặt tất cả qua Zalo</span>
            <span className="btn-icon">🚀</span>
          </a>
        </div>
      )}

      {/* IMAGE LIGHTBOX */}
      {lightboxImage && (
        <div 
          className="lightbox-overlay"
          onClick={() => setLightboxImage(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Xem ảnh lớn"
        >
          <div className="lightbox-content">
            <button 
              className="lightbox-close"
              onClick={() => setLightboxImage(null)}
              aria-label="Đóng"
            >
              ✕
            </button>
            <img 
              src={lightboxImage.src} 
              alt={lightboxImage.name}
              onClick={(e) => e.stopPropagation()}
            />
            <div className="lightbox-caption">
              {lightboxImage.name}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Menu;