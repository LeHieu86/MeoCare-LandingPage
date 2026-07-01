import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../../utils/api";
import { filterVouchersForService, groupVouchers } from "../../utils/voucherBenefit";
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

// ================= SUẤT ĂN THÊM (cấu hình từ admin) =================
// Neo theo đơn giá cố định /100g × TỔNG GRAM/ngày — không có gói cứng theo cữ×size.
const DEFAULT_FOOD_OPTIONS = {
    enabled: false,
    label: "Pate tươi tự nấu",
    pricePer100g: 18000,
    mealPresets: [1, 2, 3],
    defaultMeals: 2,
    gramStep: 50,
    minGramsPerDay: 50,
    maxGramsPerDay: 600,
    sizeHints: [
        { label: "Mèo nhỏ / dưới 6 tháng", gramsPerMeal: 50 },
        { label: "Mèo trưởng thành", gramsPerMeal: 100 },
    ],
};

// Tính giá suất ăn: giống hệt công thức server (round(gram/ngày / 100 × đơn giá/100g)).
const calcFood = (cfg, choice, days) => {
    if (!cfg?.enabled || !choice?.enabled) return { gramsPerDay: 0, perDay: 0, total: 0 };
    const meals = Number(choice.meals) || 0;
    const gramsPerMeal = Number(choice.gramsPerMeal) || 0;
    const gramsPerDay = meals * gramsPerMeal;
    const perDay = Math.round((gramsPerDay / 100) * (Number(cfg.pricePer100g) || 0));
    return { gramsPerDay, perDay, total: perDay * Math.max(days, 0) };
};

// Voucher chỉ áp cho dịch vụ giữ mèo: "miễn phí N đêm" → giảm min(N, số ngày) × đơn giá/ngày,
// không vượt quá tiền phòng (không trừ vào suất ăn). Các loại khác không áp cho booking.
const VOUCHER_BOARDING_TYPE = "boarding_free_nights";
const calcVoucherDiscount = (voucher, pricing) => {
    if (!voucher || voucher.type !== VOUCHER_BOARDING_TYPE) return 0;
    const nights = Number(voucher.value?.nights) || 0;
    const freeNights = Math.min(nights, pricing.days);
    return Math.min(freeNights * pricing.unitPrice, pricing.totalPrice);
};

// "YYYY-MM-DD" → "DD/MM" (gọn cho dải tóm tắt)
const fmtShort = (s) => {
    if (!s) return "";
    const [, m, d] = s.split("-");
    return `${d}/${m}`;
};

// ================= KHUNG GIỜ NHẬN / TRẢ (cấu hình từ admin) =================
// Cấu hình mặc định nếu dịch vụ chưa có bookingHours (dữ liệu cũ). Khóa ngày = getDay() (0=CN..6=T7).
const DEFAULT_BOOKING_HOURS = {
    enabled: true,
    slotMinutes: 30,
    days: {
        0: { open: true, start: "08:00", end: "21:00" },
        1: { open: true, start: "18:00", end: "22:00" },
        2: { open: true, start: "18:00", end: "22:00" },
        3: { open: true, start: "18:00", end: "22:00" },
        4: { open: true, start: "18:00", end: "22:00" },
        5: { open: true, start: "18:00", end: "22:00" },
        6: { open: true, start: "18:00", end: "22:00" },
    },
};

const DAY_LABELS = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

// Lấy cấu hình ngày theo chuỗi "YYYY-MM-DD" (parse local để không lệch múi giờ)
const dayCfgFor = (dateStr, cfg) => {
    if (!dateStr) return null;
    const day = new Date(`${dateStr}T00:00:00`).getDay();
    return cfg?.days?.[String(day)] || cfg?.days?.[day] || null;
};

// Sinh các mốc giờ "HH:MM" từ start→end theo bước slotMinutes
const genSlots = (dateStr, cfg) => {
    const d = dayCfgFor(dateStr, cfg);
    if (!d || !d.open) return [];
    const step = cfg?.slotMinutes || 30;
    const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
    const pad = (n) => String(n).padStart(2, "0");
    const slots = [];
    for (let t = toMin(d.start); t <= toMin(d.end); t += step) {
        slots.push(`${pad(Math.floor(t / 60))}:${pad(t % 60)}`);
    }
    return slots;
};

