import React, { useState, useCallback } from "react";
import ClientBooking from "./ClientBooking";
import "../../../styles/client/store-service.css";
import "../../../styles/client/client_portal.css";

const SERVICES = [
  {
    id: "boarding",
    icon: "🏠",
    title: "Giữ mèo",
    subtitle: "Khách sạn cho thú cưng",
    description: "Gửi mèo theo ngày, đầy đủ tiện nghi, có camera quan sát 24/7",
    priceFrom: "50.000đ/ngày",
    color: "linear-gradient(135deg, #FFB899 0%, #FF9B71 100%)",
    available: true,
  },
  {
    id: "medical",
    icon: "🏥",
    title: "Khám bệnh",
    subtitle: "Dịch vụ thú y",
    description: "Khám tổng quát, tiêm phòng, điều trị các bệnh thường gặp ở mèo",
    priceFrom: "Liên hệ",
    color: "linear-gradient(135deg, #A8D8EA 0%, #7BB6E0 100%)",
    available: false,
  },
  {
    id: "grooming",
    icon: "✂️",
    title: "Grooming",
    subtitle: "Tắm & làm đẹp",
    description: "Tắm, sấy, cắt tỉa lông, vệ sinh tai - móng, làm đẹp toàn diện",
    priceFrom: "Liên hệ",
    color: "linear-gradient(135deg, #C7B8EA 0%, #9F8FD9 100%)",
    available: false,
  },
];

const StoreService = ({ onGoToActive }) => {
  const [selectedService, setSelectedService] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleSelect = (service) => {
    if (!service.available) {
      showToast(`Dịch vụ "${service.title}" sắp ra mắt!`, "info");
      return;
    }
    setSelectedService(service);
  };

  const handleBack = () => {
    setSelectedService(null);
  };

  if (selectedService) {
    return (
      <div className="ss-detail-container">
        <div className="ss-detail-header">
          <button className="ss-back-btn" onClick={handleBack}>
            ← Trở về
          </button>
          <div className="ss-detail-title-wrap">
            <span className="ss-detail-icon">{selectedService.icon}</span>
            <h2 className="ss-detail-title">{selectedService.title}</h2>
          </div>
        </div>

        <div className="ss-detail-content">
          {selectedService.id === "boarding" && (
            <ClientBooking onSuccess={showToast} onGoToActive={onGoToActive} />
          )}
        </div>

        {toast && (
          <div className={`ss-toast ${toast.type}`}>
            {toast.msg}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="ss-container">
      <div className="ss-header">
        <h2 className="ss-title">Dịch Vụ MeoMeoCare</h2>
        <p className="ss-subtitle">
          Chăm sóc toàn diện cho thú cưng của bạn
        </p>
      </div>

      <div className="ss-grid">
        {SERVICES.map((service) => (
          <button
            key={service.id}
            className={`ss-card ${!service.available ? "disabled" : ""}`}
            onClick={() => handleSelect(service)}
            type="button"
          >
            <div
              className="ss-card-icon"
              style={{ background: service.color }}
            >
              {service.icon}
            </div>
            <div className="ss-card-body">
              <div className="ss-card-head">
                <h3 className="ss-card-title">{service.title}</h3>
                {!service.available && (
                  <span className="ss-coming-soon">Sắp ra mắt</span>
                )}
              </div>
              <p className="ss-card-subtitle">{service.subtitle}</p>
              <p className="ss-card-desc">{service.description}</p>
              <div className="ss-card-footer">
                <span className="ss-price-label">Từ</span>
                <span className="ss-price-value">{service.priceFrom}</span>
                {service.available && (
                  <span className="ss-card-arrow">→</span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="ss-info-banner">
        <span className="ss-info-icon">💡</span>
        <div>
          <strong>Khách hàng có mèo mua từ MeoMeoCare</strong>
          <p>Được hưởng ưu đãi giảm giá đặc biệt cho tất cả các dịch vụ</p>
        </div>
      </div>

      {toast && (
        <div className={`ss-toast ${toast.type}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default StoreService;
