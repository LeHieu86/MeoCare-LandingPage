import React, { useEffect, useMemo, useState, useCallback } from "react";
import { computeBranchDistances, fmtDistance, catAge } from "../utils/geo";
import "../../styles/client/cat-showcase.css";

const API = import.meta.env.VITE_API_URL || "/api";
const fmtPrice = (n) => (n ? Number(n).toLocaleString("vi-VN") + "đ" : "Liên hệ");
const genderLabel = (g) => (g === "female" ? "Cái ♀" : "Đực ♂");

const HEALTH_ICON = { vaccine: "💉", deworm: "🪱", checkup: "🩺", other: "📋" };
const HEALTH_LABEL = { vaccine: "Tiêm phòng", deworm: "Tẩy giun", checkup: "Khám sức khỏe", other: "Khác" };
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("vi-VN") : "");

/* ── Thẻ 1 bé mèo ─────────────────────────────────────────── */
function CatCard({ cat, distance, onOpen }) {
  const age = catAge(cat.birth_date);
  return (
    <button className="cs-card" onClick={() => onOpen(cat)} type="button">
      <div className="cs-card-imgwrap">
        {cat.image
          ? <img src={cat.image} alt={cat.name} className="cs-card-img" loading="lazy" />
          : <div className="cs-card-img cs-noimg">🐱</div>}
        <span className="cs-price-tag">{fmtPrice(cat.price)}</span>
        {(cat.vaccinated || cat.dewormed) && (
          <div className="cs-card-badges">
            {cat.vaccinated && <span className="cs-mini-badge">💉 Đã tiêm</span>}
            {cat.dewormed && <span className="cs-mini-badge">🪱 Tẩy giun</span>}
          </div>
        )}
      </div>
      <div className="cs-card-body">
        <div className="cs-card-name">{cat.name}</div>
        <div className="cs-card-meta">
          {cat.breed && <span>{cat.breed}</span>}
          <span className="cs-dot">·</span>
          <span>{genderLabel(cat.gender)}</span>
          {age && (<><span className="cs-dot">·</span><span>{age}</span></>)}
        </div>
        <div className="cs-card-foot">
          <span className="cs-branch">🏪 {cat.store?.name || "Chi nhánh"}</span>
          {distance != null && <span className="cs-dist">🚗 {fmtDistance(distance)}</span>}
        </div>
      </div>
    </button>
  );
}

