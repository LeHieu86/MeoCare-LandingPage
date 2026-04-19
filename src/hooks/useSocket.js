import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

const useSocket = (conversationId) => {
  const socketRef = useRef(null);

  useEffect(() => {
    // Xử lý đường dẫn khi ở Local (Vite proxy) và trên Server thật (Domain)
    const socketServer = import.meta.env.VITE_API_URL 
      ? `${import.meta.env.VITE_API_URL.replace('/api', '')}` // Do /api trả về http://localhost:3001
      : "http://localhost:3001";

    // Khởi tạo kết nối Socket
    socketRef.current = io(socketServer, {
      withCredentials: true // Bắt buộc gửi cookie (Cần thiết nếu dùng Session/Cookie trong tương lai)
    });

    // Khi có ID phòng chat, tham gia vào
    if (conversationId) {
      socketRef.current.emit("joinRoom", { conversationId });
    }

    // Cleanup khi thoát component
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [conversationId]);

  return socketRef.current;
};

export default useSocket;