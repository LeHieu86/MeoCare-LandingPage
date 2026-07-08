/**
 * useEmployeeSocket
 * Kết nối Socket.IO cho cổng nhân viên (website).
 * Dùng ở EmployeeLayout — broadcast xuống các page qua CustomEvent.
 *
 * Các page lắng nghe qua:
 *   window.addEventListener('emp:socket', (e) => { const { event, data } = e.detail; ... });
 */
import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

const SOCKET_EVENTS = [
  "leave:new",
  "leave:approved",
  "leave:rejected",
  "leave:manager_approved",
  "attendance:alert",
  "ot:approved",
  "ot:rejected",
  "chat:newMessage",
];

const useEmployeeSocket = () => {
  const socketRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const apiUrl = import.meta.env.VITE_API_URL || "/api";
    const serverUrl = apiUrl.replace(/\/api$/, "");

    const socket = io(serverUrl, {
      transports: ["websocket"],
      auth: { token },
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      socket.emit("joinNotifRoom", { role: user.role || "employee", token });
    });

    // Broadcast tất cả event ra window để các page tự lắng nghe
    SOCKET_EVENTS.forEach((evName) => {
      socket.on(evName, (data) => {
        window.dispatchEvent(
          new CustomEvent("emp:socket", {
            detail: { event: evName, data: data || {} },
          })
        );
      });
    });

    socket.on("disconnect", () => {});
    socket.on("connect_error", () => {});

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  return socketRef;
};

export default useEmployeeSocket;
