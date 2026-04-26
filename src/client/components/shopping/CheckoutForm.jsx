import React, { useState } from "react";

const CheckoutForm = ({ cart, cartTotal, onBack, onPlaceOrder }) => {
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    address: "",
    ward: "",
    district: "",
    city: "",
    paymentMethod: "cod",
    note: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (error) setError("");
  };

  const validate = () => {
    if (!form.fullName.trim()) return "Vui lòng nhập họ tên";
    if (!form.phone.trim()) return "Vui lòng nhập số điện thoại";
    if (!/^(0[3|5|7|8|9])+([0-9]{8})$/.test(form.phone.trim())) {
      return "Số điện thoại không hợp lệ";
    }
    if (!form.address.trim()) return "Vui lòng nhập địa chỉ";
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const fullAddress = `${form.address}, ${form.ward}, ${form.district}, ${form.city}`.replace(/, ,/g, ",").replace(/,\s*$/, "");
      
      await onPlaceOrder({
        ...form,
        fullAddress: fullAddress,
        items: cart.map(item => ({
          cartItemId: item.cartItemId,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity
        }))
      });
    } catch (err) {
      setError(err.message || "Đặt hàng thất bại, vui lòng thử lại");
    } finally {
      setLoading(false);
    }
  };

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="sp-checkout-view">
      {/* Header */}
      <div className="checkout-header">
        <button className="btn-back" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <h3>Đặt hàng</h3>
        <div style={{width: 40}}></div>
      </div>

      <form className="checkout-form" onSubmit={handleSubmit}>
        {/* Thông tin giao hàng */}
        <div className="checkout-section">
          <h4 className="section-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            Thông tin nhận hàng
          </h4>
          
          <div className="form-group">
            <label>Họ tên *</label>
            <input
              type="text"
              name="fullName"
              value={form.fullName}
              onChange={handleChange}
              placeholder="Nguyễn Văn A"
            />
          </div>

          <div className="form-group">
            <label>Số điện thoại *</label>
            <input
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="0912 345 678"
              maxLength={10}
            />
          </div>

          <div className="form-group">
            <label>Địa chỉ *</label>
            <input
              type="text"
              name="address"
              value={form.address}
              onChange={handleChange}
              placeholder="Số nhà, tên đường"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Phường/Xã</label>
              <input
                type="text"
                name="ward"
                value={form.ward}
                onChange={handleChange}
                placeholder="Phường Xuân Phước"
              />
            </div>
            <div className="form-group">
              <label>Quận/Huyện</label>
              <input
                type="text"
                name="district"
                value={form.district}
                onChange={handleChange}
                placeholder="Quận Đống Đa"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Tỉnh/Thành phố</label>
            <input
              type="text"
              name="city"
              value={form.city}
              onChange={handleChange}
              placeholder="Hà Nội"
            />
          </div>
        </div>

        {/* Phương thức thanh toán */}
        <div className="checkout-section">
          <h4 className="section-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
              <line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
            Thanh toán
          </h4>

          <div className="payment-options">
            <label className={`payment-option ${form.paymentMethod === "cod" ? "active" : ""}`}>
              <input
                type="radio"
                name="paymentMethod"
                value="cod"
                checked={form.paymentMethod === "cod"}
                onChange={handleChange}
              />
              <div className="payment-content">
                <span className="payment-icon">💰</span>
                <div>
                  <span className="payment-name">Thanh toán khi nhận hàng (COD)</span>
                  <span className="payment-desc">Trả tiền mặt khi nhận đơn</span>
                </div>
              </div>
            </label>

            <label className={`payment-option ${form.paymentMethod === "bank" ? "active" : ""}`}>
              <input
                type="radio"
                name="paymentMethod"
                value="bank"
                checked={form.paymentMethod === "bank"}
                onChange={handleChange}
              />
              <div className="payment-content">
                <span className="payment-icon">🏦</span>
                <div>
                  <span className="payment-name">Chuyển khoản ngân hàng</span>
                  <span className="payment-desc">Xác nhận sau khi chuyển</span>
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Ghi chú */}
        <div className="checkout-section">
          <div className="form-group">
            <label>Ghi chú đơn hàng</label>
            <textarea
              name="note"
              value={form.note}
              onChange={handleChange}
              placeholder="Ghi chú thêm cho đơn hàng (nếu có)..."
              rows={2}
            />
          </div>
        </div>

        {/* Tóm tắt đơn hàng */}
        <div className="checkout-section">
          <h4 className="section-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
            Tóm tắt đơn hàng
          </h4>

          <div className="order-summary">
            {cart.map(item => (
              <div key={item.cartItemId} className="summary-item">
                <div className="summary-item-info">
                  <img src={item.image} alt={item.name} />
                  <div>
                    <span className="summary-name">{item.name}</span>
                    <span className="summary-variant">{item.variantName}</span>
                  </div>
                </div>
                <div className="summary-item-right">
                  <span className="summary-qty">x{item.quantity}</span>
                  <span className="summary-price">{item.subtotal.toLocaleString("vi-VN")}đ</span>
                </div>
              </div>
            ))}
          </div>

          <div className="summary-total">
            <div className="summary-row">
              <span>Tạm tính ({totalItems} sản phẩm)</span>
              <span>{cartTotal.toLocaleString("vi-VN")}đ</span>
            </div>
            <div className="summary-row">
              <span>Phí vận chuyển</span>
              <span className="free-ship">Miễn phí</span>
            </div>
            <div className="summary-row total">
              <span>Tổng cộng</span>
              <span className="total-price">{cartTotal.toLocaleString("vi-VN")}đ</span>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="checkout-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            {error}
          </div>
        )}

        {/* Submit button */}
        <button 
          type="submit" 
          className="btn-place-order"
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="spinner"></span>
              Đang đặt hàng...
            </>
          ) : (
            `Xác nhận đặt hàng • ${cartTotal.toLocaleString("vi-VN")}đ`
          )}
        </button>
      </form>
    </div>
  );
};

export default CheckoutForm;