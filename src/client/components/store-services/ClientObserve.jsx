import React, { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import "../../../styles/client/client_portal.css";

const API = import.meta.env.VITE_API_URL || "/api";

// ================= UTILITIES =================
const calculateServiceCost = (check_in, check_out) => {
    const start = new Date(check_in); const end = new Date(check_out);
    const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
    const unitPrice = days === 1 ? 70000 : 50000;
    return { days, unitPrice, total: days * unitPrice };
};

const calculateLateFee = (check_out) => {
    const end = new Date(check_out).getTime(); const now = Date.now();
    if (now <= end) return { isLate: false, fee: 0, hours: 0, days: 0 };
    const diffMs = now - end;
    const hours = Math.ceil(diffMs / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    let fee = 0;
    if (hours <= 4) fee = hours * 10000;
    else fee = 40000 + (days * 50000);
    return { isLate: true, fee, hours, days };
};

const formatCurrency = (n) => n.toLocaleString("vi-VN") + "đ";

const getTimeLeft = (check_out) => {
    const end = new Date(check_out).getTime(); const now = Date.now();
    if (end <= now) return { text: "Đã hết hạn", isExpired: true };
    const diff = end - now;
    const d = Math.floor(diff / (1000*60*60*24));
    const h = Math.floor((diff % (1000*60*60*24)) / (1000*60*60));
    const m = Math.floor((diff % (1000*60*60)) / (1000*60));
    let text = ""; if(d>0) text += `${d} ngày `; text += `${h} giờ ${m} phút`;
    return { text, isExpired: false };
};

// ================= SIGNATURE PAD =================
const SignaturePad = ({ onSave }) => {
    const canvasRef = useRef(null); const [isDrawing, setIsDrawing] = useState(false);
    const getPos = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
        const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
        return { x: x * (canvasRef.current.width / rect.width), y: y * (canvasRef.current.height / rect.height) };
    };
    const startDraw = (e) => { e.preventDefault(); setIsDrawing(true); const ctx = canvasRef.current.getContext("2d"); const pos = getPos(e); ctx.beginPath(); ctx.moveTo(pos.x, pos.y); };
    const draw = (e) => { if (!isDrawing) return; e.preventDefault(); const ctx = canvasRef.current.getContext("2d"); const pos = getPos(e); ctx.lineTo(pos.x, pos.y); ctx.stroke(); };
    const stopDraw = () => setIsDrawing(false);
    const clear = () => { const ctx = canvasRef.current.getContext("2d"); ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); };

    return (
        <div className="cp-sigpad">
            <div className="cp-sigpad-canvas-wrap">
                <canvas ref={canvasRef} width={500} height={150} className="cp-sigpad-canvas"
                    onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                    onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
                <div className="cp-sigpad-hint">Ký tên tại đây...</div>
            </div>
            <div className="cp-sigpad-actions">
                <button onClick={clear} className="cp-btn cp-btn-outline">Xóa ký lại</button>
                <button onClick={() => onSave(canvasRef.current.toDataURL())} className="cp-btn cp-btn-primary">✅ Xác nhận &amp; Bắt đầu dịch vụ</button>
            </div>
        </div>
    );
};

