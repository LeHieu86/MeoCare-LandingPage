import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import ClientBooking from "./ClientBooking";
import ClientBookingPackage from "./ClientBookingPackage";
import "../../../styles/client/store-service.css";
import "../../../styles/client/client_portal.css";

const API = import.meta.env.VITE_API_URL || "/api";

const StoreService = ({ onGoToActive }) => {
  const [services,         setServices]         = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [selectedService,  setSelectedService]  = useState(null);

  /* ── Fetch service types (kèm packages) từ API ───────── */
  const fetchServices = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/service-types`);
      const json = await res.json();
      setServices(json.data || []);
    } catch {
      toast.error("Không tải được danh sách dịch vụ", { icon: "⚠️" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  const handleSelect = (service) => {
    if (!service.available) {
      toast(`Dịch vụ "${service.name}" sắp ra mắt!`, { icon: "💡" });
      return;
    }
    setSelectedService(service);
  };

  const handleBack = () => setSelectedService(null);

  const showToast = (msg, type) => {
    if (type === "error") toast.error(msg);
    else toast.success(msg);
  };

  /* ── Detail / booking view ────────────────────────────── */
  if (selectedService) {
    const isPricedByDay      = selectedService.pricingType === "per_day";
    const isPricedByPackage  = selectedService.pricingType === "package" || selectedService.pricingType === "procedure";

    return (
      <div className="ss-detail-container">
        <div className="ss-detail-header">
          <button className="ss-back-btn" onClick={handleBack}>← Trở về</button>
          <div className="ss-detail-title-wrap">
            <span className="ss-detail-icon">{selectedService.icon}</span>
            <h2 className="ss-detail-title">{selectedService.name}</h2>
          </div>
        </div>

        <div className="ss-detail-content">
          {/* Boarding — form đặt lịch theo ngày */}
          {isPricedByDay && (
            <ClientBooking
              serviceTypeMeta={selectedService}
              onSuccess={showToast}
              onGoToActive={onGoToActive}
            />
          )}

          {/* Grooming / Medical — form đặt lịch theo gói/ca */}
          {isPricedByPackage && (
            <ClientBookingPackage
              serviceType={selectedService}
              onSuccess={showToast}
              onGoToActive={onGoToActive}
            />
          )}
        </div>
      </div>
    );
  }

  /* ── Service grid ─────────────────────────────────────── */
  const pricingIcon = (type) => ({ per_day: "📅", package: "📦", procedure: "🏥" }[type] || "");

  return (
    <div className="ss-container">
      <div className="ss-header">
        <h2 className="ss-title">Dịch Vụ MeoMeoCare</h2>
        <p className="ss-subtitle">Chăm sóc toàn diện cho thú cưng của bạn</p>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
          Đang tải danh sách dịch vụ...
        </div>
      ) : services.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🐾</div>
          <p>Chưa có dịch vụ nào. Vui lòng quay lại sau!</p>
        </div>
      ) : (
        <div className="ss-grid">
          {services.map((service) => (
            <button
              key={service.id}
              className={`ss-card ${!service.available ? "disabled" : ""}`}
              onClick={() => handleSelect(service)}
              type="button"
            >
              <div className="ss-card-icon" style={{ background: service.color }}>
                {service.icon}
              </div>
              <div className="ss-card-body">
                <div className="ss-card-head">
                  <h3 className="ss-card-title">{service.name}</h3>
                  {!service.available && <span className="ss-coming-soon">Sắp ra mắt</span>}
                </div>
                <p className="ss-card-subtitle">{service.subtitle}</p>
                <p className="ss-card-desc">{service.description}</p>

                {/* Hiển thị vài gói nhanh nếu là package/procedure */}
                {(service.pricingType === "package" || service.pricingType === "procedure") &&
                  service.packages && service.packages.length > 0 && (
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
                    {service.packages.slice(0, 3).map((pkg) => (
                      <span key={pkg.id} style={{
                        fontSize: 10.5, padding: "2px 8px",
                        background: `${service.accent}18`,
                        border: `1px solid ${service.accent}44`,
                        color: service.accent,
                        borderRadius: 20,
                      }}>
                        {pkg.name} — {Number(pkg.price).toLocaleString("vi-VN")}đ
                      </span>
                    ))}
                    {service.packages.length > 3 && (
                      <span style={{ fontSize: 10.5, color: "#94a3b8" }}>+{service.packages.length - 3} nữa...</span>
                    )}
                  </div>
                )}

                <div className="ss-card-footer">
                  <span className="ss-price-label">Từ</span>
                  <span className="ss-price-value">{service.priceFrom}</span>
                  {service.available && <span className="ss-card-arrow">→</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="ss-info-banner">
        <span className="ss-info-icon">💡</span>
        <div>
          <strong>Khách hàng có mèo mua từ MeoMeoCare</strong>
          <p>Được hưởng ưu đãi giảm giá đặc biệt cho tất cả các dịch vụ</p>
        </div>
      </div>
    </div>
  );
};

export default StoreService;
