import React, { useState, useMemo } from "react";
import PRODUCTS from "../data/products";
import "../styles/menu.css";

const ZALO_PHONE = "0942768652";

const Menu = () => {
  const [category, setCategory] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);

  const categories = [
    { id: "all", label: "Tất cả" },
    { id: "combo", label: "Combo" },
    { id: "food", label: "Hạt" },
    { id: "pate", label: "Pate" },
    { id: "hygiene", label: "Vệ sinh" },
  ];

  const list = useMemo(() => {
    return PRODUCTS.filter((p) => {
      const byCat = category === "all" || p.category === category;
      const byKey =
        p.name.toLowerCase().includes(keyword.toLowerCase()) ||
        p.description.toLowerCase().includes(keyword.toLowerCase());
      return byCat && byKey;
    });
  }, [category, keyword]);

  const toggleSelect = (product, variant) => {
    const key = `${product.id}-${variant.name}`;
    setSelectedItems((prev) => {
      const exists = prev.find((i) => i.key === key);
      if (exists) return prev.filter((i) => i.key !== key);

      return [
        ...prev,
        {
          key,
          productName: product.name,
          variantName: variant.name,
          price: variant.price,
        },
      ];
    });
  };

  const buildSingleZalo = (product, variant) => {
    const msg = `
Meo Care ơi, mình muốn hỏi:
• ${product.name}
• Loại: ${variant.name}
• Giá: ${variant.price.toLocaleString("vi-VN")}đ
    `;
    return `https://zalo.me/${ZALO_PHONE}?chat=${encodeURIComponent(msg)}`;
  };

  const buildBulkZalo = () => {
    if (selectedItems.length === 0) return "#";

    const lines = selectedItems.map(
      (i, idx) =>
        `${idx + 1}. ${i.productName} – ${i.variantName} – ${i.price.toLocaleString("vi-VN")}đ`
    );

    const total = selectedItems.reduce((s, i) => s + i.price, 0);

    const msg = `
Meo Care ơi, mình muốn hỏi các món sau:
${lines.join("\n")}

Tổng tạm tính: ${total.toLocaleString("vi-VN")}đ
    `;

    return `https://zalo.me/${ZALO_PHONE}?chat=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="menu-page">
      {/* HEADER */}
      <header className="menu-header">
        <div className="container header-row">
          <div className="logo">🐱 Meo Care – Bảng Giá</div>
          <a
            className="zalo-header"
            href={`https://zalo.me/${ZALO_PHONE}`}
            target="_blank"
            rel="noreferrer"
          >
            Chat Zalo
          </a>
        </div>
      </header>

      {/* HERO */}
      <section className="menu-hero">
        <div className="container">
          <h1>Bảng Giá Sản Phẩm</h1>
          <p>
            Giá bán trực tiếp tại Meo Care (không phí sàn).<br />
            Giá Shopee có thể cao hơn.
          </p>
        </div>
      </section>

      {/* FILTER */}
      <section className="menu-filter">
        <div className="container">
          <input
            placeholder="Tìm sản phẩm..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />

          <div className="menu-tabs">
            {categories.map((c) => (
              <button
                key={c.id}
                className={category === c.id ? "active" : ""}
                onClick={() => setCategory(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* MENU LIST */}
      <section className="menu-list">
        <div className="container">
          {list.map((p) => (
            <div className="menu-item" key={p.id}>
              <div className="menu-icon">{p.image}</div>

              <div className="menu-content">
                <h3>{p.name}</h3>
                <p className="desc">{p.description}</p>

                <div className="variants">
                  {p.variants.map((v) => {
                    const key = `${p.id}-${v.name}`;
                    const checked = selectedItems.some((i) => i.key === key);

                    return (
                      <div className="variant-row" key={key}>
                        <label className="variant-check">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSelect(p, v)}
                          />
                          <span>{v.name}</span>
                        </label>

                        <strong>{v.price.toLocaleString("vi-VN")}đ</strong>

                        <a
                          href={buildSingleZalo(p, v)}
                          target="_blank"
                          rel="noreferrer"
                          className="buy-btn"
                        >
                          Đặt lẻ
                        </a>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* BULK BAR */}
      {selectedItems.length > 0 && (
        <div className="bulk-bar">
          <span>
            Đã chọn <strong>{selectedItems.length}</strong> món
          </span>
          <a
            href={buildBulkZalo()}
            target="_blank"
            rel="noreferrer"
            className="bulk-zalo-btn"
          >
            Đặt tất cả qua Zalo
          </a>
        </div>
      )}
    </div>
  );
};

export default Menu;
