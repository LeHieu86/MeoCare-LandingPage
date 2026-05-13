import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../utils/api";
import "../../../styles/client/payment-qr.css";

const POLL_INTERVAL = 5000;

const PaymentQR = () => {
    const { orderId } = useParams();
    const navigate = useNavigate();
    const [retrying, setRetrying] = useState(false);
    const [payment, setPayment] = useState(null);
    const [status, setStatus] = useState("loading");
    const [countdown, setCountdown] = useState(0);
    const [copied, setCopied] = useState("");
    const [userConfirmed, setUserConfirmed] = useState(false);
    const [checking, setChecking] = useState(false);
    const pollRef = useRef(null);

    /* ── Fetch thông tin thanh toán ── */
    useEffect(() => {
        const fetchPayment = async () => {
            try {
                const data = await api.get(`/payment/${orderId}`);
                if (data.success) {
                    setPayment(data.payment);
                    setStatus(data.payment.status);
                } else {
                    setStatus("error");
                }
            } catch {
                setStatus("error");
            }
        };
        fetchPayment();
    }, [orderId]);

    /* ── Countdown timer ── */
    useEffect(() => {
        if (!payment?.expiredAt || status !== "pending") return;

        const tick = () => {
            const remaining = Math.max(0, new Date(payment.expiredAt) - new Date());
            setCountdown(remaining);
            if (remaining <= 0) setStatus("expired");
        };

        tick();
        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, [payment?.expiredAt, status]);

    /* ── Poll trạng thái ── */
    const pollStatus = useCallback(async () => {
        try {
            const data = await api.get(`/payment/${orderId}/status`);
            if (data.success) {
                if (data.status === "paid") {
                    setStatus("paid");
                    clearInterval(pollRef.current);
                } else if (data.status === "expired") {
                    setStatus("expired");
                    clearInterval(pollRef.current);
                }
            }
        } catch { /* ignore */ }
    }, [orderId]);

    useEffect(() => {
        if (status !== "pending") return;
        pollRef.current = setInterval(pollStatus, POLL_INTERVAL);
        return () => clearInterval(pollRef.current);
    }, [status, pollStatus]);

    /* ── Copy helper ── */
    const handleCopy = (text, field) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(field);
            setTimeout(() => setCopied(""), 2000);
        });
    };

    /* ── Người dùng xác nhận đã chuyển → poll ngay ── */
    const handleUserConfirmed = async () => {
        setUserConfirmed(true);
        setChecking(true);
        try {
            const data = await api.get(`/payment/${orderId}/status`);
            if (data.success && data.status === "paid") {
                setStatus("paid");
                clearInterval(pollRef.current);
            }
        } catch { /* ignore, tiếp tục poll */ }
        finally { setChecking(false); }
    };

    // Hàm gia hạn QR (gọi API backend)
    const handleExtendQR = async () => {
        setRetrying(true);
        try {
            const data = await api.put(`/payment/${orderId}/extend`);
            if (data.success) {
                setPayment(data.payment);
                setStatus("pending");
            }
        } catch {
            alert("Không thể gia hạn. Vui lòng liên hệ cửa hàng.");
        } finally {
            setRetrying(false);
        }
    };

    const formatTime = (ms) => {
        const totalSec = Math.floor(ms / 1000);
        const min = Math.floor(totalSec / 60);
        const sec = totalSec % 60;
        return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    };

    const fmt = (n) => (n || 0).toLocaleString("vi-VN") + "đ";

    /* ══════════ RENDER ══════════ */

    if (status === "loading") {
        return (
            <div className="qr-page">
                <div className="qr-center-msg">
                    <div className="qr-spinner" />
                    <p>Đang tải thông tin thanh toán...</p>
                </div>
            </div>
        );
    }

    if (status === "error") {
        return (
            <div className="qr-page">
                <div className="qr-center-msg">
                    <div className="qr-center-icon">⚠️</div>
                    <p>Không thể tải thông tin thanh toán</p>
                    <button className="qr-btn qr-btn-primary" onClick={() => navigate("/dashboard")}>
                        Về trang chủ
                    </button>
                </div>
            </div>
        );
    }

    /* ── PAID ── */
    if (status === "paid") {
        return (
            <div className="qr-page">
                <div className="qr-result qr-result-success">
                    <div className="qr-result-icon">✅</div>
                    <h3 className="qr-result-title">Thanh toán thành công!</h3>
                    <p className="qr-result-desc">
                        Đơn hàng <strong>{payment.invoiceNo}</strong> đã được xác nhận.
                    </p>
                    <button className="qr-btn qr-btn-primary" onClick={() => navigate("/dashboard")}>
                        Xem đơn hàng
                    </button>
                </div>
            </div>
        );
    }

    /* ── EXPIRED ── */
    if (status === "expired") {
        return (
            <div className="qr-page">
                <div className="qr-result qr-result-expired">
                    <div className="qr-result-icon">⏰</div>
                    <h3 className="qr-result-title">Mã QR đã hết hạn</h3>
                    <p className="qr-result-desc">
                        Vui lòng liên hệ cửa hàng nếu bạn đã chuyển khoản.
                    </p>
                    <div className="qr-result-actions">
                        <button className="qr-btn qr-btn-ghost" onClick={() => navigate("/dashboard")}>
                            Về trang chủ
                        </button>
                        <button
                            className="qr-btn qr-btn-primary"
                            onClick={handleExtendQR}
                            disabled={retrying}
                        >
                            {retrying ? "Đang xử lý..." : "Tải lại QR"}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    /* ── PENDING — Chờ thanh toán ── */
    return (
        <div className="qr-page">
            {/* Header */}
            <div className="qr-header">
                <button className="qr-back-btn" onClick={() => navigate("/dashboard")}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                </button>
                <h3 className="qr-header-title">Thanh toán chuyển khoản</h3>
                <div style={{ width: 38 }} />
            </div>

            <div className="qr-body">
                {/* Countdown */}
                <div className="qr-countdown-bar">
                    <span className="qr-countdown-label">Thời gian còn lại</span>
                    <span className={`qr-countdown-time ${countdown < 120000 ? "urgent" : ""}`}>
                        {formatTime(countdown)}
                    </span>
                </div>

                {/* QR Code */}
                <div className="qr-card-main">
                    <div className="qr-amount-display">
                        <span className="qr-amount-label">Số tiền cần chuyển</span>
                        <span className="qr-amount-value">{fmt(payment.amount)}</span>
                    </div>

                    <div className="qr-image-wrap">
                        <img src={payment.qrUrl} alt="QR chuyển khoản" className="qr-image" />
                        <div className="qr-scanning-hint">
                            <div className="qr-scanning-dot" />
                            Đang chờ thanh toán...
                        </div>
                    </div>
                </div>

                {/* Thông tin chuyển khoản */}
                <div className="qr-card">
                    <h4 className="qr-card-title">Thông tin chuyển khoản</h4>

                    <div className="qr-info-list">
                        <div className="qr-info-row">
                            <span className="qr-info-label">Ngân hàng</span>
                            <span className="qr-info-value">{payment.bankName}</span>
                        </div>

                        <div className="qr-info-row">
                            <span className="qr-info-label">Chủ tài khoản</span>
                            <span className="qr-info-value">{payment.accountName}</span>
                        </div>

                        <div className="qr-info-row">
                            <span className="qr-info-label">Số tài khoản</span>
                            <div className="qr-info-copyable">
                                <span className="qr-info-value qr-mono">{payment.accountNo}</span>
                                <button className="qr-copy-btn" onClick={() => handleCopy(payment.accountNo, "account")}>
                                    {copied === "account" ? "✓ Đã copy" : "Copy"}
                                </button>
                            </div>
                        </div>

                        <div className="qr-info-row">
                            <span className="qr-info-label">Số tiền</span>
                            <div className="qr-info-copyable">
                                <span className="qr-info-value qr-price">{fmt(payment.amount)}</span>
                                <button className="qr-copy-btn" onClick={() => handleCopy(String(payment.amount), "amount")}>
                                    {copied === "amount" ? "✓ Đã copy" : "Copy"}
                                </button>
                            </div>
                        </div>

                        <div className="qr-info-row qr-info-highlight">
                            <span className="qr-info-label">Nội dung CK</span>
                            <div className="qr-info-copyable">
                                <span className="qr-info-value qr-mono">{payment.transferContent}</span>
                                <button className="qr-copy-btn" onClick={() => handleCopy(payment.transferContent, "content")}>
                                    {copied === "content" ? "✓ Đã copy" : "Copy"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Lưu ý */}
                <div className="qr-note">
                    <strong>Lưu ý:</strong> Nhập đúng nội dung chuyển khoản{" "}
                    <strong>{payment.transferContent}</strong> để hệ thống tự động xác nhận.
                    Không thay đổi nội dung chuyển khoản.
                </div>

                {/* Nút xác nhận đã chuyển */}
                {!userConfirmed ? (
                    <button className="qr-btn qr-btn-primary" style={{ width: "100%", marginTop: 8 }}
                        onClick={handleUserConfirmed} disabled={checking}>
                        {checking ? "Đang kiểm tra..." : "✅ Tôi đã chuyển khoản xong"}
                    </button>
                ) : (
                    <div style={{ textAlign: "center", padding: "14px 0", color: "#6b7280", fontSize: 14 }}>
                        <div style={{ marginBottom: 8 }}>
                            {checking
                                ? "⏳ Đang kiểm tra giao dịch..."
                                : "⏳ Đang chờ ngân hàng xác nhận — thường mất 1–2 phút..."}
                        </div>
                        <div style={{ fontSize: 12 }}>
                            Hệ thống tự động cập nhật mỗi 5 giây. Vui lòng không đóng trang này.
                        </div>
                        <button className="qr-btn qr-btn-ghost"
                            style={{ marginTop: 10, fontSize: 13, padding: "6px 16px" }}
                            onClick={handleUserConfirmed} disabled={checking}>
                            {checking ? "..." : "Kiểm tra lại ngay"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PaymentQR;