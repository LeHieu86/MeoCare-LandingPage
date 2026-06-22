import React from "react";
import { ProductGallery } from "./ProductDetail";
import { catAge } from "../../utils/geo";

const fmtPrice = (n) => (n ? Number(n).toLocaleString("vi-VN") + "đ" : "Liên hệ");
const genderLabel = (g) => (g === "female" ? "Cái ♀" : "Đực ♂");
const HEALTH_ICON = { vaccine: "💉", deworm: "🪱", checkup: "🩺", other: "📋" };
const HEALTH_LABEL = { vaccine: "Tiêm phòng", deworm: "Tẩy giun", checkup: "Khám sức khỏe", other: "Khác" };
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("vi-VN") : "");

const CatDetail = ({ cat, allCats = [], onSelectCat }) => {
  const age = catAge(cat.birth_date);
  const images = (cat.images && cat.images.length) ? cat.images : (cat.image ? [cat.image] : []);

  // Google Maps: ưu tiên toạ độ thật của chi nhánh, fallback địa chỉ
  const mapHref =
    (cat.store?.latitude != null && cat.store?.longitude != null)
      ? `https://www.google.com/maps/search/?api=1&query=${cat.store.latitude},${cat.store.longitude}`
      : (cat.store?.address
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cat.store.address)}`
          : null);

  // "Nhắn giữ bé" → mở chat đúng chi nhánh giữ bé + điền sẵn thông tin bé.
  // ClientChat (FAB ở App) lắng nghe sự kiện này.
  const openChat = () => {
    const meta = {
      catId: cat.id,
      code: cat.code,
      name: cat.name,
      image: cat.image || images[0] || "",
      price: cat.price,
      breed: cat.breed || "",
      gender: cat.gender,
      age: age || "",
    };
    window.dispatchEvent(new CustomEvent("open-branch-chat", {
      detail: {
        storeId: cat.store?.id ?? null,
        storeName: cat.store?.name || "Chi nhánh MeoCare",
        cat: meta,                                            // → hiện thẻ mèo trong chat
        content: `Quan tâm bé "${cat.name}" (${cat.code})`,   // text tóm tắt (preview/Flutter fallback)
        prefill: "Bé còn không ạ? Em muốn giữ bé ạ 🐱",       // điền sẵn câu hỏi
      },
    }));
  };

  const specs = [
    cat.breed && ["Giống", cat.breed],
    ["Giới tính", genderLabel(cat.gender)],
    age && ["Tuổi", age],
    cat.color && ["Màu lông", cat.color],
    cat.weight != null && ["Cân nặng", `${cat.weight} kg`],
  ].filter(Boolean);

  return (
    <div className="sp-detail-view">
      <ProductGallery images={images} name={cat.name} />

      <div className="sp-detail-info">
        <div className="pd-meta-row">
          <span className="cd-code">{cat.code}</span>
        </div>

        <h1>{cat.name}</h1>
        {cat.description && <p className="sp-detail-desc">{cat.description}</p>}

        <div className="sp-detail-price">{fmtPrice(cat.price)}</div>

        {/* Thông số */}
        <div className="cd-spec">
          {specs.map(([label, value]) => (
            <div key={label} className="cd-spec-item">
              <span className="cd-spec-label">{label}</span>
              <span className="cd-spec-value">{value}</span>
            </div>
          ))}
        </div>

        {/* Sức khỏe & tiêm phòng — luôn hiện trạng thái rõ ràng */}
        <div className="cd-section">
          <div className="variant-group-title">💉 Sức khỏe & tiêm phòng</div>
          <div className="cd-health-status">
            <span className={`cd-status-pill ${cat.vaccinated ? "ok" : "no"}`}>
              {cat.vaccinated ? "✓ Đã tiêm phòng" : "Chưa tiêm phòng"}
            </span>
            <span className={`cd-status-pill ${cat.dewormed ? "ok" : "no"}`}>
              {cat.dewormed ? "✓ Đã tẩy giun" : "Chưa tẩy giun"}
            </span>
          </div>
          {cat.healthRecords?.length > 0 ? (
            <ul className="cd-health">
              {cat.healthRecords.map((h) => (
                <li key={h.id}>
                  <span className="cd-health-icon">{HEALTH_ICON[h.type] || "📋"}</span>
                  <span className="cd-health-main">
                    <b>{h.name}</b>
                    <small>{HEALTH_LABEL[h.type] || "Khác"} · {fmtDate(h.date)}{h.vet ? ` · ${h.vet}` : ""}</small>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="cd-health-empty">Chi tiết hồ sơ tiêm phòng sẽ được cửa hàng cung cấp khi bạn tới xem bé.</p>
          )}
        </div>

        {/* Chi nhánh + liên hệ (bán trực tiếp tại cửa hàng) */}
        <div className="cd-branch">
          <div className="cd-branch-head">🏪 {cat.store?.name || "Chi nhánh MeoCare"}</div>
          {cat.store?.address && <div className="cd-branch-addr">📍 {cat.store.address}</div>}
          <div className="cd-branch-actions">
            <button type="button" className="cd-btn cd-btn-primary" onClick={openChat}>💬 Nhắn giữ bé</button>
            {mapHref && <a className="cd-btn cd-btn-line" href={mapHref} target="_blank" rel="noreferrer">🗺️ Google Maps</a>}
          </div>
        </div>

        {/* Điểm bán / chính sách (giống pd-policy của sản phẩm) */}
        <div className="pd-policy">
          <div className="pd-policy-row">
            <span className="pd-policy-icon">🩺</span>
            <div>
              <span className="pd-policy-title">Bảo hành sức khỏe</span>
              <span className="pd-policy-sub">Khám miễn phí sau khi nhận bé</span>
            </div>
          </div>
          <div className="pd-policy-row">
            <span className="pd-policy-icon">🎁</span>
            <div>
              <span className="pd-policy-title">Ưu đãi cho khách mua mèo</span>
              <span className="pd-policy-sub">Gửi mèo & spa ưu đãi · Giảm giá đồ ăn thành viên</span>
            </div>
          </div>
          <div className="pd-policy-row">
            <span className="pd-policy-icon">🏪</span>
            <div>
              <span className="pd-policy-title">Bán trực tiếp tại cửa hàng</span>
              <span className="pd-policy-sub">Tới xem & nhận bé tại chi nhánh MeoCare</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bé khác đang tìm chủ */}
      {allCats.length > 0 && (
        <div className="sp-related">
          <div className="sp-related-header">
            <span className="sp-related-icon">🐾</span>
            <h3>Bé khác đang tìm chủ</h3>
          </div>
          <div className="sp-related-scroll">
            {allCats.slice(0, 12).map((c) => (
              <div key={c.id} className="sp-related-card" onClick={() => onSelectCat?.(c)}>
                <div className="sp-related-img">
                  <img src={c.image || "https://via.placeholder.com/120?text=Meo"} alt={c.name} />
                </div>
                <div className="sp-related-info">
                  <p className="sp-related-name">{c.name}</p>
                  <span className="sp-related-price">{fmtPrice(c.price)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CatDetail;
