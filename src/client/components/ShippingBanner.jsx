import React, { useState } from "react";

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
        <button className="shipping-toggle-btn" onClick={() => setExpanded(v => !v)}>
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

export default ShippingBanner;