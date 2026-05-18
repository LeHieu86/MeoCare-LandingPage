import React, { useState } from "react";
import { VN_BANKS, vietQrUrl } from "../../client/utils/bankList";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

/**
 * RefundFlowModal
 *  - mode "cancel-paid"  : admin hủy đơn paid → cần nhập STK + reason + tạo QR + upload biên lai
 *  - mode "refund-only"  : đơn đã ở refund_pending (khách hủy) → show QR từ snapshot + upload biên lai
 *
 * Workflow chung:
 *   Step 1: Form input (reason + STK nếu cần)
 *   Step 2: Hiện VietQR + hướng dẫn quét
 *   Step 3: Nhập tx_ref + upload biên lai → confirm
 */
const RefundFlowModal = ({ order, mode = "refund-only", onClose, onDone }) => {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  // Step 1 inputs
  const [reason, setReason] = useState("Hết hàng");
  const [customReason, setCustomReason] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankHolder, setBankHolder] = useState("");

  // Step 3 inputs
  const [txRef, setTxRef] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  // Khi mode = "refund-only", lấy thông tin STK đã snapshot trong order
  const refundBank = mode === "refund-only" ? {
    name: order.refund_bank_name,
    account: order.refund_bank_account,
    holder: order.refund_bank_holder,
    bin: order.refund_bank_bin,
  } : null;

  const cancelReason = order.cancel_reason || "";

  // Step 1 → Step 2: validate input
  const goToQR = () => {
    setErr("");
    if (mode === "cancel-paid") {
      const finalReason = reason === "Khác" ? customReason.trim() : reason;
      if (!finalReason) { setErr("Chọn lý do hủy"); return; }
      const bank = VN_BANKS.find(b => b.code === bankCode);
      if (!bank) { setErr("Chọn ngân hàng"); return; }
      if (!/^\d{6,20}$/.test(bankAccount.trim())) { setErr("STK phải là 6-20 chữ số"); return; }
      if (!bankHolder.trim()) { setErr("Nhập tên chủ TK"); return; }
    }
    setStep(2);
  };

  // QR data
  const qrBin = mode === "refund-only" ? refundBank?.bin : VN_BANKS.find(b => b.code === bankCode)?.bin;
  const qrAccount = mode === "refund-only" ? refundBank?.account : bankAccount.trim();
  const qrHolder = mode === "refund-only" ? refundBank?.holder : bankHolder.trim();
  const qrUrl = vietQrUrl({
    bin: qrBin,
    account: qrAccount,
    amount: order.total,
    memo: `Hoan tien ${order.invoice_no}`,
  });

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("image", file);
      const token = localStorage.getItem("mc_admin_token");
      const res = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const data = await res.json();
      if (data.success && data.url) setProofUrl(data.url);
      else setErr(data.message || "Upload thất bại");
    } catch {
      setErr("Lỗi upload");
    } finally {
      setUploading(false);
    }
  };

  const handleConfirm = async () => {
    if (!txRef.trim()) { setErr("Nhập mã giao dịch"); return; }
    if (!proofUrl) { setErr("Upload ảnh biên lai"); return; }
    setSubmitting(true);
    setErr("");

    try {
      // Nếu mode = cancel-paid → cancel trước
      if (mode === "cancel-paid") {
        const bank = VN_BANKS.find(b => b.code === bankCode);
        const finalReason = reason === "Khác" ? customReason.trim() : reason;
        const cancelRes = await fetch(`${API_BASE}/orders/${order.id}/cancel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: finalReason,
            by: "admin",
            refund_account: {
              bank_name: bank.name,
              bank_account: bankAccount.trim(),
              bank_holder: bankHolder.trim().toUpperCase(),
              bank_bin: bank.bin,
            },
          }),
        });
        const cancelData = await cancelRes.json();
        if (!cancelData.success) { setErr(cancelData.message); setSubmitting(false); return; }
      }

      // Confirm refund
      const refundRes = await fetch(`${API_BASE}/orders/${order.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tx_ref: txRef.trim(), proof_url: proofUrl }),
      });
      const refundData = await refundRes.json();
      if (!refundData.success) { setErr(refundData.message); setSubmitting(false); return; }

      onDone(refundData.order);
    } catch {
      setErr("Lỗi kết nối");
      setSubmitting(false);
    }
  };

  return (
    <div className="ord-modal-backdrop" onClick={onClose}>
      <div className="ord-modal" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
        <div className="ord-modal-header">
          <div>
            <div className="ord-modal-title">
              {mode === "cancel-paid" ? "❌ Hủy đơn + Hoàn tiền" : "💰 Hoàn tiền cho khách"}
            </div>
            <div className="ord-modal-sub">#{order.invoice_no} · {order.total.toLocaleString("vi-VN")}đ</div>
          </div>
          <button className="ord-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="ord-modal-body">
          {/* Steps indicator */}
          <div className="rf-steps">
            <div className={`rf-step ${step >= 1 ? "active" : ""}`}>1. Thông tin</div>
            <div className={`rf-step ${step >= 2 ? "active" : ""}`}>2. Quét QR</div>
            <div className={`rf-step ${step >= 3 ? "active" : ""}`}>3. Xác nhận</div>
          </div>

          {/* STEP 1: Form */}
          {step === 1 && (
            <div className="rf-section">
              {mode === "cancel-paid" ? (
                <>
                  <label className="rf-label">Lý do hủy</label>
                  <div className="rf-radio-list">
                    {["Hết hàng", "Shop tạm nghỉ", "Không liên hệ được khách", "Khác"].map(r => (
                      <label key={r} className={`rf-radio ${reason === r ? "active" : ""}`}>
                        <input type="radio" checked={reason === r} onChange={() => setReason(r)} />
                        <span>{r}</span>
                      </label>
                    ))}
                  </div>
                  {reason === "Khác" && (
                    <textarea
                      className="rf-input" rows={2}
                      placeholder="Lý do cụ thể..."
                      value={customReason} onChange={(e) => setCustomReason(e.target.value)}
                    />
                  )}

                  <div className="rf-divider" />
                  <label className="rf-label">Tài khoản nhận hoàn tiền (lấy từ khách qua điện thoại)</label>
                  <select className="rf-input" value={bankCode} onChange={(e) => setBankCode(e.target.value)}>
                    <option value="">— Chọn ngân hàng —</option>
                    {VN_BANKS.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
                  </select>
                  <input
                    className="rf-input" type="text" inputMode="numeric"
                    placeholder="Số tài khoản"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value.replace(/\D/g, ""))}
                  />
                  <input
                    className="rf-input" type="text"
                    placeholder="Tên chủ TK (IN HOA)"
                    value={bankHolder}
                    onChange={(e) => setBankHolder(e.target.value)}
                    style={{ textTransform: "uppercase" }}
                  />
                </>
              ) : (
                <div className="rf-info-block">
                  <div className="rf-info-row"><span>Lý do khách hủy</span><strong>{cancelReason}</strong></div>
                  <div className="rf-info-row"><span>Ngân hàng</span><strong>{refundBank?.name}</strong></div>
                  <div className="rf-info-row"><span>Số tài khoản</span><strong>{refundBank?.account}</strong></div>
                  <div className="rf-info-row"><span>Chủ tài khoản</span><strong>{refundBank?.holder}</strong></div>
                </div>
              )}
              {err && <div className="rf-error">{err}</div>}
            </div>
          )}

          {/* STEP 2: QR */}
          {step === 2 && (
            <div className="rf-section rf-qr-section">
              {qrUrl ? (
                <>
                  <p style={{ fontSize: 13, color: "var(--adm-text-2)", marginTop: 0 }}>
                    Mở app ngân hàng → quét QR → chuyển khoản. <br/>
                    Nội dung sẽ tự fill: <code>Hoan tien {order.invoice_no}</code>
                  </p>
                  <img src={qrUrl} alt="VietQR" className="rf-qr-img" />
                  <div className="rf-qr-meta">
                    <div><strong>{qrAccount}</strong></div>
                    <div>{qrHolder}</div>
                    <div style={{ color: "#dc2626", fontWeight: 700, fontSize: 18 }}>
                      {order.total.toLocaleString("vi-VN")}đ
                    </div>
                  </div>
                </>
              ) : (
                <div className="rf-error">Không tạo được QR — kiểm tra lại STK</div>
              )}
            </div>
          )}

          {/* STEP 3: Confirm */}
          {step === 3 && (
            <div className="rf-section">
              <label className="rf-label">Mã giao dịch (lấy từ app ngân hàng sau khi chuyển)</label>
              <input
                className="rf-input" type="text"
                placeholder="FT2026..."
                value={txRef} onChange={(e) => setTxRef(e.target.value)}
              />
              <label className="rf-label">Ảnh biên lai chuyển khoản</label>
              {proofUrl ? (
                <div className="rf-proof-preview">
                  <img src={proofUrl} alt="proof" />
                  <button className="rf-remove-btn" onClick={() => setProofUrl("")}>✕ Đổi ảnh</button>
                </div>
              ) : (
                <label className="rf-upload">
                  <input type="file" accept="image/*" onChange={handleUpload} hidden />
                  {uploading ? "⏳ Đang upload..." : "📷 Chọn ảnh biên lai"}
                </label>
              )}
              {err && <div className="rf-error">{err}</div>}
            </div>
          )}

          {/* Footer actions */}
          <div className="rf-actions">
            {step > 1 && (
              <button className="adm-btn-ghost" onClick={() => setStep(step - 1)} disabled={submitting}>
                ← Quay lại
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button className="adm-btn-ghost" onClick={onClose} disabled={submitting}>Đóng</button>
            {step === 1 && <button className="adm-btn-primary" onClick={goToQR}>Tiếp →</button>}
            {step === 2 && <button className="adm-btn-primary" onClick={() => setStep(3)}>Đã chuyển khoản →</button>}
            {step === 3 && (
              <button
                className="adm-btn-primary"
                style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}
                onClick={handleConfirm}
                disabled={submitting}
              >
                {submitting ? "Đang xử lý..." : "✓ Xác nhận hoàn tiền"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RefundFlowModal;
