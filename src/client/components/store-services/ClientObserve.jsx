import React, { useState, useEffect, useRef } from "react";
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
        <div style={{marginTop: 16}}>
            <div style={{border: '2px dashed #d1d5db', borderRadius: 12, overflow: 'hidden', background: '#fafafa', position: 'relative'}}>
                <canvas ref={canvasRef} width={500} height={150} style={{width: '100%', height: 150, cursor: 'crosshair', display: 'block', touchAction: 'none'}}
                    onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                    onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
                <div style={{position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', color:'#9ca3af', fontSize:14, pointerEvents:'none'}}>Ký tên tại đây...</div>
            </div>
            <div style={{display:'flex', gap:10, marginTop:12}}>
                <button onClick={clear} className="cp-btn" style={{flex:1, background:'#f3f4f6', color:'#374151'}}>Xóa ký lại</button>
                <button onClick={() => onSave(canvasRef.current.toDataURL())} className="cp-btn cp-btn-primary" style={{flex:1}}>✅ Xác nhận & Bắt đầu dịch vụ</button>
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
            // Gọi API lưu chữ ký VÀ chuyển trạng thái sang active
            const res = await fetch(`${API}/bookings/${currentBooking.id}/activate`, {
                method: 'POST', 
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ 
                    signature: signatureImg, 
                    signed_at: new Date().toISOString(),
                    action: 'sign_and_activate' // Backend nhận cờ này để update cả status lẫn contract
                })
            });
            
            if(res.ok) {
                setIsSigned(true);
                // Cập nhật local state để UI mở khóa ngay lập tức không cần reload
                setCurrentBooking(prev => ({...prev, status: 'active'}));
                setActiveTab('timeline'); // Chuyển về tab tiến trình
            } else {
                alert("Lỗi hệ thống, vui lòng nhờ nhân viên kiểm tra lại.");
            }
        } catch(err) { 
            alert("Lỗi kết nối mạng"); 
        }
    };

    return (
        <div style={{position: 'fixed', inset: 0, background: '#f8fafc', zIndex: 1000, overflowY: 'auto'}}>
            <div style={{maxWidth: 600, margin: '0 auto', padding: 20}}>
                {/* Header */}
                <div style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, background: 'white', padding: '16px', borderRadius: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.05)'}}>
                    <button onClick={onBack} style={{fontSize: 24, background: 'none', border: 'none', cursor: 'pointer'}}>←</button>
                    <div style={{flex: 1}}>
                        <h3 style={{margin: 0}}>🐱 {currentBooking.cat_name}</h3>
                        <p style={{margin: 0, fontSize: 13, color: '#6b7280'}}>Phòng: {currentBooking.room_name || 'Chưa phân bổ'}</p>
                    </div>
                    <span className={`cp-status-badge ${isLocked ? 'pending' : currentBooking.status}`}>
                        {isLocked ? '🔒 Chờ ký HĐ' : currentBooking.status === 'active' ? '🟢 Đang phục vụ' : currentBooking.status}
                    </span>
                </div>

                {/* WARNING BANNER NẾU DỊCH VỤ BỊ KHÓA */}
                {isLocked && (
                    <div style={{
                        background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', 
                        border: '2px solid #f59e0b', borderRadius: 16, padding: 20, marginBottom: 20, textAlign: 'center'
                    }}>
                        <div style={{fontSize: 40, marginBottom: 8}}>🔒</div>
                        <h3 style={{margin: '0 0 8px', color: '#92400e'}}>DỊCH VỤ CHƯA BẮT ĐẦU</h3>
                        <p style={{margin: 0, fontSize: 14, color: '#a16207', lineHeight: 1.5}}>
                            Cửa hàng chưa tiếp nhận bé mèo. Vui lòng đọc kỹ các điều khoản và ký hợp đồng điện tử bên dưới để xác nhận gửi mèo.
                        </p>
                    </div>
                )}

                {/* Countdown Box - CHỈ HIỆN KHI ĐÃ KÝ (Active) */}
                {!isLocked && (
                    <div style={{background: timeLeft.isExpired ? '#fef2f2' : '#f0fdf4', border: `1px solid ${timeLeft.isExpired ? '#fca5a5' : '#86efac'}`, borderRadius: 12, padding: 16, marginBottom: 20, textAlign: 'center'}}>
                        <div style={{fontSize: 13, color: timeLeft.isExpired ? '#b91c1c' : '#166534', marginBottom: 4}}>
                            {timeLeft.isExpired ? '⚠️ ĐÃ HẾT HẠN DỊCH VỤ' : '⏰ Thời gian còn lại đến khi trả mèo'}
                        </div>
                        <div style={{fontSize: 24, fontWeight: 800, color: timeLeft.isExpired ? '#dc2626' : '#15803d', fontFamily: 'monospace'}}>
                            {timeLeft.text}
                        </div>
                        {lateInfo.isLate && (
                            <div style={{marginTop: 10, fontSize: 14, color: '#dc2626', fontWeight: 600}}>
                                Phí phụ thu hiện tại: +{formatCurrency(lateInfo.fee)}
                            </div>
                        )}
                    </div>
                )}

                {/* Tabs */}
                <div style={{display: 'flex', background: '#e2e8f0', borderRadius: 12, padding: 4, marginBottom: 20}}>
                    {/* Nếu bị khóa, ép chuyển sang tab Hợp đồng, ẩn tab khác đi hoặc làm mờ */}
                    <button onClick={() => !isLocked && setActiveTab('timeline')} style={{flex: 1, padding: 10, border: 'none', borderRadius: 10, fontWeight: 600, cursor: isLocked ? 'not-allowed' : 'pointer', fontSize: 13, opacity: isLocked ? 0.5 : 1, background: activeTab === 'timeline' && !isLocked ? 'white' : 'transparent', color: activeTab === 'timeline' && !isLocked ? '#0ea5e9' : '#64748b'}}>
                        📊 Tiến trình
                    </button>
                    <button onClick={() => setActiveTab('contract')} style={{flex: 1, padding: 10, border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer', fontSize: 13, background: activeTab === 'contract' ? 'white' : 'transparent', color: activeTab === 'contract' ? (isLocked ? '#f59e0b' : '#0ea5e9') : '#64748b', boxShadow: activeTab === 'contract' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'}}>
                        📝 Hợp đồng {isLocked && '(Bắt buộc)'}
                    </button>
                    <button onClick={() => !isLocked && setActiveTab('camera')} style={{flex: 1, padding: 10, border: 'none', borderRadius: 10, fontWeight: 600, cursor: isLocked ? 'not-allowed' : 'pointer', fontSize: 13, opacity: isLocked ? 0.5 : 1, background: activeTab === 'camera' && !isLocked ? 'white' : 'transparent', color: activeTab === 'camera' && !isLocked ? '#0ea5e9' : '#64748b'}}>
                        📹 Camera
                    </button>
                </div>

                {/* Tab Content */}
                <div className="cp-card" style={{padding: 20}}>
                    
                    {/* KHÓA TAB TIMELINE NẾU CHƯA KÝ */}
                    {activeTab === 'timeline' && isLocked && (
                        <div style={{textAlign:'center', padding: 40, color:'#9ca3af'}}>
                            <div style={{fontSize:40, marginBottom:10}}>🚫</div>
                            <p>Vui lòng hoàn tất ký hợp đồng để xem tiến trình dịch vụ.</p>
                        </div>
                    )}

                    {/* TIMELINE TAB (Chỉ hiện khi active) */}
                    {activeTab === 'timeline' && !isLocked && (
                        <div>
                            <h4 style={{marginTop:0, marginBottom: 20}}>Chi tiết dịch vụ</h4>
                            <div style={{display: 'flex', flexDirection: 'column', gap: 20, paddingLeft: 20, borderLeft: '2px solid #e5e7eb'}}>
                                {[
                                    {label: 'Ngày nhận mèo', val: currentBooking.check_in, done: true},
                                    {label: 'Đang chăm sóc', val: `${pricing.days} ngày`, done: currentBooking.status === 'completed'},
                                    {label: 'Ngày trả mèo', val: currentBooking.check_out, done: timeLeft.isExpired},
                                ].map((item, i) => (
                                    <div key={i} style={{position: 'relative', paddingLeft: 20}}>
                                        <div style={{position: 'absolute', left: -26, width: 12, height: 12, borderRadius: '50%', background: item.done ? '#10b981' : '#d1d5db', border: '2px solid white'}}></div>
                                        <div style={{fontSize: 13, color: '#6b7280'}}>{item.label}</div>
                                        <div style={{fontWeight: 700}}>{item.val}</div>
                                    </div>
                                ))}
                            </div>
                            <div style={{marginTop: 24, padding: 16, background: '#f9fafb', borderRadius: 12}}>
                                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 8}}><span>Đơn giá ({pricing.days} ngày)</span><span>{formatCurrency(pricing.unitPrice)}/ngày</span></div>
                                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 8}}><span>Thành tiền</span><span style={{fontWeight: 700}}>{formatCurrency(pricing.total)}</span></div>
                                {lateInfo.isLate && (<div style={{display: 'flex', justifyContent: 'space-between', color: '#dc2626', borderTop: '1px solid #e5e7eb', paddingTop: 8}}><span>Phí nhận trễ</span><span style={{fontWeight: 700}}>+{formatCurrency(lateInfo.fee)}</span></div>)}
                            </div>
                        </div>
                    )}

                    {/* CONTRACT TAB (LUÔN HIỆN) */}
                    {activeTab === 'contract' && (
                        <div>
                            <h4 style={{marginTop:0}}>HỢP ĐỒNG CHĂM SÓC THÚ CƯNG</h4>
                            <div style={{fontSize: 13, lineHeight: 1.8, color: '#374151', marginBottom: 20}}>
                                <p>1. Tôi đồng ý gửi <strong>{currentBooking.cat_name}</strong> từ ngày <strong>{currentBooking.check_in}</strong> đến <strong>{currentBooking.check_out}</strong>.</p>
                                <p>2. Chi phí dịch vụ là <strong>{formatCurrency(pricing.total)}</strong> ({pricing.days} ngày x {formatCurrency(pricing.unitPrice)}). Phí phát sinh nếu nhận trễ sẽ được tính theo quy định.</p>
                                <p style={{color: '#dc2626', fontWeight: 600, background: '#fef2f2', padding: '8px 12px', borderRadius: 8}}>
                                    3. QUAN TRỌNG: Nếu quá 14 ngày kể từ ngày hẹn trả mà không liên lạc và không nhận lại thú cưng, cửa hàng sẽ xem đây là hành vi "BỎ THÚ CƯNG". Cửa hàng có quyền chuyển giao thú cưng cho tổ chức cứu hộ.
                                </p>
                                <p>4. Cửa hàng cam kết chăm sóc tốt nhất, nhưng sẽ không chịu trách nhiệm bồi thường nếu xảy ra bệnh lý lây nhiễm ngầm.</p>
                            </div>
                            
                            {isSigned ? (
                                <div style={{textAlign: 'center', padding: 20, background: '#f0fdf4', borderRadius: 12}}>
                                    <div style={{fontSize: 40, marginBottom: 10}}>✅</div>
                                    <h4 style={{margin:0, color: '#166534'}}>Hợp đồng đã được ký & Dịch vụ đã bắt đầu</h4>
                                </div>
                            ) : (
                                <div style={{borderTop: '2px solid #fbbf24', paddingTop: 16}}>
                                    <p style={{fontWeight: 600, color: '#92400e'}}>⚠️ Vui lòng đọc kỹ và ký xác nhận bên dưới để nhận mèo</p>
                                    <SignaturePad onSave={handleSignContract} />
                                </div>
                            )}
                        </div>
                    )}

                    {/* KHÓA TAB CAMERA NẾU CHƯA KÝ */}
                    {activeTab === 'camera' && isLocked && (
                        <div style={{textAlign:'center', padding: 40, color:'#9ca3af'}}>
                            <div style={{fontSize:40, marginBottom:10}}>🔒</div>
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
                                                    <button onClick={() => setViewCam(c)} style={{position:'absolute',bottom:10,right:10,background:'rgba(0,0,0,0.6)',color:'white',border:'none',borderRadius:8,padding:'6px 12px',cursor:'pointer',fontSize:13}}>⛶ Toàn màn hình</button>
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
                <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.9)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={() => setViewCam(null)}>
                    <div style={{width:'90vw',height:'80vh',position:'relative'}} onClick={e => e.stopPropagation()}>
                        <button onClick={() => setViewCam(null)} style={{position:'absolute',top:10,right:10,zIndex:10,background:'rgba(255,255,255,0.2)',border:'none',color:'white',width:36,height:36,borderRadius:'50%',fontSize:18,cursor:'pointer'}}>✕</button>
                        <iframe src={viewCam.stream_url} style={{width:'100%',height:'100%',border:'none',borderRadius:12}} allow="autoplay; encrypted-media" title="full" />
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
                <div style={{ display: "flex", gap: 12 }}>
                    <input className="cp-input" style={{flex: 1}} placeholder="Nhập số điện thoại đặt lịch..." value={phone} onChange={(e) => setPhone(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
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
        <div style={{marginBottom: 30}}>
            <h2 className="cp-section-title" style={{fontSize: '1.3rem', marginTop: 10}}>📊 Danh sách dịch vụ</h2>
            <div className="cp-booking-list">
                {bookings.map((b, i) => {
                    const lateInfo = calculateLateFee(b.check_out);
                    const needsSigning = b.status === 'pending' && b.contract_status !== 'signed';
                    return (
                        <div key={i} className="cp-booking-item" style={{cursor: 'pointer', borderLeft: needsSigning ? '4px solid #f59e0b' : '4px solid transparent'}} onClick={() => onSelectBooking(b)}>
                            <div className="cp-booking-header">
                                <div className="cp-booking-info">
                                    <h3>🐱 {b.cat_name} {b.cat_breed ? `(${b.cat_breed})` : ""}</h3>
                                    <p>Phòng: {b.room_name || 'Chưa phân bổ'}</p>
                                </div>
                                <span className={`cp-status-badge ${needsSigning ? 'pending' : b.status}`}>
                                    {needsSigning ? '🔒 Chờ ký HĐ' : b.status === 'active' ? '🟢 Đang phục vụ' : b.status === 'pending' ? '🟡 Chờ nhận' : '⚫ Hoàn thành'}
                                </span>
                            </div>
                            
                            <div className="cp-booking-dates" style={{marginBottom: 8}}>
                                <div className="cp-date-info"><span>📥</span> <span>{b.check_in}</span></div>
                                <div className="cp-date-info"><span>📤</span> <span>{b.check_out}</span></div>
                            </div>

                            {needsSigning && (
                                <div style={{background: '#fffbeb', padding: '8px 12px', borderRadius: 8, fontSize: 13, color: '#92400e', fontWeight: 600, display: 'flex', justifyContent: 'space-between'}}>
                                    <span>⚠️ Yêu cầu ký hợp đồng để nhận mèo</span>
                                    <span>&rarr;</span>
                                </div>
                            )}

                            {lateInfo.isLate && b.status === 'active' && (
                                <div style={{background: '#fef2f2', padding: '8px 12px', borderRadius: 8, fontSize: 13, color: '#dc2626', fontWeight: 600, display: 'flex', justifyContent: 'space-between'}}>
                                    <span>⚠️ Đang bị trễ hạn</span>
                                    <span>+{formatCurrency(lateInfo.fee)}</span>
                                </div>
                            )}
                            
                            <div style={{textAlign: 'right', marginTop: 8, fontSize: 12, color: '#6b7280'}}>Nhấn để xem chi tiết &rarr;</div>
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