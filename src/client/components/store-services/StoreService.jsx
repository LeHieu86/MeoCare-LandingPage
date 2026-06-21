import React, { useState, useEffect, useCallback, useMemo } from "react";
import toast from "react-hot-toast";
import ClientBooking from "./ClientBooking";
import ClientBookingPackage from "./ClientBookingPackage";
import { useAuth } from "../auth/AuthContext";
import api from "../../utils/api";
import { fmtDistance, computeBranchDistances } from "../../utils/geo";
import "../../../styles/client/store-service.css";
import "../../../styles/client/client_portal.css";

const API = import.meta.env.VITE_API_URL || "/api";

/* Tên hợp lệ: bỏ rỗng và chuỗi "Null" mặc định trong DB */
const cleanName = (s) => {
  const t = (s || "").trim();
  return t && t.toLowerCase() !== "null" ? t : "";
};

/* ── WMO weather code → emoji + label ─────────────────────── */
const wmoToIcon = (code) => {
  if (code === 0)                    return { icon: "☀️", label: "Trời quang" };
  if (code <= 2)                     return { icon: "🌤️", label: "Ít mây" };
  if (code === 3)                    return { icon: "☁️", label: "Nhiều mây" };
  if (code <= 48)                    return { icon: "🌫️", label: "Sương mù" };
  if (code <= 55)                    return { icon: "🌦️", label: "Mưa phùn" };
  if (code <= 65)                    return { icon: "🌧️", label: "Mưa" };
  if (code <= 77)                    return { icon: "🌨️", label: "Tuyết" };
  if (code <= 82)                    return { icon: "🌦️", label: "Mưa rào" };
  return                                    { icon: "⛈️", label: "Giông bão" };
};

const SERVICE_TRUST = {
  0: { badge: '🏆 Phổ biến nhất', highlight: true },
  1: { badge: '✨ Được yêu thích', highlight: false },
};

const SkeletonCard = () => (
  <div className="ss-skeleton-card">
    <div className="ss-skeleton-icon" />
    <div className="ss-skeleton-body">
      <div className="ss-skeleton-line ss-sk-title" />
      <div className="ss-skeleton-line ss-sk-sub" />
      <div className="ss-skeleton-line ss-sk-desc" />
      <div className="ss-skeleton-line ss-sk-price" />
    </div>
  </div>
);

