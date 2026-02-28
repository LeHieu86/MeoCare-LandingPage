import React, { useState, useMemo } from "react";
import PRODUCTS from "../data/products";
import "../styles/menu.css";

const parseGroups = (variants) => {
  const groups = {};
  for (const v of variants) {
    const match = v.name.match(/^(.+?)\s*-\s*(\d+.*)$/);
    if (match) {
      const flavor = match[1].trim();
      const qty = match[2].trim();
      if (!groups[flavor]) groups[flavor] = [];
      groups[flavor].push({ qty, price: v.price, fullName: v.name });
    } else {
      if (!groups["__flat__"]) groups["__flat__"] = [];
      groups["__flat__"].push({ qty: v.name, price: v.price, fullName: v.name });
    }
  }
  return groups;
};

const MESSENGER_URL = "https://m.me/557095840820970";

// ─────────────────────────────────────────────────────────────────────────────
const ProductCard = ({
  product,
  selectedItems,
  toggleSelect,
  setLightboxImage,
  openModal,
  buildSingleMsg,
}) => {
  const groups = useMemo(() => parseGroups(product.variants), [product]);
  const flavors = Object.keys(groups);
  const isFlat = flavors.length === 1 && flavors[0] === "__flat__";
  const hasGroups = !isFlat && flavors.length > 1;

  const [activeFlavor, setActiveFlavor] = useState(flavors[0]);
  const currentOpts = groups[activeFlavor] || [];

  const isChecked = (fullName) =>
    selectedItems.some((i) => i.key === `${product.id}-${fullName}`);

  const selectedInCurrent = currentOpts.filter((o) => isChecked(o.fullName));

  return (
    <div className="product-card">
      {/* Image */}
      <div
        className="product-image"
        onClick={() => setLightboxImage({ src: product.image, name: product.name })}
        role="button"
        tabIndex={0}
        onKeyPress={(e) => {
          if (e.key === "Enter")
            setLightboxImage({ src: product.image, name: product.name });
        }}
      >
        <img src={product.image} alt={product.name} loading="lazy" />
        {product.category === "combo" && (
          <div className="combo-ribbon">🎁 Combo</div>
        )}
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
          {/* STEP 1: Flavor chips */}
          {hasGroups && (
            <div className="flavor-section">
              <div className="variants-label">
                <span>🍽</span>
                <span>① Chọn hương vị:</span>
              </div>
              <div className="flavor-chips">
                {flavors.map((f) => (
                  <button
                    key={f}
                    className={`flavor-chip ${activeFlavor === f ? "active" : ""}`}
                    onClick={() => setActiveFlavor(f)}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: Qty grid */}
          <div className="variants-label" style={{ marginTop: hasGroups ? 12 : 0 }}>
            <span>📦</span>
            <span>{hasGroups ? "② Chọn số lượng:" : "Chọn loại sản phẩm:"}</span>
          </div>
          <div className="qty-grid">
            {currentOpts.map((opt) => {
              const checked = isChecked(opt.fullName);
              return (
                <button
                  key={opt.fullName}
                  className={`qty-tile ${checked ? "checked" : ""}`}
                  onClick={() =>
                    toggleSelect(product, { name: opt.fullName, price: opt.price })
                  }
                >
                  {checked && <span className="qty-tick">✓</span>}
                  <span className="qty-label">{opt.qty}</span>
                  <span className="qty-price">
                    {opt.price.toLocaleString("vi-VN")}đ
                  </span>
                </button>
              );
            })}
          </div>

          {/* Action area */}
          {selectedInCurrent.length > 0 ? (
            <div className="action-selected">
              <div className="action-info">
                <span className="action-count">
                  ✅ {selectedInCurrent.length} loại đã chọn
                </span>
                <span className="action-total">
                  {selectedInCurrent
                    .reduce((s, o) => s + o.price, 0)
                    .toLocaleString("vi-VN")}đ
                </span>
              </div>
              {selectedInCurrent.length === 1 && (
                <button
                  className="order-btn"
                  onClick={() =>
                    openModal(
                      buildSingleMsg(product, {
                        name: selectedInCurrent[0].fullName,
                        price: selectedInCurrent[0].price,
                      })
                    )
                  }
                >
                  Đặt ngay →
                </button>
              )}
            </div>
          ) : isFlat && currentOpts.length === 1 ? (
            <button
              className="order-btn order-btn-block"
              onClick={() =>
                openModal(
                  buildSingleMsg(product, {
                    name: currentOpts[0].fullName,
                    price: currentOpts[0].price,
                  })
                )
              }
            >
              Đặt ngay →
            </button>
          ) : (
            <p className="variants-hint">
              ☝️ Chọn loại để thêm vào giỏ hoặc đặt ngay
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
const CopyModal = ({ msg, onClose }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    let ok = false;

    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(msg); ok = true; }
      catch { }
    }

    if (!ok) {
      try {
        const el = document.createElement("textarea");
        el.value = msg;
        el.style.cssText = "position:fixed;top:0;left:0;opacity:0;";
        document.body.appendChild(el);
        el.focus();
        el.select();
        el.setSelectionRange(0, el.value.length);
        ok = document.execCommand("copy");
        document.body.removeChild(el);
      } catch { ok = false; }
    }

    if (ok) setCopied(true);
  };

  const handleGoMessenger = () => {
    onClose();
    window.open(MESSENGER_URL, "_blank");
  };

  return (
    <div className="cm-overlay" onClick={onClose}>
      <div className="cm-sheet" onClick={(e) => e.stopPropagation()}>

        {/* Handle bar */}
        <div className="cm-handle" />

        {/* Title */}
        <p className="cm-title">Gửi đơn qua Messenger</p>
        <p className="cm-subtitle">
          Copy nội dung bên dưới rồi dán vào ô chat Messenger nhé 👇
        </p>

        {/* Message preview */}
        <div className="cm-preview">
          <pre className="cm-text">{msg}</pre>
        </div>

        {/* Step 1: Copy */}
        <button
          className={`cm-copy-btn ${copied ? "copied" : ""}`}
          onClick={handleCopy}
        >
          {copied ? (
            <>
              <span className="cm-tick">✓</span>
              Đã sao chép!
            </>
          ) : (
            <>
              <span className="cm-icon">📋</span>
              Copy nội dung
            </>
          )}
        </button>

        {/* Step 2: Go Messenger — chỉ enable sau khi copy */}
        <button
          className={`cm-go-btn ${copied ? "enabled" : "disabled"}`}
          onClick={copied ? handleGoMessenger : undefined}
          disabled={!copied}
        >
          <span className="cm-mess-icon">💬</span>
          Chuyển sang Messenger
          {!copied && <span className="cm-lock">🔒</span>}
        </button>

        <button className="cm-cancel" onClick={onClose}>
          Để sau
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
const Menu = () => {
  const [category, setCategory] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [modalMsg, setModalMsg] = useState(null); // string | null

  const categories = [
    { id: "all",     label: "Tất cả",  icon: "🏠" },
    { id: "combo",   label: "Combo",   icon: "🎁" },
    { id: "food",    label: "Hạt",     icon: "🍚" },
    { id: "pate",    label: "Pate",    icon: "🥫" },
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

  // ── Build message text ───────────────────────────────────────────────────
  const buildSingleMsg = (product, variant) =>
    `Meo Care ơi, mình muốn hỏi:\n• ${product.name}\n• Loại: ${variant.name}\n• Giá: ${variant.price.toLocaleString("vi-VN")}đ`;

  const buildBulkMsg = () => {
    if (selectedItems.length === 0) return null;
    const lines = selectedItems.map(
      (i, idx) =>
        `${idx + 1}. ${i.productName} – ${i.variantName} – ${i.price.toLocaleString("vi-VN")}đ`
    );
    const total = selectedItems.reduce((s, i) => s + i.price, 0);
    return `Meo Care ơi, mình muốn hỏi các món sau:\n\n${lines.join("\n")}\n\nTổng tạm tính: ${total.toLocaleString("vi-VN")}đ`;
  };

  const openModal = (msg) => setModalMsg(msg);
  const closeModal = () => setModalMsg(null);

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
            className="messenger-header"
            href={MESSENGER_URL}
            target="_blank"
            rel="noreferrer"
          >
            <span className="messenger-icon">💬</span>
            <span>Nhắn tin</span>
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
              <button className="clear-search" onClick={() => setKeyword("")}>
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
                onClick={() => { setKeyword(""); setCategory("all"); }}
              >
                Xem tất cả sản phẩm
              </button>
            </div>
          ) : (
            list.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                selectedItems={selectedItems}
                toggleSelect={toggleSelect}
                setLightboxImage={setLightboxImage}
                openModal={openModal}
                buildSingleMsg={buildSingleMsg}
              />
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
          <button
            className="bulk-order-btn"
            onClick={() => openModal(buildBulkMsg())}
          >
            <span>Đặt qua Messenger</span>
            <span className="btn-icon">🚀</span>
          </button>
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
            <div className="lightbox-caption">{lightboxImage.name}</div>
          </div>
        </div>
      )}

      {/* COPY MODAL */}
      {modalMsg && (
        <CopyModal msg={modalMsg} onClose={closeModal} />
      )}
    </div>
  );
};

export default Menu;