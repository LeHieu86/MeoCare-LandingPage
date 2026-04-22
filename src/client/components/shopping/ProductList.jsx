import React from "react";

const ProductList = ({ products, loading, error, refetch, categories, category, setCategory, keyword, setKeyword, onSelectProduct }) => {
  return (
    <div className="product-list-view">
      {/* Search & Filter */}
      <div className="sp-filter-bar">
        <div className="sp-search-box">
          <span>🔍</span>
          <input type="text" placeholder="Tìm kiếm..." value={keyword} onChange={e => setKeyword(e.target.value)} />
        </div>
      </div>
      
      <div className="sp-categories">
        {categories.map(c => (
          <button key={c.id} className={`sp-cat-btn ${category === c.id ? 'active' : ''}`} onClick={() => setCategory(c.id)}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {/* Product Grid */}
      {loading ? <div className="sp-loading">Đang tải...</div> : 
       error ? <div className="sp-error">Lỗi. <button onClick={refetch}>Thử lại</button></div> :
       <div className="sp-grid">
          {products.map(p => (
            <div key={p.id} className="sp-card" onClick={() => onSelectProduct(p)}>
              <div className="sp-card-img">
                <img src={p.image || "https://via.placeholder.com/150"} alt={p.name} />
                {p.variants?.length > 1 && <span className="sp-badge-variant">Nhiều lựa chọn</span>}
              </div>
              <div className="sp-card-info">
                <h3 className="sp-card-name">{p.name}</h3>
                <div className="sp-card-price">
                  {Math.min(...p.variants.map(v => v.price)).toLocaleString("vi-VN")}đ
                </div>
              </div>
            </div>
          ))}
          {products.length === 0 && <div className="sp-empty">Không tìm thấy sản phẩm</div>}
       </div>
      }
    </div>
  );
};

export default ProductList;