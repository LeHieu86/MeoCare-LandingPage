import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { voucherKindMeta, voucherConditionText } from "../../utils/voucherBenefit";
import "../../../styles/client/voucher-picker.css";

const fmt = (n) => (Number(n) || 0).toLocaleString("vi-VN");
const fmtDate = (s) => {
    if (!s) return "";
    const d = new Date(s);
    if (isNaN(d.getTime())) return "";
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

/**
 * Bộ chọn ưu đãi kiểu Shopee: nút mở → bottom-sheet modal → card từng mã có nút "Áp dụng".
 * props:
 *   vouchers    — mảng voucher ĐÃ GỘP (groupVouchers): {id, type, title, value, count, valid_until}
 *   value       — id đang chọn (string) hoặc ""
 *   onChange    — (idString) => void  ("" = không dùng)
 *   getDiscount — (voucher) => số tiền giảm ước tính cho ngữ cảnh này (tùy chọn)
 */
export default function VoucherPicker({ vouchers = [], value = "", onChange, getDiscount }) {
    const [open, setOpen] = useState(false);
    const selected = vouchers.find((v) => String(v.id) === String(value)) || null;

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
        document.addEventListener("keydown", onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = prev;
        };
    }, [open]);

    const apply = (id) => { onChange?.(id); setOpen(false); };
    const selDiscount = selected && getDiscount ? getDiscount(selected) : 0;

    return (
        <>
            <button type="button" className={`vp-trigger ${selected ? "has-sel" : ""}`} onClick={() => setOpen(true)}>
                <span className="vp-trigger-icon">🎁</span>
                <span className="vp-trigger-main">
                    {selected ? (
                        <>
                            <span className="vp-trigger-title">
                                {selected.title}{selected.count > 1 ? ` ×${selected.count}` : ""}
                            </span>
                            <span className="vp-trigger-sub">
                                {selDiscount > 0 ? `Đã áp — giảm ${fmt(selDiscount)}đ` : "Đã áp ưu đãi"}
                            </span>
                        </>
                    ) : (
                        <>
                            <span className="vp-trigger-title muted">Chọn ưu đãi</span>
                            <span className="vp-trigger-sub">{vouchers.length} mã khả dụng</span>
                        </>
                    )}
                </span>
                <span className="vp-trigger-chevron">›</span>
            </button>

            {open && createPortal(
                <div className="vp-overlay" onClick={() => setOpen(false)}>
                    <div className="vp-sheet" onClick={(e) => e.stopPropagation()}>
                        <div className="vp-sheet-head">
                            <span className="vp-sheet-title">🎁 Chọn ưu đãi</span>
                            <button type="button" className="vp-close" onClick={() => setOpen(false)}>✕</button>
                        </div>
                        <div className="vp-sheet-body">
                            <button type="button" className={`vp-none ${!value ? "on" : ""}`} onClick={() => apply("")}>
                                <span>Không dùng ưu đãi</span>
                                {!value && <span className="vp-none-check">✓</span>}
                            </button>

                            {vouchers.length === 0 && (
                                <div className="vp-empty">Bạn chưa có ưu đãi nào dùng được cho dịch vụ này.</div>
                            )}

                            {vouchers.map((v) => {
                                const meta = voucherKindMeta(v.type);
                                const disc = getDiscount ? getDiscount(v) : 0;
                                const on = String(v.id) === String(value);
                                return (
                                    <div key={v.id} className={`vp-card ${on ? "on" : ""}`}>
                                        <div className="vp-card-left">
                                            <div className="vp-card-icon">{meta.icon}</div>
                                            <span className="vp-card-tag">{meta.tag}</span>
                                        </div>
                                        <div className="vp-card-main">
                                            <div className="vp-card-title">
                                                {v.title}
                                                {v.count > 1 && <span className="vp-card-qty">×{v.count}</span>}
                                            </div>
                                            <div className="vp-card-cond">{voucherConditionText(v)}</div>
                                            <div className="vp-card-foot">
                                                {disc > 0 && <span className="vp-card-save">Giảm ~{fmt(disc)}đ cho lịch này</span>}
                                                {v.valid_until && <span className="vp-card-exp">HSD {fmtDate(v.valid_until)}</span>}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className={`vp-apply ${on ? "on" : ""}`}
                                            onClick={() => apply(on ? "" : String(v.id))}
                                        >
                                            {on ? "Đang dùng ✓" : "Áp dụng"}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
