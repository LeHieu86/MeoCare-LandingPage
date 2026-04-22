import React, { useState, useMemo } from "react";

// ✅ HÀM TÁCH NHÓM THÔNG MINH CHUẨN SHOPEE
// Nó sẽ gom tất cả các "Mùi vị" làm 1 mảng, và tất cả "Khối lượng" làm 1 mảng
const parseVariantGroups = (variants) => {
  if (!variants || variants.length === 0) return { isGrouped: false, options: [] };

  // Kiểm tra xem có dùng dấu " - " để phân cách không
  const hasSeparator = variants.some(v => v.name.includes(' - '));
  if (!hasSeparator) {
    return { isGrouped: false, options: variants };
  }

  const flavorsSet = new Set();
  const weightsSet = new Set();

  // Lọc ra tập hợp Mùi vị và Khối lượng duy nhất
  variants.forEach(v => {
    const parts = v.name.split(' - ');
    if (parts.length >= 2) {
      flavorsSet.add(parts[0].trim()); // VD: "Sữa dê + Thịt gà"
      weightsSet.add(parts.slice(1).join(' - ').trim()); // VD: "5 Hộp"
    }
  });

  const flavors = Array.from(flavorsSet);
  const weights = Array.from(weightsSet);

  // Chỉ chia làm 2 hàng khi CẢ HAI đều có từ 2 lựa chọn trở lên
  // (Tránh trường hợp chỉ có 1 mùi vị mà lại chia làm 2 hàng trông rất lạ)
  if (flavors.length > 1 && weights.length > 1) {
     return { isGrouped: true, flavors, weights };
  }

  // Còn lại rơi về danh sách phẳng
  return { isGrouped: false, options: variants };
};

const ProductDetail = ({ product, onAddToCart }) => {
  const { isGrouped, options, flavors, weights } = useMemo(() => parseVariantGroups(product.variants), [product.variants]);
  
  // Khởi tạo state chọn mặc định
  const [selectedFlavor, setSelectedFlavor] = useState(flavors?.[0] || "");
  const [selectedWeight, setSelectedWeight] = useState(weights?.[0] || "");
  const [selectedFlatVariant, setSelectedFlatVariant] = useState(options?.[0] || {});
  const [quantity, setQuantity] = useState(1);

  // Tìm ra object variant đang được chọn (để lấy ID và Giá chính xác)
  const getSelectedVariant = () => {
    if (!isGrouped) return selectedFlatVariant;
    
    // Ghép lại tên đúng với Database (VD: "Sữa dê + Thịt gà - 5 Hộp")
    const fullName = `${selectedFlavor} - ${selectedWeight}`;
    return product.variants.find(v => v.name === fullName) || product.variants[0];
  };

  const handleAdd = () => {
    onAddToCart(product, getSelectedVariant(), quantity);
  };

  return (
    <div className="sp-detail-view">
      <div className="sp-detail-img">
        <img src={product.image || "https://via.placeholder.com/400"} alt={product.name} />
      </div>
      
      <div className="sp-detail-info">
        <h1>{product.name}</h1>
        <p className="sp-detail-desc">{product.description}</p>
        
        <div className="sp-detail-price">
          {getSelectedVariant().price?.toLocaleString("vi-VN")}đ
          <span className="sp-selected-type-name">/ {getSelectedVariant().name}</span>
        </div>

        <div className="sp-detail-variants">
          {isGrouped ? (
            <>
              {/* ✅ HÀNG 1: CHỌN MÙI VỊ */}
              <div className="variant-group">
                <div className="variant-group-title">Mùi vị</div>
                <div className="variant-chips">
                  {flavors.map(f => (
                    <button 
                      key={f}
                      className={`variant-chip ${selectedFlavor === f ? 'active' : ''}`}
                      onClick={() => setSelectedFlavor(f)}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* ✅ HÀNG 2: CHỌN KHỐI LƯỢNG */}
              <div className="variant-group">
                <div className="variant-group-title">Khối lượng</div>
                <div className="variant-chips">
                  {weights.map(w => (
                    <button 
                      key={w}
                      className={`variant-chip ${selectedWeight === w ? 'active' : ''}`}
                      onClick={() => setSelectedWeight(w)}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* Trường hợp danh sách phẳng (Không có dấu - hoặc chỉ có 1 loại) */
            <div className="variant-group">
              <div className="variant-group-title">Phân loại</div>
              <div className="variant-chips">
                {options.map(opt => (
                  <button 
                    key={opt.name}
                    className={`variant-chip ${selectedFlatVariant.name === opt.name ? 'active' : ''}`}
                    onClick={() => setSelectedFlatVariant(opt)}
                  >
                    {opt.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="sp-detail-actions">
          <div className="qty-selector">
            <button onClick={() => setQuantity(q => Math.max(1, q - 1))}>-</button>
            <span>{quantity}</span>
            <button onClick={() => setQuantity(q => q + 1)}>+</button>
          </div>
          
          <button className="btn-add-to-cart" onClick={handleAdd}>
            🛒 Thêm vào giỏ hàng
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;