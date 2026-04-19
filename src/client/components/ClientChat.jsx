import { useState, useEffect, useRef } from "react";
import useSocket from "../../hooks/useSocket"; // ← đã sửa ở câu trước

const API = import.meta.env.VITE_API_URL || "/api";

export default function ClientChat({ userPhone }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showPhonePrompt, setShowPhonePrompt] = useState(false); // ← MỚI
  const [conversationId, setConversationId] = useState(null);
  const [clientPhone, setClientPhone] = useState(userPhone || "");
  const [phoneInput, setPhoneInput] = useState(""); // ← MỚI
  const [phoneError, setPhoneError] = useState(""); // ← MỚI
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const messagesEndRef = useRef(null);

  const socket = useSocket(conversationId);

  // Validate SĐT Việt Nam đơn giản
  const isValidPhone = (phone) => /^(0[3|5|7|8|9])+([0-9]{8})$/.test(phone.trim());

  // Bấm FAB: nếu đã có phone thì mở thẳng, chưa có thì hỏi
  const handleToggleChat = () => {
    if (!isOpen) {
      if (clientPhone) {
        startChat(clientPhone);
      } else {
        setShowPhonePrompt(true); // ← hiện popup nhập SĐT
      }
    } else {
      setIsOpen(false);
    }
  };

  // Xác nhận SĐT từ popup
  const handleConfirmPhone = async () => {
    if (!isValidPhone(phoneInput)) {
      setPhoneError("Vui lòng nhập số điện thoại hợp lệ (VD: 0901234567)");
      return;
    }
    setClientPhone(phoneInput);
    setShowPhonePrompt(false);
    setPhoneError("");
    await startChat(phoneInput);
  };

  const startChat = async (phone) => {
    setIsStarting(true);
    try {
      const res = await fetch(`${API}/chat/room`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, name: "Khách hàng" })
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
      .then(res => res.json())
      .then(data => setMessages(data))
      .catch(err => console.error(err));
  }, [conversationId]);

  useEffect(() => {
    if (!socket) return;
    const handleNewMessage = (newMsg) => setMessages((prev) => [...prev, newMsg]);
    socket.on("receiveMessage", handleNewMessage);
    return () => socket.off("receiveMessage", handleNewMessage);
  }, [socket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim() || !socket) return;
    socket.emit("sendMessage", {
      conversationId,
      content: inputText,
      senderType: "client",
      messageType: "text"
    });
    setMessages(prev => [...prev, { content: inputText, senderType: "client", createdAt: new Date() }]);
    setInputText("");
  };

  return (
    <>
      {/* FAB button */}
      {!isOpen && !showPhonePrompt && (
        <div
          onClick={handleToggleChat}
          style={{
            position: 'fixed', bottom: 24, right: 24, width: 60, height: 60,
            borderRadius: '50%', backgroundColor: isStarting ? '#aaa' : '#0084ff',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, cursor: isStarting ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 15px rgba(0,132,255,0.4)', zIndex: 999
          }}
        >
          💬
        </div>
      )}

      {/* Popup nhập SĐT */}
      {showPhonePrompt && (
        <div style={{
          position: 'fixed', bottom: 0, right: 0, width: '100%', maxWidth: 400,
          backgroundColor: '#fff', boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
          borderRadius: '16px 16px 0 0', padding: 24, zIndex: 1000,
          border: '1px solid #e0e0e0'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontWeight: 700, fontSize: 16 }}>💬 Bắt đầu trò chuyện</span>
            <button
              onClick={() => { setShowPhonePrompt(false); setPhoneError(""); }}
              style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#666' }}
            >✕</button>
          </div>
          <p style={{ color: '#555', fontSize: 14, marginBottom: 16 }}>
            Nhập số điện thoại để chúng tôi có thể hỗ trợ bạn tốt hơn.
          </p>
          <input
            type="tel"
            value={phoneInput}
            onChange={(e) => { setPhoneInput(e.target.value); setPhoneError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleConfirmPhone()}
            placeholder="VD: 0901234567"
            autoFocus
            style={{
              width: '100%', padding: '12px 15px', borderRadius: 10,
              border: `1px solid ${phoneError ? '#ff4d4f' : '#ccc'}`,
              outline: 'none', fontSize: 15, marginBottom: 8, boxSizing: 'border-box'
            }}
          />
          {phoneError && (
            <p style={{ color: '#ff4d4f', fontSize: 12, marginBottom: 12 }}>{phoneError}</p>
          )}
          <button
            onClick={handleConfirmPhone}
            disabled={isStarting}
            style={{
              width: '100%', padding: '13px', borderRadius: 10, border: 'none',
              backgroundColor: isStarting ? '#aaa' : '#0084ff', color: '#fff',
              cursor: isStarting ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: 15
            }}
          >
            {isStarting ? 'Đang kết nối...' : 'Bắt đầu chat'}
          </button>
        </div>
      )}

      {/* Khung Chat */}
      {isOpen && (
        <div style={{
          position: 'fixed', bottom: 0, right: 0, width: '100%', maxWidth: 400, height: '500px',
          backgroundColor: '#fff', boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
          display: 'flex', flexDirection: 'column', zIndex: 1000, border: '1px solid #e0e0e0'
        }}>
          {/* Header */}
          <div style={{
            padding: '15px', backgroundColor: '#0084ff', color: '#fff',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span style={{ fontWeight: 700 }}>💬 Hỗ trợ trực tuyến</span>
            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>✕</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, padding: '15px', overflowY: 'auto', backgroundColor: '#f9f9f9', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {messages.length === 0 && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: '14px' }}>
                Chào bạn! Hãy nhập câu hỏi, chúng tôi sẽ phản hồi sớm nhất.
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} style={{ alignSelf: msg.senderType === 'client' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '80%', padding: '10px 14px', borderRadius: '15px',
                  backgroundColor: msg.senderType === 'client' ? '#0084ff' : '#fff',
                  color: msg.senderType === 'client' ? '#fff' : '#333',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)', fontSize: '14px', lineHeight: '1.4'
                }}>
                  {msg.content}
                  <div style={{ fontSize: '10px', color: '#888', textAlign: msg.senderType === 'client' ? 'right' : 'left', marginTop: 4 }}>
                    {new Date(msg.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div style={{ padding: '15px', borderTop: '1px solid #e0e0e0', backgroundColor: '#fff' }}>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Nhập tin nhắn..."
              style={{ width: '100%', padding: '12px 15px', borderRadius: 20, border: '1px solid #ccc', outline: 'none', fontSize: '14px', marginBottom: 8 }}
            />
            <button 
              onClick={handleSend} 
              disabled={!inputText.trim()}
              style={{
                width: '100%', padding: '12px', borderRadius: 20, border: 'none',
                backgroundColor: inputText.trim() ? '#0084ff' : '#ccc', color: '#fff', 
                cursor: inputText.trim() ? 'pointer' : 'not-allowed', fontWeight: 'bold', fontSize: '14px'
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