import React, { useEffect, useState } from "react";
import "../styles/invoice-print.css";

const fmt = (n) => (n || 0).toLocaleString("vi-VN") + "đ";

const InvoicePrint = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("mc_invoice_data");
      if (!raw) { setError("Không tìm thấy dữ liệu hóa đơn."); return; }
      setData(JSON.parse(raw));
    } catch {
      setError("Dữ liệu hóa đơn bị lỗi.");
    }
  }, []);

  if (error) return (
    <div className="inv-error">
      <p>⚠️ {error}</p>
      <button onClick={() => window.close()}>Đóng</button>
    </div>
  );

  if (!data) return <div className="inv-loading">Đang tải hóa đơn...</div>;

  const { invoiceNo, createdAt, customer, lines, subtotal, shipFee, discount, total, note } = data;

  return (
    <div className="inv-root">
      {/* ── Print controls (ẩn khi in) ────────────────────────────────────── */}
      <div className="inv-controls no-print">
        <div className="inv-controls-left">
          <span className="inv-controls-title">🖨️ Hóa đơn #{invoiceNo}</span>
          <span className="inv-controls-hint">Chọn khổ giấy A4 hoặc A5 trong hộp thoại in</span>
        </div>
        <div className="inv-controls-right">
          <select
            className="inv-size-select"
            onChange={(e) => {
              document.documentElement.setAttribute("data-paper", e.target.value);
            }}
            defaultValue="a4"
          >
            <option value="a4">A4 (210 × 297mm)</option>
            <option value="a5">A5 (148 × 210mm)</option>
            <option value="k80">K80 — bill cuộn (80mm)</option>
          </select>
          <button className="inv-btn-print" onClick={() => window.print()}>
            🖨️ In ngay
          </button>
          <button className="inv-btn-close" onClick={() => window.close()}>✕ Đóng</button>
        </div>
      </div>

      {/* ── Invoice paper ─────────────────────────────────────────────────── */}
      <div className="inv-paper">
        {/* Header */}
        <div className="inv-header">
          <div className="inv-brand">
            <div className="inv-brand-name">🐱 Meo Care</div>
            <div className="inv-brand-tagline">Thức ăn & Đồ dùng cho Mèo</div>
          </div>
          <div className="inv-meta">
            <div className="inv-title">HÓA ĐƠN BÁN HÀNG</div>
            <div className="inv-meta-row">
              <span className="inv-meta-label">Số HĐ:</span>
              <span className="inv-meta-val">#{invoiceNo}</span>
            </div>
            <div className="inv-meta-row">
              <span className="inv-meta-label">Ngày:</span>
              <span className="inv-meta-val">{createdAt}</span>
            </div>
          </div>
        </div>

        <div className="inv-divider" />

        {/* Customer */}
        <div className="inv-customer">
          <div className="inv-section-title">THÔNG TIN KHÁCH HÀNG</div>
          <div className="inv-customer-grid">
            <div className="inv-cust-row">
              <span className="inv-cust-label">Khách hàng:</span>
              <span className="inv-cust-val inv-cust-name">{customer.name}</span>
            </div>
            {customer.phone && (
              <div className="inv-cust-row">
                <span className="inv-cust-label">Điện thoại:</span>
                <span className="inv-cust-val">{customer.phone}</span>
              </div>
            )}
            {customer.address && (
              <div className="inv-cust-row">
                <span className="inv-cust-label">Địa chỉ:</span>
                <span className="inv-cust-val">{customer.address}</span>
              </div>
            )}
          </div>
        </div>

        <div className="inv-divider" />

        {/* Items table */}
        <div className="inv-section-title">CHI TIẾT ĐƠN HÀNG</div>
        <table className="inv-table">
          <thead>
            <tr>
              <th className="inv-th-stt">STT</th>
              <th className="inv-th-name">Sản phẩm</th>
              <th className="inv-th-qty">SL</th>
              <th className="inv-th-price">Đơn giá</th>
              <th className="inv-th-sub">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => (
              <tr key={idx} className={idx % 2 === 1 ? "inv-tr-alt" : ""}>
                <td className="inv-td-stt">{idx + 1}</td>
                <td className="inv-td-name">
                  <div className="inv-item-name">{line.productName}</div>
                  <div className="inv-item-variant">{line.variantName}</div>
                </td>
                <td className="inv-td-qty">{line.qty}</td>
                <td className="inv-td-price">{fmt(line.price)}</td>
                <td className="inv-td-sub">{fmt(line.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="inv-totals">
          <div className="inv-totals-inner">
            <div className="inv-total-row">
              <span>Tiền hàng</span>
              <span>{fmt(subtotal)}</span>
            </div>
            {shipFee > 0 && (
              <div className="inv-total-row">
                <span>Phí vận chuyển</span>
                <span>{fmt(shipFee)}</span>
              </div>
            )}
            {discount > 0 && (
              <div className="inv-total-row inv-total-discount">
                <span>Giảm giá</span>
                <span>−{fmt(discount)}</span>
              </div>
            )}
            <div className="inv-total-divider" />
            <div className="inv-total-row inv-total-grand">
              <span>TỔNG CỘNG</span>
              <span>{fmt(total)}</span>
            </div>
          </div>
        </div>

        {/* Note */}
        {note && (
          <div className="inv-note">
            <span className="inv-note-label">Ghi chú: </span>
            <span>{note}</span>
          </div>
        )}

        <div className="inv-divider" />

        {/* Footer */}
        <div className="inv-footer">
          <div className="inv-footer-thanks">Cảm ơn quý khách đã tin tưởng Meo Care! 🐾</div>
          <div className="inv-footer-contact">
            Liên hệ: m.me/MeoCare · Facebook: Meo Care
          </div>
          <div className="inv-footer-sig">
            <div className="inv-sig-box">
              <div className="inv-sig-label">Khách hàng ký tên</div>
              <div className="inv-sig-space" />
            </div>
            <div className="inv-sig-box">
              <div className="inv-sig-label">Người bán ký tên</div>
              <div className="inv-sig-space" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoicePrint;