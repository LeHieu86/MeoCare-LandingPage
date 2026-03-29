import React, { useState, useMemo, useEffect } from "react";
import { useProducts } from "../../hooks/useProducts";
import "../../styles/client/menu.css";
import "../../styles/client/order-modal.css";

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const MESSENGER_URL = "https://m.me/557095840820970";


// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) => n.toLocaleString("vi-VN") + "đ";

const estimateWeight = (items) => {
  // Ước tính trọng lượng (gram) dựa theo danh mục & tên variant
  let total = 0;
  for (const item of items) {
    const cat = item.category || "";
    const name = (item.variantName || "").toLowerCase();
    let w = 400; // default
    if (cat === "food")    w = 2200;
    if (cat === "hygiene") w = 6500;
    if (cat === "combo")   w = 3000;
    if (cat === "pate") {
      const match = name.match(/(\d+)\s*(hộp|gói)/);
      const qty = match ? parseInt(match[1]) : 1;
      w = name.includes("50g") ? qty * 60 : qty * 190;
    }
    total += w;
  }
  return Math.max(total, 200);
};

const getSubsidyLabel = (total) => {
  if (total >= 350000) return { amount: 30000, label: "Đơn ≥ 350k → hỗ trợ 30k" };
  if (total >= 250000) return { amount: 20000, label: "Đơn ≥ 250k → hỗ trợ 20k" };
  if (total >= 150000) return { amount: 10000, label: "Đơn ≥ 150k → hỗ trợ 10k" };
  return { amount: 0, label: "Đơn dưới 150k — không hỗ trợ ship" };
};

const buildReceiptText = ({ customer, address, items, orderTotal, shipFee, subsidy, finalFee }) => {
  const line = "─────────────────────────────";
  const bold = (s) => s;

  const itemLines = items.map((i, idx) =>
    `  ${idx + 1}. ${i.productName}\n     ${i.variantName} — ${fmt(i.price)}`
  ).join("\n");

  const shipSection = [
    `Phí ship GHN:   ${fmt(shipFee)}`,
    subsidy > 0 ? `Hỗ trợ ship:   -${fmt(subsidy)}` : null,
    `Phí ship sau HT: ${fmt(finalFee)}`,
  ].filter(Boolean).join("\n  ");

  return [
    `🧾 ĐƠN HÀNG MEO CARE 🐾`,
    line,
    `👤 KHÁCH HÀNG`,
    `  Tên: ${customer.name}`,
    `  SĐT: ${customer.phone}`,
    line,
    `📦 SẢN PHẨM`,
    itemLines,
    line,
    `📍 ĐỊA CHỈ GIAO`,
    `  ${address.street}`,
    `  ${address.wardName}, ${address.districtName}`,
    `  ${address.provinceName}`,
    line,
    `💰 THANH TOÁN`,
    `  Tiền hàng:     ${fmt(orderTotal)}`,
    `  ${shipSection}`,
    line,
    `  TỔNG CỘNG: ${fmt(orderTotal + finalFee)}`,
    line,
    `Cảm ơn bạn đã tin tưởng Meo Care! 🐱`,
  ].join("\n");
};

// ── parseGroups ───────────────────────────────────────────────────────────────
const parseGroups = (variants) => {
  const groups = {};
  for (const v of variants) {
    const match = v.name.match(/^(.+?)\s*-\s*(\d+.*)$/);
    if (match) {
      const flavor = match[1].trim();
      const qty    = match[2].trim();
      if (!groups[flavor]) groups[flavor] = [];
      groups[flavor].push({ qty, price: v.price, fullName: v.name });
    } else {
      if (!groups["__flat__"]) groups["__flat__"] = [];
      groups["__flat__"].push({ qty: v.name, price: v.price, fullName: v.name });
    }
  }
  return groups;
};

