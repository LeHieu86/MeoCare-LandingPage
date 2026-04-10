import React, { useState, useEffect, useMemo, useRef } from "react";
import "../../styles/client/client_portal.css";

const API = import.meta.env.VITE_API_URL || "/api";

// ... (Giữ nguyên hàm calculatePrice) ...
const calculatePrice = (checkIn, checkOut) => {
    if (!checkIn || !checkOut || checkOut <= checkIn) return { days: 0, totalPrice: 0, unitPrice: 0 };
    const diffInMs = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    const days = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));
    const unitPrice = days === 1 ? 70000 : 50000;
    return { days, totalPrice: days * unitPrice, unitPrice };
};

// ================= SIGNATURE PAD COMPONENT =================
// Component vẽ chữ ký đơn giản
const SignaturePad = ({ onSave, onClear }) => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        // Set kích thước canvas đúng với pixel để tránh mờ
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
    }, []);

    const getPos = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const startDraw = (e) => {
        e.preventDefault();
        setIsDrawing(true);
        const ctx = canvasRef.current.getContext('2d');
        const { x, y } = getPos(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        e.preventDefault();
        const ctx = canvasRef.current.getContext('2d');
        const { x, y } = getPos(e);
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDraw = () => setIsDrawing(false);

    const handleSave = () => {
        if (canvasRef.current) {
            const dataUrl = canvasRef.current.toDataURL("image/png");
            onSave(dataUrl);
        }
    };

    const handleClear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        onClear(null);
    };

    return (
        <div style={{ border: '1px dashed #ccc', borderRadius: 8, overflow: 'hidden', background: '#fff', position: 'relative' }}>
            <canvas
                ref={canvasRef}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={stopDraw}
                onMouseLeave={stopDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={stopDraw}
                style={{ display: 'block', width: '100%', height: 200, cursor: 'crosshair' }}
            />
            <div style={{ position: 'absolute', bottom: 10, right: 10, display: 'flex', gap: 8 }}>
                <button type="button" onClick={handleClear} style={{ padding: '4px 8px', fontSize: 12, background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: 4 }}>Xóa ký</button>
            </div>
        </div>
    );
};

// ================= BOOKING FORM (UPDATED) =================
const BookingTab = ({ onSuccess, prefillDate }) => {
    const [step, setStep] = useState(1); // 1: Nhập thông tin, 2: Ký hợp đồng
    const [form, setForm] = useState({ cat_name: "", cat_breed: "", owner_name: "", owner_phone: "", check_in: "", check_out: "", note: "" });
    const [signature, setSignature] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // ... (Giữ nguyên useEffect prefillDate) ...
    useEffect(() => {
        if (prefillDate) {
            const nextDay = new Date(prefillDate); nextDay.setDate(nextDay.getDate() + 1);
            setForm(f => ({ ...f, check_in: prefillDate, check_out: (!f.check_out || f.check_out <= prefillDate) ? nextDay.toISOString().split("T")[0] : f.check_out }));
        }
    }, [prefillDate]);

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    // Xử lý khi bấm "Tiếp tục" (Chuyển sang bước ký)
    const handleNextStep = () => {
        if (!form.cat_name || !form.owner_name || !form.owner_phone || !form.check_in || !form.check_out) {
            return alert("Vui lòng điền đầy đủ thông tin có dấu *!");
        }
        if (form.check_out <= form.check_in) return alert("Ngày trả phải sau ngày nhận!");
        setStep(2);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Xử lý khi bấm "Xác nhận đặt lịch" (Gửi API)
    const handleSubmit = async () => {
        if (!signature) return alert("Vui lòng ký tên vào hợp đồng để xác nhận!");
        
        setIsSubmitting(true);
        try {
            // Gửi kèm dữ liệu signature (chuỗi base64)
            const res = await fetch(`${API}/bookings`, { 
                method: "POST", 
                headers: { "Content-Type": "application/json" }, 
                body: JSON.stringify({ 
                    ...form, 
                    service: "day",
                    signature: signature, 
                    contract_status: 'signed' // Set sẵn là signed
                }) 
            });
            
            const data = await res.json();
            if (res.ok) onSuccess?.(data.message || "🎉 Đặt lịch thành công!");
            else onSuccess?.(`❌ ${data.error || "Lỗi đặt lịch"}`, "error");
        } catch { onSuccess?.("❌ Lỗi kết nối mạng", "error"); } finally { setIsSubmitting(false); }
    };

    const pricing = useMemo(() => calculatePrice(form.check_in, form.check_out), [form.check_in, form.check_out]);
    const formatCurrency = (amount) => amount.toLocaleString("vi-VN");

    // === BƯỚC 1: NHẬP THÔNG TIN ===
    if (step === 1) {
        return (
            <div id="cp-booking-form-section">
                <h2 className="cp-section-title">📝 Thông tin đặt lịch (Bước 1/2)</h2>
                <p className="cp-section-sub">Điền thông tin bé mèo và chọn ngày</p>
                <div className="cp-card">
                    <div className="cp-form-grid">
                        <div className="cp-field"><label className="cp-label">Tên mèo *</label><input name="cat_name" className="cp-input" placeholder="Ví dụ: Miu Miu" value={form.cat_name} onChange={handleChange} /></div>
                        <div className="cp-field"><label className="cp-label">Giống mèo</label><input name="cat_breed" className="cp-input" placeholder="VD: Anh lông ngắn" value={form.cat_breed} onChange={handleChange} /></div>
                        <div className="cp-field"><label className="cp-label">Tên chủ nuôi *</label><input name="owner_name" className="cp-input" placeholder="Người đại diện" value={form.owner_name} onChange={handleChange} /></div>
                        <div className="cp-field"><label className="cp-label">Số điện thoại *</label><input name="owner_phone" className="cp-input" placeholder="SĐT Zalo" value={form.owner_phone} onChange={handleChange} /></div>
                        <div className="cp-field"><label className="cp-label">Ngày nhận 🐱</label><input name="check_in" type="date" className="cp-input" value={form.check_in} onChange={handleChange} /></div>
                        <div className="cp-field"><label className="cp-label">Ngày trả 🏠</label><input name="check_out" type="date" className="cp-input" value={form.check_out} min={form.check_in || undefined} onChange={handleChange} /></div>
                        
                        {pricing.totalPrice > 0 && (
                            <div className="cp-field span-2">
                                <div className="cp-price-summary">
                                    <span className="cp-price-label">📅 {pricing.days} ngày x {formatCurrency(pricing.unitPrice)}đ</span>
                                    <span className="cp-price-value">{formatCurrency(pricing.totalPrice)}đ</span>
                                </div>
                            </div>
                        )}

                        <div className="cp-field span-2"><label className="cp-label">Ghi chú</label><textarea name="note" className="cp-textarea" placeholder="Dị ứng, thói quen..." value={form.note} onChange={handleChange} /></div>
                    </div>
                    
                    <div style={{ marginTop: 24, textAlign: 'right' }}>
                        <button className="cp-btn cp-btn-primary" onClick={handleNextStep}>
                            Tiếp tục: Ký hợp đồng ➡️
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // === BƯỚC 2: XEM & KÝ HỢP ĐỒNG ===
    return (
        <div id="cp-booking-contract-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 className="cp-section-title">✍️ Xác nhận & Ký hợp đồng (Bước 2/2)</h2>
                <button className="cp-btn" style={{ background: '#f3f4f6', color: '#374151' }} onClick={() => setStep(1)}>⬅️ Quay lại sửa</button>
            </div>
            
            <div className="cp-card">
                <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid #e5e7eb' }}>
                    <h3 style={{ margin: '0 0 10px', color: '#111827' }}>Hợp đồng gửi thú cưng</h3>
                    <p style={{ fontSize: 14, lineHeight: 1.6, color: '#4b5563' }}>
                        Tôi, ông/bà <strong>{form.owner_name}</strong>, điện thoại <strong>{form.owner_phone}</strong> xin gửi bé mèo 
                        <strong> {form.cat_name}</strong> ({form.cat_breed}) tại Cửa hàng từ ngày <strong>{form.check_in}</strong> đến ngày <strong>{form.check_out}</strong>.
                        <br /><br />
                        Tôi đồng ý với các quy định của cửa hàng về chăm sóc, giá cước và chịu trách nhiệm về thông tin cung cấp.
                        <br /><br />
                        <strong>Tổng tiền thanh toán dự kiến: {formatCurrency(pricing.totalPrice)}đ</strong>
                    </p>
                </div>

                <div style={{ marginBottom: 20 }}>
                    <label className="cp-label">Chữ ký của khách hàng *</label>
                    <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Vẽ chữ ký của bạn vào khung dưới đây:</p>
                    <SignaturePad 
                        onSave={setSignature} 
                        onClear={() => setSignature(null)} 
                    />
                </div>

                <button className="cp-btn cp-btn-primary cp-btn-full" onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? <span className="cp-spinner"></span> : "🐾 Xác nhận Đặt Lịch & Gửi Hợp Đồng"}
                </button>
            </div>
        </div>
    );
};

// ... (Giữ nguyên ScheduleTab và các component khác) ...
const ScheduleTab = ({ onSelectDate }) => {
    // ... (Code cũ giữ nguyên) ...
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
    const [calData, setCalData] = useState([]);
    const [selectedDay, setSelectedDay] = useState(null);
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
        setSelectedDay(null); onSelectDate?.(null);
    };

    const handleSelectDay = (day) => {
        const data = calMap[day];
        if (!data || data.available === 0) return;
        const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        if (clickedDate < today) return;
        setSelectedDay(day);
        onSelectDate?.(clickedDate.toISOString().split("T")[0]);
        setTimeout(() => document.getElementById("cp-booking-form-section")?.scrollIntoView({ behavior: "smooth" }), 150);
    };

    const dayNames = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
    const monthNames = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];

    return (
        <div>
            <h2 className="cp-section-title">📆 Lịch phòng trống</h2>
            <p className="cp-section-sub">Chọn ngày để xem phòng trống và đặt lịch</p>
            <div className="cp-card">
                {isLoading ? <div className="cp-loading"><div className="cp-loading-spinner"></div><p>Đang tải lịch...</p></div> : (
                    <>
                        <div className="cp-calendar-header">
                            <div className="cp-calendar-nav">
                                <button onClick={() => changeMonth(-1)}>◀</button>
                                <span className="cp-calendar-month">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
                                <button onClick={() => changeMonth(1)}>▶</button>
                            </div>
                        </div>
                        <div className="cp-calendar-grid cp-cal-weekdays">{dayNames.map(d => <div key={d} className="cp-cal-day-name">{d}</div>)}</div>
                        <div className="cp-calendar-grid">
                            {Array(firstDayOfMonth).fill(null).map((_, i) => <div key={`empty-${i}`} className="cp-cal-day empty" />)}
                            {days.map(day => {
                                const data = calMap[day];
                                const isPast = new Date(currentDate.getFullYear(), currentDate.getMonth(), day) < today;
                                const isFull = data ? data.available === 0 : true;
                                const isLow = data && data.available > 0 && data.available <= 1;
                                const isToday = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).getTime() === today.getTime();
                                let cls = "cp-cal-day";
                                if (isPast) cls += " past"; else if (isFull) cls += " avail-full"; else if (isLow) cls += " avail-low"; else cls += " avail-open";
                                if (isToday) cls += " today"; if (selectedDay === day) cls += " selected";
                                return (
                                    <div key={day} className={cls} onClick={() => handleSelectDay(day)}>
                                        <span className="cp-cal-day-num">{day}</span>
                                        {!isPast && data && <span className="cp-cal-avail-count">{isFull ? "Hết" : data.available}</span>}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="cp-legend">
                            <div className="cp-legend-item"><div className="cp-legend-dot" style={{ background: "rgba(134, 239, 172, 0.8)" }}></div>Còn trống</div>
                            <div className="cp-legend-item"><div className="cp-legend-dot" style={{ background: "rgba(253, 230, 138, 0.8)" }}></div>Sắp hết</div>
                            <div className="cp-legend-item"><div className="cp-legend-dot" style={{ background: "rgba(252, 165, 165, 0.8)" }}></div>Hết phòng</div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

const BookingWithCalendar = ({ onSuccess }) => {
    const [selectedDate, setSelectedDate] = useState(null);
    return (
        <div>
            <ScheduleTab onSelectDate={(date) => setSelectedDate(date)} />
            <BookingTab onSuccess={onSuccess} prefillDate={selectedDate} />
        </div>
    );
};

export default function ClientBooking({ onSuccess }) {
    return <BookingWithCalendar onSuccess={onSuccess} />;
}