import React, { useState, useMemo, useEffect } from "react";
import { useProducts } from "../../../hooks/useProducts"; // Chỉnh lại đường dẫn cho đúng
import ProductList from "./ProductList";
import ProductDetail from "./ProductDetail";
import Cart from "./Cart";
import "../../../styles/client/shopping.css";

const API = "/api"; // Dùng proxy của Vite, rất an toàn, không lo CORS

const ShoppingTab = () => {
  const { products, loading, error, refetch } = useProducts();
  const [view, setView] = useState("list"); // 'list' | 'detail' | 'cart'
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [cart, setCart] = useState([]); // Chỉ chứa data lấy từ Backend về
  const [cartTotal, setCartTotal] = useState(0);
  
  // State cho trang List
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("all");

  const categories = [
    { id: "all", label: "Tất cả", icon: "🏠" },
    { id: "combo", label: "Combo", icon: "🎁" },
    { id: "food", label: "Hạt", icon: "🍚" },
    { id: "pate", label: "Pate", icon: "🥫" },
    { id: "hygiene", label: "Vệ sinh", icon: "🧼" },
  ];

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const byCat = category === "all" || p.category === category;
      const byKey = p.name.toLowerCase().includes(keyword.toLowerCase());
      return byCat && byKey;
    });
  }, [products, category, keyword]);

  // ✅ 1. HÀM GỌI API LẤY GIỎ HÀNG (Realtime Price)
  const fetchCart = async () => {
    try {
      const res = await fetch(`${API}/cart`);
      const data = await res.json();
      if (data.success) {
        setCart(data.items);
        setCartTotal(data.total);
      }
    } catch (err) {
      console.error("Lỗi lấy giỏ hàng:", err);
    }
  };

  // Chạy 1 lần khi vào tab Mua Sắm
  useEffect(() => {
    fetchCart();
  }, []);

  // ✅ 2. HÀM THÊM VÀO GIỎ HÀNG (Gọi API Upsert)
  const addToCart = async (product, variant, quantity) => {
    try {
      const res = await fetch(`${API}/cart/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          productId: product.id, 
          variantName: variant.name, // Backend cần tên variant
          quantity: quantity 
        }),
      });
      const data = await res.json();
      
      if (data.success) {
        setView("cart"); // Chuyển sang trang giỏ hàng
        fetchCart();      // Gọi lại để lấy list mới nhất (có giá realtime)
      }
    } catch (err) {
      console.error("Lỗi thêm giỏ hàng:", err);
    }
  };

  // ✅ 3. HÀM CẬP NHẬT SỐ LƯỢNG (Gọi API Put)
  const updateCartQuantity = async (cartItemId, newQty) => {
    try {
      await fetch(`${API}/cart/item/${cartItemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: newQty }),
      });
      fetchCart(); // Fetch lại để cập nhật tiền
    } catch (err) {
      console.error("Lỗi cập nhật số lượng:", err);
    }
  };

  return (
    <div className="shopping-container">
      <div className="shopping-navbar">
        {view !== "list" && (
          <button className="nav-back-btn" onClick={() => setView("list")}>← Trở lại</button>
        )}
        <div className="nav-title">
          {view === "list" && "Sản Phẩm"}
          {view === "detail" && selectedProduct?.name}
          {view === "cart" && `Giỏ Hàng (${cart.length})`}
        </div>
        <button className="nav-cart-btn" onClick={() => { setView("cart"); fetchCart(); }}>
          🛒 <span className="cart-badge">{cart.length > 0 ? cart.length : null}</span>
        </button>
      </div>

      <div className="shopping-content">
        {view === "list" && (
          <ProductList 
            products={filteredProducts} 
            loading={loading} 
            error={error} 
            refetch={refetch}
            categories={categories}
            category={category}
            setCategory={setCategory}
            keyword={keyword}
            setKeyword={setKeyword}
            onSelectProduct={(p) => { setSelectedProduct(p); setView("detail"); }}
          />
        )}
        
        {view === "detail" && selectedProduct && (
          <ProductDetail product={selectedProduct} onAddToCart={addToCart} />
        )}
        
        {view === "cart" && (
          <Cart 
            cart={cart} 
            updateQuantity={updateCartQuantity} 
            cartTotal={cartTotal} 
          />
        )}
      </div>
    </div>
  );
};

export default ShoppingTab;