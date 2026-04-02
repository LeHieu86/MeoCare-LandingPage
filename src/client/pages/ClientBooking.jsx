import React, { useState, useEffect, useMemo } from "react";
import "../../styles/client/client_portal.css";

const API = import.meta.env.VITE_API_URL || "/api";
const PRICE_PER_DAY = 50000;

// ================= WRAPPER =================
const BookingWithCalendar = ({ onSuccess }) => {
    const [selectedDate, setSelectedDate] = useState(null);

    return (
        <div>
            <ScheduleTab onSelectDate={(date) => setSelectedDate(date)} />
            <BookingTab onSuccess={onSuccess} prefillDate={selectedDate} />
        </div>
    );
};

// ================= SCHEDULE (CALENDAR) =================
const ScheduleTab = ({ onSelectDate }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

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
    const calMap = {};
    calData.forEach(item => calMap[item.day] = item);

    const changeMonth = (offset) => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
        setSelectedDay(null);
        onSelectDate?.(null);
    };

    const handleSelectDay = (day) => {
        const data = calMap[day];
        if (!data || data.available === 0) return;
        const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        if (clickedDate < today) return;

        setSelectedDay(day);
        const dateString = clickedDate.toISOString().split("T")[0];
        onSelectDate?.(dateString);

        setTimeout(() => {
            document.getElementById("cp-booking-form-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 150);
    };

    const dayNames = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
    const monthNames = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
        "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];

    return (
        <div>
            <h2 className="cp-section-title">📆 Lịch phòng trống</h2>
            <p className="cp-section-sub">Chọn ngày để xem phòng trống và đặt lịch</p>

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
                                <span className="cp-calendar-month">
                                    {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                                </span>
                                <button onClick={() => changeMonth(1)}>▶</button>
                            </div>
                        </div>

                        <div className="cp-calendar-grid cp-cal-weekdays">
                            {dayNames.map(d => <div key={d} className="cp-cal-day-name">{d}</div>)}
                        </div>

                        <div className="cp-calendar-grid">
                            {Array(firstDayOfMonth).fill(null).map((_, i) => (
                                <div key={`empty-${i}`} className="cp-cal-day empty" />
                            ))}
                            {days.map(day => {
                                const data = calMap[day];
                                const isPast = new Date(currentDate.getFullYear(), currentDate.getMonth(), day) < today;
                                const isFull = data ? data.available === 0 : true;
                                const isLow = data && data.available > 0 && data.available <= 1;
                                const isToday = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).getTime() === today.getTime();
                                const selected = selectedDay === day;

                                let cls = "cp-cal-day";
                                if (isPast) cls += " past";
                                else if (isFull) cls += " avail-full";
                                else if (isLow) cls += " avail-low";
                                else cls += " avail-open";
                                if (isToday) cls += " today";
                                if (selected) cls += " selected";

                                return (
                                    <div key={day} className={cls} onClick={() => handleSelectDay(day)}>
                                        <span className="cp-cal-day-num">{day}</span>
                                        {!isPast && data && (
                                            <span className="cp-cal-avail-count">{isFull ? "Hết" : data.available}</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="cp-legend">
                            <div className="cp-legend-item">
                                <div className="cp-legend-dot" style={{ background: "rgba(134, 239, 172, 0.8)" }}></div>
                                Còn trống
                            </div>
                            <div className="cp-legend-item">
                                <div className="cp-legend-dot" style={{ background: "rgba(253, 230, 138, 0.8)" }}></div>
                                Sắp hết
                            </div>
                            <div className="cp-legend-item">
                                <div className="cp-legend-dot" style={{ background: "rgba(252, 165, 165, 0.8)" }}></div>
                                Hết phòng
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

// ================= BOOKING FORM =================
const BookingTab = ({ onSuccess, prefillDate }) => {
    const [form, setForm] = useState({
        cat_name: "", cat_breed: "", owner_name: "", owner_phone: "",
        check_in: "", check_out: "", note: ""
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (prefillDate) {
            const nextDay = new Date(prefillDate);
            nextDay.setDate(nextDay.getDate() + 1);
            const nextDayStr = nextDay.toISOString().split("T")[0];

            setForm(f => ({
                ...f,
                check_in: prefillDate,
                check_out: (!f.check_out || f.check_out <= prefillDate) ? nextDayStr : f.check_out,
            }));
        }
    }, [prefillDate]);

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async () => {
        if (!form.cat_name || !form.owner_phone || !form.check_in || !form.check_out) {
            alert("Vui lòng điền đầy đủ thông tin bắt buộc!");
            return;
        }
        if (form.check_out <= form.check_in) {
            alert("Ngày trả phải sau ngày nhận!");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch(`${API}/bookings`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...form, service: "day" }),
            });
            const data = await res.json();

            if (res.ok) {
                onSuccess?.(data.message || "🎉 Đặt lịch thành công!");
            } else {
                onSuccess?.(`❌ ${data.error || "Lỗi đặt lịch"}`, "error");
            }
        } catch {
            onSuccess?.("❌ Lỗi kết nối mạng", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const totalPrice = useMemo(() => {
        if (!form.check_in || !form.check_out || form.check_out <= form.check_in) return 0;
        const diffInMs = new Date(form.check_out).getTime() - new Date(form.check_in).getTime();
        return Math.ceil(diffInMs / (1000 * 60 * 60 * 24)) * PRICE_PER_DAY;
    }, [form.check_in, form.check_out]);

    const numDays = useMemo(() => {
        if (!form.check_in || !form.check_out || form.check_out <= form.check_in) return 0;
        return Math.ceil((new Date(form.check_out) - new Date(form.check_in)) / (1000 * 60 * 60 * 24));
    }, [form.check_in, form.check_out]);

    const formatCurrency = (amount) => amount.toLocaleString("vi-VN");

    return (
        <div id="cp-booking-form-section">
            <h2 className="cp-section-title">📝 Thông tin đặt lịch</h2>
            <p className="cp-section-sub">Điền thông tin bé mèo và chọn ngày để hoàn tất</p>

            <div className="cp-card">
                <div className="cp-form-grid">

                    {/* Hàng 1: Tên mèo + Giống mèo */}
                    <div className="cp-field">
                        <label className="cp-label">Tên mèo *</label>
                        <input name="cat_name" className="cp-input" placeholder="Ví dụ: Miu Miu" value={form.cat_name} onChange={handleChange} />
                    </div>
                    <div className="cp-field">
                        <label className="cp-label">Giống mèo</label>
                        <input name="cat_breed" className="cp-input" placeholder="VD: Anh lông ngắn" value={form.cat_breed} onChange={handleChange} />
                    </div>

                    {/* Hàng 2: Tên chủ + SĐT */}
                    <div className="cp-field">
                        <label className="cp-label">Tên chủ nuôi *</label>
                        <input name="owner_name" className="cp-input" placeholder="Người đại diện" value={form.owner_name} onChange={handleChange} />
                    </div>
                    <div className="cp-field">
                        <label className="cp-label">Số điện thoại *</label>
                        <input name="owner_phone" className="cp-input" placeholder="SĐT Zalo để tiện liên hệ" value={form.owner_phone} onChange={handleChange} />
                    </div>

                    {/* Hàng 3: Ngày nhận + Ngày trả */}
                    <div className="cp-field">
                        <label className="cp-label">Ngày nhận 🐱</label>
                        <input name="check_in" type="date" className="cp-input" value={form.check_in} onChange={handleChange} />
                    </div>
                    <div className="cp-field">
                        <label className="cp-label">Ngày trả 🏠</label>
                        <input name="check_out" type="date" className="cp-input" value={form.check_out} min={form.check_in || undefined} onChange={handleChange} />
                    </div>

                    {/* Tổng giá — hiện khi đủ ngày */}
                    {totalPrice > 0 && (
                        <div className="cp-field span-2">
                            <div className="cp-price-summary">
                                <span className="cp-price-label">📅 Giữ {numDays} ngày</span>
                                <span className="cp-price-value">{formatCurrency(totalPrice)}đ</span>
                            </div>
                        </div>
                    )}

                    {/* Ghi chú — full width */}
                    <div className="cp-field span-2">
                        <label className="cp-label">Ghi chú</label>
                        <textarea
                            name="note"
                            className="cp-textarea"
                            placeholder="Dị ứng, thói quen, yêu cầu đặc biệt của bé..."
                            value={form.note}
                            onChange={handleChange}
                        />
                    </div>

                </div>

                <button
                    className="cp-btn cp-btn-primary cp-btn-full"
                    style={{ marginTop: 24 }}
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? <span className="cp-spinner"></span> : "🐾 Xác nhận đặt lịch"}
                </button>
            </div>
        </div>
    );
};

// ================= EXPORT =================
export default function ClientBooking() {
    const [message, setMessage] = useState("");
    const [msgType, setMsgType] = useState("success");

    const handleSuccess = (msg, type = "success") => {
        setMessage(msg);
        setMsgType(type);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    return (
        <div>
            {message && (
                <div className={`cp-alert ${msgType === "error" ? "cp-alert-error" : "cp-alert-success"}`}>
                    {message}
                </div>
            )}
            <BookingWithCalendar onSuccess={handleSuccess} />
        </div>
    );
}