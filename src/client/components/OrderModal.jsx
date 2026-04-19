import React, { useState, useEffect } from "react";
import { fmt, getSubsidyLabel, buildReceiptText } from "../../client/utils/menuHelpers";
import { useShipping } from "../../hooks/useShipping";
import ScrollPicker from "../components/ScrollPicker";

const MESSENGER_URL = "https://m.me/557095840820970";

const OrderModal = ({ items, orderTotal, onClose }) => {
  const [step,    setStep]    = useState("form");
  const [copied,  setCopied]  = useState(false);
  const [customer, setCustomer] = useState({ name: "", phone: "" });
  const [province, setProvince] = useState(null);
  const [district, setDistrict] = useState(null);
  const [ward,     setWard]     = useState(null);
  const [street,   setStreet]   = useState("");
  const [receiptText, setReceiptText] = useState("");

  const {
    provinces, districts, wards,
    shipLoading, shipResult, shipError,
    loadDistricts, loadWards, calculateFee,
  } = useShipping({ district, ward, items, orderTotal });

  const subsidy = getSubsidyLabel(orderTotal);

  const handleProvinceSelect = (p) => { setProvince(p); setDistrict(null); setWard(null); loadDistricts(p); };
  const handleDistrictSelect = (d) => { setDistrict(d); setWard(null); loadWards(d); };
  const handleWardSelect     = (w) => { setWard(w); calculateFee(district, w); };

  const canProceed = customer.name.trim() && customer.phone.trim() && province && district && ward && shipResult;

  const handleProceed = () => {
    const address = {
      street,
      wardName:     ward?.WardName       || "",
      districtName: district?.DistrictName || "",
      provinceName: province?.ProvinceName || "",
    };
    setReceiptText(buildReceiptText({
      customer, address, items, orderTotal,
      shipFee:  shipResult?.ship_fee  || 0,
      subsidy:  shipResult?.subsidy   || 0,
      finalFee: shipResult?.final_fee || 0,
    }));
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

  return (
    <div className="om-overlay" onClick={onClose}>
      <div className="om-sheet" onClick={e => e.stopPropagation()}>
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
              <div className="om-summary-bar">
                <span>🛒 {items.length} sản phẩm</span>
                <span className="om-summary-total">{fmt(orderTotal)}</span>
              </div>

              <div className="om-section-title">👤 Thông tin người nhận</div>
              <div className="om-row">
                <div className="om-field">
                  <label>Họ tên</label>
                  <input className="om-input" placeholder="Nguyễn Văn A"
                    value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })} />
                </div>
                <div className="om-field">
                  <label>Số điện thoại</label>
                  <input className="om-input" placeholder="0901234567" type="tel"
                    value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })} />
                </div>
              </div>

              <div className="om-section-title">📍 Địa chỉ giao hàng</div>

              <ScrollPicker label="Tỉnh / Thành phố" items={provinces} selected={province}
                onSelect={handleProvinceSelect} getKey={p => p.ProvinceID}
                getLabel={p => p.ProvinceName} placeholder="— Chọn tỉnh/thành —" />

              {province && (
                <>
                  <ScrollPicker label="Quận / Huyện" items={districts} selected={district}
                    onSelect={handleDistrictSelect} getKey={d => d.DistrictID}
                    getLabel={d => d.DistrictName} placeholder="— Chọn quận/huyện —" />
                  <ScrollPicker label="Phường / Xã" items={wards} selected={ward}
                    onSelect={handleWardSelect} getKey={w => w.WardCode}
                    getLabel={w => w.WardName} placeholder="— Chọn phường/xã —" disabled={!district} />

                  {shipLoading && <div className="om-ship-loading"><span className="om-spinner" /> Đang tính phí ship...</div>}
                  {shipError   && <div className="om-ship-error">⚠️ {shipError}</div>}
                  {shipResult  && (
                    <div className="om-ship-result">
                      <div className="om-ship-row"><span>Phí ship GHN</span><span>{fmt(shipResult.ship_fee)}</span></div>
                      {shipResult.subsidy > 0 && (
                        <div className="om-ship-row om-ship-subsidy">
                          <span>🎁 {subsidy.label}</span>
                          <span>−{fmt(shipResult.subsidy)}</span>
                        </div>
                      )}
                      {shipResult.subsidy === 0 && <div className="om-ship-hint">💡 {subsidy.label}</div>}
                      <div className="om-ship-row om-ship-final">
                        <span>Phí ship thực trả</span><span>{fmt(shipResult.final_fee)}</span>
                      </div>
                    </div>
                  )}
                  <div className="om-field">
                    <label>Số nhà, tên đường <span className="om-optional">(chi tiết và chính xác)</span></label>
                    <input className="om-input" placeholder="123 Đường ABC..."
                      value={street} onChange={e => setStreet(e.target.value)} />
                  </div>
                </>
              )}
            </div>

            <div className="om-footer">
              {canProceed && (
                <div className="om-total-preview">
                  <span>Tổng thanh toán</span>
                  <span className="om-total-amt">{fmt(totalToPay)}</span>
                </div>
              )}
              <button className="om-proceed-btn" disabled={!canProceed} onClick={handleProceed}>Xem hóa đơn →</button>
              <button className="om-cancel" onClick={onClose}>Để sau</button>
            </div>
          </>
        ) : (
          <>
            <div className="om-header">
              <span className="om-header-icon">🧾</span>
              <div>
                <p className="om-title">Hóa đơn đặt hàng</p>
                <p className="om-sub">Copy và dán vào Messenger để gửi cho shop</p>
              </div>
            </div>
            <div className="om-body">
              <div className="om-receipt"><pre className="om-receipt-text">{receiptText}</pre></div>
            </div>
            <div className="om-footer">
              <button className={`om-copy-btn ${copied ? "copied" : ""}`} onClick={handleCopy}>
                {copied ? <><span>✓</span> Đã sao chép!</> : <><span>📋</span> Copy hóa đơn</>}
              </button>
              <button className={`om-mess-btn ${copied ? "enabled" : "disabled"}`}
                onClick={copied ? () => { onClose(); window.open(MESSENGER_URL, "_blank"); } : undefined}
                disabled={!copied}>
                <span>💬</span> Chuyển sang Messenger
                {!copied && <span className="om-lock">🔒</span>}
              </button>
              <button className="om-back-btn" onClick={() => { setStep("form"); setCopied(false); }}>← Sửa địa chỉ</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default OrderModal;