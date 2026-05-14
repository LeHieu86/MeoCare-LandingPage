import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

const useSocket = (conversationId) => {
  const socketRef = useRef(null);

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
    const socketServer = apiUrl.replace(/\/api$/, "");

    const newSocket = io(socketServer, {
      withCredentials: true
    });

    socketRef.current = newSocket;

    if (conversationId) {
      newSocket.emit("joinRoom", { conversationId });
    }

    return () => {
      newSocket.disconnect();
      socketRef.current = null;
    };
  }, [conversationId]);

  return socketRef;
};

export default useSocket;