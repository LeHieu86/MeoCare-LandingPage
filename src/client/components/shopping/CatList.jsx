import React from "react";
import { catAge } from "../../utils/geo";

const fmtPrice = (n) => (n ? Number(n).toLocaleString("vi-VN") + "đ" : "Liên hệ");
const genderLabel = (g) => (g === "female" ? "Cái ♀" : "Đực ♂");

const CatList = ({ cats, loading, categories, category, setCategory, keyword, setKeyword, onSelectCat }) => {
  return (
    <div className="product-list-view">
      {/* Search bar (giống ProductList) */}
      <div className="sp-filter-bar">
        <div className="sp-search-box">
          <span className="sp-search-icon">🔍</span>
          <input
            type="text"
            placeholder="Tìm mèo theo tên, giống..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          {keyword && <button className="sp-search-clear" onClick={() => setKeyword("")}>✕</button>}
        </div>
      </div>

      {/* Category pills (chung với sản phẩm) */}
      <div className="sp-categories">
        {categories.map((c) => (
          <button
            key={c.id}
            className={`sp-cat-btn ${category === c.id ? "active" : ""}`}
            onClick={() => setCategory(c.id)}
          >
            <span>{c.icon}</span>
            <span>{c.label}</span>
          </button>
        ))}
      </div>

      {/* Cat grid */}
      {loading ? (
        <div className="sp-loading">
          <div className="sp-loading-spinner" />
          <span>Đang tải danh sách mèo...</span>
        </div>
      ) : (
        <div className="sp-grid">
          {cats.map((cat) => {
            const age = catAge(cat.birth_date);
            return (
              <div key={cat.id} className="sp-card" onClick={() => onSelectCat?.(cat)}>
                <div className="sp-card-img">
                  <img src={cat.image || "https://via.placeholder.com/150?text=Meo"} alt={cat.name} />
                  {cat.vaccinated && <span className="sp-badge-variant">💉 Đã tiêm</span>}
                  <div className="sp-card-overlay">
                    <span className="sp-card-overlay-text">Xem chi tiết →</span>
                  </div>
                </div>
                <div className="sp-card-info">
                  <h3 className="sp-card-name">{cat.name}</h3>
                  <div className="sp-card-price">{fmtPrice(cat.price)}</div>
                  <div className="sp-card-stats">
                    {cat.breed && <span className="sp-card-stat">{cat.breed}</span>}
                    <span className="sp-card-dot">·</span>
                    <span className="sp-card-stat">{genderLabel(cat.gender)}</span>
                    {age && (<><span className="sp-card-dot">·</span><span className="sp-card-stat">{age}</span></>)}
                  </div>
                </div>
              </div>
            );
          })}
          {cats.length === 0 && (
            <div className="sp-empty-state">
              <span>🐈</span>
              <p>Chưa có bé mèo nào đang bán</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CatList;
