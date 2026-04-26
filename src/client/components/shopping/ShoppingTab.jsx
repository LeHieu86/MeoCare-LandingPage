import React, { useState, useMemo, useEffect } from "react";
import { useProducts } from "../../../hooks/useProducts";
import ProductList from "./ProductList";
import ProductDetail from "./ProductDetail";
import Cart from "./Cart";
import OrderSuccess from "./OrderSuccess";
import "../../../styles/client/shopping.css";

const API = "/api";

const ShoppingTab = ({ onNavToggle }) => {
  const { products, loading, error, refetch } = useProducts();
  const [view, setView] = useState("list"); // 'list' | 'detail' | 'cart'
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [cart, setCart] = useState([]);
  const [cartTotal, setCartTotal] = useState(0);
  const [orderResult, setOrderResult] = useState(null);
  const [isCheckout, setIsCheckout] = useState(false);
  
  // State cho trang List
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("all");

  useEffect(() => {
    const inCartFlow = view === 'cart' || isCheckout || !!orderResult;
    if (onNavToggle) onNavToggle(inCartFlow);
    window.dispatchEvent(new CustomEvent('shopping-cart-mode', { detail: { active: inCartFlow } }));
  }, [view, isCheckout, orderResult, onNavToggle]);

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

  // 1. Lấy giỏ hàng
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

  useEffect(() => {
    fetch(`${API}/cart`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setCart(data.items);
          setCartTotal(data.total);
        }
      })
      .catch(err => console.error("Lỗi lấy giỏ hàng:", err));
  }, []);

  // 2. Thêm vào giỏ hàng
  const addToCart = async (product, variant, quantity) => {
    try {
      const res = await fetch(`${API}/cart/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          productId: product.id, 
          variantName: variant.name,
          quantity: quantity 
        }),
      });
      const data = await res.json();
      
      if (data.success) {
        setView("cart");
        fetchCart();
      }
    } catch (err) {
      console.error("Lỗi thêm giỏ hàng:", err);
    }
  };

  // 3. Cập nhật số lượng
  const updateCartQuantity = async (cartItemId, newQty) => {
    try {
      await fetch(`${API}/cart/item/${cartItemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: newQty }),
      });
      fetchCart();
    } catch (err) {
      console.error("Lỗi cập nhật số lượng:", err);
    }
  };

  // ✅ 4. ĐẶT HÀNG (Gọi API)
  const handlePlaceOrder = async (orderData) => {
    const res = await fetch(`${API}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderData),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Đặt hàng thất bại");
    }

    setOrderResult(data);
    setCart([]);
    setCartTotal(0);
  };

  // ✅ 5. Quay lại mua sắm sau khi đặt thành công
  const handleContinueShopping = () => {
    setOrderResult(null);
    setView("list");
  };

  // ✅ Xác định title cho navbar
  const getNavTitle = () => {
    if (orderResult) return "Đặt hàng thành công";
    if (view === "list") return "Sản Phẩm";
    if (view === "detail") return selectedProduct?.name || "";
    if (view === "cart") return `Giỏ Hàng (${cart.length})`;
    return "";
  };

  // ✅ Có nên hiện nút Back không
  const showBackBtn = view !== "list" || orderResult;

  // ✅ Có nên hiện nút Cart không (ẩn khi đang checkout/success)
  const showCartBtn = !orderResult && view !== "cart";

  return (
    <div className="shopping-container">
      {!isCheckout && (
        <div className="shopping-navbar">
          {showBackBtn && (
            <button
              className="nav-back-btn"
              onClick={() => {
                if (orderResult) {
                  handleContinueShopping();
                } else {
                  setView("list");
                }
              }}
            >
              ← Trở lại
            </button>
          )}
          <div className="nav-title">{getNavTitle()}</div>
          {showCartBtn && (
            <button className="nav-cart-btn" onClick={() => { setView("cart"); fetchCart(); }}>
              🛒 <span className="cart-badge">{cart.length > 0 ? cart.length : null}</span>
            </button>
          )}
        </div>
      )}

      <div className="shopping-content">
        {/* ✅ Màn thành công */}
        {orderResult ? (
          <OrderSuccess 
            order={orderResult} 
            onContinue={handleContinueShopping} 
          />
        ) : view === "list" ? (
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
        ) : view === "detail" && selectedProduct ? (
          <ProductDetail product={selectedProduct} onAddToCart={addToCart} />
        ) : view === "cart" ? (
          <Cart
            cart={cart}
            updateQuantity={updateCartQuantity}
            cartTotal={cartTotal}
            onPlaceOrder={handlePlaceOrder}
            onCheckoutChange={setIsCheckout}
          />
        ) : null}
      </div>
    </div>
  );
};

export default ShoppingTab;