/* ── Bảng chi tiết (modal) ────────────────────────────────── */
function CatDetail({ cat, distance, onClose }) {
  const [active, setActive] = useState(0);
  const imgs = cat.images?.length ? cat.images : (cat.image ? [cat.image] : []);
  const age = catAge(cat.birth_date);
  const mapHref = cat.store?.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cat.store.address)}`
    : null;

  return (
    <div className="cs-modal-overlay" onClick={onClose}>
      <div className="cs-modal" onClick={(e) => e.stopPropagation()}>
        <button className="cs-close" onClick={onClose} aria-label="Đóng">✕</button>

        <div className="cs-modal-grid">
          {/* Gallery */}
          <div className="cs-gallery">
            <div className="cs-gallery-main">
              {imgs[active]
                ? <img src={imgs[active]} alt={cat.name} />
                : <div className="cs-noimg cs-gallery-noimg">🐱</div>}
            </div>
            {imgs.length > 1 && (
              <div className="cs-thumbs">
                {imgs.map((src, i) => (
                  <button key={i} className={`cs-thumb ${i === active ? "on" : ""}`} onClick={() => setActive(i)}>
                    <img src={src} alt={`${cat.name} ${i + 1}`} loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Thông tin */}
          <div className="cs-info">
            <div className="cs-info-head">
              <h2>{cat.name}</h2>
              <span className="cs-code">{cat.code}</span>
            </div>
            <div className="cs-price-big">{fmtPrice(cat.price)}</div>

            <div className="cs-spec">
              {cat.breed && <div><span>Giống</span><b>{cat.breed}</b></div>}
              <div><span>Giới tính</span><b>{genderLabel(cat.gender)}</b></div>
              {age && <div><span>Tuổi</span><b>{age}</b></div>}
              {cat.color && <div><span>Màu lông</span><b>{cat.color}</b></div>}
              {cat.weight != null && <div><span>Cân nặng</span><b>{cat.weight} kg</b></div>}
            </div>

            {cat.description && <p className="cs-desc">{cat.description}</p>}

            {/* Sức khỏe & tiêm phòng — luôn hiện trạng thái rõ ràng */}
            <div className="cs-health">
              <div className="cs-health-title">💉 Sức khỏe & tiêm phòng</div>
              <div className="cs-health-chips">
                <span className={`cs-chip ${cat.vaccinated ? "ok" : "no"}`}>
                  {cat.vaccinated ? "✓ Đã tiêm phòng" : "Chưa tiêm phòng"}
                </span>
                <span className={`cs-chip ${cat.dewormed ? "ok" : "no"}`}>
                  {cat.dewormed ? "✓ Đã tẩy giun" : "Chưa tẩy giun"}
                </span>
              </div>
              {cat.healthRecords?.length > 0 ? (
                <ul className="cs-health-list">
                  {cat.healthRecords.map((h) => (
                    <li key={h.id}>
                      <span className="cs-h-icon">{HEALTH_ICON[h.type] || "📋"}</span>
                      <span className="cs-h-main">
                        <b>{h.name}</b>
                        <small>{HEALTH_LABEL[h.type] || "Khác"} · {fmtDate(h.date)}{h.vet ? ` · ${h.vet}` : ""}</small>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="cs-health-empty">Cửa hàng sẽ cung cấp chi tiết hồ sơ tiêm phòng khi bạn tới xem bé.</p>
              )}
            </div>

            {/* CTA: bán tại quầy → mời tới cửa hàng / liên hệ */}
            <div className="cs-cta">
              <div className="cs-cta-branch">
                <div>🏪 <b>{cat.store?.name || "Chi nhánh MeoCare"}</b>{distance != null && <span className="cs-dist"> · 🚗 {fmtDistance(distance)}</span>}</div>
                {cat.store?.address && <div className="cs-cta-addr">📍 {cat.store.address}</div>}
              </div>
              <div className="cs-cta-actions">
                {cat.store?.phone && <a className="cs-btn cs-btn-line" href={`tel:${cat.store.phone}`}>📞 Gọi giữ bé</a>}
                {mapHref && <a className="cs-btn cs-btn-primary" href={mapHref} target="_blank" rel="noreferrer">🗺️ Tới xem trực tiếp</a>}
              </div>
              <p className="cs-cta-note">Bé được bán trực tiếp tại cửa hàng. Mua mèo tại MeoCare nhận nhiều <b>ưu đãi riêng</b> 🎁</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const SkeletonCard = () => (
  <div className="cs-card cs-skel">
    <div className="cs-card-imgwrap cs-skel-box" />
    <div className="cs-card-body">
      <div className="cs-skel-line w70" />
      <div className="cs-skel-line w50" />
      <div className="cs-skel-line w40" />
    </div>
  </div>
);

export default function CatShowcase() {
  const [cats, setCats] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [distances, setDistances] = useState({});
  const [filterStore, setFilterStore] = useState("all"); // "all" | storeId
  const [filterGender, setFilterGender] = useState("all"); // "all" | male | female
  const [q, setQ] = useState("");

  /* Fetch mèo + chi nhánh */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, sRes] = await Promise.all([
        fetch(`${API}/cats`).then((r) => r.json()).catch(() => ({ cats: [] })),
        fetch(`${API}/stores/public`).then((r) => r.json()).catch(() => ({ stores: [] })),
      ]);
      setCats(cRes.cats || []);
      setStores(sRes.stores || []);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  /* Vị trí khách → khoảng cách tới từng chi nhánh */
  useEffect(() => {
    if (!navigator.geolocation || stores.length === 0) return;
    let alive = true;
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      computeBranchDistances(
        { lat: coords.latitude, lng: coords.longitude },
        stores,
        (map) => { if (alive) setDistances(map); },
        () => alive
      );
    }, () => { /* khách từ chối vị trí → bỏ qua, vẫn xem được */ });
    return () => { alive = false; };
  }, [stores]);

  /* Lọc + sắp xếp theo khoảng cách (gần nhất lên đầu) */
  const visible = useMemo(() => {
    const kw = q.trim().toLowerCase();
    let arr = cats.filter((c) => {
      if (filterStore !== "all" && c.store_id !== Number(filterStore)) return false;
      if (filterGender !== "all" && c.gender !== filterGender) return false;
      if (kw && !(`${c.name} ${c.breed} ${c.color}`.toLowerCase().includes(kw))) return false;
      return true;
    });
    return arr.sort((a, b) => {
      const da = distances[a.store_id];
      const db = distances[b.store_id];
      if (da == null && db == null) return 0;
      if (da == null) return 1;
      if (db == null) return -1;
      return da - db;
    });
  }, [cats, filterStore, filterGender, q, distances]);

  return (
    <div className="cs-page">
      {/* Hero */}
      <header className="cs-hero">
        <a className="cs-back" href="/">← Trang chủ</a>
        <div className="cs-hero-main">
          <span className="cs-hero-paw">🐾</span>
          <h1>Bé Mèo Tìm Sen</h1>
          <p>Những bé mèo khỏe mạnh, đã tiêm phòng — đang chờ về nhà mới tại MeoCare</p>
        </div>
      </header>

      {/* Banner ưu đãi */}
      <div className="cs-perk-banner">
        <span className="cs-perk-icon">🎁</span>
        <div>
          <strong>Mua mèo tại MeoCare có ưu đãi riêng</strong>
          <p>Bảo hành sức khỏe · Gửi mèo & spa ưu đãi · Giảm giá đồ ăn cho thành viên</p>
        </div>
      </div>

      {/* Bộ lọc */}
      <div className="cs-filters">
        <input
          className="cs-search"
          placeholder="🔍 Tìm theo tên, giống, màu lông..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="cs-select" value={filterStore} onChange={(e) => setFilterStore(e.target.value)}>
          <option value="all">Tất cả chi nhánh</option>
          {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="cs-select" value={filterGender} onChange={(e) => setFilterGender(e.target.value)}>
          <option value="all">Đực & Cái</option>
          <option value="male">Đực ♂</option>
          <option value="female">Cái ♀</option>
        </select>
      </div>

      {/* Lưới mèo */}
      {loading ? (
        <div className="cs-grid">{Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      ) : visible.length === 0 ? (
        <div className="cs-empty">
          <div className="cs-empty-icon">🐈</div>
          <p>{cats.length === 0 ? "Hiện chưa có bé mèo nào được đăng bán. Sen quay lại sau nha!" : "Không có bé nào khớp bộ lọc."}</p>
        </div>
      ) : (
        <div className="cs-grid">
          {visible.map((cat) => (
            <CatCard key={cat.id} cat={cat} distance={distances[cat.store_id]} onOpen={setSelected} />
          ))}
        </div>
      )}

      {selected && (
        <CatDetail cat={selected} distance={distances[selected.store_id]} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
