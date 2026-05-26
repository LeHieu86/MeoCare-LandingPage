/**
 * usePWAUpdate — Tự động phát hiện & áp dụng phiên bản PWA mới
 *
 * Flow:
 *  1. SW mới được install xong → useRegisterSW báo needRefresh = true
 *  2. Ta show toast "Đang cập nhật..." màu hồng
 *  3. Sau 2.5s → gọi updateServiceWorker(true) → SW skip waiting → trang reload
 *
 * Người dùng không cần làm gì, không cần xóa app rồi add lại.
 */
import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import toast from "react-hot-toast";

export default function usePWAUpdate() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // Kiểm tra update mỗi 60 giây khi app đang chạy (PWA mở sẵn trên phone)
    onRegistered(registration) {
      if (!registration) return;
      setInterval(() => registration.update(), 60_000);
    },
    onRegisterError(err) {
      console.warn("[PWA] Đăng ký Service Worker thất bại:", err);
    },
  });

  useEffect(() => {
    if (!needRefresh) return;

    // Show toast thông báo (không cần user bấm gì)
    toast.loading("🚀 Có phiên bản mới! Đang cập nhật...", {
      id: "pwa-update",
      duration: 3000,
      style: {
        background: "#FF6B9D",
        color: "#fff",
        fontWeight: "700",
        borderRadius: "12px",
        fontSize: "14px",
      },
      iconTheme: { primary: "#fff", secondary: "#FF6B9D" },
    });

    // Sau 2.5s → kích hoạt SW mới + reload trang tự động
    const timer = setTimeout(() => {
      toast.dismiss("pwa-update");
      updateServiceWorker(true); // true = reload sau khi SW activate
    }, 2500);

    return () => clearTimeout(timer);
  }, [needRefresh]);
}
