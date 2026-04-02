import React, { useState, useEffect } from "react";
import "../../styles/client/client_portal.css";

const API = import.meta.env.VITE_API_URL || "/api";

// ================= WRAPPER OBSERVE =================
const ObserveTab = () => {
  const [phone, setPhone] = useState("");
  const [trigger, setTrigger] = useState(0);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = () => {
    if(!phone) return;
    setIsSearching(true);
    setTrigger(t => t + 1);
    setTimeout(() => setIsSearching(false), 500); 
  };

  return (
    <div>
      <h2 className="cp-section-title">👀 Quan sát dịch vụ</h2>
      <p className="cp-section-sub">Nhập SĐT để tra cứu tiến trình và xem camera</p>

      <div className="cp-card">
        <div style={{ display: "flex", gap: 12 }}>
          <input 
            className="cp-input" 
            style={{flex: 1}}
            placeholder="Nhập số điện thoại đặt lịch..." 
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button className="cp-btn cp-btn-primary" onClick={handleSearch} disabled={isSearching}>
            {isSearching ? <span className="cp-spinner"></span> : "Tìm kiếm"}
          </button>
        </div>
      </div>

      <TrackingTab phone={phone} trigger={trigger} />
      <CameraTab phone={phone} trigger={trigger} />
    </div>
  );
};

