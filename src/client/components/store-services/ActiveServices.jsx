import React, { useState, useEffect, useCallback } from "react";
import authService from "../../../../backend/services/authService";
import ServiceCard from "./ServiceCard";
import "../../../styles/client/active-services.css";

const API = import.meta.env.VITE_API_URL || "/api";

// Map booking → service shape mà ServiceCard dùng
const mapBookingStatus = (booking) => {
  if (booking.status === "cancelled" || booking.status === "completed") {
    return booking.status;
  }

  const today = new Date().toISOString().split("T")[0];
  const checkIn = booking.check_in;
  const checkOut = booking.check_out;

  if (booking.status === "pending") return "pending";

  // status === 'active': xác định giai đoạn chi tiết
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  if (checkOut <= tomorrowStr) return "almost_done";
  if (checkIn === today) return "received";
  return "active";
};

const mapBookingToService = (b) => ({
  id: b.id,
  code: `BD-${String(b.id).padStart(4, "0")}`,
  type: "boarding",
  status: mapBookingStatus(b),
  rawStatus: b.status,
  petName: b.cat_name,
  petBreed: b.cat_breed,
  startDate: b.check_in,
  endDate: b.check_out,
  room: b.room_name,
});

const ActiveServices = ({ onGoToServices }) => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cameraModal, setCameraModal] = useState(null);
  const [cameraStreams, setCameraStreams] = useState(null);
  const [cameraLoading, setCameraLoading] = useState(false);

  const userPhone = authService.getUser()?.phone || "";

  const loadServices = useCallback(async () => {
    if (!userPhone) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/bookings/track?phone=${encodeURIComponent(userPhone)}`);
      if (!res.ok) throw new Error("Không tải được danh sách dịch vụ");
      const bookings = await res.json();
      setServices(bookings.map(mapBookingToService));
    } catch (err) {
      setError(err.message || "Lỗi kết nối");
    } finally {
      setLoading(false);
    }
  }, [userPhone]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

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

  // Chỉ hiện service đang dùng (pending + active), không hiện cancelled/completed
  const activeOnes = services.filter(
    s => s.rawStatus === "pending" || s.rawStatus === "active"
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
        <p className="as-subtitle">
          Theo dõi tiến trình các dịch vụ bạn đang dùng
        </p>
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
          <button className="as-btn-cta" onClick={loadServices}>
            Thử lại
          </button>
        </div>
      ) : activeOnes.length === 0 ? (
        <div className="as-empty">
          <div className="as-empty-icon">📭</div>
          <h3>Bạn chưa sử dụng dịch vụ nào</h3>
          <p>Đặt dịch vụ chăm sóc cho bé mèo của bạn ngay hôm nay</p>
          <button className="as-btn-cta" onClick={onGoToServices}>
            Khám phá dịch vụ →
          </button>
        </div>
      ) : (
        <div className="as-list">
          {activeOnes.map(service => (
            <ServiceCard
              key={service.id}
              service={service}
              onViewCamera={handleViewCamera}
              onContact={handleContact}
            />
          ))}
        </div>
      )}

      {cameraModal && (
        <div className="as-modal-overlay" onClick={closeCameraModal}>
          <div className="as-modal" onClick={e => e.stopPropagation()}>
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
                  <span className="as-camera-hint">
                    Camera sẽ khả dụng khi mèo được nhận vào phòng
                  </span>
                </div>
              ) : (
                <div className="as-camera-grid">
                  {cameraStreams.map(cam => (
                    <div key={cam.id} className="as-camera-item">
                      <div className="as-camera-frame">
                        <iframe
                          src={cam.stream_url}
                          title={cam.name}
                          allow="autoplay"
                          allowFullScreen
                        />
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
