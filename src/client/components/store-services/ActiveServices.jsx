import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import authService from "../../utils/authService";
import api from "../../utils/api";
import ServiceCard from "./ServiceCard";
import "../../../styles/client/active-services.css";

const API = import.meta.env.VITE_API_URL || "/api";

const fmtMoney = (n) => (Number(n) || 0).toLocaleString("vi-VN") + "đ";
const fmtDate = (d) => {
  if (!d) return "";
  const x = new Date(d);
  return isNaN(x.getTime()) ? d : `${x.getDate()}/${x.getMonth() + 1}/${x.getFullYear()}`;
};

/* ── Map booking status chi tiết ── */
const mapBookingStatus = (booking) => {
  if (booking.status === "cancelled" || booking.status === "completed") {
    return booking.status;
  }

  const today = new Date().toISOString().split("T")[0];
  const checkIn  = booking.check_in;
  const checkOut = booking.check_out;

  if (booking.status === "pending") return "pending";

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  if (checkOut <= tomorrowStr) return "almost_done";
  if (checkIn === today) return "received";
  return "active";
};

/* ── Tính phí dịch vụ dựa trên serviceMeta từ API ── */
const calculatePrice = (checkIn, checkOut, meta) => {
  const days       = Math.max(1, Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24)));
  // Dùng giá từ API nếu có, fallback hardcode cũ
  const priceDay1  = meta?.pricePerDay    || 70000;
  const priceMore  = (meta?.priceMultiDay > 0 ? meta.priceMultiDay : meta?.pricePerDay) || 50000;
  const unitPrice  = days === 1 ? priceDay1 : priceMore;
  return { days, unitPrice, total: days * unitPrice };
};

/* ── Tính phí trễ hạn ── */
const calculateLateFee = (checkOut) => {
  const end = new Date(checkOut).getTime();
  const now = Date.now();
  if (now <= end) return { isLate: false, fee: 0, hours: 0, days: 0 };
  const hours = Math.ceil((now - end) / (1000 * 60 * 60));
  const days  = Math.floor(hours / 24);
  const fee   = hours <= 4 ? hours * 10000 : 40000 + (days * 50000);
  return { isLate: true, fee, hours, days };
};

/* ── Map booking → service (kèm pricing theo meta) ── */
const mapBookingToService = (b, meta) => {
  const pricing  = calculatePrice(b.check_in, b.check_out, meta);
  const lateInfo = b.status === "active"
    ? calculateLateFee(b.check_out)
    : { isLate: false, fee: 0, hours: 0, days: 0 };

  // Dịch vụ theo gói (grooming/medical) dùng package_price snapshot từ lúc đặt
  const serviceTotal = b.package_price ? Number(b.package_price) : pricing.total;

  return {
    id:           b.id,
    // Mã ngẫu nhiên lưu ở DB (DV-YYMMDD-NNNNNN); fallback cho đơn cũ chưa backfill
    code:         b.code || `DV-${String(b.id).padStart(4, "0")}`,
    type:         b.service_type || "boarding",
    status:       mapBookingStatus(b),
    rawStatus:    b.status,
    petName:      b.cat_name,
    petBreed:     b.cat_breed,
    startDate:    b.check_in,
    endDate:      b.check_out,
    room:         b.room_name,
    packageName:  b.package_name  || null,
    packagePrice: b.package_price ? Number(b.package_price) : null,
    serviceDays:  pricing.days,
    unitPrice:    pricing.unitPrice,
    serviceTotal,
    actualTotal:  b.total_price != null ? Number(b.total_price) : null, // tổng thực thu lúc trả mèo (hóa đơn)
    lateFee:      lateInfo.fee,
    lateHours:    lateInfo.hours,
    lateDays:     lateInfo.days,
    isLate:       lateInfo.isLate,
    totalPrice:   serviceTotal + lateInfo.fee,
  };
};

