import { useState, useEffect, useRef } from "react";
import useSocket from "../../hooks/useSocket";
import "../../styles/admin/admin.css";

const API = import.meta.env.VITE_API_URL || "/api";

export default function AdminChat() {
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv]       = useState(null);
  const [messages, setMessages]           = useState([]);
  const [inputText, setInputText]         = useState("");
  const messagesEndRef = useRef(null);

  const socket = useSocket(activeConv?._id);

  useEffect(() => {
    fetch(`${API}/chat/conversations`)
      .then(res => res.json())
      .then(setConversations)
      .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    if (!activeConv) return;
    fetch(`${API}/chat/history/${activeConv._id}`)
      .then(res => res.json())
      .then(setMessages)
      .catch(err => console.error(err));
  }, [activeConv]);

  useEffect(() => {
    if (!socket.current) return;
    const handleNewMsg = (msg) => setMessages(prev => [...prev, msg]);
    socket.current.on("receiveMessage", handleNewMsg);
    return () => socket.current?.off("receiveMessage", handleNewMsg);
  }, [socket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim() || !socket.current) return;
    socket.current.emit("sendMessage", {
      conversationId: activeConv._id,
      content: inputText,
      senderType: "admin",
      messageType: "text"
    });
    setInputText("");
  };

  return (
    <div style={{
      display: "flex",
      height: "calc(100vh - 100px)",
      border: "1px solid var(--adm-border)",
      borderRadius: "var(--adm-radius)",
      overflow: "hidden",
      background: "var(--adm-surface)"
    }}>

      {/* ── Cột trái: Danh sách hội thoại ── */}
      <div style={{
        width: 280,
        borderRight: "1px solid var(--adm-border)",
        background: "var(--adm-surface)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0
      }}>
        {/* Header cột trái */}
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--adm-border)",
          background: "var(--adm-surface-2)",
          fontWeight: 700,
          fontSize: 15,
          color: "var(--adm-text)",
          display: "flex",
          alignItems: "center",
          gap: 8
        }}>
          <span>💬</span> Tin nhắn
          {conversations.length > 0 && (
            <span style={{
              marginLeft: "auto",
              background: "var(--adm-accent)",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 20
            }}>
              {conversations.length}
            </span>
          )}
        </div>

        {/* Danh sách */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {conversations.length === 0 ? (
            <div className="adm-empty" style={{ padding: "40px 20px" }}>
              <span className="adm-empty-icon">💬</span>
              <span style={{ fontSize: 13 }}>Chưa có hội thoại nào</span>
            </div>
          ) : (
            conversations.map(conv => {
              const isActive = activeConv?._id === conv._id;
              return (
                <div
                  key={conv._id}
                  onClick={() => setActiveConv(conv)}
                  style={{
                    padding: "14px 20px",
                    cursor: "pointer",
                    borderBottom: "1px solid var(--adm-border)",
                    background: isActive ? "var(--adm-accent-glow)" : "transparent",
                    borderLeft: isActive ? "3px solid var(--adm-accent)" : "3px solid transparent",
                    transition: "all 0.15s"
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "var(--adm-surface-2)"; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                >
                  {/* Avatar + tên */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: "50%",
                      background: "var(--adm-accent-glow)",
                      border: "1px solid rgba(91,124,246,0.3)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14, fontWeight: 700,
                      color: "var(--adm-accent)", flexShrink: 0
                    }}>
                      {(conv.clientName || "K").charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontWeight: 600, fontSize: 14,
                        color: isActive ? "var(--adm-accent)" : "var(--adm-text)",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
                      }}>
                        {conv.clientName || "Khách hàng"}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--adm-text-2)" }}>
                        {conv.phone}
                      </div>
                    </div>
                  </div>
                  {/* Preview tin nhắn cuối */}
                  <div style={{
                    fontSize: 12, color: "var(--adm-text-2)",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    paddingLeft: 46
                  }}>
                    {conv.lastMessage || "Chưa có tin nhắn"}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Cột phải: Khung chat ── */}
      {activeConv ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

          {/* Header chat */}
          <div style={{
            padding: "14px 20px",
            borderBottom: "1px solid var(--adm-border)",
            background: "var(--adm-surface-2)",
            display: "flex", alignItems: "center", gap: 12
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: "50%",
              background: "var(--adm-accent-glow)",
              border: "1px solid rgba(91,124,246,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: 15, color: "var(--adm-accent)"
            }}>
              {(activeConv.clientName || "K").charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "var(--adm-text)" }}>
                {activeConv.clientName || "Khách hàng"}
              </div>
              <div style={{ fontSize: 12, color: "var(--adm-text-2)" }}>
                {activeConv.phone}
              </div>
            </div>
            {/* Badge online (tuỳ chọn) */}
            <div style={{
              marginLeft: "auto",
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 12, color: "var(--adm-success)"
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                background: "var(--adm-success)", display: "inline-block"
              }} />
              Đang hoạt động
            </div>
          </div>

          {/* Vùng tin nhắn */}
          <div style={{
            flex: 1, padding: "20px 20px 10px",
            overflowY: "auto",
            background: "var(--adm-bg)",
            display: "flex", flexDirection: "column", gap: 8
          }}>
            {messages.length === 0 && (
              <div style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 8,
                color: "var(--adm-text-2)", fontSize: 14
              }}>
                <span style={{ fontSize: 32 }}>💬</span>
                Chưa có tin nhắn nào
              </div>
            )}
            {messages.map((msg, i) => {
              const isAdmin = msg.senderType === "admin";
              return (
                <div key={i} style={{
                  display: "flex",
                  justifyContent: isAdmin ? "flex-end" : "flex-start"
                }}>
                  <div style={{
                    maxWidth: "70%",
                    padding: "10px 14px",
                    borderRadius: isAdmin ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
                    background: isAdmin ? "var(--adm-accent)" : "var(--adm-surface-2)",
                    color: isAdmin ? "#fff" : "var(--adm-text)",
                    fontSize: 14,
                    lineHeight: 1.5,
                    border: isAdmin ? "none" : "1px solid var(--adm-border)"
                  }}>
                    {msg.content}
                    <div style={{
                      fontSize: 10,
                      marginTop: 4,
                      color: isAdmin ? "rgba(255,255,255,0.6)" : "var(--adm-text-2)",
                      textAlign: isAdmin ? "right" : "left"
                    }}>
                      {new Date(msg.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input gửi tin */}
          <div style={{
            padding: "14px 20px",
            borderTop: "1px solid var(--adm-border)",
            background: "var(--adm-surface)",
            display: "flex", gap: 10, alignItems: "center"
          }}>
            <input
              className="adm-input"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSend()}
              placeholder="Nhập phản hồi..."
              style={{ flex: 1 }}
            />
            <button
              className="adm-btn-primary"
              onClick={handleSend}
              disabled={!inputText.trim()}
              style={{ flexShrink: 0 }}
            >
              Gửi
            </button>
          </div>
        </div>
      ) : (
        /* Trạng thái chưa chọn hội thoại */
        <div className="adm-empty" style={{ flex: 1 }}>
          <span style={{ fontSize: 48 }}>💬</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: "var(--adm-text)" }}>
            Chọn hội thoại để bắt đầu
          </span>
          <span style={{ fontSize: 13 }}>
            Danh sách khách hàng hiển thị bên trái
          </span>
        </div>
      )}
    </div>
  );
}