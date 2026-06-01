import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import authService from "../../utils/authService";
import ServiceCard from "./ServiceCard";
import "../../../styles/client/active-services.css";

const API = import.meta.env.VITE_API_URL || "/api";

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
    code:         `BD-${String(b.id).padStart(4, "0")}`,
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
      const res = await fetch(`${API}/bookings/track?phone=${encodeURIComponent(userPhone)}`);
      if (!res.ok) throw new Error("Không tải được danh sách dịch vụ");
      const bookings = await res.json();
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

  const handleViewCamera = async (service) => {
    setCameraModal(service);
    setCameraStreams(null);
    setCameraLoading(true);
    try {
      const res = await fetch(`${API}/bookings/cameras?phone=${encodeURIComponent(userPhone)}`);
      if (!res.ok) throw new Error("Không tải được camera");
      const cameras = await res.json();
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
        <h2 className="as-title">Dịch Vụ Đang Sử Dụng</h2>
        <p className="as-subtitle">Theo dõi tiến trình các dịch vụ bạn đang dùng</p>
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
      ) : activeOnes.length === 0 ? (
        <div className="as-empty">
          <div className="as-empty-icon">📭</div>
          <h3>Bạn chưa sử dụng dịch vụ nào</h3>
          <p>Đặt dịch vụ chăm sóc cho bé mèo của bạn ngay hôm nay</p>
          <button className="as-btn-cta" onClick={onGoToServices}>Khám phá dịch vụ →</button>
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