// ================= BOOKING DETAIL PAGE =================
const BookingDetailPage = ({ booking, onBack, phone }) => {
    const [activeTab, setActiveTab] = useState("timeline");
    const [isSigned, setIsSigned] = useState(booking.contract_status === 'signed');
    const [timeLeft, setTimeLeft] = useState(getTimeLeft(booking.check_out));
    const [cams, setCams] = useState([]);
    const [viewCam, setViewCam] = useState(null);

    // Lưu trạng thái real-time của booking để khi ký xong chuyển thành active ngay lập tức
    const [currentBooking, setCurrentBooking] = useState(booking);

    useEffect(() => {
        const timer = setInterval(() => setTimeLeft(getTimeLeft(currentBooking.check_out)), 60000);
        return () => clearInterval(timer);
    }, [currentBooking.check_out]);

    useEffect(() => {
        if(currentBooking.status === 'active') {
            fetch(`${API}/bookings/cameras?phone=${phone}`).then(r=>r.json()).then(d=>setCams(Array.isArray(d)?d:[])).catch(()=>{});
        }
    }, [currentBooking.status, phone]);

    const pricing = calculateServiceCost(currentBooking.check_in, currentBooking.check_out);
    const lateInfo = calculateLateFee(currentBooking.check_out);

    // LOGIC GÁC CỔNG: Nếu đang pending và chưa ký => KHÓA TOÀN BỘ
    const isLocked = currentBooking.status === 'pending' && !isSigned;

    const handleSignContract = async (signatureImg) => {
        try {
            const res = await fetch(`${API}/bookings/${currentBooking.id}/activate`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ signature: signatureImg })
            });

            if(res.ok) {
                setIsSigned(true);
                // Chỉ cập nhật contract_status — status vẫn là 'pending' cho đến khi admin nhận mèo
                setCurrentBooking(prev => ({...prev, contract_status: 'signed'}));
                setActiveTab('timeline');
            } else {
                toast.error("Lỗi hệ thống, vui lòng nhờ nhân viên kiểm tra lại.");
            }
        } catch(err) {
            toast.error("Lỗi kết nối mạng");
        }
    };

    return (
        <div className="cp-detail-overlay">
            <div className="cp-detail-wrap">
                {/* Header */}
                <div className="cp-detail-head">
                    <button onClick={onBack} className="cp-detail-back" aria-label="Quay lại">←</button>
                    <div className="cp-detail-head-info">
                        <h3>🐱 {currentBooking.cat_name}</h3>
                        <p>Phòng: {currentBooking.room_name || 'Chưa phân bổ'}</p>
                    </div>
                    <span className={`cp-status-badge ${isLocked ? 'pending' : currentBooking.status}`}>
                        {isLocked ? '🔒 Chờ ký HĐ' :
                         currentBooking.status === 'active' ? '🟢 Đang phục vụ' :
                         currentBooking.status === 'pending' ? '🟡 Chờ nhận mèo' :
                         currentBooking.status === 'completed' ? '⚫ Hoàn thành' :
                         currentBooking.status}
                    </span>
                </div>

                {/* WARNING BANNER NẾU DỊCH VỤ BỊ KHÓA */}
                {isLocked && (
                    <div className="cp-lock-banner">
                        <div className="cp-lock-banner-icon">🔒</div>
                        <h3>DỊCH VỤ CHƯA BẮT ĐẦU</h3>
                        <p>Cửa hàng chưa tiếp nhận bé mèo. Vui lòng đọc kỹ các điều khoản và ký hợp đồng điện tử bên dưới để xác nhận gửi mèo.</p>
                    </div>
                )}

                {/* Countdown Box - CHỈ HIỆN KHI ĐÃ KÝ (Active) */}
                {!isLocked && (
                    <div className={`cp-countdown ${timeLeft.isExpired ? 'expired' : ''}`}>
                        <div className="cp-countdown-label">
                            {timeLeft.isExpired ? '⚠️ ĐÃ HẾT HẠN DỊCH VỤ' : '⏰ Thời gian còn lại đến khi trả mèo'}
                        </div>
                        <div className="cp-countdown-value">{timeLeft.text}</div>
                        {lateInfo.isLate && (
                            <div className="cp-countdown-fee">
                                Phí phụ thu hiện tại: +{formatCurrency(lateInfo.fee)}
                            </div>
                        )}
                    </div>
                )}

                {/* Tabs */}
                <div className="cp-detail-tabs">
                    {/* Nếu bị khóa, ép chuyển sang tab Hợp đồng, ẩn tab khác đi hoặc làm mờ */}
                    <button
                        onClick={() => !isLocked && setActiveTab('timeline')}
                        className={`cp-detail-tab ${isLocked ? 'locked' : ''} ${activeTab === 'timeline' && !isLocked ? 'active' : ''}`}
                    >
                        📊 Tiến trình
                    </button>
                    <button
                        onClick={() => setActiveTab('contract')}
                        className={`cp-detail-tab ${isLocked ? 'contract-required' : ''} ${activeTab === 'contract' ? 'active' : ''}`}
                    >
                        📝 Hợp đồng {isLocked && '(Bắt buộc)'}
                    </button>
                    <button
                        onClick={() => !isLocked && setActiveTab('camera')}
                        className={`cp-detail-tab ${isLocked ? 'locked' : ''} ${activeTab === 'camera' && !isLocked ? 'active' : ''}`}
                    >
                        📹 Camera
                    </button>
                </div>

                {/* Tab Content */}
                <div className="cp-card">

                    {/* KHÓA TAB TIMELINE NẾU CHƯA KÝ */}
                    {activeTab === 'timeline' && isLocked && (
                        <div className="cp-locked-msg">
                            <div className="cp-locked-msg-icon">🚫</div>
                            <p>Vui lòng hoàn tất ký hợp đồng để xem tiến trình dịch vụ.</p>
                        </div>
                    )}

                    {/* TIMELINE TAB (Chỉ hiện khi active) */}
                    {activeTab === 'timeline' && !isLocked && (
                        <div>
                            <h4 className="cp-card-title">Chi tiết dịch vụ</h4>
                            <div className="cp-timeline">
                                {[
                                    {label: 'Ngày nhận mèo', val: currentBooking.check_in, done: currentBooking.status !== 'pending'},
                                    {label: 'Đang chăm sóc', val: `${pricing.days} ngày`, done: currentBooking.status === 'completed'},
                                    {label: 'Ngày trả mèo', val: currentBooking.check_out, done: timeLeft.isExpired},
                                ].map((item, i) => (
                                    <div key={i} className={`cp-timeline-item ${item.done ? 'done' : ''}`}>
                                        <div className="cp-timeline-dot"></div>
                                        <div className="cp-timeline-label">{item.label}</div>
                                        <div className="cp-timeline-val">{item.val}</div>
                                    </div>
                                ))}
                            </div>
                            <div className="cp-detail-pricing">
                                <div className="cp-detail-pricing-row"><span>Đơn giá ({pricing.days} ngày)</span><span>{formatCurrency(pricing.unitPrice)}/ngày</span></div>
                                <div className="cp-detail-pricing-row"><span>Thành tiền</span><strong>{formatCurrency(pricing.total)}</strong></div>
                                {lateInfo.isLate && (<div className="cp-detail-pricing-row late"><span>Phí nhận trễ</span><strong>+{formatCurrency(lateInfo.fee)}</strong></div>)}
                            </div>
                        </div>
                    )}

                    {/* CONTRACT TAB (LUÔN HIỆN) */}
                    {activeTab === 'contract' && (
                        <div>
                            <h4 className="cp-card-title">HỢP ĐỒNG CHĂM SÓC THÚ CƯNG</h4>
                            <div className="cp-contract-body">
                                <p>1. Tôi đồng ý gửi <strong>{currentBooking.cat_name}</strong> từ ngày <strong>{currentBooking.check_in}</strong> đến <strong>{currentBooking.check_out}</strong>.</p>
                                <p>2. Chi phí dịch vụ là <strong>{formatCurrency(pricing.total)}</strong> ({pricing.days} ngày x {formatCurrency(pricing.unitPrice)}). Phí phát sinh nếu nhận trễ sẽ được tính theo quy định.</p>
                                <p className="cp-contract-warn">
                                    3. QUAN TRỌNG: Nếu quá 14 ngày kể từ ngày hẹn trả mà không liên lạc và không nhận lại thú cưng, cửa hàng sẽ xem đây là hành vi "BỎ THÚ CƯNG". Cửa hàng có quyền chuyển giao thú cưng cho tổ chức cứu hộ.
                                </p>
                                <p>4. Cửa hàng cam kết chăm sóc tốt nhất, nhưng sẽ không chịu trách nhiệm bồi thường nếu xảy ra bệnh lý lây nhiễm ngầm.</p>
                            </div>

                            {isSigned ? (
                                <div className="cp-contract-signed">
                                    <div className="cp-contract-signed-icon">✅</div>
                                    <h4>Hợp đồng đã được ký &amp; Dịch vụ đã bắt đầu</h4>
                                </div>
                            ) : (
                                <div className="cp-contract-sign-prompt">
                                    <p>⚠️ Vui lòng đọc kỹ và ký xác nhận bên dưới để nhận mèo</p>
                                    <SignaturePad onSave={handleSignContract} />
                                </div>
                            )}
                        </div>
                    )}

                    {/* KHÓA TAB CAMERA NẾU CHƯA KÝ */}
                    {activeTab === 'camera' && isLocked && (
                        <div className="cp-locked-msg">
                            <div className="cp-locked-msg-icon">🔒</div>
                            <p>Camera chỉ được kích hoạt sau khi hợp đồng được ký xác nhận.</p>
                        </div>
                    )}

                    {/* CAMERA TAB (Chỉ hiện khi active) */}
                    {activeTab === 'camera' && !isLocked && (
                        <div>
                            {cams.length === 0 ? <div className="cp-empty"><div className="cp-empty-icon">📹</div><h3>Chưa có camera</h3><p>Phòng này chưa được cấp camera.</p></div> : (
                                <div className="cp-camera-grid">
                                    {cams.map(c => (
                                        <div key={c.id} className="cp-camera-card">
                                            <div className="cp-camera-feed">
                                                {c.status === 'online' ? (<>
                                                    <div className="cp-camera-live-badge"><div className="cp-live-dot"></div> LIVE</div>
                                                    <iframe className="cp-camera-iframe" src={c.stream_url} title="cam" allow="autoplay; encrypted-media" />
                                                    <button onClick={() => setViewCam(c)} className="cp-cam-fullscreen-btn">⛶ Toàn màn hình</button>
                                                </>) : <div className="cp-camera-offline"><span>🔒</span><span>Ngoại tuyến</span></div>}
                                            </div>
                                            <div className="cp-camera-info"><div className="cp-camera-name">{c.room_name}</div></div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {viewCam && (
                <div className="cp-cam-fs" onClick={() => setViewCam(null)}>
                    <div className="cp-cam-fs-inner" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setViewCam(null)} className="cp-cam-fs-close" aria-label="Đóng">✕</button>
                        <iframe src={viewCam.stream_url} className="cp-cam-fs-iframe" allow="autoplay; encrypted-media" title="full" />
                    </div>
                </div>
            )}
        </div>
    );
};

// ================= MAIN OBSERVE WRAPPER =================
const ObserveTab = () => {
    const [phone, setPhone] = useState("");
    const [trigger, setTrigger] = useState(0);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState(null);

    const handleSearch = () => {
        if(!phone) return;
        setIsSearching(true);
        setTrigger(t => t + 1);
        setTimeout(() => setIsSearching(false), 500);
    };

    if (selectedBooking) {
        return <BookingDetailPage booking={selectedBooking} onBack={() => setSelectedBooking(null)} phone={phone} />;
    }

    return (
        <div>
            <h2 className="cp-section-title">👀 Quan sát dịch vụ</h2>
            <p className="cp-section-sub">Nhập SĐT để tra cứu tiến trình, phí và xem camera</p>
            <div className="cp-card">
                <div className="cp-search-row">
                    <input className="cp-input" placeholder="Nhập số điện thoại đặt lịch..." value={phone} onChange={(e) => setPhone(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
                    <button className="cp-btn cp-btn-primary" onClick={handleSearch} disabled={isSearching}>
                        {isSearching ? <span className="cp-spinner"></span> : "Tìm kiếm"}
                    </button>
                </div>
            </div>
            <TrackingTab phone={phone} trigger={trigger} onSelectBooking={setSelectedBooking} />
        </div>
    );
};

// ================= MODIFY TRACKING =================
const TrackingTab = ({ phone, trigger, onSelectBooking }) => {
    const [bookings, setBookings] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    useEffect(() => {
        if (!phone) return;
        setIsLoading(true); setHasSearched(true);
        fetch(`${API}/bookings/track?phone=${phone}`).then(r => r.json()).then(d => { setBookings(Array.isArray(d) ? d : []); setIsLoading(false); }).catch(() => { setBookings([]); setIsLoading(false); });
    }, [trigger]);

    if (!hasSearched) return null;
    if (isLoading) return <div className="cp-loading"><div className="cp-loading-spinner"></div><p>Đang tra cứu...</p></div>;
    if (bookings.length === 0) return <div className="cp-empty"><div className="cp-empty-icon">🔍</div><h3>Không tìm thấy lịch sử</h3><p>Số điện thoại {phone} chưa có đặt lịch nào.</p></div>;

    return (
        <div className="cp-tracking-list">
            <h2 className="cp-section-title cp-section-title-sm">📊 Danh sách dịch vụ</h2>
            <div className="cp-booking-list">
                {bookings.map((b, i) => {
                    const lateInfo = calculateLateFee(b.check_out);
                    const needsSigning = b.status === 'pending' && b.contract_status !== 'signed';
                    return (
                        <div key={i} className={`cp-booking-item clickable ${needsSigning ? 'needs-signing' : ''}`} onClick={() => onSelectBooking(b)}>
                            <div className="cp-booking-header">
                                <div className="cp-booking-info">
                                    <h3>🐱 {b.cat_name} {b.cat_breed ? `(${b.cat_breed})` : ""}</h3>
                                    <p>Phòng: {b.room_name || 'Chưa phân bổ'}</p>
                                </div>
                                <span className={`cp-status-badge ${needsSigning ? 'pending' : b.status}`}>
                                    {needsSigning ? '🔒 Chờ ký HĐ' : b.status === 'active' ? '🟢 Đang phục vụ' : b.status === 'pending' ? '🟡 Chờ nhận' : '⚫ Hoàn thành'}
                                </span>
                            </div>

                            <div className="cp-booking-dates">
                                <div className="cp-date-info"><span>📥</span> <span>{b.check_in}</span></div>
                                <div className="cp-date-info"><span>📤</span> <span>{b.check_out}</span></div>
                            </div>

                            {needsSigning && (
                                <div className="cp-booking-alert warn">
                                    <span>⚠️ Yêu cầu ký hợp đồng để nhận mèo</span>
                                    <span>&rarr;</span>
                                </div>
                            )}

                            {lateInfo.isLate && b.status === 'active' && (
                                <div className="cp-booking-alert late">
                                    <span>⚠️ Đang bị trễ hạn</span>
                                    <span>+{formatCurrency(lateInfo.fee)}</span>
                                </div>
                            )}

                            <div className="cp-booking-cta">Nhấn để xem chi tiết &rarr;</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default function ClientObserve() {
    return <ObserveTab />;
}
