import React from "react";

const Cart = ({ cart, updateQuantity, cartTotal }) => {
  if (cart.length === 0) {
    return (
      <div className="sp-cart-empty">
        <span>🛒</span>
        <p>Giỏ hàng trống</p>
      </div>
    );
  }

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
              {/* Truyền trực tiếp cartItemId và quantity mới cho API */}
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
          <span>Tạm tính:</span>
          <span className="cart-total-price">{cartTotal.toLocaleString("vi-VN")}đ</span>
        </div>
        <button className="btn-checkout" disabled>
          Đặt hàng (Sẽ làm sau)
        </button>
      </div>
    </div>
  );
};

export default Cart;