// ================= MODIFY TRACKING (TỰ TÍNH PROGRESS TỪ NGÀY) =================
const TrackingTab = ({ phone, trigger }) => {
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const calculateProgress = (check_in, check_out, status) => {
    if (status === 'completed') return 100;
    if (status === 'pending') return 0;
    const start = new Date(check_in).getTime();
    const end = new Date(check_out).getTime();
    const now = Date.now();
    if (now <= start) return 0;
    if (now >= end) return 100;
    return Math.round(((now - start) / (end - start)) * 100);
  };

  useEffect(() => {
    if (!phone) return;
    setIsLoading(true);
    setHasSearched(true);
    
    fetch(`${API}/bookings/track?phone=${phone}`)
      .then(r => r.json())
      .then(d => {
        setBookings(Array.isArray(d) ? d : []);
        setIsLoading(false);
      })
      .catch(() => {
        setBookings([]);
        setIsLoading(false);
      });
  }, [trigger]);

  if (!hasSearched) return null;
  if (isLoading) return <div className="cp-loading"><div className="cp-loading-spinner"></div><p>Đang tra cứu...</p></div>;
  if (bookings.length === 0) return (
    <div className="cp-empty">
      <div className="cp-empty-icon">🔍</div>
      <h3>Không tìm thấy lịch sử</h3>
      <p>Số điện thoại {phone} chưa có đặt lịch nào.</p>
    </div>
  );

  return (
    <div style={{marginBottom: 30}}>
      <h2 className="cp-section-title" style={{fontSize: '1.3rem', marginTop: 10}}>📊 Tiến trình dịch vụ</h2>
      <div className="cp-booking-list">
        {bookings.map((b, i) => {
          const progress = calculateProgress(b.check_in, b.check_out, b.status);
          const status = b.status || 'pending';
          
          return (
            <div key={i} className="cp-booking-item">
              <div className="cp-booking-header">
                <div className="cp-booking-info">
                  <h3>🐱 {b.cat_name} {b.cat_breed ? `(${b.cat_breed})` : ""}</h3>
                  <p>Dịch vụ: {b.service === 'day' ? 'Gửi ngày' : b.service === 'night' ? 'Gửi đêm' : 'Khác'} - Phòng: {b.room_name || 'Chưa phân bổ'}</p>
                </div>
                <span className={`cp-status-badge ${status}`}>
                  {status === 'active' ? '🟢 Đang phục vụ' : status === 'pending' ? '🟡 Chờ nhận' : '⚫ Hoàn thành'}
                </span>
              </div>
              
              {status === 'active' && (
                <div className="cp-progress-wrap">
                  <div className="cp-progress-label">
                    <span>Tiến trình</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="cp-progress-bar">
                    <div className="cp-progress-fill" style={{ width: `${progress}%` }}></div>
                  </div>
                </div>
              )}

              <div className="cp-booking-dates">
                <div className="cp-date-info">
                  <span>📥</span> <span>Nhận: {b.check_in}</span>
                </div>
                <div className="cp-date-info">
                  <span>📤</span> <span>Trả: {b.check_out}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ================= CAMERA =================
const CameraTab = ({ phone, trigger }) => {
  const [cams, setCams] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [viewingCamera, setViewingCamera] = useState(null);

  useEffect(() => {
    if (!phone) return;
    setIsLoading(true);
    setHasSearched(true);
    
    fetch(`${API}/bookings/cameras?phone=${phone}`)
      .then(r => r.json())
      .then(d => {
        setCams(Array.isArray(d) ? d : []);
        setIsLoading(false);
      })
      .catch(() => {
        setCams([]);
        setIsLoading(false);
      });
  }, [trigger]);

  if (!hasSearched) return null;

  if (isLoading) {
    return (
      <div className="cp-loading">
        <div className="cp-loading-spinner"></div>
        <p>Đang tải camera...</p>
      </div>
    );
  }

  if (cams.length === 0) {
    return (
      <div className="cp-empty" style={{ marginTop: 20 }}>
        <div className="cp-empty-icon">📹</div>
        <h3>Không có camera nào</h3>
        <p>Đơn hàng của bạn chưa được phân phòng, chưa bắt đầu phục vụ, hoặc phòng chưa được lắp camera.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="cp-section-title" style={{fontSize: '1.3rem', marginTop: 10}}>📹 Camera quan sát</h2>
      <p className="cp-section-sub">Camera được cấp quyền truy cập riêng cho bé của bạn</p>
      
      <div className="cp-camera-grid">
        {cams.map((c) => {
          const isOnline = c.status === 'online'; 

          return (
            <div key={c.id} className="cp-camera-card">
              <div className="cp-camera-feed">
                {isOnline ? (
                  <>
                    <div className="cp-camera-live-badge"><div className="cp-live-dot"></div> LIVE</div>
                    <iframe className="cp-camera-iframe" src={c.stream_url} title="cam" allow="autoplay; encrypted-media" />
                    
                    <button 
                      onClick={() => setViewingCamera(c)}
                      style={{
                        position: 'absolute', bottom: 10, right: 10,
                        background: 'rgba(0,0,0,0.6)', color: 'white',
                        border: 'none', borderRadius: '8px', padding: '6px 12px',
                        cursor: 'pointer', fontSize: '13px', fontWeight: 700,
                        fontFamily: 'var(--cp-font)', backdropFilter: 'blur(4px)',
                        zIndex: 10, display: 'flex', alignItems: 'center', gap: 4,
                        transition: 'background 0.2s'
                      }}
                      onMouseOver={(e) => e.target.style.background = 'rgba(0,0,0,0.9)'}
                      onMouseOut={(e) => e.target.style.background = 'rgba(0,0,0,0.6)'}
                    >
                      ⛶ Phóng to
                    </button>
                  </>
                ) : (
                  <div className="cp-camera-offline">
                    <span>🔒</span>
                    <span>Camera đang ngoại tuyến</span>
                  </div>
                )}
              </div>
              <div className="cp-camera-info">
                <div className="cp-camera-name">{c.room_name || `Camera`}</div>
                <div className="cp-camera-room">📍 Phòng: {c.room_name}</div>
                <div className={`cp-camera-status ${isOnline ? 'online' : 'offline'}`}>
                  <div className="cp-status-dot"></div>
                  {isOnline ? 'Đang hoạt động' : 'Ngoại tuyến'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* GIAO DIỆN XEM VIDEO TOÀN MÀN HÌNH */}
      {viewingCamera && (
        <div 
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)',
            zIndex: 9998, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', padding: 20
          }}
          onClick={() => setViewingCamera(null)}
        >
          <div 
            style={{
              width: '100%', maxWidth: '90vw', height: '80vh', background: '#000',
              borderRadius: 16, overflow: 'hidden', position: 'relative',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, padding: '15px 20px',
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)',
              zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <span style={{ color: 'white', fontSize: 16, fontWeight: 700, fontFamily: 'var(--cp-font)' }}>
                📹 {viewingCamera.room_name || "Camera"} - LIVE
              </span>
              <button 
                onClick={() => setViewingCamera(null)}
                style={{
                  background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white',
                  width: 36, height: 36, borderRadius: '50%', fontSize: 18,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >✕</button>
            </div>
            <iframe 
              src={viewingCamera.stream_url} 
              style={{ width: '100%', height: '100%', border: 'none' }} 
              allow="autoplay; encrypted-media" title="fullscreen-cam"
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Export component chính của tab này
export default function ClientObserve() {
  return <ObserveTab />;
}