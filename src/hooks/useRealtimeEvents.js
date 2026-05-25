import { useEffect } from "react";
import { io } from "socket.io-client";

/* ══════════════════════════════════════════════════════
   SINGLETON SOCKET — một kết nối duy nhất cho toàn admin
   Tránh việc mỗi component tạo một socket riêng.
   ══════════════════════════════════════════════════════ */
let _socket = null;

function getSocket() {
  if (!_socket) {
    const base = (import.meta.env.VITE_API_URL || "/api").replace(/\/api$/, "");
    _socket = io(base, {
      withCredentials: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ["websocket", "polling"],
    });
    _socket.on("connect", () => {
      console.log("🟢 Admin socket connected:", _socket.id);
    });
    _socket.on("disconnect", () => {
      console.log("🔴 Admin socket disconnected");
    });
  }
  return _socket;
}

/**
 * Gọi sau khi admin đăng nhập để tham gia room nhận thông báo realtime.
 * Server sẽ forward order:new, booking:new, chat:newMessage vào room này.
 */
export function joinAdminRoom() {
  getSocket().emit("joinAdminRoom");
}

/**
 * Ngắt kết nối và huỷ singleton (gọi khi admin đăng xuất).
 */
export function disconnectAdminSocket() {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}

/**
 * Hook lắng nghe các sự kiện socket realtime.
 *
 * @param {Record<string, Function>} eventMap  - { "event:name": handlerFn }
 * @param {any[]} deps  - dependency array; dùng [] nếu handler không phụ thuộc state
 *
 * @example
 * useRealtimeEvents({
 *   "order:new": (data) => { toast.success(`Đơn mới #${data.invoiceNo}`); refetch(); },
 * }, []);
 */
export function useRealtimeEvents(eventMap, deps = []) {
  useEffect(() => {
    const socket = getSocket();
    const entries = Object.entries(eventMap);
    entries.forEach(([event, handler]) => socket.on(event, handler));
    return () => {
      entries.forEach(([event, handler]) => socket.off(event, handler));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
