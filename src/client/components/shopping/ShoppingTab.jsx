import React, { useState, useMemo, useEffect } from "react";
import { useProducts } from "../../../hooks/useProducts";
import api from "../../utils/api";
import ProductList from "./ProductList";
import ProductDetail from "./ProductDetail";
import Cart from "./Cart";
import OrderSuccess from "./OrderSuccess";
import "../../../styles/client/shopping.css";

const ShoppingTab = ({ onNavToggle }) => {
  const { products, loading, error, refetch } = useProducts();
  const [view, setView] = useState("list");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [cart, setCart] = useState([]);
  const [cartTotal, setCartTotal] = useState(0);
  const [orderResult, setOrderResult] = useState(null);
  const [isCheckout, setIsCheckout] = useState(false);

  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("all");

  useEffect(() => {
    const inCartFlow = view === "cart" || isCheckout || !!orderResult;
    if (onNavToggle) onNavToggle(inCartFlow);
    window.dispatchEvent(
      new CustomEvent("shopping-cart-mode", { detail: { active: inCartFlow } })
    );
  }, [view, isCheckout, orderResult, onNavToggle]);

  const categories = [
    { id: "all", label: "Tất cả", icon: "🏠" },
    { id: "combo", label: "Combo", icon: "🎁" },
    { id: "food", label: "Hạt", icon: "🍚" },
    { id: "pate", label: "Pate", icon: "🥫" },
    { id: "hygiene", label: "Vệ sinh", icon: "🧼" },
  ];

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const byCat = category === "all" || p.category === category;
      const byKey = p.name.toLowerCase().includes(keyword.toLowerCase());
      return byCat && byKey;
    });
  }, [products, category, keyword]);

  // 1. Lấy giỏ hàng
  const fetchCart = async () => {
    try {
      const data = await api.get("/cart");
      if (data.success) {
        setCart(data.items);
        setCartTotal(data.total);
      }
    } catch (err) {
      console.error("Lỗi lấy giỏ hàng:", err);
    }
  };

  useEffect(() => {
    fetchCart();
  }, []);

  // 2. Thêm vào giỏ hàng
  const addToCart = async (product, variant, quantity) => {
    try {
      const data = await api.post("/cart/add", {
        productId: product.id,
        variantName: variant.name,
        quantity: quantity,
      });

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
      await api.put(`/cart/item/${cartItemId}`, { quantity: newQty });
      fetchCart();
    } catch (err) {
      console.error("Lỗi cập nhật số lượng:", err);
    }
  };

  // 4. Đặt hàng
  const handlePlaceOrder = async (orderData) => {
    const data = await api.post("/orders", orderData);
    setOrderResult(data);
    setCart([]);
    setCartTotal(0);
  };

  // 5. Quay lại mua sắm
  const handleContinueShopping = () => {
    setOrderResult(null);
    setView("list");
  };

  const getNavTitle = () => {
    if (orderResult) return "Đặt hàng thành công";
    if (view === "list") return "Sản Phẩm";
    if (view === "detail") return selectedProduct?.name || "";
    if (view === "cart") return `Giỏ Hàng (${cart.length})`;
    return "";
  };

  const showBackBtn = view !== "list" || orderResult;
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
            <button
              className="nav-cart-btn"
              onClick={() => {
                setView("cart");
                fetchCart();
              }}
            >
              🛒{" "}
              <span className="cart-badge">
                {cart.length > 0 ? cart.length : null}
              </span>
            </button>
          )}
        </div>
      )}

      <div className="shopping-content">
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
            onSelectProduct={(p) => {
              setSelectedProduct(p);
              setView("detail");
            }}
          />
        ) : view === "detail" && selectedProduct ? (
          <ProductDetail
            product={selectedProduct}
            onAddToCart={addToCart}
            allProducts={products.filter((p) => p.id !== selectedProduct.id)}
            onSelectProduct={(p) => setSelectedProduct(p)}
          />
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