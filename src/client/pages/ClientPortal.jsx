import React, { useState, useEffect, useCallback } from "react";
import "../../styles/client/client_portal.css";

const API = import.meta.env.VITE_API_URL || "/api";

const SERVICES = [
  { id: "day",   icon: "☀️", name: "Gửi theo ngày",   price: "80.000đ/ngày",      desc: "Không qua đêm" },
  { id: "week",  icon: "🌙", name: "Gửi theo tuần",   price: "500.000đ/tuần",     desc: "Tối đa 7 ngày" },
  { id: "month", icon: "⭐", name: "Gửi theo tháng",  price: "1.800.000đ/tháng",  desc: "Ưu đãi dài hạn" },
];

const DAY_NAMES = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const MONTH_NAMES = ["Tháng 1","Tháng 2","Tháng 3","Tháng 4","Tháng 5","Tháng 6",
                     "Tháng 7","Tháng 8","Tháng 9","Tháng 10","Tháng 11","Tháng 12"];

const fmtDate  = (d) => new Date(d).toLocaleDateString("vi-VN");
const diffDays = (a, b) => Math.max(0, Math.ceil((new Date(b) - new Date(a)) / 86400000));
const progressPct = (start, end) => {
  const total   = diffDays(start, end);
  const elapsed = diffDays(start, new Date());
  if (total === 0) return 100;
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
};

const getAvailStatus = (available, total) => {
  if (total === 0 || available === undefined) return { color: "gray", label: "—" };
  if (available === 0) return { color: "full", label: "Hết" };
  if (available <= Math.ceil(total / 3)) return { color: "low", label: `${available}` };
  return { color: "open", label: `${available}` };
};

