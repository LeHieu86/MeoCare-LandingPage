import React from "react";

const OrderSuccess = ({ order, onContinue }) => {
  return (
    <div className="sp-order-success">
      <div className="success-icon">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      </div>
      
      <h2>Đặt hàng thành công!</h2>
      
      <div className="success-info">
        <div className="info-row">
          <span>Mã đơn hàng:</span>
          <strong>#{order?.orderCode || "..."}</strong>
        </div>
        <div className="info-row">
          <span>Người nhận:</span>
          <strong>{order?.fullName}</strong>
        </div>
        <div className="info-row">
          <span>Số điện thoại:</span>
          <strong>{order?.phone}</strong>
        </div>
        <div className="info-row">
          <span>Địa chỉ:</span>
          <strong>{order?.fullAddress}</strong>
        </div>
        <div className="info-row">
          <span>Thanh toán:</span>
          <strong>{order?.paymentMethod === "cod" ? "COD" : "Chuyển khoản"}</strong>
        </div>
        <div className="info-row total-row">
          <span>Tổng tiền:</span>
          <strong className="total-amount">
            {(order?.totalAmount || 0).toLocaleString("vi-VN")}đ
          </strong>
        </div>
      </div>

      <p className="success-note">
        📱 Chúng tôi sẽ liên hệ xác nhận đơn hàng qua điện thoại.
        <br />
        Cảm ơn bạn đã mua sắm!
      </p>

      <button className="btn-continue" onClick={onContinue}>
        Tiếp tục mua sắm
      </button>
    </div>
  );
};

export default OrderSuccess;