import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRealtimeEvents, joinAdminRoom } from "../hooks/useRealtimeEvents";

/* ══════════════════════════════════════════════════════
   ADMIN NOTIFICATION CONTEXT
   - Đếm số thông báo chưa đọc: đơn hàng, booking, chat
   - Tự động cộng khi nhận sự kiện realtime từ server
   - clearCount(key) để reset khi admin mở trang tương ứng
   ══════════════════════════════════════════════════════ */

const AdminNotifContext = createContext({
  counts: { orders: 0, bookings: 0, chat: 0 },
  clearCount: () => {},
});

export function AdminNotifProvider({ children }) {
  const [counts, setCounts] = useState({ orders: 0, bookings: 0, chat: 0 });

  /* Tham gia admin-room ngay khi layout mount (sau khi admin đăng nhập) */
  useEffect(() => {
    joinAdminRoom();
  }, []);

  /* Lắng nghe 3 sự kiện từ server */
  useRealtimeEvents(
    {
      "order:new":       () => setCounts((p) => ({ ...p, orders:   p.orders   + 1 })),
      "booking:new":     () => setCounts((p) => ({ ...p, bookings: p.bookings + 1 })),
      "chat:newMessage": () => setCounts((p) => ({ ...p, chat:     p.chat     + 1 })),
    },
    [] // stable — setters từ useState không thay đổi
  );

  /** Xoá badge của 1 key khi admin mở trang tương ứng */
  const clearCount = useCallback((key) => {
    setCounts((p) => ({ ...p, [key]: 0 }));
  }, []);

  return (
    <AdminNotifContext.Provider value={{ counts, clearCount }}>
      {children}
    </AdminNotifContext.Provider>
  );
}

/** Hook tiện dụng để dùng trong các component */
export const useAdminNotif = () => useContext(AdminNotifContext);
