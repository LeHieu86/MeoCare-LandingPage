import React, { useEffect, useState, useRef } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import QRCode from "qrcode";
import "../styles/invoice-print.css";

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const fmt = (n) => (n || 0).toLocaleString("vi-VN") + "đ";

// ── Parse PEM → ArrayBuffer ───────────────────────────────────────────────────
function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN [A-Z ]+-----/, "")
    .replace(/-----END [A-Z ]+-----/, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

// ── Ký payload bằng Web Crypto API ───────────────────────────────────────────
async function signPayload(payload, keyFile) {
  const keyPem  = await keyFile.text();
  const keyData = pemToArrayBuffer(keyPem);

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const encoded   = new TextEncoder().encode(payload);
  const sigBuffer = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, encoded);

  const sigArray = Array.from(new Uint8Array(sigBuffer));
  return btoa(String.fromCharCode(...sigArray));
}

// ── Main Component ────────────────────────────────────────────────────────────
const InvoicePrint = () => {
  const [data,        setData]        = useState(null);
  const [error,       setError]       = useState("");
  const [downloading, setDownloading] = useState(false);

  const [sigState,  setSigState]  = useState("idle");
  const [sigInfo,   setSigInfo]   = useState(null);
  const [sigError,  setSigError]  = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");

  const paperRef  = useRef(null);
  const fileInput = useRef(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("mc_invoice_data");
      if (!raw) { setError("Không tìm thấy dữ liệu hóa đơn."); return; }
      setData(JSON.parse(raw));
    } catch {
      setError("Dữ liệu hóa đơn bị lỗi.");
    }
  }, []);

  // ── Bước 1: mở file picker ────────────────────────────────────────────────
  const handleSignClick = () => {
    setSigError("");
    fileInput.current?.click();
  };

  // ── Bước 2: chọn file → ký ───────────────────────────────────────────────
  const handleFileSelected = async (e) => {
    const keyFile = e.target.files?.[0];
    if (!keyFile) return;
    e.target.value = "";

    setSigState("signing");
    setSigError("");

    try {
      // Lấy payload từ server
      const payloadRes = await fetch(`${API_BASE}/sign/payload/${data.invoiceNo}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("mc_admin_token")}` },
      });
      if (!payloadRes.ok) throw new Error("Không lấy được payload từ server");
      const { payload } = await payloadRes.json();

      // Ký trên laptop bằng key từ USB
      const signature = await signPayload(payload, keyFile);

      // Gửi signature lên server
      const signRes = await fetch(`${API_BASE}/sign/${data.invoiceNo}`, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${localStorage.getItem("mc_admin_token")}`,
        },
        body: JSON.stringify({ signature }),
      });
      if (!signRes.ok) throw new Error("Server từ chối lưu signature");
      const result = await signRes.json();

      // Tạo QR
      const qr = await QRCode.toDataURL(result.verifyUrl, {
        width: 160, margin: 1,
        color: { dark: "#1c1917", light: "#ffffff" },
      });

      setSigInfo({ ...result, signature });
      setQrDataUrl(qr);
      setSigState("done");

    } catch (err) {
      console.error("Sign error:", err);
      setSigError(err.message || "Ký thất bại");
      setSigState("error");
    }
  };

  // ── Tải PDF ───────────────────────────────────────────────────────────────
  const handleDownloadPDF = async () => {
    if (!paperRef.current || downloading) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(paperRef.current, {
        scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false,
      });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf     = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW   = pdf.internal.pageSize.getWidth();
      const pageH   = pdf.internal.pageSize.getHeight();
      const imgH    = (canvas.height / canvas.width) * pageW;

      let posY = 0, remaining = imgH;
      while (remaining > 0) {
        pdf.addImage(imgData, "JPEG", 0, posY, pageW, imgH);
        remaining -= pageH;
        if (remaining > 0) { pdf.addPage(); posY -= pageH; }
      }
      pdf.save(`HoaDon_${data.invoiceNo || "MeoCare"}.pdf`);
    } catch (err) {
      alert("Tạo PDF thất bại: " + err.message);
    } finally {
      setDownloading(false);
    }
  };

  if (error) return (
    <div className="inv-error"><p>⚠️ {error}</p><button onClick={() => window.close()}>Đóng</button></div>
  );
  if (!data) return <div className="inv-loading">Đang tải hóa đơn...</div>;

  const { invoiceNo, createdAt, customer, lines, subtotal, shipFee, discount, total, note } = data;

  return (
    <div className="inv-root">
      {/* Hidden file input */}
      <input
        ref={fileInput}
        type="file"
        accept=".key,.pem"
        style={{ display: "none" }}
        onChange={handleFileSelected}
      />

      {/* Controls */}
      <div className="inv-controls no-print">
        <div className="inv-controls-left">
          <span className="inv-controls-title">🖨️ Hóa đơn #{invoiceNo}</span>
          <span className="inv-controls-hint">
            {sigState === "done"
              ? "✅ Đã ký số — sẵn sàng tải PDF"
              : "Cắm USB → bấm Ký số → chọn file meocare.key"}
          </span>
        </div>
        <div className="inv-controls-right">
          <select
            className="inv-size-select"
            onChange={(e) => document.documentElement.setAttribute("data-paper", e.target.value)}
            defaultValue="a4"
          >
            <option value="a4">A4 (210 × 297mm)</option>
            <option value="a5">A5 (148 × 210mm)</option>
            <option value="k80">K80 — bill cuộn (80mm)</option>
          </select>

          {sigState === "done" ? (
            <span className="inv-sign-badge">✅ Đã ký số</span>
          ) : (
            <button
              className="inv-btn-sign"
              onClick={handleSignClick}
              disabled={sigState === "signing"}
            >
              {sigState === "signing" ? "⏳ Đang ký..." :
               sigState === "error"   ? "⚠️ Ký lại"    : "🔏 Ký số"}
            </button>
          )}

          <button className="inv-btn-pdf" onClick={handleDownloadPDF} disabled={downloading}>
            {downloading ? "⏳ Đang tạo..." : "⬇️ Tải PDF"}
          </button>
          <button className="inv-btn-print" onClick={() => window.print()}>🖨️ In ngay</button>
          <button className="inv-btn-close" onClick={() => window.close()}>✕ Đóng</button>
        </div>
      </div>

      {/* Lỗi ký */}
      {sigError && (
        <div className="inv-sign-error no-print">
          ⚠️ {sigError}
          <button onClick={() => setSigError("")}>✕</button>
        </div>
      )}

      {/* Invoice paper */}
      <div className="inv-paper" ref={paperRef}>
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

        <div className="inv-totals">
          <div className="inv-totals-inner">
            <div className="inv-total-row"><span>Tiền hàng</span><span>{fmt(subtotal)}</span></div>
            {shipFee > 0 && (
              <div className="inv-total-row"><span>Phí vận chuyển</span><span>{fmt(shipFee)}</span></div>
            )}
            {discount > 0 && (
              <div className="inv-total-row inv-total-discount">
                <span>Giảm giá</span><span>−{fmt(discount)}</span>
              </div>
            )}
            <div className="inv-total-divider" />
            <div className="inv-total-row inv-total-grand">
              <span>TỔNG CỘNG</span><span>{fmt(total)}</span>
            </div>
          </div>
        </div>

        {note && (
          <div className="inv-note">
            <span className="inv-note-label">Ghi chú: </span><span>{note}</span>
          </div>
        )}

        <div className="inv-divider" />

        <div className="inv-footer">
          <div className="inv-footer-thanks">Cảm ơn quý khách đã tin tưởng Meo Care! 🐾</div>
          <div className="inv-footer-contact">Liên hệ: m.me/MeoCare · Facebook: Meo Care</div>
          <div className="inv-footer-sig">
            <div className="inv-sig-box">
              <div className="inv-sig-label">Khách hàng ký tên</div>
              <div className="inv-sig-space" />
            </div>
            <div className="inv-sig-box">
              <div className="inv-sig-label">Người bán ký tên</div>
              {sigState === "done" && sigInfo ? (
                <div className="inv-digital-sig">
                  <img src={qrDataUrl} alt="QR xác thực" className="inv-sig-qr" />
                  <div className="inv-sig-meta">
                    <div className="inv-sig-verified">🔏 Đã ký số</div>
                    <div className="inv-sig-date">
                      {new Date(sigInfo.signedAt).toLocaleString("vi-VN")}
                    </div>
                    <div className="inv-sig-hash">{sigInfo.signature.slice(0, 24)}...</div>
                    <div className="inv-sig-scan">Quét QR để xác thực</div>
                  </div>
                </div>
              ) : (
                <div className="inv-sig-space" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoicePrint;