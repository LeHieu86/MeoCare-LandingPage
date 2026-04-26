import React, { useState, useEffect, useMemo, useRef } from "react";
import "../../../styles/client/client_portal.css";

const API = import.meta.env.VITE_API_URL || "/api";

// ================= UTILITIES =================
const calculatePrice = (checkIn, checkOut) => {
    if (!checkIn || !checkOut || checkOut <= checkIn) return { days: 0, totalPrice: 0, unitPrice: 0 };
    const diffInMs = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    const days = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));
    const unitPrice = days === 1 ? 70000 : 50000;
    return { days, totalPrice: days * unitPrice, unitPrice };
};

const formatCurrency = (amount) => amount.toLocaleString("vi-VN");

// ================= STEP PROGRESS =================
const StepProgress = ({ current }) => {
    const steps = [
        { label: "Chọn ngày", icon: "📅" },
        { label: "Thông tin", icon: "📋" },
        { label: "Xác nhận", icon: "✅" },
    ];
    return (
        <div className="cp-step-progress">
            {steps.map((s, i) => {
                const num = i + 1;
                const state = num < current ? "done" : num === current ? "active" : "";
                return (
                    <div key={i} className={`cp-step-item ${state}`}>
                        <div className="cp-step-dot">
                            {num < current ? "✓" : s.icon}
                        </div>
                        <span className="cp-step-label">{s.label}</span>
                    </div>
                );
            })}
        </div>
    );
};

// ================= SIGNATURE PAD COMPONENT =================
const SignaturePad = ({ onSave, onClear, hasSig }) => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasContent, setHasContent] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        ctx.strokeStyle = "#1e3a8a";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
    }, []);

    const getPos = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const startDraw = (e) => {
        setIsDrawing(true);
        setHasContent(true);
        const ctx = canvasRef.current.getContext('2d');
        const { x, y } = getPos(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        const ctx = canvasRef.current.getContext('2d');
        const { x, y } = getPos(e);
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDraw = () => {
        if (!isDrawing) return;
        setIsDrawing(false);
        if (canvasRef.current) {
            const dataUrl = canvasRef.current.toDataURL("image/png");
            onSave(dataUrl);
        }
    };

    const handleClear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasContent(false);
        onClear(null);
    };

    return (
        <div className={`cp-sig-wrap ${hasContent ? 'has-sig' : ''}`}>
            {!hasContent && (
                <div className="cp-sig-placeholder">
                    <span>✍️</span>
                    <p>Vẽ chữ ký của bạn tại đây</p>
                </div>
            )}
            <canvas
                ref={canvasRef}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={stopDraw}
                onMouseLeave={stopDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={stopDraw}
                style={{ display: 'block', width: '100%', height: 180, cursor: 'crosshair', touchAction: 'none' }}
            />
            {hasContent && (
                <button type="button" className="cp-sig-clear" onClick={handleClear}>
                    ✕ Xóa ký
                </button>
            )}
        </div>
    );
};

// ================= MAIN CONTROLLER =================
export default function ClientBooking({ onSuccess }) {
    const [step, setStep] = useState(1);
    const [bookingData, setBookingData] = useState({
        check_in: "",
        check_out: "",
        cat_name: "",
        cat_breed: "",
        owner_name: "",
        owner_phone: "",
        note: ""
    });
    const [signature, setSignature] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleDateRangeSelect = ({ start, end }) => {
        setBookingData(prev => ({ ...prev, check_in: start, check_out: end }));
        setStep(2);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleInputChange = (e) => {
        setBookingData({ ...bookingData, [e.target.name]: e.target.value });
    };

    const handleStep2Next = () => {
        const { cat_name, owner_name, owner_phone, check_in, check_out } = bookingData;
        if (!cat_name || !owner_name || !owner_phone || !check_in || !check_out) {
            return alert("Vui lòng điền đầy đủ thông tin có dấu *!");
        }
        if (check_out <= check_in) return alert("Ngày trả phải sau ngày nhận!");
        setStep(3);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSubmit = async () => {
        if (!signature) return alert("Vui lòng ký tên vào hợp đồng để xác nhận!");
        setIsSubmitting(true);
        try {
            const res = await fetch(`${API}/bookings`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...bookingData,
                    service: "day",
                    signature: signature,
                    contract_status: 'signed'
                })
            });

            const data = await res.json();
            if (res.ok) onSuccess?.(data.message || "🎉 Đặt lịch thành công!");
            else onSuccess?.(`❌ ${data.error || "Lỗi đặt lịch"}`, "error");
        } catch { onSuccess?.("❌ Lỗi kết nối mạng", "error"); } finally { setIsSubmitting(false); }
    };

    return (
        <div>
            <StepProgress current={step} />

            {step === 1 && <Step1Calendar onSelectDateRange={handleDateRangeSelect} />}

            {step === 2 && (
                <Step2InfoForm
                    data={bookingData}
                    onChange={handleInputChange}
                    onBack={() => setStep(1)}
                    onNext={handleStep2Next}
                />
            )}

            {step === 3 && (
                <Step3Review
                    data={bookingData}
                    signature={signature}
                    setSignature={setSignature}
                    onBack={() => setStep(2)}
                    onSubmit={handleSubmit}
                    isSubmitting={isSubmitting}
                />
            )}
        </div>
    );
}

// ================= STEP 1 =================
const Step1Calendar = ({ onSelectDateRange }) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
    const [calData, setCalData] = useState([]);
    const [rangeStart, setRangeStart] = useState(null);
    const [rangeEnd, setRangeEnd] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(true);
        fetch(`${API}/bookings/calendar?year=${currentDate.getFullYear()}&month=${currentDate.getMonth() + 1}`)
            .then(r => r.json())
            .then(d => { setCalData(Array.isArray(d) ? d : []); setIsLoading(false); })
            .catch(() => setIsLoading(false));
    }, [currentDate]);

    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const calMap = {}; calData.forEach(item => calMap[item.day] = item);

    const changeMonth = (offset) => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
        setRangeStart(null);
        setRangeEnd(null);
    };

    const formatDate = (dateObj) => {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const handleDayClick = (day) => {
        const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        if (clickedDate < today) return;

        const dayData = calMap[day];
        if (dayData && dayData.available === 0 && (!rangeStart || formatDate(clickedDate) < rangeStart)) {
            return alert("Ngày này đã hết phòng, vui lòng chọn ngày khác!");
        }

        const dateStr = formatDate(clickedDate);

        if (!rangeStart || (rangeStart && rangeEnd)) {
            setRangeStart(dateStr);
            setRangeEnd(null);
        } else if (rangeStart && !rangeEnd) {
            if (dateStr < rangeStart) {
                setRangeStart(dateStr);
            } else {
                setRangeEnd(dateStr);
            }
        }
    };

    const handleConfirmRange = () => {
        if (!rangeStart || !rangeEnd) return alert("Vui lòng chọn khoảng thời gian (Ngày gửi và Ngày trả)!");
        onSelectDateRange({ start: rangeStart, end: rangeEnd });
    };

    const diffDays = rangeStart && rangeEnd
        ? Math.ceil((new Date(rangeEnd) - new Date(rangeStart)) / (1000 * 60 * 60 * 24))
        : 0;

    const dayNames = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
    const monthNames = ["Tháng 1","Tháng 2","Tháng 3","Tháng 4","Tháng 5","Tháng 6","Tháng 7","Tháng 8","Tháng 9","Tháng 10","Tháng 11","Tháng 12"];

    return (
        <div>
            <h2 className="cp-section-title">Chọn ngày gửi & trả 📅</h2>
            <p className="cp-section-sub">Chạm vào ngày bắt đầu, sau đó chọn ngày kết thúc</p>
            <div className="cp-card">
                {isLoading ? (
                    <div className="cp-loading">
                        <div className="cp-loading-spinner"></div>
                        <p>Đang tải lịch...</p>
                    </div>
                ) : (
                    <>
                        <div className="cp-calendar-header">
                            <div className="cp-calendar-nav">
                                <button onClick={() => changeMonth(-1)}>◀</button>
                                <span className="cp-calendar-month">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
                                <button onClick={() => changeMonth(1)}>▶</button>
                            </div>
                        </div>

                        <div className="cp-cal-weekdays">
                            {dayNames.map(d => <div key={d} className="cp-cal-day-name">{d}</div>)}
                        </div>

                        <div className="cp-calendar-grid">
                            {Array(firstDayOfMonth).fill(null).map((_, i) => <div key={`empty-${i}`} className="cp-cal-day empty" />)}
                            {days.map(day => {
                                const data = calMap[day];
                                const currentDateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                const isPast = new Date(currentDate.getFullYear(), currentDate.getMonth(), day) < today;
                                const isFull = data ? data.available === 0 : true;
                                const isToday = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).getTime() === today.getTime();
                                const isStart = rangeStart === currentDateStr;
                                const isEnd = rangeEnd === currentDateStr;
                                const inRange = rangeStart && rangeEnd && currentDateStr > rangeStart && currentDateStr < rangeEnd;

                                let cls = "cp-cal-day";
                                if (isPast) cls += " past";
                                else if (isFull) cls += " avail-full";
                                else cls += " avail-open";
                                if (isToday) cls += " today";

                                let style = {};
                                if (isStart || isEnd) {
                                    style = {
                                        background: '#2563eb',
                                        color: '#fff',
                                        fontWeight: 'bold',
                                        borderRadius: '50%',
                                        transform: 'scale(1.12)',
                                        boxShadow: '0 4px 10px rgba(37,99,235,0.4)',
                                        border: 'none',
                                    };
                                } else if (inRange) {
                                    style = { background: '#dbeafe', color: '#1e40af', fontWeight: 'bold' };
                                }

                                return (
                                    <div key={day} className={cls} style={style} onClick={() => handleDayClick(day)}>
                                        <span className="cp-cal-day-num">{day}</span>
                                        {!isPast && !isStart && !isEnd && !inRange && data && (
                                            <span className="cp-cal-avail-count">{isFull ? "Hết" : data.available}</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {rangeStart && rangeEnd && (
                            <div className="cp-range-bar">
                                <div>
                                    <div className="cp-range-text">📅 {rangeStart} → {rangeEnd}</div>
                                </div>
                                <span className="cp-range-days">{diffDays} ngày</span>
                            </div>
                        )}

                        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                className="cp-btn cp-btn-primary"
                                onClick={handleConfirmRange}
                                disabled={!rangeStart || !rangeEnd}
                                style={{ opacity: (!rangeStart || !rangeEnd) ? 0.45 : 1 }}
                            >
                                Tiếp theo →
                            </button>
                        </div>

                        <div className="cp-legend">
                            <div className="cp-legend-item">
                                <div className="cp-legend-dot" style={{ background: "rgba(134,239,172,0.8)" }}></div>Còn trống
                            </div>
                            <div className="cp-legend-item">
                                <div className="cp-legend-dot" style={{ background: "rgba(253,230,138,0.8)" }}></div>Sắp hết
                            </div>
                            <div className="cp-legend-item">
                                <div className="cp-legend-dot" style={{ background: "rgba(252,165,165,0.8)" }}></div>Hết phòng
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

// ================= STEP 2 =================
const Step2InfoForm = ({ data, onChange, onBack, onNext }) => {
    const pricing = useMemo(() => calculatePrice(data.check_in, data.check_out), [data.check_in, data.check_out]);

    return (
        <div>
            <div className="cp-step-topbar">
                <h2 className="cp-section-title">Thông tin đặt lịch 📋</h2>
                <button className="cp-btn cp-btn-outline" onClick={onBack}>← Quay lại</button>
            </div>

            <div className="cp-card">
                <div className="cp-price-info">
                    💡 1 ngày: <strong>70.000đ</strong> &nbsp;|&nbsp; Từ 2 ngày: <strong>50.000đ/ngày</strong>
                </div>

                <div className="cp-form-grid">
                    <div className="cp-field">
                        <label className="cp-label">Ngày nhận 🐱</label>
                        <input name="check_in" type="date" className="cp-input" value={data.check_in} disabled />
                    </div>
                    <div className="cp-field">
                        <label className="cp-label">Ngày trả 🏠</label>
                        <input name="check_out" type="date" className="cp-input" value={data.check_out} disabled />
                    </div>

                    <div className="cp-field">
                        <label className="cp-label">Tên mèo *</label>
                        <input name="cat_name" className="cp-input" placeholder="Ví dụ: Miu Miu" value={data.cat_name} onChange={onChange} />
                    </div>
                    <div className="cp-field">
                        <label className="cp-label">Giống mèo</label>
                        <input name="cat_breed" className="cp-input" placeholder="VD: Anh lông ngắn" value={data.cat_breed} onChange={onChange} />
                    </div>

                    <div className="cp-field">
                        <label className="cp-label">Tên chủ nuôi *</label>
                        <input name="owner_name" className="cp-input" placeholder="Người đại diện" value={data.owner_name} onChange={onChange} />
                    </div>
                    <div className="cp-field">
                        <label className="cp-label">Số điện thoại *</label>
                        <input name="owner_phone" className="cp-input" placeholder="SĐT Zalo" value={data.owner_phone} onChange={onChange} inputMode="tel" />
                    </div>

                    {pricing.totalPrice > 0 && (
                        <div className="cp-field span-2">
                            <div className="cp-price-summary">
                                <span className="cp-price-label">📅 {pricing.days} ngày × {formatCurrency(pricing.unitPrice)}đ</span>
                                <span className="cp-price-value">{formatCurrency(pricing.totalPrice)}đ</span>
                            </div>
                        </div>
                    )}

                    <div className="cp-field span-2">
                        <label className="cp-label">Ghi chú</label>
                        <textarea name="note" className="cp-textarea" placeholder="Dị ứng, thói quen ăn uống, yêu cầu đặc biệt..." value={data.note} onChange={onChange} />
                    </div>
                </div>

                <div style={{ marginTop: 22, display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="cp-btn cp-btn-primary" onClick={onNext}>
                        Xem hợp đồng & Ký →
                    </button>
                </div>
            </div>
        </div>
    );
};

// ================= STEP 3 =================
const Step3Review = ({ data, signature, setSignature, onBack, onSubmit, isSubmitting }) => {
    const pricing = useMemo(() => calculatePrice(data.check_in, data.check_out), [data.check_in, data.check_out]);

    return (
        <div>
            <div className="cp-step-topbar">
                <h2 className="cp-section-title">Xác nhận & Ký 📝</h2>
                <button className="cp-btn cp-btn-outline" onClick={onBack}>← Quay lại</button>
            </div>

            <div className="cp-card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Invoice */}
                <div className="cp-invoice">
                    <div className="cp-invoice-header">
                        <span className="cp-invoice-title">🧾 Hóa đơn tạm tính</span>
                        <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>MeoMeoCare</span>
                    </div>
                    <div className="cp-invoice-body">
                        <div className="cp-invoice-row">
                            <span>Khách hàng</span>
                            <strong>{data.owner_name}</strong>
                        </div>
                        <div className="cp-invoice-row">
                            <span>Số điện thoại</span>
                            <strong>{data.owner_phone}</strong>
                        </div>
                        <div className="cp-invoice-row">
                            <span>Bé mèo</span>
                            <strong>{data.cat_name}{data.cat_breed ? ` (${data.cat_breed})` : ''}</strong>
                        </div>
                        <div className="cp-invoice-row">
                            <span>Ngày nhận</span>
                            <strong>{data.check_in}</strong>
                        </div>
                        <div className="cp-invoice-row">
                            <span>Ngày trả</span>
                            <strong>{data.check_out}</strong>
                        </div>
                        <div className="cp-invoice-row">
                            <span>Dịch vụ ({pricing.days} ngày × {formatCurrency(pricing.unitPrice)}đ)</span>
                            <strong>{formatCurrency(pricing.totalPrice)}đ</strong>
                        </div>
                    </div>
                    <div className="cp-invoice-total">
                        <span>Tổng thanh toán</span>
                        <span className="cp-invoice-total-amount">{formatCurrency(pricing.totalPrice)}đ</span>
                    </div>
                </div>
            </div>

            <div className="cp-card">
                {/* Contract */}
                <div className="cp-contract">
                    <h3>📜 Hợp đồng gửi thú cưng</h3>
                    <p>
                        Tôi, ông/bà <strong>{data.owner_name}</strong>, điện thoại <strong>{data.owner_phone}</strong>, xin gửi bé mèo
                        {" "}<strong>{data.cat_name}</strong>{data.cat_breed ? ` (${data.cat_breed})` : ''} tại MeoCare từ ngày{" "}
                        <strong>{data.check_in}</strong> đến ngày <strong>{data.check_out}</strong>.
                        <br /><br />
                        Tôi đồng ý với các quy định của cửa hàng về chăm sóc, giá cước và chịu trách nhiệm về tính chính xác của thông tin đã cung cấp.
                    </p>
                </div>

                {/* Signature */}
                <div style={{ marginBottom: 22 }}>
                    <label className="cp-label" style={{ marginBottom: 6, display: 'block' }}>
                        Chữ ký khách hàng *
                    </label>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-light)', marginBottom: 10 }}>
                        Dùng ngón tay hoặc chuột để ký vào khung bên dưới
                    </p>
                    <SignaturePad
                        onSave={setSignature}
                        onClear={() => setSignature(null)}
                        hasSig={!!signature}
                    />
                    {signature && (
                        <p style={{ fontSize: '0.78rem', color: '#2d7a5a', fontWeight: 700, marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                            ✅ Đã ký xác nhận
                        </p>
                    )}
                </div>

                <button
                    className="cp-btn cp-btn-primary cp-btn-full"
                    onClick={onSubmit}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? <><span className="cp-spinner"></span> Đang gửi...</> : "🐾 Xác nhận Đặt Lịch"}
                </button>
            </div>
        </div>
    );
};