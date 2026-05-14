import { useState, useEffect, useRef } from "react";
import useSocket from "../../../hooks/useSocket";

const API = import.meta.env.VITE_API_URL || "/api";

export default function ClientChat({ userPhone }) {
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const messagesEndRef = useRef(null);
  
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [chatHidden, setChatHidden] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handler = (e) => setChatHidden(e.detail.active);
    window.addEventListener("shopping-cart-mode", handler);
    return () => window.removeEventListener("shopping-cart-mode", handler);
  }, []);

  const socket = useSocket(conversationId);

  // ✅ 2. XÓA LOGIC HỎI SĐT - BẤM VÀO CHAT LUÔN
  const handleToggleChat = () => {
    if (!isOpen) {
      if (userPhone) {
        startChat(userPhone);
      } else {
        alert("Vui lòng đăng nhập để sử dụng tính năng chat.");
      }
    } else {
      setIsOpen(false);
    }
  };

  const startChat = async (phone) => {
    setIsStarting(true);
    try {
      const res = await fetch(`${API}/chat/room`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, name: "Khách hàng" }),
      });
      const data = await res.json();
      if (data.success) {
        setConversationId(data.conversationId);
        setIsOpen(true);
      } else {
        alert(data.error || "Không thể kết nối phòng chat.");
      }
    } catch (err) {
      console.error("Lỗi lấy phòng chat:", err);
    } finally {
      setIsStarting(false);
    }
  };

  useEffect(() => {
    if (!conversationId) return;
    fetch(`${API}/chat/history/${conversationId}`)
      .then((res) => res.json())
      .then((data) => setMessages(data))
      .catch((err) => console.error(err));
  }, [conversationId]);

  useEffect(() => {
    if (!socket.current) return;
    const handleNewMessage = (newMsg) => setMessages((prev) => [...prev, newMsg]);
    socket.current.on("receiveMessage", handleNewMessage);
    return () => socket.current?.off("receiveMessage", handleNewMessage);
  }, [socket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim() || !socket.current) return;
    socket.current.emit("sendMessage", {
      conversationId,
      content: inputText,
      senderType: "client",
      messageType: "text",
    });
    // setMessages((prev) => [...prev, { content: inputText, senderType: "client", createdAt: new Date() }]);
    setInputText("");
  };

  if (chatHidden) return null;

  return (
    <>
      {/* ✅ FAB button - TỰ ĐỘNG CHỈNH VỊ TRÍ THEO MÀN HÌNH */}
      {!isOpen && (
        <div
          onClick={handleToggleChat}
          style={{
            position: "fixed",
            bottom: isMobile ? 85 : 24, // Nếu Mobile đẩy lên 85px, Desktop giữ nguyên 24px
            right: 24,
            width: 60,
            height: 60,
            borderRadius: "50%",
            backgroundColor: isStarting ? "#aaa" : "#0084ff",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
            cursor: isStarting ? "not-allowed" : "pointer",
            boxShadow: "0 4px 15px rgba(0,132,255,0.4)",
            zIndex: 999,
            transition: "bottom 0.3s ease" // Thêm hiệu ứng trượt mượt mà
          }}
        >
          💬
        </div>
      )}

      {/* ✅ Khung Chat - TỰ ĐỘNG CHỈNH CHIỀU CAO TRÊN MOBILE */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            right: 0,
            width: "100%",
            maxWidth: 400,
            height: isMobile ? "calc(100vh - 70px)" : "500px", // Mobile chiếm hết màn hình trừ tab bar
            backgroundColor: "#fff",
            boxShadow: "0 -4px 20px rgba(0,0,0,0.15)",
            display: "flex",
            flexDirection: "column",
            zIndex: 1000,
            border: "1px solid #e0e0e0",
          }}
        >
          {/* Header */}
          <div style={{ padding: "15px", backgroundColor: "#0084ff", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700 }}>💬 Hỗ trợ trực tuyến</span>
            <button onClick={() => setIsOpen(false)} style={{ background: "none", border: "none", color: "#fff", fontSize: 20, cursor: "pointer" }}>✕</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, padding: "15px", overflowY: "auto", backgroundColor: "#f9f9f9", display: "flex", flexDirection: "column", gap: "10px" }}>
            {messages.length === 0 && (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#888", fontSize: "14px" }}>
                Chào bạn! Hãy nhập câu hỏi, chúng tôi sẽ phản hồi sớm nhất.
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} style={{ alignSelf: msg.senderType === "client" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "80%", padding: "10px 14px", borderRadius: "15px",
                  backgroundColor: msg.senderType === "client" ? "#0084ff" : "#fff",
                  color: msg.senderType === "client" ? "#fff" : "#333",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.1)", fontSize: "14px", lineHeight: "1.4"
                }}>
                  {msg.content}
                  <div style={{ fontSize: "10px", color: "#888", textAlign: msg.senderType === "client" ? "right" : "left", marginTop: 4 }}>
                    {new Date(msg.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div style={{ padding: "15px", borderTop: "1px solid #e0e0e0", backgroundColor: "#fff" }}>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Nhập tin nhắn..."
              style={{ width: "100%", padding: "12px 15px", borderRadius: 20, border: "1px solid #ccc", outline: "none", fontSize: "14px", marginBottom: 8, boxSizing: "border-box" }}
            />
            <button 
              onClick={handleSend} 
              disabled={!inputText.trim()}
              style={{
                width: "100%", padding: "12px", borderRadius: 20, border: "none",
                backgroundColor: inputText.trim() ? "#0084ff" : "#ccc", color: "#fff", 
                cursor: inputText.trim() ? "pointer" : "not-allowed", fontWeight: "bold", fontSize: "14px"
              }}
            >
              Gửi tin nhắn
            </button>
          </div>
        </div>
      )}
    </>
  );
}