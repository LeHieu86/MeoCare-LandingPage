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
const UTM_KEY = "mc_utm";

// Trang nội bộ, KHÔNG phải khách vãng lai → không đếm.
const IGNORED_PREFIXES = ["/employee", "/customer-display"];

/**
 * Lấy UTM của phiên truy cập theo kiểu "chạm ĐẦU TIÊN" (first-touch).
 *
 * Vì sao cần: khách bấm link quảng cáo có ?utm_campaign=... vào trang chủ, rồi bấm tiếp
 * sang /meo — lúc đó URL không còn utm nữa. Nếu chỉ đọc URL hiện tại thì các trang sau
 * mất dấu nguồn, báo cáo sẽ nói sai là "direct". Nên lưu UTM lần đầu vào sessionStorage
 * rồi gắn cho mọi lượt xem trong cùng phiên.
 */
function getSessionUtm() {
  try {
    const q = new URLSearchParams(window.location.search);
    const fresh = {
      utmSource:   q.get("utm_source"),
      utmMedium:   q.get("utm_medium"),
      utmCampaign: q.get("utm_campaign"),
    };
    if (fresh.utmSource || fresh.utmMedium || fresh.utmCampaign) {
      sessionStorage.setItem(UTM_KEY, JSON.stringify(fresh)); // chạm đầu tiên → ghi đè
      return fresh;
    }
    const saved = sessionStorage.getItem(UTM_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {}; // trình duyệt chặn storage → vẫn đếm được lượt xem, chỉ thiếu nguồn
  }
}

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
      ...getSessionUtm(),   // nguồn chiến dịch (nếu khách vào từ link có gắn UTM)
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
