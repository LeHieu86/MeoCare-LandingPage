import React, { useState } from "react";
import CheckoutForm from "./CheckoutForm";

const Cart = ({ cart, updateQuantity, cartTotal, onPlaceOrder, onNavigate, onCheckoutChange }) => {
  const [showCheckout, setShowCheckout] = useState(false);

  const handleToggleCheckout = (val) => {
    setShowCheckout(val);
    if (onCheckoutChange) onCheckoutChange(val);
  };

  // Báo cho parent biết đang ở giỏ hàng để ẩn tab menu
  React.useEffect(() => {
    if (onNavigate) onNavigate("cart");
    return () => {
      if (onNavigate) onNavigate(null);
    };
  }, [onNavigate]);

  if (cart.length === 0) {
    return (
      <div className="sp-cart-empty">
        <span>🛒</span>
        <p>Giỏ hàng trống</p>
        <button 
          className="btn-back-shop"
          onClick={() => {
            if (onNavigate) onNavigate(null);
          }}
        >
          Quay lại mua sắm
        </button>
      </div>
    );
  }

  // Hiển thị form đặt hàng
  if (showCheckout) {
    return (
      <CheckoutForm
        cart={cart}
        cartTotal={cartTotal}
        onBack={() => handleToggleCheckout(false)}
        onPlaceOrder={onPlaceOrder}
      />
    );
  }

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="sp-cart-view">
      <div className="sp-cart-list">
        {cart.map(item => (
          <div key={item.cartItemId} className="sp-cart-item">
            <img src={item.image} alt={item.name} className="cart-item-img" />
            <div className="cart-item-info">
              <h4>{item.name}</h4>
              <p className="cart-item-variant">{item.variantName}</p>
              <p className="cart-item-price">{item.price.toLocaleString("vi-VN")}đ</p>
            </div>
            <div className="cart-item-actions">
              <div className="qty-selector small">
                <button onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}>-</button>
                <span>{item.quantity}</span>
                <button onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}>+</button>
              </div>
              <div className="cart-item-total">
                {item.subtotal.toLocaleString("vi-VN")}đ
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="sp-cart-footer">
        <div className="cart-total-block">
          <span>Tạm tính ({totalItems} sp):</span>
          <span className="cart-total-price">{cartTotal.toLocaleString("vi-VN")}đ</span>
        </div>
        <button 
          className="btn-checkout"
          onClick={() => handleToggleCheckout(true)}
        >
          Đặt hàng
        </button>
      </div>
    </div>
  );
};

export default Cart;