// ================= THÔNG BÁO GIỜ NHẬN / TRẢ (7 thứ) =================
const PickupHoursNotice = ({ cfg = DEFAULT_BOOKING_HOURS }) => {
    // Hiển thị T2..T7 rồi CN cho dễ đọc
    const order = [1, 2, 3, 4, 5, 6, 0];
    return (
        <div className="cp-pickup-notice">
            <div className="cp-pickup-notice-head">
                <span className="cp-pickup-notice-icon">⏰</span>
                <strong>Giờ nhận &amp; trả mèo</strong>
            </div>
            <ul className="cp-pickup-notice-list">
                {order.map((dow) => {
                    const d = cfg?.days?.[String(dow)] || cfg?.days?.[dow];
                    const text = !d || !d.open ? "Nghỉ" : `${d.start} – ${d.end}`;
                    return (
                        <li key={dow}>
                            <span>{DAY_LABELS[dow]}</span>
                            <strong className={!d || !d.open ? "cp-pickup-closed" : ""}>{text}</strong>
                        </li>
                    );
                })}
            </ul>
            <p className="cp-pickup-notice-foot">
                Vui lòng chọn giờ nhận &amp; trả mèo trong khung trên ở bước tiếp theo.
            </p>
        </div>
    );
};

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
const SignaturePad = ({ onSave, onClear }) => {
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

// ================= CỔNG CHẶN: CHƯA CÓ HỒ SƠ MÈO =================
const NeedPetGate = ({ onGoToPets }) => (
    <div className="cp-card cp-gate">
        <div className="cp-gate-icon">🐱</div>
        <h3 className="cp-gate-title">Thêm hồ sơ bé mèo trước nhé</h3>
        <p className="cp-gate-text">
            Để đặt dịch vụ giữ mèo, bạn cần thêm thông tin bé mèo vào hồ sơ trước.
            Việc này giúp cửa hàng chăm sóc bé chính xác và an toàn hơn.
        </p>
        <button className="cp-btn cp-btn-primary" onClick={onGoToPets}>
            ➕ Thêm hồ sơ mèo
        </button>
    </div>
);

// ================= MAIN CONTROLLER =================
export default function ClientBooking({ onSuccess, onGoToActive, onGoToPets, storeId, serviceTypeMeta }) {
    const navigate = useNavigate();
    const goPets = onGoToPets || (() => navigate("/dashboard"));
    // Khung giờ nhận/trả lấy từ cấu hình dịch vụ (admin chỉnh), fallback mặc định nếu thiếu
    const cfg = serviceTypeMeta?.bookingHours || DEFAULT_BOOKING_HOURS;
    // Cấu hình suất ăn thêm (admin chỉnh trong app) — chỉ hiện khi enabled
    const foodCfg = serviceTypeMeta?.foodOptions || DEFAULT_FOOD_OPTIONS;

    // Lựa chọn suất ăn của khách (tạm tính — nhân viên chốt lại lúc nhận mèo)
    const [foodChoice, setFoodChoice] = useState({
        enabled: false,
        meals: foodCfg.defaultMeals || 2,
        gramsPerMeal: foodCfg.sizeHints?.[0]?.gramsPerMeal || 100,
    });

    const [step, setStep] = useState(1);
    const [bookingData, setBookingData] = useState({
        check_in: "",
        check_out: "",
        check_in_time: "",
        check_out_time: "",
        cat_name: "",
        cat_breed: "",
        owner_name: "",
        owner_phone: "",
        note: ""
    });
    const [signature, setSignature] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    /* ── Pre-fetch profile + pets ── */
    const [, setProfile] = useState(null);
    const [pets, setPets] = useState([]);
    const [profileLoaded, setProfileLoaded] = useState(false);
    const [myVouchers, setMyVouchers] = useState([]);  // ví ưu đãi của khách
    const [voucherId, setVoucherId] = useState("");    // voucher khách chọn cho lịch này

    // Chỉ hiện voucher áp được cho dịch vụ giữ mèo (miễn phí đêm) — loại khác không liên quan
    const boardingVouchers = filterVouchersForService(myVouchers, serviceTypeMeta);
    const selectedVoucher = boardingVouchers.find((v) => String(v.id) === String(voucherId)) || null;

    useEffect(() => {
        const fetchBookingProfile = async () => {
            try {
                const data = await api.get("/service/booking-profile");
                if (data.success) {
                    setProfile(data.profile);
                    setPets(data.pets || []);

                    /* Pre-fill owner info */
                    setBookingData(prev => ({
                        ...prev,
                        owner_name: data.profile.fullName || prev.owner_name,
                        owner_phone: data.profile.phone || prev.owner_phone,
                    }));
                }
            } catch (err) {
                /* 401 → api.js tự xử lý, lỗi khác bỏ qua */
                console.error("Không thể tải profile:", err);
            } finally {
                setProfileLoaded(true);
            }
        };
        fetchBookingProfile();
    }, []);

    /* Tải ví ưu đãi của khách (để chọn dùng cho lịch) */
    useEffect(() => {
        api.get("/customer-benefits/my")
            .then((d) => { if (d?.success) setMyVouchers(d.vouchers || []); })
            .catch(() => {});
    }, []);

    const handleDateRangeSelect = ({ start, end }) => {
        setBookingData(prev => ({ ...prev, check_in: start, check_out: end }));
        setStep(2);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleInputChange = (e) => {
        setBookingData({ ...bookingData, [e.target.name]: e.target.value });
    };

    /* ── Chọn pet từ dropdown → điền cat_name + cat_breed ── */
    const handlePetSelect = (petId) => {
        if (!petId) {
            /* Phòng hờ: không có pet nào được chọn → xóa thông tin mèo */
            setBookingData(prev => ({ ...prev, cat_name: "", cat_breed: "" }));
            return;
        }
        const pet = pets.find(p => p.id === Number(petId));
        if (pet) {
            setBookingData(prev => ({
                ...prev,
                cat_name: pet.name,
                cat_breed: pet.breed || "",
            }));
        }
    };

    const handleStep2Next = () => {
        const { cat_name, owner_name, owner_phone, check_in, check_out, check_in_time, check_out_time } = bookingData;
        if (!cat_name || !owner_name || !owner_phone || !check_in || !check_out) {
            return toast.error("Vui lòng điền đầy đủ thông tin có dấu *!");
        }
        if (check_out <= check_in) return toast.error("Ngày trả phải sau ngày nhận!");
        if (cfg.enabled && (!check_in_time || !check_out_time)) {
            return toast.error("Vui lòng chọn giờ nhận và giờ trả mèo!");
        }
        setStep(3);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // 2. Sửa handleSubmit — chuyển về ActiveServices sau khi thành công
    const handleSubmit = async () => {
        if (!signature) return toast.error("Vui lòng ký tên vào hợp đồng để xác nhận!");
        setIsSubmitting(true);
        try {
            const res = await fetch(`${API}/bookings`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...bookingData,
                    store_id: storeId || undefined,
                    service: "day",
                    signature: signature,
                    contract_status: 'signed',
                    voucher_id: voucherId || undefined,
                    // Suất ăn thêm (server tự tính lại giá từ config)
                    food_enabled: !!(foodCfg.enabled && foodChoice.enabled),
                    food_meals: foodChoice.meals,
                    food_grams_per_meal: foodChoice.gramsPerMeal,
                })
            });

            const data = await res.json();
            if (res.ok) {
                onSuccess?.(data.message || "🎉 Đặt lịch thành công!");
                // Chuyển về trang Dịch vụ đang sử dụng sau 1.5s
                setTimeout(() => onGoToActive?.(), 1500);
            } else {
                onSuccess?.(`❌ ${data.error || "Lỗi đặt lịch"}`, "error");
            }
        } catch {
            onSuccess?.("❌ Lỗi kết nối mạng", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    /* Chưa có hồ sơ mèo → bắt thêm trước, không cho vào luồng đặt lịch */
    if (profileLoaded && pets.length === 0) {
        return <NeedPetGate onGoToPets={goPets} />;
    }

    return (
        <div>
            <StepProgress current={step} />

            {step === 1 && <Step1Calendar onSelectDateRange={handleDateRangeSelect} storeId={storeId} cfg={cfg} />}

            {step === 2 && (
                <Step2InfoForm
                    data={bookingData}
                    onChange={handleInputChange}
                    onBack={() => setStep(1)}
                    onNext={handleStep2Next}
                    pets={pets}
                    onPetSelect={handlePetSelect}
                    profileLoaded={profileLoaded}
                    cfg={cfg}
                    vouchers={boardingVouchers}
                    voucherId={voucherId}
                    onVoucherChange={setVoucherId}
                    foodCfg={foodCfg}
                    foodChoice={foodChoice}
                    onFoodChange={setFoodChoice}
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
                    foodCfg={foodCfg}
                    foodChoice={foodChoice}
                    voucher={selectedVoucher}
                />
            )}
        </div>
    );
}

// ================= STEP 1 =================
const Step1Calendar = ({ onSelectDateRange, storeId, cfg }) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
    const [calData, setCalData] = useState([]);
    const [rangeStart, setRangeStart] = useState(null);
    const [rangeEnd, setRangeEnd] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(true);
        fetch(`${API}/bookings/calendar?year=${currentDate.getFullYear()}&month=${currentDate.getMonth() + 1}${storeId ? `&store_id=${storeId}` : ""}`)
            .then(r => r.json())
            .then(d => { setCalData(Array.isArray(d) ? d : []); setIsLoading(false); })
            .catch(() => setIsLoading(false));
    }, [currentDate, storeId]);

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
            return toast.error("Ngày này đã hết phòng, vui lòng chọn ngày khác!");
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
        if (!rangeStart || !rangeEnd) return toast.error("Vui lòng chọn khoảng thời gian (Ngày gửi và Ngày trả)!");
        onSelectDateRange({ start: rangeStart, end: rangeEnd });
    };

    const diffDays = rangeStart && rangeEnd
        ? Math.ceil((new Date(rangeEnd) - new Date(rangeStart)) / (1000 * 60 * 60 * 24))
        : 0;

    const dayNames = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
    const monthNames = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];

    return (
        <div>
            <h2 className="cp-section-title">Chọn ngày gửi & trả 📅</h2>
            <p className="cp-section-sub">Chạm vào ngày bắt đầu, sau đó chọn ngày kết thúc</p>
            <PickupHoursNotice cfg={cfg} />
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

                        <div className="cp-step-actions">
                            <button
                                className="cp-btn cp-btn-primary cp-btn-full"
                                onClick={handleConfirmRange}
                                disabled={!rangeStart || !rangeEnd}
                                style={{ opacity: (!rangeStart || !rangeEnd) ? 0.45 : 1 }}
                            >
                                Tiếp theo →
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

// ================= CHỌN SUẤT ĂN THÊM (Bước 2) =================
const FoodAddonPicker = ({ cfg, choice, onChange, days }) => {
    if (!cfg?.enabled) return null;
    const step = Number(cfg.gramStep) || 50;
    const maxDay = Number(cfg.maxGramsPerDay) || 600;
    const price = calcFood(cfg, choice, days);

    // Giữ gram/cữ trong khung: ≥ 1 bước, và tổng gram/ngày không vượt trần
    const clamp = (c) => {
        const meals = Math.max(1, Number(c.meals) || 1);
        const maxPerMeal = Math.max(step, Math.floor(maxDay / meals));
        let g = Number(c.gramsPerMeal) || step;
        g = Math.max(step, Math.min(g, maxPerMeal));
        return { ...c, meals, gramsPerMeal: g };
    };
    const set = (patch) => onChange(clamp({ ...choice, ...patch }));

    const chipBase = {
        padding: "7px 14px", borderRadius: 999, fontSize: 13, fontWeight: 700,
        cursor: "pointer", border: "1.5px solid #d7dbe6", background: "#fff", color: "#475569",
    };
    const chipActive = { borderColor: "#2563eb", background: "#eff4ff", color: "#1e40af" };

    return (
        <div className="cp-field span-2" style={{
            border: "1.5px solid #e2e6f0", borderRadius: 14, padding: 14,
            background: choice.enabled ? "#f7f9ff" : "#fbfbfd",
        }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", margin: 0 }}>
                <input
                    type="checkbox"
                    checked={choice.enabled}
                    onChange={(e) => set({ enabled: e.target.checked })}
                    style={{ width: 18, height: 18, accentColor: "#2563eb" }}
                />
                <span style={{ fontWeight: 800, fontSize: 14.5, color: "#1e293b" }}>
                    🍽 Thêm suất ăn — {cfg.label}
                </span>
            </label>
            <p style={{ fontSize: 12, color: "#8a90a2", margin: "6px 0 0 28px" }}>
                Tính theo tổng gram/ngày × {formatCurrency(Number(cfg.pricePer100g) || 0)}đ/100g.
                Bạn chọn tạm — nhân viên sẽ chốt lại khẩu phần khi nhận mèo.
            </p>

            {choice.enabled && (
                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
                    {/* Số cữ/ngày */}
                    <div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#475569", marginBottom: 7 }}>Số cữ mỗi ngày</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {(cfg.mealPresets || [1, 2, 3]).map((m) => (
                                <button
                                    key={m} type="button"
                                    style={{ ...chipBase, ...(choice.meals === m ? chipActive : {}) }}
                                    onClick={() => set({ meals: m })}
                                >
                                    {m} cữ{m === (cfg.defaultMeals || 2) ? " (phổ biến)" : ""}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Gram mỗi cữ */}
                    <div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#475569", marginBottom: 7 }}>Lượng ăn mỗi cữ</div>
                        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 0, border: "1.5px solid #d7dbe6", borderRadius: 10, overflow: "hidden" }}>
                                <button type="button" onClick={() => set({ gramsPerMeal: choice.gramsPerMeal - step })}
                                    style={{ width: 38, height: 38, border: "none", background: "#f1f4fb", fontSize: 20, cursor: "pointer", color: "#2563eb" }}>−</button>
                                <span style={{ minWidth: 64, textAlign: "center", fontWeight: 800, fontSize: 15, color: "#1e293b" }}>{choice.gramsPerMeal}g</span>
                                <button type="button" onClick={() => set({ gramsPerMeal: choice.gramsPerMeal + step })}
                                    style={{ width: 38, height: 38, border: "none", background: "#f1f4fb", fontSize: 20, cursor: "pointer", color: "#2563eb" }}>+</button>
                            </div>
                            {(cfg.sizeHints || []).map((h, i) => (
                                <button key={i} type="button"
                                    style={{ ...chipBase, ...(choice.gramsPerMeal === h.gramsPerMeal ? chipActive : {}) }}
                                    onClick={() => set({ gramsPerMeal: h.gramsPerMeal })}
                                >
                                    {h.label} ({h.gramsPerMeal}g/cữ)
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Preview giá */}
                    <div style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6,
                        background: "#fff", border: "1px solid #e2e6f0", borderRadius: 10, padding: "10px 14px",
                    }}>
                        <span style={{ fontSize: 13, color: "#475569" }}>
                            Tổng <strong>{price.gramsPerDay}g/ngày</strong> · +{formatCurrency(price.perDay)}đ/ngày
                        </span>
                        {days > 0 && (
                            <span style={{ fontSize: 14, fontWeight: 800, color: "#2d7a5a" }}>
                                {days} ngày = +{formatCurrency(price.total)}đ
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ================= STEP 2 (CẬP NHẬT — Pre-fill + Pet selector) =================
const Step2InfoForm = ({ data, onChange, onBack, onNext, pets, onPetSelect, cfg = DEFAULT_BOOKING_HOURS, vouchers = [], voucherId = "", onVoucherChange, foodCfg = DEFAULT_FOOD_OPTIONS, foodChoice, onFoodChange }) => {
    const pricing = useMemo(() => calculatePrice(data.check_in, data.check_out), [data.check_in, data.check_out]);
    const [selectedPetId, setSelectedPetId] = useState("");

    /* Khung giờ cho phép theo thứ của ngày nhận / ngày trả */
    const inSlots  = useMemo(() => genSlots(data.check_in,  cfg), [data.check_in,  cfg]);
    const outSlots = useMemo(() => genSlots(data.check_out, cfg), [data.check_out, cfg]);

    /* Khi có pets và chưa chọn → auto-chọn pet đầu tiên */
    useEffect(() => {
        if (pets.length > 0 && !data.cat_name && selectedPetId === "") {
            const first = pets[0];
            setSelectedPetId(String(first.id));
            onPetSelect(first.id);
        }
    }, [pets]);

    const handlePetChange = (e) => {
        const val = e.target.value;
        setSelectedPetId(val);
        onPetSelect(val);
    };

    return (
        <div>
            <div className="cp-step-topbar">
                <h2 className="cp-section-title">Thông tin đặt lịch 📋</h2>
                <button className="cp-btn cp-btn-outline" onClick={onBack}>← Quay lại</button>
            </div>

            <div className="cp-card">
                {/* ── Dải tóm tắt: ngày · số ngày · tổng tiền (gộp 3 khối cũ cho gọn) ── */}
                <div className="cp-booking-recap">
                    <div className="cp-recap-dates">
                        <span className="cp-recap-seg">🐱 {fmtShort(data.check_in)}</span>
                        <span className="cp-recap-arrow">→</span>
                        <span className="cp-recap-seg">🏠 {fmtShort(data.check_out)}</span>
                    </div>
                    <div className="cp-recap-meta">
                        <span>{pricing.days} ngày</span>
                        {pricing.totalPrice > 0 && (
                            <span className="cp-recap-total">{formatCurrency(pricing.totalPrice)}đ</span>
                        )}
                    </div>
                </div>
                <p className="cp-recap-tip">💡 70.000đ ngày đầu · 50.000đ/ngày từ ngày thứ 2</p>

                <div className="cp-form-grid">
                    {/* ── CHỌN GIỜ NHẬN / TRẢ (luôn nằm ngang vì nội dung ngắn) ── */}
                    {cfg.enabled && (
                        <div className="cp-field-pair span-2">
                            <div className="cp-field">
                                <label className="cp-label">Giờ nhận mèo *</label>
                                <select
                                    name="check_in_time"
                                    className="cp-input"
                                    value={data.check_in_time}
                                    onChange={onChange}
                                    disabled={inSlots.length === 0}
                                >
                                    <option value="">
                                        {inSlots.length === 0 ? "Ngày này không nhận giao/trả" : "-- Chọn giờ --"}
                                    </option>
                                    {inSlots.map((t) => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div className="cp-field">
                                <label className="cp-label">Giờ trả mèo *</label>
                                <select
                                    name="check_out_time"
                                    className="cp-input"
                                    value={data.check_out_time}
                                    onChange={onChange}
                                    disabled={outSlots.length === 0}
                                >
                                    <option value="">
                                        {outSlots.length === 0 ? "Ngày này không nhận giao/trả" : "-- Chọn giờ --"}
                                    </option>
                                    {outSlots.map((t) => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                        </div>
                    )}

                    {/* ── CHỌN BÉ MÈO (từ hồ sơ — không nhập tay nữa) ── */}
                    <div className="cp-field span-2">
                        <label className="cp-label">Chọn bé mèo 🐾</label>
                        <select
                            className="cp-input"
                            value={selectedPetId}
                            onChange={handlePetChange}
                        >
                            {pets.map(pet => (
                                <option key={pet.id} value={String(pet.id)}>
                                    {pet.name}{pet.breed ? ` — ${pet.breed}` : ""}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="cp-field">
                        <label className="cp-label">Tên chủ nuôi *</label>
                        <input name="owner_name" className="cp-input" placeholder="Người đại diện" value={data.owner_name} onChange={onChange} />
                    </div>
                    <div className="cp-field">
                        <label className="cp-label">Số điện thoại *</label>
                        <input name="owner_phone" className="cp-input" placeholder="SĐT Zalo" value={data.owner_phone} onChange={onChange} inputMode="tel" />
                    </div>

                    <div className="cp-field span-2">
                        <label className="cp-label">Ghi chú</label>
                        <textarea name="note" className="cp-textarea cp-textarea-sm" placeholder="Dị ứng, thói quen ăn uống, yêu cầu đặc biệt..." value={data.note} onChange={onChange} />
                    </div>

                    <FoodAddonPicker cfg={foodCfg} choice={foodChoice} onChange={onFoodChange} days={pricing.days} />

                    {vouchers.length > 0 && (
                        <div className="cp-field span-2">
                            <label className="cp-label">🎁 Dùng ưu đãi (nếu có)</label>
                            <select className="cp-input" value={voucherId} onChange={(e) => onVoucherChange?.(e.target.value)}>
                                <option value="">-- Không dùng ưu đãi --</option>
                                {groupVouchers(vouchers).map((g) => (
                                    <option key={g.id} value={String(g.id)}>
                                        {g.title}{g.count > 1 ? ` ×${g.count}` : ""}
                                    </option>
                                ))}
                            </select>
                            <p style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
                                Ưu đãi được trừ thẳng vào hóa đơn tạm tính ở bước tiếp theo.
                            </p>
                        </div>
                    )}
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
const Step3Review = ({ data, signature, setSignature, onBack, onSubmit, isSubmitting, foodCfg = DEFAULT_FOOD_OPTIONS, foodChoice, voucher = null }) => {
    const pricing = useMemo(() => calculatePrice(data.check_in, data.check_out), [data.check_in, data.check_out]);
    const food = useMemo(() => calcFood(foodCfg, foodChoice, pricing.days), [foodCfg, foodChoice, pricing.days]);
    const hasFood = !!(foodCfg?.enabled && foodChoice?.enabled && food.total > 0);
    const discount = useMemo(() => calcVoucherDiscount(voucher, pricing), [voucher, pricing]);
    const grandTotal = pricing.totalPrice + (hasFood ? food.total : 0) - discount;

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
                            <strong>{data.check_in}{data.check_in_time ? ` · ${data.check_in_time}` : ''}</strong>
                        </div>
                        <div className="cp-invoice-row">
                            <span>Ngày trả</span>
                            <strong>{data.check_out}{data.check_out_time ? ` · ${data.check_out_time}` : ''}</strong>
                        </div>
                        <div className="cp-invoice-row">
                            <span>Dịch vụ ({pricing.days} ngày × {formatCurrency(pricing.unitPrice)}đ)</span>
                            <strong>{formatCurrency(pricing.totalPrice)}đ</strong>
                        </div>
                        {hasFood && (
                            <div className="cp-invoice-row">
                                <span>🍽 {foodCfg.label} ({food.gramsPerDay}g/ngày × {pricing.days} ngày)</span>
                                <strong>{formatCurrency(food.total)}đ</strong>
                            </div>
                        )}
                        {discount > 0 && (
                            <div className="cp-invoice-row">
                                <span>🎁 {voucher?.title || "Ưu đãi"}</span>
                                <strong style={{ color: "#2d7a5a" }}>−{formatCurrency(discount)}đ</strong>
                            </div>
                        )}
                    </div>
                    <div className="cp-invoice-total">
                        <span>Tổng thanh toán</span>
                        <span className="cp-invoice-total-amount">{formatCurrency(grandTotal)}đ</span>
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
                        Tôi cam kết đã đọc, hiểu rõ và đồng ý với toàn bộ các điều khoản dưới đây:
                    </p>

                    <ol className="cp-contract-terms">
                        <li>
                            Chi phí dịch vụ tạm tính là <strong>{formatCurrency(grandTotal)}đ</strong>{" "}
                            ({pricing.days} ngày × {formatCurrency(pricing.unitPrice)}đ
                            {hasFood ? <> + suất ăn {foodCfg.label} {food.gramsPerDay}g/ngày</> : null}
                            {discount > 0 ? <> − ưu đãi {voucher?.title} ({formatCurrency(discount)}đ)</> : null}).
                            Khẩu phần ăn sẽ được nhân viên chốt lại khi nhận mèo; phí phát sinh nếu nhận trễ
                            so với ngày hẹn trả sẽ được tính theo bảng giá của cửa hàng.
                        </li>
                        <li>
                            Tôi chịu trách nhiệm về tính chính xác của thông tin bé mèo (tình trạng sức khỏe, tiêm phòng,
                            thói quen ăn uống) đã cung cấp cho cửa hàng.
                        </li>
                        <li>
                            Cửa hàng cam kết chăm sóc tốt nhất, nhưng sẽ không chịu trách nhiệm bồi thường nếu xảy ra
                            bệnh lý lây nhiễm ngầm hoặc bệnh nền có sẵn mà không được khai báo.
                        </li>
                        <li className="cp-contract-term-warn">
                            <strong>QUAN TRỌNG:</strong> Nếu quá <strong>14 ngày</strong> kể từ ngày hẹn trả mà tôi không
                            liên lạc và không nhận lại bé mèo, cửa hàng sẽ xem đây là hành vi “BỎ THÚ CƯNG” và có quyền
                            chuyển giao bé mèo cho tổ chức cứu hộ.
                        </li>
                        <li>
                            Mọi yêu cầu hủy lịch cần được thực hiện trước <strong>24 giờ</strong> tính đến giờ nhận phòng
                            để được hoàn phí miễn phí.
                        </li>
                        <li>
                            Tôi sẽ giao &amp; nhận bé mèo đúng khung giờ cửa hàng quy định
                            {(data.check_in_time || data.check_out_time) ? (
                                <> mà tôi đã chọn: nhận lúc <strong>{data.check_in_time || "—"}</strong>,
                                trả lúc <strong>{data.check_out_time || "—"}</strong></>
                            ) : null}.
                        </li>
                    </ol>
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

                <div className="cp-booking-reassurance">
                    <span>🔒 Chữ ký chỉ dùng cho hợp đồng nội bộ</span>
                    <span className="cp-reassurance-dot">·</span>
                    <span>✅ Hủy miễn phí trước 24 giờ nhận phòng</span>
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