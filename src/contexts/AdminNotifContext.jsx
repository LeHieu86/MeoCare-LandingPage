import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRealtimeEvents, joinAdminRoom } from "../hooks/useRealtimeEvents";
import { playOrderSound, playBookingSound, playChatSound } from "../utils/notifSound";

/* ══════════════════════════════════════════════════════
   ADMIN NOTIFICATION CONTEXT
   - Đếm số thông báo chưa đọc: đơn hàng, booking, chat
   - Phát âm thanh khi có thông báo mới (nếu chưa mute)
   - clearCount(key) để reset khi admin mở trang tương ứng
   - muted / toggleMute để tắt/bật âm thanh
   ══════════════════════════════════════════════════════ */

const MUTE_KEY = "adminNotifMuted";

const AdminNotifContext = createContext({
  counts: { orders: 0, bookings: 0, chat: 0 },
  clearCount: () => {},
  muted: false,
  toggleMute: () => {},
});

export function AdminNotifProvider({ children }) {
  const [counts, setCounts] = useState({ orders: 0, bookings: 0, chat: 0 });

  // Lấy trạng thái mute từ localStorage (persist qua session)
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem(MUTE_KEY) === "1"; }
    catch { return false; }
  });

  /* Tham gia admin-room ngay khi layout mount */
  useEffect(() => {
    joinAdminRoom();
  }, []);

  /* Lắng nghe 3 sự kiện từ server — dùng ref để đọc muted mới nhất */
  const mutedRef = useCallback(() => muted, [muted]);

  useRealtimeEvents(
    {
      "order:new": () => {
        setCounts((p) => ({ ...p, orders: p.orders + 1 }));
        if (!mutedRef()) playOrderSound();
      },
      "booking:new": () => {
        setCounts((p) => ({ ...p, bookings: p.bookings + 1 }));
        if (!mutedRef()) playBookingSound();
      },
      "chat:newMessage": () => {
        setCounts((p) => ({ ...p, chat: p.chat + 1 }));
        if (!mutedRef()) playChatSound();
      },
    },
    [mutedRef] // re-subscribe khi muted thay đổi để dùng value mới nhất
  );

  /** Xoá badge của 1 key khi admin mở trang tương ứng */
  const clearCount = useCallback((key) => {
    setCounts((p) => ({ ...p, [key]: 0 }));
  }, []);

  /** Tắt/bật âm thanh + persist vào localStorage */
  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      try { localStorage.setItem(MUTE_KEY, next ? "1" : "0"); } catch {}
      return next;
    });
  }, []);

  return (
    <AdminNotifContext.Provider value={{ counts, clearCount, muted, toggleMute }}>
      {children}
    </AdminNotifContext.Provider>
  );
}

/** Hook tiện dụng để dùng trong các component */
export const useAdminNotif = () => useContext(AdminNotifContext);