// ── ShippingBanner ────────────────────────────────────────────────────────────
const ShippingBanner = () => {
  const [expanded, setExpanded] = useState(false);
  return (
    <section className="shipping-banner">
      <div className="container">
        <div className="shipping-header">
          <div className="shipping-title-row">
            <span className="shipping-truck">🚚</span>
            <span className="shipping-title">Chính sách hỗ trợ phí ship – Meo Care 🐾</span>
          </div>
        </div>
        <div className="shipping-summary">
          <div className="shipping-pill canbe-free">
            <span>📍</span>
            <span>Nội ô Cần Thơ: giao hàng trực tiếp · 17h30–22h</span>
          </div>
          <div className="shipping-pill">
            <span>📦</span>
            <span>Ngoại tỉnh: hỗ trợ tới <strong>30k</strong> tùy đơn</span>
          </div>
        </div>
        <button className="shipping-toggle-btn" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Thu gọn ▴" : "Xem thêm ▾"}
        </button>
        {expanded && (
          <div className="shipping-detail">
            <div className="shipping-col">
              <p className="shipping-col-title">📍 Nội ô TP. Cần Thơ</p>
              <ul>
                <li>✅ Giao hàng trực tiếp</li>
                <li>🕐 T2–T7: 17h–22h | CN: 8h–22h</li>
              </ul>
            </div>
            <div className="shipping-divider" />
            <div className="shipping-col">
              <p className="shipping-col-title">📦 Khách ngoại tỉnh / ở xa</p>
              <table className="ship-table">
                <thead><tr><th>Giá trị đơn</th><th>Hỗ trợ ship</th></tr></thead>
                <tbody>
                  <tr><td>Dưới 150k</td><td>—</td></tr>
                  <tr><td>150k – 249k</td><td>−10k</td></tr>
                  <tr><td>250k – 349k</td><td>−20k</td></tr>
                  <tr className="highlight"><td>350k trở lên</td><td>−30k</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

// ── ScrollPicker — custom scrollable list thay thế <select> trên mobile ───────
const ScrollPicker = ({ label, items, selected, onSelect, getKey, getLabel, disabled, placeholder }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const listRef = React.useRef(null);

  const filtered = items.filter((i) =>
    getLabel(i).toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (item) => {
    onSelect(item);
    setOpen(false);
    setSearch("");
  };

  // Scroll item đang chọn vào giữa khi mở
  React.useEffect(() => {
    if (open && selected && listRef.current) {
      const el = listRef.current.querySelector(".sp-item.active");
      if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [open]);

  return (
    <div className="sp-wrap">
      <label className="om-field-label">{label}</label>
      <button
        type="button"
        className={`sp-trigger ${disabled ? "sp-disabled" : ""} ${selected ? "sp-has-value" : ""}`}
        onClick={() => !disabled && setOpen(true)}
        disabled={disabled}
      >
        <span className="sp-value">
          {selected ? getLabel(selected) : <span className="sp-placeholder">{placeholder}</span>}
        </span>
        <span className="sp-arrow">▾</span>
      </button>

      {open && (
        <div className="sp-backdrop" onClick={() => { setOpen(false); setSearch(""); }}>
          <div className="sp-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sp-sheet-handle" />
            <div className="sp-sheet-header">
              <span className="sp-sheet-title">{label}</span>
              <button className="sp-sheet-close" onClick={() => { setOpen(false); setSearch(""); }}>✕</button>
            </div>
            <div className="sp-search-wrap">
              <span className="sp-search-icon">🔍</span>
              <input
                className="sp-search"
                placeholder={`Tìm ${label.toLowerCase()}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
              {search && <button className="sp-search-clear" onClick={() => setSearch("")}>✕</button>}
            </div>
            <div className="sp-list" ref={listRef}>
              {filtered.length === 0 ? (
                <div className="sp-empty">Không tìm thấy kết quả</div>
              ) : (
                filtered.map((item) => (
                  <button
                    key={getKey(item)}
                    type="button"
                    className={`sp-item ${selected && getKey(selected) === getKey(item) ? "active" : ""}`}
                    onClick={() => handleSelect(item)}
                  >
                    <span>{getLabel(item)}</span>
                    {selected && getKey(selected) === getKey(item) && <span className="sp-tick">✓</span>}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── OrderModal ─────────────────────────────────────────────────────────────────
const OrderModal = ({ items, orderTotal, onClose }) => {
  // Steps: "form" | "receipt"
  const [step, setStep] = useState("form");
  const [copied, setCopied] = useState(false);

  // Customer info
  const [customer, setCustomer] = useState({ name: "", phone: "" });

  // Address
  const [provinces,  setProvinces]  = useState([]);
  const [districts,  setDistricts]  = useState([]);
  const [wards,      setWards]      = useState([]);
  const [province,   setProvince]   = useState(null); // { ProvinceID, ProvinceName }
  const [district,   setDistrict]   = useState(null);
  const [ward,       setWard]       = useState(null);
  const [street,     setStreet]     = useState("");

  // Shipping
  const [shipLoading, setShipLoading] = useState(false);
  const [shipResult,  setShipResult]  = useState(null); // { ship_fee, subsidy, final_fee }
  const [shipError,   setShipError]   = useState("");

  const subsidy  = getSubsidyLabel(orderTotal);

  // Receipt text (built when entering receipt step)
  const [receiptText, setReceiptText] = useState("");

  // ── Load provinces once ─────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE}/shipping/provinces`)
      .then((r) => r.json())
      .then((d) => setProvinces(d.data || []))
      .catch(() => {});
  }, []);

  // ── Load districts when province changes ───────────────────────────────
  useEffect(() => {
    setDistrict(null); setWard(null); setDistricts([]); setWards([]);
    setShipResult(null); setShipError("");
    if (!province) return;
    fetch(`${API_BASE}/shipping/districts/${province.ProvinceID}`)
      .then((r) => r.json())
      .then((d) => setDistricts(d.data || []))
      .catch(() => {});
  }, [province]);

  // ── Load wards when district changes ──────────────────────────────────
  useEffect(() => {
    setWard(null); setWards([]);
    setShipResult(null); setShipError("");
    if (!district) return;
    fetch(`${API_BASE}/shipping/wards/${district.DistrictID}`)
      .then((r) => r.json())
      .then((d) => setWards(d.data || []))
      .catch(() => {});
  }, [district]);

  // ── Calculate fee when ward selected (and not Cần Thơ) ────────────────
  useEffect(() => {
    if (!ward || !district) return;
    setShipLoading(true);
    setShipError("");
    setShipResult(null);

    const weight = estimateWeight(items);
    fetch(`${API_BASE}/shipping/fee`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to_district_id: district.DistrictID,
        to_ward_code:   ward.WardCode,
        weight,
        order_total: orderTotal,
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setShipError(d.error);
        else setShipResult(d);
      })
      .catch(() => setShipError("Không thể kết nối tính phí ship."))
      .finally(() => setShipLoading(false));
  }, [ward]);

  const canProceed = customer.name.trim() && customer.phone.trim() && province &&
    (district && ward && shipResult);

  const handleProceed = () => {
    const address = {
      street,
      wardName:     ward?.WardName     || "",
      districtName: district?.DistrictName || "",
      provinceName: province?.ProvinceName || "",
    };
    const text = buildReceiptText({
      customer,
      address,
      items,
      orderTotal,
      shipFee:  shipResult?.ship_fee  || 0,
      subsidy:  shipResult?.subsidy   || 0,
      finalFee: shipResult?.final_fee || 0,
    });
    setReceiptText(text);
    setStep("receipt");
  };

  const handleCopy = async () => {
    let ok = false;
    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(receiptText); ok = true; } catch {}
    }
    if (!ok) {
      try {
        const el = document.createElement("textarea");
        el.value = receiptText;
        el.style.cssText = "position:fixed;top:0;left:0;opacity:0;";
        document.body.appendChild(el);
        el.focus(); el.select();
        ok = document.execCommand("copy");
        document.body.removeChild(el);
      } catch {}
    }
    if (ok) setCopied(true);
  };

  const totalToPay = orderTotal + (shipResult?.final_fee || 0);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="om-overlay" onClick={onClose}>
      <div className="om-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="om-handle" />

        {step === "form" ? (
          <>
            <div className="om-header">
              <span className="om-header-icon">🛍️</span>
              <div>
                <p className="om-title">Thông tin đặt hàng</p>
                <p className="om-sub">Điền địa chỉ để tính phí ship tự động</p>
              </div>
            </div>

            <div className="om-body">
              {/* Order summary */}
              <div className="om-summary-bar">
                <span>🛒 {items.length} sản phẩm</span>
                <span className="om-summary-total">{fmt(orderTotal)}</span>
              </div>

              {/* Customer */}
              <div className="om-section-title">👤 Thông tin người nhận</div>
              <div className="om-row">
                <div className="om-field">
                  <label>Họ tên</label>
                  <input className="om-input" placeholder="Nguyễn Văn A"
                    value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
                </div>
                <div className="om-field">
                  <label>Số điện thoại</label>
                  <input className="om-input" placeholder="0901234567" type="tel"
                    value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
                </div>
              </div>

              {/* Address */}
              <div className="om-section-title">📍 Địa chỉ giao hàng</div>

              {/* Province */}
              <ScrollPicker
                label="Tỉnh / Thành phố"
                items={provinces}
                selected={province}
                onSelect={(p) => setProvince(p)}
                getKey={(p) => p.ProvinceID}
                getLabel={(p) => p.ProvinceName}
                placeholder="— Chọn tỉnh/thành —"
              />

              {province && (
                <>
                  <ScrollPicker
                    label="Quận / Huyện"
                    items={districts}
                    selected={district}
                    onSelect={(d) => setDistrict(d)}
                    getKey={(d) => d.DistrictID}
                    getLabel={(d) => d.DistrictName}
                    placeholder="— Chọn quận/huyện —"
                  />
                  <ScrollPicker
                    label="Phường / Xã"
                    items={wards}
                    selected={ward}
                    onSelect={(w) => setWard(w)}
                    getKey={(w) => w.WardCode}
                    getLabel={(w) => w.WardName}
                    placeholder="— Chọn phường/xã —"
                    disabled={!district}
                  />

                  {/* Shipping result */}
                  {shipLoading && (
                    <div className="om-ship-loading">
                      <span className="om-spinner" /> Đang tính phí ship...
                    </div>
                  )}
                  {shipError && <div className="om-ship-error">⚠️ {shipError}</div>}
                  {shipResult && (
                    <div className="om-ship-result">
                      <div className="om-ship-row">
                        <span>Phí ship GHN</span>
                        <span>{fmt(shipResult.ship_fee)}</span>
                      </div>
                      {shipResult.subsidy > 0 && (
                        <div className="om-ship-row om-ship-subsidy">
                          <span>🎁 {subsidy.label}</span>
                          <span>−{fmt(shipResult.subsidy)}</span>
                        </div>
                      )}
                      {shipResult.subsidy === 0 && (
                        <div className="om-ship-hint">💡 {subsidy.label}</div>
                      )}
                      <div className="om-ship-row om-ship-final">
                        <span>Phí ship thực trả</span>
                        <span>{fmt(shipResult.final_fee)}</span>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Street */}
              {province && (
                <div className="om-field">
                  <label>Số nhà, tên đường <span className="om-optional">(chi tiết và chính xác)</span></label>
                  <input className="om-input" placeholder="123 Đường ABC..."
                    value={street} onChange={(e) => setStreet(e.target.value)} />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="om-footer">
              {canProceed && (
                <div className="om-total-preview">
                  <span>Tổng thanh toán</span>
                  <span className="om-total-amt">{fmt(totalToPay)}</span>
                </div>
              )}
              <button className="om-proceed-btn" disabled={!canProceed} onClick={handleProceed}>
                Xem hóa đơn →
              </button>
              <button className="om-cancel" onClick={onClose}>Để sau</button>
            </div>
          </>
        ) : (
          /* ── Receipt step ─────────────────────────────────────────── */
          <>
            <div className="om-header">
              <span className="om-header-icon">🧾</span>
              <div>
                <p className="om-title">Hóa đơn đặt hàng</p>
                <p className="om-sub">Copy và dán vào Messenger để gửi cho shop</p>
              </div>
            </div>

            <div className="om-body">
              <div className="om-receipt">
                <pre className="om-receipt-text">{receiptText}</pre>
              </div>
            </div>

            <div className="om-footer">
              <button className={`om-copy-btn ${copied ? "copied" : ""}`} onClick={handleCopy}>
                {copied
                  ? <><span>✓</span> Đã sao chép!</>
                  : <><span>📋</span> Copy hóa đơn</>}
              </button>
              <button
                className={`om-mess-btn ${copied ? "enabled" : "disabled"}`}
                onClick={copied ? () => { onClose(); window.open(MESSENGER_URL, "_blank"); } : undefined}
                disabled={!copied}>
                <span>💬</span> Chuyển sang Messenger
                {!copied && <span className="om-lock">🔒</span>}
              </button>
              <button className="om-back-btn" onClick={() => { setStep("form"); setCopied(false); }}>
                ← Sửa địa chỉ
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ── ProductCard ───────────────────────────────────────────────────────────────
const ProductCard = ({ product, selectedItems, toggleSelect, setLightboxImage, openOrderModal }) => {
  const groups = useMemo(() => parseGroups(product.variants), [product]);
  const flavors = Object.keys(groups);
  const isFlat = flavors.length === 1 && flavors[0] === "__flat__";
  const hasGroups = !isFlat && flavors.length > 1;

  const [activeFlavor, setActiveFlavor] = useState(flavors[0]);
  const currentOpts = groups[activeFlavor] || [];

  const isChecked = (fullName) =>
    selectedItems.some((i) => i.key === `${product.id}-${fullName}`);

  const selectedInCurrent = currentOpts.filter((o) => isChecked(o.fullName));

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
        onKeyPress={(e) => { if (e.key === "Enter") setLightboxImage({ src: product.image, name: product.name }); }}>
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
                {flavors.map((f) => (
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
            {currentOpts.map((opt) => {
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

// ── Menu (main) ───────────────────────────────────────────────────────────────
const Menu = () => {
  const { products, loading, error, refetch } = useProducts();
  const [category,      setCategory]      = useState("all");
  const [keyword,       setKeyword]        = useState("");
  const [selectedItems, setSelectedItems]  = useState([]);
  const [lightboxImage, setLightboxImage]  = useState(null);
  const [orderModal,    setOrderModal]     = useState(null); // items[] | null

  const categories = [
    { id: "all",     label: "Tất cả",  icon: "🏠" },
    { id: "combo",   label: "Combo",   icon: "🎁" },
    { id: "food",    label: "Hạt",     icon: "🍚" },
    { id: "pate",    label: "Pate",    icon: "🥫" },
    { id: "hygiene", label: "Vệ sinh", icon: "🧼" },
  ];

  const list = useMemo(() => products.filter((p) => {
    const byCat = category === "all" || p.category === category;
    const byKey = p.name.toLowerCase().includes(keyword.toLowerCase()) ||
                  p.description.toLowerCase().includes(keyword.toLowerCase());
    return byCat && byKey;
  }), [products, category, keyword]);

  const toggleSelect = (product, variant) => {
    const key = `${product.id}-${variant.name}`;
    setSelectedItems((prev) => {
      const exists = prev.find((i) => i.key === key);
      if (exists) return prev.filter((i) => i.key !== key);
      return [...prev, {
        key,
        productName: product.name,
        variantName: variant.name,
        price: variant.price,
        category: product.category,
      }];
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
          <a className="messenger-header" href={MESSENGER_URL} target="_blank" rel="noreferrer">
            <span className="messenger-icon">💬</span><span>Nhắn tin</span>
          </a>
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
              onChange={(e) => setKeyword(e.target.value)} />
            {keyword && <button className="clear-search" onClick={() => setKeyword("")}>✕</button>}
          </div>
          <div className="menu-tabs">
            {categories.map((c) => (
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
              <button className="reset-btn" onClick={() => { setKeyword(""); setCategory("all"); }}>
                Xem tất cả
              </button>
            </div>
          ) : (
            list.map((p) => (
              <ProductCard key={p.id} product={p} selectedItems={selectedItems}
                toggleSelect={toggleSelect} setLightboxImage={setLightboxImage}
                openOrderModal={setOrderModal} />
            ))
          )}
        </div>
      </section>

      {/* Bulk bar — ẩn khi modal đang mở */}
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

      {/* Lightbox */}
      {lightboxImage && (
        <div className="lightbox-overlay" onClick={() => setLightboxImage(null)} role="dialog">
          <div className="lightbox-content">
            <button className="lightbox-close" onClick={() => setLightboxImage(null)}>✕</button>
            <img src={lightboxImage.src} alt={lightboxImage.name} onClick={(e) => e.stopPropagation()} />
            <div className="lightbox-caption">{lightboxImage.name}</div>
          </div>
        </div>
      )}

      {/* Order modal */}
      {orderModal && (
        <OrderModal
          items={orderModal}
          orderTotal={orderModal.reduce((s, i) => s + i.price, 0)}
          onClose={() => setOrderModal(null)}
        />
      )}
    </div>
  );
};

export default Menu;