const ActiveServices = ({ onGoToServices }) => {
  const [services,      setServices]      = useState([]);
  const [serviceTypes,  setServiceTypes]  = useState({}); // key → meta obj
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState("");
  const [cameraModal,   setCameraModal]   = useState(null);
  const [cameraStreams, setCameraStreams]  = useState(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [view,          setView]          = useState("active"); // "active" | "history"

  const userPhone = authService.getUser()?.phone || "";

  /* ── Load service types (lấy meta theo key) ─────────── */
  const loadServiceTypes = useCallback(async () => {
    try {
      // Lấy tất cả service types (kể cả unavailable) — dùng public endpoint,
      // vì client chỉ cần đọc meta cho booking đang có.
      // Nếu type không có trong available list thì dùng fallback trong ServiceCard.
      const res  = await fetch(`${API}/service-types`);
      const json = await res.json();
      const map  = {};
      (json.data || []).forEach((t) => { map[t.key] = t; });
      setServiceTypes(map);
    } catch {
      // Không toast — fallback trong ServiceCard sẽ xử lý
    }
  }, []);

  /* ── Load bookings ───────────────────────────────────── */
  const loadServices = useCallback(async () => {
    if (!userPhone) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      // Qua api helper → tự kèm JWT; BE lấy SĐT từ token (không truyền ?phone= nữa).
      const bookings = await api.get("/bookings/track");
      // serviceTypes có thể chưa load xong → dùng state hiện tại; mỗi booking tìm meta theo service_type
      setServices(bookings.map((b) => mapBookingToService(b, serviceTypes[b.service_type] || serviceTypes["boarding"] || null)));
    } catch (err) {
      setError(err.message || "Lỗi kết nối");
      toast.error(err.message || "Không thể tải danh sách dịch vụ");
    } finally {
      setLoading(false);
    }
  }, [userPhone, serviceTypes]);

  useEffect(() => { loadServiceTypes(); }, [loadServiceTypes]);
  useEffect(() => { loadServices(); },   [loadServices]);

  /* ── Realtime: chi nhánh đổi trạng thái lịch → tự nạp lại ── */
  useEffect(() => {
    const onBookingUpdated = () => loadServices();
    window.addEventListener("booking-updated", onBookingUpdated);
    return () => window.removeEventListener("booking-updated", onBookingUpdated);
  }, [loadServices]);

  const handleViewCamera = async (service) => {
    setCameraModal(service);
    setCameraStreams(null);
    setCameraLoading(true);
    try {
      // Qua api helper → tự kèm JWT; BE lấy SĐT từ token (không truyền ?phone= nữa).
      const cameras = await api.get("/bookings/cameras");
      setCameraStreams(cameras);
    } catch (err) {
      setCameraStreams({ error: err.message });
    } finally {
      setCameraLoading(false);
    }
  };

  const handleContact = () => {
    window.dispatchEvent(new CustomEvent("open-client-chat"));
  };

  const closeCameraModal = () => {
    setCameraModal(null);
    setCameraStreams(null);
  };

  const activeOnes = services.filter(
    (s) => s.rawStatus === "pending" || s.rawStatus === "active"
  );
  // Lịch sử = đã hoàn thành / đã hủy (đã sort created_at desc từ /track)
  const historyOnes = services.filter(
    (s) => s.rawStatus === "completed" || s.rawStatus === "cancelled"
  );

  if (!userPhone) {
    return (
      <div className="as-container">
        <div className="as-empty">
          <div className="as-empty-icon">🔒</div>
          <h3>Vui lòng đăng nhập</h3>
          <p>Đăng nhập để xem các dịch vụ bạn đang sử dụng</p>
        </div>
      </div>
    );
  }

  return (
    <div className="as-container">
      <div className="as-header">
        <h2 className="as-title">Dịch Vụ Của Tôi</h2>
        <p className="as-subtitle">Dịch vụ đang dùng và lịch sử đã qua</p>
      </div>

      <div className="as-toggle">
        <button className={`as-toggle-btn ${view === "active" ? "active" : ""}`} onClick={() => setView("active")}>
          Đang dùng{activeOnes.length ? ` (${activeOnes.length})` : ""}
        </button>
        <button className={`as-toggle-btn ${view === "history" ? "active" : ""}`} onClick={() => setView("history")}>
          Lịch sử{historyOnes.length ? ` (${historyOnes.length})` : ""}
        </button>
      </div>

      {loading ? (
        <div className="as-loading">
          <div className="as-spinner" />
          <p>Đang tải...</p>
        </div>
      ) : error ? (
        <div className="as-empty">
          <div className="as-empty-icon">⚠️</div>
          <h3>Có lỗi xảy ra</h3>
          <p>{error}</p>
          <button className="as-btn-cta" onClick={loadServices}>Thử lại</button>
        </div>
      ) : view === "active" ? (
        activeOnes.length === 0 ? (
          <div className="as-empty as-empty-friendly">
            <div className="as-empty-illustration">🐱</div>
            <h3>Bé nhà bạn đang ở nhà!</h3>
            <p>Bạn chưa có dịch vụ nào đang diễn ra. Hãy đặt lịch để chúng tôi chăm sóc bé yêu khi bạn bận nhé.</p>
            <div className="as-empty-perks">
              <span>📹 Camera Live 24/7</span>
              <span>💌 Cập nhật hàng ngày</span>
              <span>🏠 Phòng riêng tư</span>
            </div>
            <button className="as-btn-cta as-btn-cta-main" onClick={onGoToServices}>
              Đặt lịch ngay cho bé →
            </button>
          </div>
        ) : (
          <div className="as-list">
            {activeOnes.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                serviceMeta={serviceTypes[service.type] || null}
                onViewCamera={handleViewCamera}
                onContact={handleContact}
              />
            ))}
          </div>
        )
      ) : (
        historyOnes.length === 0 ? (
          <div className="as-empty as-empty-friendly">
            <div className="as-empty-illustration">🧾</div>
            <h3>Chưa có lịch sử dịch vụ</h3>
            <p>Các dịch vụ đã hoàn thành hoặc đã hủy sẽ xuất hiện ở đây.</p>
          </div>
        ) : (
          <div className="as-hist-list">
            {historyOnes.map((service) => {
              const done = service.rawStatus === "completed";
              const dateRange = service.endDate && service.endDate !== service.startDate
                ? `${fmtDate(service.startDate)} → ${fmtDate(service.endDate)}`
                : fmtDate(service.startDate);
              return (
                <div key={service.id} className={`as-hist-card ${done ? "" : "cancelled"}`}>
                  <div className="as-hist-top">
                    <span className="as-hist-code">{service.code}</span>
                    <span className={`as-hist-badge ${service.rawStatus}`}>
                      {done ? "✓ Hoàn thành" : "Đã hủy"}
                    </span>
                  </div>
                  <div className="as-hist-body">
                    <span className="as-hist-icon">{serviceTypes[service.type]?.icon || "🐾"}</span>
                    <div className="as-hist-info">
                      <div className="as-hist-name">
                        {service.packageName || serviceTypes[service.type]?.name || "Dịch vụ"}
                      </div>
                      <div className="as-hist-meta">
                        🐱 {service.petName}
                        {dateRange ? ` · ${dateRange}` : ""}
                        {service.room ? ` · ${service.room}` : ""}
                      </div>
                    </div>
                    <div className="as-hist-total">
                      {done ? fmtMoney(service.actualTotal ?? service.serviceTotal) : "—"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {cameraModal && (
        <div className="as-modal-overlay" onClick={closeCameraModal}>
          <div className="as-modal" onClick={(e) => e.stopPropagation()}>
            <div className="as-modal-header">
              <div>
                <h3>📹 Camera Live</h3>
                <p>Bé {cameraModal.petName} · {cameraModal.room || "Đang gán phòng"}</p>
              </div>
              <button className="as-modal-close" onClick={closeCameraModal}>✕</button>
            </div>

            <div className="as-modal-body">
              {cameraLoading ? (
                <div className="as-camera-placeholder">
                  <div className="as-spinner" style={{ borderColor: "#333", borderTopColor: "#fff" }} />
                  <p>Đang kết nối camera...</p>
                </div>
              ) : cameraStreams?.error ? (
                <div className="as-camera-placeholder">
                  <span className="as-camera-icon">⚠️</span>
                  <p>{cameraStreams.error}</p>
                </div>
              ) : !cameraStreams || cameraStreams.length === 0 ? (
                <div className="as-camera-placeholder">
                  <span className="as-camera-icon">📷</span>
                  <p>Chưa có camera nào hoạt động</p>
                  <span className="as-camera-hint">Camera sẽ khả dụng khi mèo được nhận vào phòng</span>
                </div>
              ) : (
                <div className="as-camera-grid">
                  {cameraStreams.map((cam) => (
                    <div key={cam.id} className="as-camera-item">
                      <div className="as-camera-frame">
                        <iframe src={cam.stream_url} title={cam.name} allow="autoplay" allowFullScreen />
                      </div>
                      <div className="as-camera-info">
                        <strong>{cam.name}</strong>
                        <span>{cam.room_name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActiveServices;
