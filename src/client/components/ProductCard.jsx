import React, { useState, useMemo } from "react";
import { parseGroups, fmt } from "../utils/menuHelpers";

const ProductCard = ({ product, selectedItems, toggleSelect, setLightboxImage, openOrderModal }) => {
  const groups   = useMemo(() => parseGroups(product.variants), [product]);
  const flavors  = Object.keys(groups);
  const isFlat   = flavors.length === 1 && flavors[0] === "__flat__";
  const hasGroups = !isFlat && flavors.length > 1;

  const [activeFlavor, setActiveFlavor] = useState(flavors[0]);
  const currentOpts = groups[activeFlavor] || [];

  const isChecked = (fullName) =>
    selectedItems.some(i => i.key === `${product.id}-${fullName}`);

  const selectedInCurrent = currentOpts.filter(o => isChecked(o.fullName));

  const buildSingleOrderItems = (opt) => [{
    key: `${product.id}-${opt.fullName}`,
    productName: product.name,
    variantName: opt.fullName,
    price: opt.price,
    category: product.category,
  }];

  return (
    <div className="product-card">
      <div className="product-image"
        onClick={() => setLightboxImage({ src: product.image, name: product.name })}
        role="button" tabIndex={0}
        onKeyPress={e => { if (e.key === "Enter") setLightboxImage({ src: product.image, name: product.name }); }}>
        <img src={product.image} alt={product.name} loading="lazy" />
        {product.category === "combo" && <div className="combo-ribbon">🎁 Combo</div>}
        <div className="image-overlay">
          <span className="zoom-icon">🔍</span>
          <span className="zoom-text">Click để phóng to</span>
        </div>
      </div>

      <div className="product-body">
        <div className="product-header">
          <h3 className="product-name">{product.name}</h3>
          <p className="product-desc">{product.description}</p>
        </div>
        <div className="product-variants">
          {hasGroups && (
            <div className="flavor-section">
              <div className="variants-label"><span>🍽</span><span>① Chọn hương vị:</span></div>
              <div className="flavor-chips">
                {flavors.map(f => (
                  <button key={f} className={`flavor-chip ${activeFlavor === f ? "active" : ""}`}
                    onClick={() => setActiveFlavor(f)}>{f}</button>
                ))}
              </div>
            </div>
          )}
          <div className="variants-label" style={{ marginTop: hasGroups ? 12 : 0 }}>
            <span>📦</span>
            <span>{hasGroups ? "② Chọn số lượng:" : "Chọn loại sản phẩm:"}</span>
          </div>
          <div className="qty-grid">
            {currentOpts.map(opt => {
              const checked = isChecked(opt.fullName);
              return (
                <button key={opt.fullName} className={`qty-tile ${checked ? "checked" : ""}`}
                  onClick={() => toggleSelect(product, { name: opt.fullName, price: opt.price })}>
                  {checked && <span className="qty-tick">✓</span>}
                  <span className="qty-label">{opt.qty}</span>
                  <span className="qty-price">{opt.price.toLocaleString("vi-VN")}đ</span>
                </button>
              );
            })}
          </div>
          {selectedInCurrent.length > 0 ? (
            <div className="action-selected">
              <div className="action-info">
                <span className="action-count">✅ {selectedInCurrent.length} loại đã chọn</span>
                <span className="action-total">
                  {selectedInCurrent.reduce((s, o) => s + o.price, 0).toLocaleString("vi-VN")}đ
                </span>
              </div>
              {selectedInCurrent.length === 1 && (
                <button className="order-btn"
                  onClick={() => openOrderModal(buildSingleOrderItems(selectedInCurrent[0]))}>
                  Đặt ngay →
                </button>
              )}
            </div>
          ) : isFlat && currentOpts.length === 1 ? (
            <button className="order-btn order-btn-block"
              onClick={() => openOrderModal(buildSingleOrderItems(currentOpts[0]))}>
              Đặt ngay →
            </button>
          ) : (
            <p className="variants-hint">☝️ Chọn loại để thêm vào giỏ hoặc đặt ngay</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductCard;