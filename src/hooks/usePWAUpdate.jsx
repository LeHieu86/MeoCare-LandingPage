/**
 * usePWAUpdate — Tự động phát hiện & áp dụng phiên bản PWA mới (bản vá độ ổn định).
 *
 * Vì sao bản cũ hay "treo / không thấy UI mới":
 *  - Chỉ gọi updateServiceWorker(true) rồi trông chờ controllerchange tự reload;
 *    nếu sự kiện đó KHÔNG bắn (SW mới không kịp nắm quyền) → kẹt mãi ở bản cũ.
 *
 * Bản này:
 *  1. Lắng nghe controllerchange (đăng ký SỚM) → reload đúng 1 lần khi SW mới nắm quyền.
 *  2. LƯỚI AN TOÀN: nếu sau ~3.5s controllerchange chưa bắn → ÉP window.location.reload().
 *  3. CHỐNG LẶP: dùng sessionStorage — nếu đã tự cập nhật 1 lần mà vẫn còn bản chờ
 *     (SW kẹt) → KHÔNG tự reload nữa, hiện toast "chạm để tải lại" cho khách chủ động.
 *  4. Chỉ kiểm tra update khi ONLINE + tab đang hiển thị (tránh gọi nền vô ích) + kiểm
 *     lại ngay khi khách quay lại app.
 */
import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import toast from "react-hot-toast";

const FLAG = "pwa-updating"; // cờ chống lặp reload trong 1 phiên tab
const TOAST_STYLE = {
  background: "#FF6B9D",
  color: "#fff",
  fontWeight: "700",
  borderRadius: "12px",
  fontSize: "14px",
};

export default function usePWAUpdate() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const check = () => {
        if (navigator.onLine && document.visibilityState === "visible") {
          registration.update().catch(() => {});
        }
      };
      setInterval(check, 60_000);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
    },
    onRegisterError(err) {
      console.warn("[PWA] Đăng ký Service Worker thất bại:", err);
    },
  });

  // Reload đúng 1 lần khi SW mới chính thức nắm quyền (đăng ký sớm để không lỡ sự kiện).
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let reloaded = false;
    const onControllerChange = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  useEffect(() => {
    if (!needRefresh) {
      sessionStorage.removeItem(FLAG); // không còn bản chờ = đã cập nhật xong
      return;
    }

    // Đã tự cập nhật 1 lần mà VẪN còn bản chờ → SW kẹt → để khách tự bấm (tránh lặp vô hạn).
    if (sessionStorage.getItem(FLAG)) {
      toast(
        (t) => (
          <span
            style={{ cursor: "pointer" }}
            onClick={() => { toast.dismiss(t.id); window.location.reload(); }}
          >
            🚀 Có phiên bản mới — chạm để tải lại
          </span>
        ),
        { id: "pwa-update", duration: Infinity, style: TOAST_STYLE },
      );
      return;
    }

    sessionStorage.setItem(FLAG, "1");
    toast.loading("🚀 Có phiên bản mới! Đang cập nhật...", {
      id: "pwa-update",
      duration: 5000,
      style: TOAST_STYLE,
    });

    const timer = setTimeout(async () => {
      try {
        await updateServiceWorker(true); // SKIP_WAITING → controllerchange → reload (effect trên)
      } catch { /* bỏ qua, đã có lưới an toàn bên dưới */ }
      // LƯỚI AN TOÀN: controllerchange không bắn (treo) → ép reload.
      setTimeout(() => { toast.dismiss("pwa-update"); window.location.reload(); }, 3500);
    }, 2000);

    return () => clearTimeout(timer);
  }, [needRefresh, updateServiceWorker]);
}
