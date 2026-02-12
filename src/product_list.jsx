import React, { useState, useMemo } from "react";
import "./style_product.css";

const ProductMenu = () => {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const products = [
    {
      id: 1,
      name: "Thức Ăn Hạt Keres",
      category: "food",
      image: "🍖",
      description: "Thức ăn cao cấp cho mèo trưởng thành & mèo con",
      variants: [
        { name: "Mèo Trường Thành - 2kg", price: 450000 },
        { name: "Mèo Con - 2kg", price: 850000 },
      ],
    },
    {
      id: 2,
      name: "Pate Whiskas",
      category: "food1",
      image: "🥫",
      description: "Pate mềm nhiều hương vị",
      variants: [
        { name: "Cá ngừ", price: 15000 },
        { name: "Cá hồi", price: 18000 },
        { name: "Gà", price: 15000 },
      ],
    },
    {
      id: 3,
      name: "Cát Vệ Sinh Bentonite",
      category: "hygiene",
      image: "🪨",
      description: "Cát siêu vón, khử mùi tốt",
      variants: [
        { name: "5kg - Không mùi", price: 85000 },
        { name: "10kg - Lavender", price: 175000 },
      ],
    },
    {
      id: 4,
      name: "Combo Hạt Keres 2Kg & Pate 50g",
      category: "set",
      image: "🪨",
      description: "Combo chăm mèo",
      variants: [
        { name: "Hạt 2Kg + 12 gói Pate", price: 85000 },
        { name: "Hạt 2Kg + 15 gói Pate", price: 175000 },
        { name: "Hạt 2Kg + 20 gói Pate", price: 175000 },
      ],
    },
  ];

  const categories = [
    { id: "set", name: "Combo"},
    { id: "food", name: "Hạt" }, 
    { id: "food1", name: "Pate"},
    { id: "hygiene", name: "Vệ sinh" },
  ];

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = selectedCategory === "all" || p.category === selectedCategory;
      const matchSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [selectedCategory, searchQuery]);

  return (
    <div className="menu-page">
      {/* HEADER */}
      <header className="menu-header">
        <div className="container">
          <div className="menu-header-content">
            <div className="logo">
              🐱 <span>Meo Care – Bảng Giá</span>
            </div>
            <a
              href="https://zalo.me/0123456789"
              target="_blank"
              rel="noopener noreferrer"
              className="zalo-header-btn"
            >
              Chat Zalo
            </a>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="menu-hero">
        <div className="container">
          <h1>Bảng Giá Sản Phẩm Meo Care</h1>
          <p>
            Giá bán trực tiếp tại Meo Care (không phí sàn).  
            Giá Shopee có thể cao hơn.
          </p>
        </div>
      </section>

      {/* FILTER */}
      <section className="menu-filter">
        <div className="container">
          <input
            type="text"
            placeholder="Tìm sản phẩm..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div className="menu-categories">
            {categories.map((c) => (
              <button
                key={c.id}
                className={selectedCategory === c.id ? "active" : ""}
                onClick={() => setSelectedCategory(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* MENU LIST */}
      <section className="menu-list">
        <div className="container">
          {filteredProducts.map((product) => (
            <div key={product.id} className="menu-item">
              <div className="menu-left">
                <div className="menu-icon">{product.image}</div>
              </div>

              <div className="menu-right">
                <h3>{product.name}</h3>
                <p className="menu-desc">{product.description}</p>

                <div className="menu-variants">
                  {product.variants.map((v, i) => (
                    <div key={i} className="variant-row">
                      <span>{v.name}</span>
                      <strong>{v.price.toLocaleString("vi-VN")}đ</strong>
                    </div>
                  ))}
                </div>

                <a
                  href={`https://zalo.me/0123456789`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="menu-zalo-btn"
                >
                  Hỏi mua qua Zalo
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default ProductMenu;