const StoreService = ({ onGoToActive, onGoToShopping, onGoToOrders, onGoToPets }) => {
  const { user } = useAuth();
  const [services,         setServices]         = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [selectedService,  setSelectedService]  = useState(null);
  const [selectedBranch,   setSelectedBranch]   = useState(null);  // chi nhánh khách chọn
  const [publicStores,     setPublicStores]     = useState([]);    // danh sách chi nhánh public
  const [userCoords,       setUserCoords]       = useState(null);   // { lat, lng } vị trí khách
  const [branchDistances,  setBranchDistances]  = useState({});     // { storeId: km }
  const [weather,          setWeather]          = useState(null);   // { temp, code }
  const [cityName,         setCityName]         = useState(null);   // string
  const [profileName,      setProfileName]      = useState("");     // tên thật lấy từ profile

  /* ── Lấy tên khách hàng mới nhất từ profile (đảm bảo luôn có tên thật) ── */
  useEffect(() => {
    let alive = true;
    api.get("/account/profile")
      .then((data) => {
        if (alive && data?.success) {
          setProfileName(cleanName(data.user?.fullName) || cleanName(data.user?.username));
        }
      })
      .catch(() => { /* fallback dùng user trong context */ });
    return () => { alive = false; };
  }, []);

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

  /* ── Fetch danh sách chi nhánh (không cần auth) ─────────── */
  useEffect(() => {
    fetch(`${API}/stores/public`)
      .then(r => r.json())
      .then(d => { if (d.success) setPublicStores(d.stores || []); })
      .catch(() => {});
  }, []);

  /* ── Vị trí + thời tiết (graceful: không hiện nếu user từ chối) ── */
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const { latitude: lat, longitude: lng } = coords;
      setUserCoords({ lat, lng }); // dùng để tìm chi nhánh gần nhất
      try {
        const [wxRes, geoRes] = await Promise.all([
          fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&timezone=auto`),
          fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=vi`),
        ]);
        const wx  = await wxRes.json();
        const geo = await geoRes.json();
        setWeather({
          temp: Math.round(wx.current?.temperature_2m ?? 0),
          code: wx.current?.weather_code ?? 0,
        });
        const addr = geo.address || {};
        setCityName(addr.city || addr.town || addr.village || addr.county || null);
      } catch { /* ignore — weather là tính năng phụ */ }
    }, () => { /* user từ chối quyền vị trí — không hiện */ });
  }, []);

  /* ── Tính khoảng cách tới từng chi nhánh (geocode tuần tự, cache) ── */
  useEffect(() => {
    if (!userCoords || publicStores.length === 0) return;
    let alive = true;
    computeBranchDistances(
      userCoords,
      publicStores,
      (map) => setBranchDistances(map),
      () => alive,
    );
    return () => { alive = false; };
  }, [userCoords, publicStores]);

  /* ── Sắp xếp chi nhánh theo khoảng cách (gần nhất lên đầu) ── */
  const sortedStores = useMemo(() => {
    const withDist = publicStores.map((s) => ({ ...s, _km: branchDistances[s.id] }));
    return withDist.sort((a, b) => {
      if (a._km == null && b._km == null) return 0;
      if (a._km == null) return 1;   // chưa rõ khoảng cách → xuống cuối
      if (b._km == null) return -1;
      return a._km - b._km;
    });
  }, [publicStores, branchDistances]);
  const nearestId = sortedStores.find((s) => s._km != null)?.id ?? null;

  const handleSelect = (service) => {
    if (!service.available) {
      toast(`Dịch vụ "${service.name}" sắp ra mắt!`, { icon: "💡" });
      return;
    }
    setSelectedService(service);
  };

  const handleBack = () => { setSelectedService(null); setSelectedBranch(null); };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Chào buổi sáng";
    if (h < 18) return "Chào buổi chiều";
    return "Chào buổi tối";
  };

  const displayName = profileName || cleanName(user?.fullName) || cleanName(user?.username) || "Quý khách";

  const showToast = (msg, type) => {
    if (type === "error") toast.error(msg);
    else toast.success(msg);
  };

  /* ── Detail / booking view ────────────────────────────── */
  if (selectedService) {
    const isPricedByDay      = selectedService.pricingType === "per_day";
    const isPricedByPackage  = selectedService.pricingType === "package" || selectedService.pricingType === "procedure";

    /* Bước 1: Chọn chi nhánh */
    if (!selectedBranch) {
      return (
        <div className="ss-detail-container">
          <div className="ss-detail-header">
            <button className="ss-back-btn" onClick={handleBack}>← Trở về</button>
            <div className="ss-detail-title-wrap">
              <span className="ss-detail-icon">{selectedService.icon}</span>
              <h2 className="ss-detail-title">{selectedService.name}</h2>
            </div>
          </div>

          <div className="ss-branch-picker">
            <p className="ss-branch-title">Chọn chi nhánh bạn muốn đặt lịch</p>
            {publicStores.length === 0 ? (
              <div className="ss-branch-empty">
                <span>🏪</span>
                <p>Đang tải danh sách chi nhánh...</p>
              </div>
            ) : (
              <div className="ss-branch-list">
                {sortedStores.map(store => {
                  const isNearest = store.id === nearestId;
                  return (
                  <button
                    key={store.id}
                    className="ss-branch-card"
                    onClick={() => setSelectedBranch(store)}
                    style={isNearest ? { borderColor: "#34c759", boxShadow: "0 0 0 1px #34c759 inset" } : undefined}
                  >
                    <div className="ss-branch-icon">{isNearest ? "📍" : "🏪"}</div>
                    <div className="ss-branch-info">
                      <span className="ss-branch-name">
                        {store.name}
                        {isNearest && (
                          <span style={{
                            marginLeft: 8, padding: "1px 8px", borderRadius: 10,
                            backgroundColor: "#e6f9ee", color: "#1a8f4c",
                            fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
                          }}>
                            Gần bạn nhất
                          </span>
                        )}
                      </span>
                      {store.address && (
                        <span className="ss-branch-address">📍 {store.address}</span>
                      )}
                      {store.phone && (
                        <span className="ss-branch-phone">📞 {store.phone}</span>
                      )}
                    </div>
                    {store._km != null ? (
                      <span style={{
                        display: "flex", flexDirection: "column", alignItems: "flex-end",
                        gap: 2, flexShrink: 0, color: isNearest ? "#1a8f4c" : "#888",
                        fontWeight: 700, fontSize: 13,
                      }}>
                        🚗 {fmtDistance(store._km)}
                      </span>
                    ) : (
                      <span className="ss-branch-arrow">→</span>
                    )}
                  </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      );
    }

    /* Bước 2: Form đặt lịch (đã chọn chi nhánh) */
    return (
      <div className="ss-detail-container">
        <div className="ss-detail-header">
          <button className="ss-back-btn" onClick={() => setSelectedBranch(null)}>← Đổi chi nhánh</button>
          <div className="ss-detail-title-wrap">
            <span className="ss-detail-icon">{selectedService.icon}</span>
            <h2 className="ss-detail-title">{selectedService.name}</h2>
          </div>
        </div>

        {/* Chip chi nhánh đã chọn */}
        <div className="ss-selected-branch-chip">
          <span>🏪</span>
          <span>{selectedBranch.name}</span>
        </div>

        <div className="ss-detail-content">
          {isPricedByDay && (
            <ClientBooking
              serviceTypeMeta={selectedService}
              storeId={selectedBranch.id}
              onSuccess={showToast}
              onGoToActive={onGoToActive}
              onGoToPets={onGoToPets}
            />
          )}
          {isPricedByPackage && (
            <ClientBookingPackage
              serviceType={selectedService}
              storeId={selectedBranch.id}
              onSuccess={showToast}
              onGoToActive={onGoToActive}
            />
          )}
        </div>
      </div>
    );
  }

  /* ── Service grid ─────────────────────────────────────── */
  return (
    <div className="ss-container">
      {/* Greeting Hero */}
      <div className="ss-greeting-hero">
        <div className="ss-greeting-content">
          <p className="ss-greeting-time">{greeting()} 👋</p>
          <h2 className="ss-greeting-name">{displayName}</h2>
          <p className="ss-greeting-sub">Hôm nay bé cần gì nào?</p>
          {(cityName || weather) && (
            <div className="ss-weather-strip">
              {cityName && (
                <span className="ss-weather-item">
                  <span className="ss-weather-icon">📍</span>
                  {cityName}
                </span>
              )}
              {weather && (
                <span className="ss-weather-item">
                  <span className="ss-weather-icon">{wmoToIcon(weather.code).icon}</span>
                  {weather.temp}°C
                </span>
              )}
            </div>
          )}
        </div>
        <div className="ss-greeting-paw">🐾</div>
      </div>

      {/* Quick Actions */}
      <div className="ss-quick-actions">
        <button className="ss-qa-btn" onClick={onGoToActive}>
          <span>🎯</span>
          <span>Đang dùng</span>
        </button>
        <button className="ss-qa-btn" onClick={onGoToShopping}>
          <span>🛒</span>
          <span>Mua sắm</span>
        </button>
        <button className="ss-qa-btn" onClick={onGoToOrders}>
          <span>📦</span>
          <span>Đơn hàng</span>
        </button>
      </div>

      <p className="ss-section-label">Dịch Vụ Của Chúng Tôi</p>

      {loading ? (
        <div className="ss-grid">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : services.length === 0 ? (
        <div className="ss-empty">
          <div className="ss-empty-icon">🐾</div>
          <p>Chưa có dịch vụ nào. Vui lòng quay lại sau!</p>
        </div>
      ) : (
        <div className="ss-grid">
          {services.map((service, index) => {
            const trust = SERVICE_TRUST[index];
            return (
            <button
              key={service.id}
              className={`ss-card ${!service.available ? "disabled" : ""} ${trust?.highlight ? "ss-card-featured" : ""}`}
              onClick={() => handleSelect(service)}
              type="button"
            >
              {trust && service.available && (
                <span className="ss-trust-badge">{trust.badge}</span>
              )}
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
                  <div className="ss-pkg-chips">
                    {service.packages.slice(0, 3).map((pkg) => (
                      <span key={pkg.id} className="ss-pkg-chip" style={{
                        background: `${service.accent}18`,
                        borderColor: `${service.accent}44`,
                        color: service.accent,
                      }}>
                        {pkg.name} — {Number(pkg.price).toLocaleString("vi-VN")}đ
                      </span>
                    ))}
                    {service.packages.length > 3 && (
                      <span className="ss-pkg-more">+{service.packages.length - 3} nữa...</span>
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
            );
          })}
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