// ── Tab: Đặt lịch ─────────────────────────────────────────────────────────────
const BookingTab = ({ onSuccess }) => {
  const [form, setForm] = useState({
    cat_name: "", cat_breed: "", owner_name: "", owner_phone: "",
    service: "day", room_id: "", check_in: "", check_out: "", note: "",
  });
  const [avail,    setAvail]    = useState(null);
  const [checking, setChecking] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [errors,   setErrors]   = useState({});

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!form.check_in || !form.check_out || form.check_out <= form.check_in) {
      setAvail(null); return;
    }
    setChecking(true);
    fetch(`${API}/bookings/check-availability?check_in=${form.check_in}&check_out=${form.check_out}`)
      .then(r => r.json())
      .then(d => { setAvail(d); setChecking(false); })
      .catch(() => setChecking(false));
  }, [form.check_in, form.check_out]);

  const validate = () => {
    const e = {};
    if (!form.cat_name.trim())    e.cat_name    = "Nhập tên mèo";
    if (!form.owner_name.trim())  e.owner_name  = "Nhập tên chủ";
    if (!form.owner_phone.trim()) e.owner_phone = "Nhập số điện thoại";
    if (!form.check_in)           e.check_in    = "Chọn ngày nhận";
    if (!form.check_out)          e.check_out   = "Chọn ngày trả";
    if (form.check_in && form.check_out && form.check_out <= form.check_in)
      e.check_out = "Ngày trả phải sau ngày nhận";
    if (avail && avail.available === 0)
      e.check_out = "Không còn phòng trống trong khoảng thời gian này";
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setSaving(true);
    try {
      const res = await fetch(`${API}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi");
      setForm({ cat_name:"", cat_breed:"", owner_name:"", owner_phone:"",
                service:"day", room_id:"", check_in:"", check_out:"", note:"" });
      setAvail(null);
      onSuccess("🎉 Đặt lịch thành công! Chúng tôi sẽ liên hệ xác nhận sớm.");
    } catch (err) {
      onSuccess(`❌ ${err.message || "Lỗi đặt lịch, vui lòng thử lại."}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <div>
      <h2 className="cp-section-title">📅 Đặt lịch gửi mèo</h2>
      <p className="cp-section-sub">Điền thông tin để đặt lịch, chúng tôi sẽ xác nhận qua điện thoại.</p>

      <div className="cp-card">
        <div className="cp-card-title">🛎️ Chọn gói dịch vụ</div>
        <div className="cp-service-options">
          {SERVICES.map(s => (
            <div key={s.id}
              className={`cp-service-option ${form.service === s.id ? "selected" : ""}`}
              onClick={() => set("service", s.id)}>
              <div className="cp-service-icon">{s.icon}</div>
              <div className="cp-service-name">{s.name}</div>
              <div className="cp-service-price">{s.price}</div>
              <div className="cp-service-desc">{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="cp-card">
        <div className="cp-card-title">🐱 Thông tin bé mèo</div>
        <div className="cp-form-grid">
          <div className="cp-field">
            <label className="cp-label">Tên mèo *</label>
            <input className="cp-input" placeholder="Milo, Luna, Bông..."
              value={form.cat_name} onChange={e => set("cat_name", e.target.value)} />
            {errors.cat_name && <span className="cp-field-error">{errors.cat_name}</span>}
          </div>
          <div className="cp-field">
            <label className="cp-label">Giống mèo</label>
            <input className="cp-input" placeholder="Mèo ta, Anh lông ngắn..."
              value={form.cat_breed} onChange={e => set("cat_breed", e.target.value)} />
          </div>
        </div>
      </div>

      <div className="cp-card">
        <div className="cp-card-title">👤 Thông tin chủ mèo</div>
        <div className="cp-form-grid">
          <div className="cp-field">
            <label className="cp-label">Họ tên *</label>
            <input className="cp-input" placeholder="Nguyễn Văn A"
              value={form.owner_name} onChange={e => set("owner_name", e.target.value)} />
            {errors.owner_name && <span className="cp-field-error">{errors.owner_name}</span>}
          </div>
          <div className="cp-field">
            <label className="cp-label">Số điện thoại *</label>
            <input className="cp-input" placeholder="0901234567" type="tel"
              value={form.owner_phone} onChange={e => set("owner_phone", e.target.value)} />
            {errors.owner_phone && <span className="cp-field-error">{errors.owner_phone}</span>}
          </div>
        </div>
      </div>

      <div className="cp-card">
        <div className="cp-card-title">🗓️ Thời gian & Phòng</div>
        <div className="cp-form-grid">
          <div className="cp-field">
            <label className="cp-label">Ngày nhận mèo *</label>
            <input className="cp-input" type="date" min={today}
              value={form.check_in} onChange={e => set("check_in", e.target.value)} />
            {errors.check_in && <span className="cp-field-error">{errors.check_in}</span>}
          </div>
          <div className="cp-field">
            <label className="cp-label">Ngày trả mèo *</label>
            <input className="cp-input" type="date" min={form.check_in || today}
              value={form.check_out} onChange={e => set("check_out", e.target.value)} />
            {errors.check_out && <span className="cp-field-error">{errors.check_out}</span>}
          </div>
        </div>

        {form.check_in && form.check_out && form.check_out > form.check_in && (
          <div className="cp-avail-result">
            {checking ? (
              <div className="cp-avail-checking">⏳ Đang kiểm tra phòng trống...</div>
            ) : avail ? (
              <>
                <div className={`cp-avail-banner ${avail.available === 0 ? "full" : avail.available <= Math.ceil(avail.total_rooms / 3) ? "low" : "open"}`}>
                  <div className="cp-avail-main">
                    {avail.available === 0 ? (
                      <><span className="cp-avail-icon">🔴</span><strong>Hết phòng</strong> trong khoảng {fmtDate(form.check_in)} – {fmtDate(form.check_out)}</>
                    ) : avail.available <= Math.ceil(avail.total_rooms / 3) ? (
                      <><span className="cp-avail-icon">🟡</span>Còn <strong>{avail.available}/{avail.total_rooms} phòng</strong> — sắp hết!</>
                    ) : (
                      <><span className="cp-avail-icon">🟢</span>Còn <strong>{avail.available}/{avail.total_rooms} phòng trống</strong></>
                    )}
                  </div>
                  <div className="cp-avail-days">⏱ {diffDays(form.check_in, form.check_out)} ngày</div>
                </div>
                {avail.available > 0 && (
                  <div className="cp-field" style={{marginTop:12}}>
                    <label className="cp-label">Chọn phòng cụ thể (tuỳ chọn)</label>
                    <select className="cp-select" value={form.room_id}
                      onChange={e => set("room_id", e.target.value)}>
                      <option value="">— Tự động chọn phòng tốt nhất —</option>
                      {avail.available_rooms.map(r => (
                        <option key={r.id} value={r.id}>{r.name} ({r.id})</option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}

        <div className="cp-field" style={{marginTop:12}}>
          <label className="cp-label">Ghi chú</label>
          <input className="cp-input" placeholder="Mèo cần thuốc, dị ứng thức ăn..."
            value={form.note} onChange={e => set("note", e.target.value)} />
        </div>
      </div>

      <button className="cp-btn cp-btn-primary cp-btn-full" onClick={handleSubmit}
        disabled={saving || (avail && avail.available === 0)}>
        {saving ? <span className="cp-spinner" /> : "🐾 Xác nhận đặt lịch"}
      </button>
    </div>
  );
};

// ── Tab: Lịch trống ────────────────────────────────────────────────────────────
const ScheduleTab = () => {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [calData, setCalData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/bookings/calendar?year=${currentDate.getFullYear()}&month=${currentDate.getMonth()+1}`)
      .then(r => r.json())
      .then(d => { setCalData(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [currentDate]);

  const prevMonth = () => { setSelectedDay(null); setCurrentDate(d => new Date(d.getFullYear(), d.getMonth()-1, 1)); };
  const nextMonth = () => { setSelectedDay(null); setCurrentDate(d => new Date(d.getFullYear(), d.getMonth()+1, 1)); };
  const firstDay  = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const isPast = (day) => {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return d < new Date(today.getFullYear(), today.getMonth(), today.getDate());
  };
  const isToday_ = (day) =>
    today.getFullYear() === currentDate.getFullYear() &&
    today.getMonth()    === currentDate.getMonth()    &&
    today.getDate()     === day;

  const selectedDayData = calData.find(d => d.day === selectedDay);

  return (
    <div>
      <h2 className="cp-section-title">📆 Lịch đặt phòng</h2>
      <p className="cp-section-sub">Số trong ô = số phòng còn trống trong ngày đó.</p>

      <div className="cp-card">
        <div className="cp-calendar-header">
          <div className="cp-calendar-nav">
            <button onClick={prevMonth}>‹</button>
            <span className="cp-calendar-month">{MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
            <button onClick={nextMonth}>›</button>
          </div>
          {calData[0] && (
            <span style={{fontSize:"0.8rem",color:"var(--text-gray)",fontWeight:600}}>
              Tổng {calData[0].total_rooms} phòng
            </span>
          )}
        </div>

        {loading ? (
          <div className="cp-loading"><div className="cp-loading-spinner" /><span>Đang tải...</span></div>
        ) : (
          <>
            <div className="cp-calendar-grid">
              {DAY_NAMES.map(d => <div key={d} className="cp-cal-day-name">{d}</div>)}
              {Array(firstDay).fill(null).map((_, i) => <div key={`e${i}`} className="cp-cal-day empty" />)}
              {calData.map(({ day, available, total_rooms }) => {
                const past     = isPast(day);
                const todayDay = isToday_(day);
                const selected = selectedDay === day;
                const st       = getAvailStatus(available, total_rooms);
                let cls = "cp-cal-day";
                if (past)     cls += " past";
                else          cls += ` avail-${st.color}`;
                if (todayDay) cls += " today";
                if (selected) cls += " selected";
                return (
                  <div key={day} className={cls}
                    onClick={() => !past && setSelectedDay(selected ? null : day)}>
                    <span className="cp-cal-day-num">{day}</span>
                    {!past && total_rooms > 0 && (
                      <span className="cp-cal-avail-count">
                        {available > 0 ? available : "—"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="cp-legend">
              <div className="cp-legend-item"><div className="cp-legend-dot" style={{background:"#86efac"}} />Còn nhiều phòng</div>
              <div className="cp-legend-item"><div className="cp-legend-dot" style={{background:"#fde68a"}} />Sắp hết phòng</div>
              <div className="cp-legend-item"><div className="cp-legend-dot" style={{background:"#fca5a5"}} />Hết phòng</div>
            </div>
          </>
        )}
      </div>

      {selectedDay && selectedDayData && (
        <div className="cp-card">
          <div className="cp-card-title">📋 Ngày {selectedDay}/{currentDate.getMonth()+1}/{currentDate.getFullYear()}</div>
          <div className={`cp-avail-banner ${selectedDayData.available === 0 ? "full" : selectedDayData.available <= Math.ceil(selectedDayData.total_rooms/3) ? "low" : "open"}`}>
            <div className="cp-avail-main">
              {selectedDayData.available === 0
                ? <><span>🔴</span><strong>Hết phòng</strong> — tất cả {selectedDayData.total_rooms} phòng đã được đặt</>
                : <><span>{selectedDayData.available <= Math.ceil(selectedDayData.total_rooms/3) ? "🟡" : "🟢"}</span>Còn <strong>{selectedDayData.available}/{selectedDayData.total_rooms} phòng trống</strong></>
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Tab: Theo dõi ──────────────────────────────────────────────────────────────
const TrackingTab = () => {
  const [phone, setPhone] = useState("");
  const [searched, setSearched] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!phone.trim()) return;
    setLoading(true); setSearched(true);
    try {
      const res = await fetch(`${API}/bookings/track?phone=${encodeURIComponent(phone.trim())}`);
      const d = await res.json();
      setBookings(Array.isArray(d) ? d : []);
    } catch { setBookings([]); } finally { setLoading(false); }
  };

  const statusLabel = (s) => {
    if (s === "active")  return { label: "🟢 Đang gửi",     cls: "active" };
    if (s === "pending") return { label: "🕐 Chờ xác nhận", cls: "pending" };
    return                      { label: "✅ Hoàn thành",    cls: "completed" };
  };

  return (
    <div>
      <h2 className="cp-section-title">📊 Theo dõi dịch vụ</h2>
      <p className="cp-section-sub">Nhập số điện thoại để xem tiến trình gửi mèo.</p>
      <div className="cp-card">
        <div className="cp-card-title">🔍 Tra cứu đặt lịch</div>
        <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
          <input className="cp-input" placeholder="Số điện thoại (VD: 0901234567)"
            value={phone} type="tel" style={{flex:1,minWidth:200}}
            onChange={e => setPhone(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()} />
          <button className="cp-btn cp-btn-primary" onClick={handleSearch} disabled={loading}>
            {loading ? <span className="cp-spinner" /> : "Tra cứu"}
          </button>
        </div>
      </div>

      {searched && !loading && (
        bookings.length === 0 ? (
          <div className="cp-empty">
            <div className="cp-empty-icon">🔍</div>
            <h3>Không tìm thấy lịch đặt</h3>
            <p>Kiểm tra lại số điện thoại hoặc liên hệ Meo Care.</p>
          </div>
        ) : (
          <div className="cp-booking-list">
            {bookings.map((b, i) => {
              const pct = b.status === "active" ? progressPct(b.check_in, b.check_out) : b.status === "completed" ? 100 : 0;
              const { label, cls } = statusLabel(b.status);
              const daysLeft = b.status === "active" ? diffDays(new Date(), b.check_out) : 0;
              return (
                <div key={i} className="cp-booking-item">
                  <div className="cp-booking-header">
                    <div className="cp-booking-info">
                      <h3>🐱 {b.cat_name} {b.cat_breed ? `(${b.cat_breed})` : ""}</h3>
                      <p>Phòng: {b.room_name || b.room_id || "Chưa xác định"} · {SERVICES.find(s=>s.id===b.service)?.name || b.service}</p>
                    </div>
                    <span className={`cp-status-badge ${cls}`}>{label}</span>
                  </div>
                  {b.status === "active" && (
                    <div className="cp-progress-wrap">
                      <div className="cp-progress-label">
                        <span>Tiến trình</span>
                        <span>{pct}% · còn {daysLeft} ngày</span>
                      </div>
                      <div className="cp-progress-bar">
                        <div className="cp-progress-fill" style={{width:`${pct}%`}} />
                      </div>
                    </div>
                  )}
                  <div className="cp-booking-dates">
                    <div className="cp-date-info"><span>📥</span><span>Nhận: <strong>{fmtDate(b.check_in)}</strong></span></div>
                    <div className="cp-date-info"><span>📤</span><span>Trả: <strong>{fmtDate(b.check_out)}</strong></span></div>
                    {b.note && <div className="cp-date-info"><span>📝</span><span>{b.note}</span></div>}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
};

// ── Tab: Camera ────────────────────────────────────────────────────────────────
const CameraTab = () => {
  const [phone, setPhone] = useState("");
  const [searched, setSearched] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!phone.trim()) return;
    setLoading(true); setSearched(true);
    try {
      const res = await fetch(`${API}/bookings/cameras?phone=${encodeURIComponent(phone.trim())}`);
      const d = await res.json();
      setCameras(Array.isArray(d) ? d : []);
    } catch { setCameras([]); } finally { setLoading(false); }
  };

  return (
    <div>
      <h2 className="cp-section-title">📷 Camera phòng mèo</h2>
      <p className="cp-section-sub">Nhập số điện thoại để xem camera phòng bé đang ở.</p>
      <div className="cp-card">
        <div className="cp-card-title">🔐 Xác thực</div>
        <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
          <input className="cp-input" placeholder="Số điện thoại đặt lịch"
            value={phone} type="tel" style={{flex:1,minWidth:200}}
            onChange={e => setPhone(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()} />
          <button className="cp-btn cp-btn-primary" onClick={handleSearch} disabled={loading}>
            {loading ? <span className="cp-spinner" /> : "Xem camera"}
          </button>
        </div>
        <p style={{fontSize:"0.8rem",color:"var(--text-light)",marginTop:10}}>
          🔒 Chỉ hiển thị camera của phòng bé đang gửi.
        </p>
      </div>

      {searched && !loading && (
        cameras.length === 0 ? (
          <div className="cp-empty">
            <div className="cp-empty-icon">📷</div>
            <h3>Không tìm thấy camera</h3>
            <p>Không có lịch đặt đang hoạt động hoặc phòng chưa có camera.</p>
          </div>
        ) : (
          <div className="cp-camera-grid">
            {cameras.map((cam, i) => (
              <div key={i} className="cp-camera-card">
                <div className="cp-camera-feed">
                  {cam.status === "online" && cam.stream_url ? (
                    <>
                      <div className="cp-camera-live-badge"><span className="cp-live-dot" /> LIVE</div>
                      <iframe className="cp-camera-iframe" src={cam.stream_url} title={cam.name} allowFullScreen />
                    </>
                  ) : (
                    <div className="cp-camera-offline"><span>📷</span><span>Camera offline</span></div>
                  )}
                </div>
                <div className="cp-camera-info">
                  <div className="cp-camera-name">{cam.name || `Camera ${i+1}`}</div>
                  <div className="cp-camera-room">🏠 {cam.room_name || cam.room_id}</div>
                  <div className={`cp-camera-status ${cam.status === "online" ? "online" : "offline"}`}>
                    <span className="cp-status-dot" />
                    {cam.status === "online" ? "Đang hoạt động" : "Offline"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
};

// ── Main ───────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "booking",  label: "Đặt lịch",   icon: "📅" },
  { id: "schedule", label: "Lịch trống",  icon: "📆" },
  { id: "tracking", label: "Theo dõi",    icon: "📊" },
  { id: "camera",   label: "Camera",      icon: "📷" },
];

export default function ClientPortal() {
  const [activeTab, setActiveTab] = useState("booking");
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  return (
    <div className="cp-root">
      <header className="cp-header">
        <a href="/" className="cp-header-logo">
          <span>🐱</span><span className="cp-logo-text">Meo Care</span>
        </a>
        <div className="cp-header-greeting">Chào mừng bạn đến với <strong>Meo Care</strong></div>
      </header>
      <nav className="cp-tabs">
        {TABS.map(t => (
          <button key={t.id} className={`cp-tab ${activeTab === t.id ? "active" : ""}`}
            onClick={() => setActiveTab(t.id)}>
            <span className="cp-tab-icon">{t.icon}</span>{t.label}
          </button>
        ))}
      </nav>
      <main className="cp-content">
        {activeTab === "booking"  && <BookingTab onSuccess={showToast} />}
        {activeTab === "schedule" && <ScheduleTab />}
        {activeTab === "tracking" && <TrackingTab />}
        {activeTab === "camera"   && <CameraTab />}
      </main>
      {toast && <div className={`cp-toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}