import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Đếm lượt truy cập website khách — bắn 1 beacon nhẹ mỗi lần đổi trang.
 *
 * Nguyên tắc: KHÔNG bao giờ làm phiền khách. Dùng navigator.sendBeacon (fire-and-forget,
 * sống sót cả khi khách đóng tab), fallback fetch keepalive; mọi lỗi nuốt hết. Backend
 * (routes/track.js) tự loại bot và gom thống kê cho dashboard admin.
 *
 * "Khách duy nhất" ước lượng bằng visitorId ngẫu nhiên lưu localStorage — ẩn danh, không
 * kèm thông tin cá nhân nào.
 */
const API = import.meta.env.VITE_API_URL || "/api";
const VISITOR_KEY = "mc_visitor_id";

// Trang nội bộ, KHÔNG phải khách vãng lai → không đếm.
const IGNORED_PREFIXES = ["/employee", "/customer-display"];

function getVisitorId() {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return null; // trình duyệt chặn localStorage (ẩn danh) → vẫn đếm được lượt xem, chỉ thiếu "khách duy nhất"
  }
}

function sendPageview(path) {
  try {
    const body = JSON.stringify({
      path,
      visitorId: getVisitorId(),
      referrer: document.referrer || null,
    });
    const url = `${API}/track/pageview`;

    // sendBeacon lý tưởng cho beacon: không chặn điều hướng, gửi được cả lúc rời trang.
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
      return;
    }
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true })
      .catch(() => {});
  } catch {
    // Đếm traffic hỏng tuyệt đối không ảnh hưởng trải nghiệm khách.
  }
}

export default function usePageTracking() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (IGNORED_PREFIXES.some((p) => pathname.startsWith(p))) return;
    sendPageview(pathname);
  }, [pathname]);
}

/** Component tiện lồng trong cây Router (đặt cạnh các provider trong App). */
export function PageTracker() {
  usePageTracking();
  return null;
}
