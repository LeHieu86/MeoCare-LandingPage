import React, { useState, useEffect } from "react";
import api from "../../utils/api";
import { useShipping } from "../../../hooks/useShipping";
import "../../../styles/client/checkout.css";

const CheckoutForm = ({ cart, cartTotal, onBack, onPlaceOrder }) => {
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    address: "",
    paymentMethod: "cod",
    note: "",
  });

  const [selectedProvince, setSelectedProvince] = useState(null);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [selectedWard, setSelectedWard] = useState(null);

  const [loading, setLoading] = useState(false);
  const [prefilling, setPrefilling] = useState(true);
  const [error, setError] = useState("");

  const {
    provinces, districts, wards,
    shipLoading, shipResult, shipError,
    loadDistricts, loadWards, calculateFee,
  } = useShipping({
    district: selectedDistrict,
    ward: selectedWard,
    items: cart,
    orderTotal: cartTotal,
  });

  const shipFee = shipResult?.fee ?? 0;
  const grandTotal = cartTotal + shipFee;

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await api.get("/checkout/profile");
        if (data.success && data.profile) {
          const { fullName, phone, address } = data.profile;
          setForm((prev) => ({
            ...prev,
            fullName: fullName || prev.fullName,
            phone: phone || prev.phone,
            address: address || prev.address,
          }));
        }
      } catch (err) {
        console.error("Không thể tải thông tin khách hàng:", err);
      } finally {
        setPrefilling(false);
      }
    };
    fetchProfile();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (error) setError("");
  };

  const handleProvinceChange = (e) => {
    const prov = provinces.find((p) => String(p.ProvinceID) === e.target.value) || null;
    setSelectedProvince(prov);
    setSelectedDistrict(null);
    setSelectedWard(null);
    loadDistricts(prov);
  };

  const handleDistrictChange = (e) => {
    const dist = districts.find((d) => String(d.DistrictID) === e.target.value) || null;
    setSelectedDistrict(dist);
    setSelectedWard(null);
    loadWards(dist);
  };

  const handleWardChange = (e) => {
    const w = wards.find((w) => w.WardCode === e.target.value) || null;
    setSelectedWard(w);
    if (w && selectedDistrict) calculateFee(selectedDistrict, w);
  };

  const validate = () => {
    if (!form.fullName.trim()) return "Vui lòng nhập họ tên";
    if (!form.phone.trim()) return "Vui lòng nhập số điện thoại";
    if (!/^(0[3|5|7|8|9])+([0-9]{8})$/.test(form.phone.trim())) return "Số điện thoại không hợp lệ";
    if (!form.address.trim()) return "Vui lòng nhập địa chỉ";
    if (!selectedProvince) return "Vui lòng chọn Tỉnh/Thành phố";
    if (!selectedDistrict) return "Vui lòng chọn Quận/Huyện";
    if (!selectedWard) return "Vui lòng chọn Phường/Xã";
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }

    setLoading(true);
    try {
      const fullAddress = [
        form.address,
        selectedWard?.WardName,
        selectedDistrict?.DistrictName,
        selectedProvince?.ProvinceName,
      ].filter(Boolean).join(", ");

      await onPlaceOrder({
        customer: {
          name: form.fullName,
          phone: form.phone,
          address: fullAddress,
        },
        ship_fee: shipFee,
        discount: 0,
        note: form.note,
        payment_method: form.paymentMethod,  // ← snake_case cho backend
        items: cart.map((item) => ({
          product_id: item.productId,
          variant_name: item.variantName,
          price: item.price,
          qty: item.quantity,
        })),
      });
    } catch (err) {
      setError(err.message || "Đặt hàng thất bại");
    } finally {
      setLoading(false);
    }
  };

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="cl-page">
      <div className="cl-header">
        <button className="cl-btn-icon" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="cl-header-title">Đặt hàng</h3>
        <div style={{ width: 36 }} />
      </div>

      {prefilling ? (
        <div className="cl-empty">
          <div className="cl-spinner cl-spinner-dark" style={{ margin: "0 auto" }} />
          <p style={{ marginTop: 12 }}>Đang tải thông tin...</p>
        </div>
      ) : (
        <form className="cl-body ck-form-bottom-pad" onSubmit={handleSubmit}>

          <div className="cl-card">
            <h4 className="cl-card-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Thông tin nhận hàng
            </h4>

            <div className="cl-form-group">
              <label className="cl-label">Họ tên *</label>
              <input className="cl-input" type="text" name="fullName"
                value={form.fullName} onChange={handleChange} placeholder="Nguyễn Văn A" />
            </div>

            <div className="cl-form-group">
              <label className="cl-label">Số điện thoại *</label>
              <input className="cl-input" type="tel" name="phone"
                value={form.phone} onChange={handleChange} placeholder="0912 345 678" maxLength={10} />
            </div>

            <div className="cl-form-group">
              <label className="cl-label">Địa chỉ (số nhà, đường) *</label>
              <input className="cl-input" type="text" name="address"
                value={form.address} onChange={handleChange} placeholder="123 Đường Nguyễn Huệ" />
            </div>

            <div className="cl-form-group">
              <label className="cl-label">Tỉnh/Thành phố *</label>
              <select className="cl-select"
                value={selectedProvince ? String(selectedProvince.ProvinceID) : ""}
                onChange={handleProvinceChange}
              >
                <option value="">-- Chọn Tỉnh/Thành phố --</option>
                {provinces.map((p) => (
                  <option key={p.ProvinceID} value={String(p.ProvinceID)}>{p.ProvinceName}</option>
                ))}
              </select>
            </div>

            <div className="cl-form-row">
              <div className="cl-form-group">
                <label className="cl-label">Quận/Huyện *</label>
                <select className="cl-select"
                  value={selectedDistrict ? String(selectedDistrict.DistrictID) : ""}
                  onChange={handleDistrictChange} disabled={!selectedProvince}
                >
                  <option value="">-- Chọn Quận/Huyện --</option>
                  {districts.map((d) => (
                    <option key={d.DistrictID} value={String(d.DistrictID)}>{d.DistrictName}</option>
                  ))}
                </select>
              </div>

              <div className="cl-form-group">
                <label className="cl-label">Phường/Xã *</label>
                <select className="cl-select"
                  value={selectedWard ? selectedWard.WardCode : ""}
                  onChange={handleWardChange} disabled={!selectedDistrict}
                >
                  <option value="">-- Chọn Phường/Xã --</option>
                  {wards.map((w) => (
                    <option key={w.WardCode} value={w.WardCode}>{w.WardName}</option>
                  ))}
                </select>
              </div>
            </div>

            {shipLoading && (
              <div className="cl-alert ck-ship-loading">Đang tính phí vận chuyển...</div>
            )}
            {shipError && (
              <div className="cl-alert cl-alert-error">{shipError}</div>
            )}
            {shipResult && !shipLoading && (
              <div className="cl-alert cl-alert-success">
                Phí vận chuyển: <strong>{shipFee.toLocaleString("vi-VN")}đ</strong>
                {shipResult.expected_delivery && (
                  <span className="cl-text-muted"> — Dự kiến {shipResult.expected_delivery}</span>
                )}
              </div>
            )}
          </div>

          <div className="cl-card">
            <h4 className="cl-card-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
              Thanh toán
            </h4>

            <div className="ck-payment-options">
              <label className={`ck-payment-option ${form.paymentMethod === "cod" ? "active" : ""}`}>
                <input type="radio" name="paymentMethod" value="cod"
                  checked={form.paymentMethod === "cod"} onChange={handleChange} />
                <span className="ck-payment-icon">💰</span>
                <div>
                  <span className="ck-payment-name">Thanh toán khi nhận hàng (COD)</span>
                  <span className="ck-payment-desc">Trả tiền mặt khi nhận đơn</span>
                </div>
              </label>

              <label className={`ck-payment-option ${form.paymentMethod === "bank" ? "active" : ""}`}>
                <input type="radio" name="paymentMethod" value="bank"
                  checked={form.paymentMethod === "bank"} onChange={handleChange} />
                <span className="ck-payment-icon">🏦</span>
                <div>
                  <span className="ck-payment-name">Chuyển khoản ngân hàng</span>
                  <span className="ck-payment-desc">Quét QR để thanh toán ngay</span>
                </div>
              </label>
            </div>
          </div>

          <div className="cl-card">
            <div className="cl-form-group">
              <label className="cl-label">Ghi chú đơn hàng</label>
              <textarea className="cl-textarea" name="note" value={form.note}
                onChange={handleChange} placeholder="Ghi chú thêm (nếu có)..." rows={2} />
            </div>
          </div>

          <div className="cl-card">
            <h4 className="cl-card-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              Tóm tắt đơn hàng
            </h4>

            <div className="ck-summary-list">
              {cart.map((item) => (
                <div key={item.cartItemId} className="ck-summary-item">
                  <img src={item.image} alt={item.name} className="ck-summary-img" />
                  <div className="ck-summary-info">
                    <span className="ck-summary-name">{item.name}</span>
                    <span className="ck-summary-variant">{item.variantName}</span>
                  </div>
                  <div className="ck-summary-right">
                    <span className="ck-summary-qty">x{item.quantity}</span>
                    <span className="ck-summary-price">
                      {item.subtotal.toLocaleString("vi-VN")}đ
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <hr className="cl-divider" />

            <div className="ck-totals">
              <div className="ck-total-row">
                <span>Tạm tính ({totalItems} sản phẩm)</span>
                <span>{cartTotal.toLocaleString("vi-VN")}đ</span>
              </div>
              <div className="ck-total-row">
                <span>Phí vận chuyển</span>
                {shipResult
                  ? <span>{shipFee > 0 ? `${shipFee.toLocaleString("vi-VN")}đ` : <span className="cl-price-free">Miễn phí</span>}</span>
                  : <span className="cl-text-muted" style={{ fontStyle: "italic", fontSize: 13 }}>Chọn địa chỉ để tính</span>
                }
              </div>
              <div className="ck-total-row ck-total-grand">
                <span>Tổng cộng</span>
                <span className="cl-price" style={{ fontSize: 18 }}>
                  {grandTotal.toLocaleString("vi-VN")}đ
                </span>
              </div>
            </div>
          </div>

          {error && (
            <div className="cl-alert cl-alert-error" style={{ animation: "cl-shake 0.35s ease" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              {error}
            </div>
          )}

          <button type="submit" className="ck-btn-order" disabled={loading || shipLoading}>
            {loading ? (
              <>
                <span className="cl-spinner" />
                Đang đặt hàng...
              </>
            ) : (
              form.paymentMethod === "bank"
                ? `Đặt hàng & Thanh toán • ${grandTotal.toLocaleString("vi-VN")}đ`
                : `Xác nhận đặt hàng • ${grandTotal.toLocaleString("vi-VN")}đ`
            )}
          </button>
        </form>
      )}
    </div>
  );
};

export default CheckoutForm;