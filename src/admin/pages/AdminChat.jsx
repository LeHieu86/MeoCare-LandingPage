import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import useSocket from "../../hooks/useSocket";
import { useAdminNotif } from "../../contexts/AdminNotifContext";
import "../../styles/admin/admin.css";

const API = import.meta.env.VITE_API_URL || "/api";

/* Màu avatar được tạo từ tên/phone để nhất quán giữa các lần render */
const AVATAR_COLORS = [
  "#5b7cf6","#22c55e","#f59e0b","#ef4444","#8b5cf6",
  "#06b6d4","#ec4899","#14b8a6","#f97316","#84cc16",
];
function avatarColor(str = "") {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/* Avatar hiển thị ảnh nếu có URL, fallback về initials */
function Avatar({ name = "K", avatarUrl = null, phone = "", size = 36 }) {
  const [imgErr, setImgErr] = useState(false);
  const initial = (name || "K").charAt(0).toUpperCase();
  const color   = avatarColor(phone || name);

  if (avatarUrl && !imgErr) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        onError={() => setImgErr(true)}
        style={{
          width: size, height: size, borderRadius: "50%",
          objectFit: "cover", flexShrink: 0,
          border: "2px solid rgba(255,255,255,0.1)"
        }}
      />
    );
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `${color}22`, border: `1.5px solid ${color}55`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 700, fontSize: size * 0.4, color, flexShrink: 0,
    }}>
      {initial}
    </div>
  );
}

export default function AdminChat() {
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv]       = useState(null);
  const [messages, setMessages]           = useState([]);
  const [inputText, setInputText]         = useState("");
  const [loadingConvs, setLoadingConvs]   = useState(true);
  const messagesEndRef = useRef(null);
  const { clearCount } = useAdminNotif();

  const socket = useSocket(activeConv?._id);

  /* Lấy danh sách hội thoại (đã enrich tên + avatar từ PostgreSQL) */
  const fetchConversations = () => {
    setLoadingConvs(true);
    fetch(`${API}/chat/conversations`)
      .then(res => res.json())
      .then(data => { setConversations(Array.isArray(data) ? data : []); setLoadingConvs(false); })
      .catch(() => setLoadingConvs(false));
  };

  useEffect(() => { fetchConversations(); }, []);

  /* Xoá badge chat khi admin mở trang này */
  useEffect(() => {
    clearCount("chat");
  }, [clearCount]);

  /* Khi chọn conversation → tải lịch sử + đánh dấu đã đọc */
  useEffect(() => {
    if (!activeConv) return;

    fetch(`${API}/chat/history/${activeConv._id}`)
      .then(res => res.json())
      .then(setMessages)
      .catch(() => toast.error("Không thể tải lịch sử chat"));

    // Đánh dấu đã đọc
    fetch(`${API}/chat/read/${activeConv._id}`, { method: "PUT" })
      .then(() => {
        // Xoá badge unread
        setConversations(prev => prev.map(c =>
          c._id === activeConv._id ? { ...c, unread: 0 } : c
        ));
      })
      .catch(() => {});
  }, [activeConv]);

  /* Nhận tin nhắn realtime */
  useEffect(() => {
    if (!socket.current) return;
    const handleNewMsg = (msg) => {
      setMessages(prev => [...prev, msg]);
      // Nếu tin đến từ client (không phải conversation đang mở) → cập nhật unread + lastMessage
      if (msg.senderType === "client") {
        setConversations(prev => prev.map(c => {
          if (c._id !== msg.conversationId) return c;
          const isActive = activeConv?._id === msg.conversationId;
          return {
            ...c,
            lastMessage: msg.content,
            unread: isActive ? 0 : (c.unread || 0) + 1,
          };
        }));
      }
    };
    socket.current.on("receiveMessage", handleNewMsg);
    return () => socket.current?.off("receiveMessage", handleNewMsg);
  }, [socket, activeConv]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim() || !socket.current) return;
    socket.current.emit("sendMessage", {
      conversationId: activeConv._id,
      content: inputText,
      senderType: "admin",
      messageType: "text",
    });
    setInputText("");
  };

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread || 0), 0);

  return (
    <div style={{
      display: "flex",
      height: "calc(100vh - 100px)",
      border: "1px solid var(--adm-border)",
      borderRadius: "var(--adm-radius)",
      overflow: "hidden",
      background: "var(--adm-surface)",
    }}>

      {/* ── Cột trái: Danh sách hội thoại ── */}
      <div style={{
        width: 300, borderRight: "1px solid var(--adm-border)",
        background: "var(--adm-surface)", display: "flex",
        flexDirection: "column", flexShrink: 0,
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid var(--adm-border)",
          background: "var(--adm-surface-2)", fontWeight: 700, fontSize: 15,
          color: "var(--adm-text)", display: "flex", alignItems: "center", gap: 8,
        }}>
          <span>💬</span> Tin nhắn
          {totalUnread > 0 && (
            <span style={{
              marginLeft: "auto", background: "#ef4444", color: "#fff",
              fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
            }}>
              {totalUnread}
            </span>
          )}
          {totalUnread === 0 && conversations.length > 0 && (
            <span style={{
              marginLeft: "auto", background: "var(--adm-accent)", color: "#fff",
              fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
            }}>
              {conversations.length}
            </span>
          )}
        </div>

        {/* Danh sách */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {loadingConvs ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--adm-text-2)", fontSize: 13 }}>
              Đang tải...
            </div>
          ) : conversations.length === 0 ? (
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
                    padding: "12px 16px", cursor: "pointer",
                    borderBottom: "1px solid var(--adm-border)",
                    background: isActive ? "var(--adm-accent-glow)" : "transparent",
                    borderLeft: isActive ? "3px solid var(--adm-accent)" : "3px solid transparent",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "var(--adm-surface-2)"; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    {/* Avatar thật hoặc initials */}
                    <Avatar
                      name={conv.clientName}
                      avatarUrl={conv.avatar}
                      phone={conv.phone}
                      size={38}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{
                        fontWeight: conv.unread > 0 ? 700 : 600, fontSize: 14,
                        color: isActive ? "var(--adm-accent)" : "var(--adm-text)",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>
                        {conv.clientName || "Khách hàng"}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--adm-text-2)" }}>
                        {conv.phone}
                        {conv.email && <span style={{ marginLeft: 6, opacity: 0.7 }}>· {conv.email}</span>}
                      </div>
                    </div>
                    {/* Badge unread */}
                    {conv.unread > 0 && (
                      <span style={{
                        background: "#ef4444", color: "#fff", fontSize: 10,
                        fontWeight: 700, padding: "2px 6px", borderRadius: 20, flexShrink: 0,
                      }}>
                        {conv.unread}
                      </span>
                    )}
                  </div>
                  {/* Preview tin nhắn cuối */}
                  <div style={{
                    fontSize: 12, color: conv.unread > 0 ? "var(--adm-text)" : "var(--adm-text-2)",
                    fontWeight: conv.unread > 0 ? 600 : 400,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    paddingLeft: 48,
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
            padding: "12px 20px", borderBottom: "1px solid var(--adm-border)",
            background: "var(--adm-surface-2)", display: "flex", alignItems: "center", gap: 12,
          }}>
            <Avatar
              name={activeConv.clientName}
              avatarUrl={activeConv.avatar}
              phone={activeConv.phone}
              size={42}
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "var(--adm-text)" }}>
                {activeConv.clientName || "Khách hàng"}
              </div>
              <div style={{ fontSize: 12, color: "var(--adm-text-2)", display: "flex", gap: 8 }}>
                <span>📱 {activeConv.phone}</span>
                {activeConv.email && <span>✉️ {activeConv.email}</span>}
              </div>
            </div>
            <div style={{
              marginLeft: "auto", display: "flex", alignItems: "center", gap: 6,
              fontSize: 12, color: "var(--adm-success)",
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                background: "var(--adm-success)", display: "inline-block",
              }} />
              Đang hoạt động
            </div>
          </div>

          {/* Vùng tin nhắn */}
          <div style={{
            flex: 1, padding: "20px 20px 10px", overflowY: "auto",
            background: "var(--adm-bg)", display: "flex", flexDirection: "column", gap: 8,
          }}>
            {messages.length === 0 && (
              <div style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 8,
                color: "var(--adm-text-2)", fontSize: 14,
              }}>
                <span style={{ fontSize: 32 }}>💬</span>
                Chưa có tin nhắn nào
              </div>
            )}
            {messages.map((msg, i) => {
              const isAdmin = msg.senderType === "admin";
              return (
                <div key={i} style={{ display: "flex", justifyContent: isAdmin ? "flex-end" : "flex-start", gap: 8, alignItems: "flex-end" }}>
                  {/* Avatar khách trước bubble */}
                  {!isAdmin && (
                    <Avatar
                      name={activeConv.clientName}
                      avatarUrl={activeConv.avatar}
                      phone={activeConv.phone}
                      size={28}
                    />
                  )}
                  <div style={{
                    maxWidth: "65%", padding: "10px 14px",
                    borderRadius: isAdmin ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
                    background: isAdmin ? "var(--adm-accent)" : "var(--adm-surface-2)",
                    color: isAdmin ? "#fff" : "var(--adm-text)",
                    fontSize: 14, lineHeight: 1.5,
                    border: isAdmin ? "none" : "1px solid var(--adm-border)",
                  }}>
                    {msg.content}
                    <div style={{
                      fontSize: 10, marginTop: 4,
                      color: isAdmin ? "rgba(255,255,255,0.6)" : "var(--adm-text-2)",
                      textAlign: isAdmin ? "right" : "left",
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
            padding: "14px 20px", borderTop: "1px solid var(--adm-border)",
            background: "var(--adm-surface)", display: "flex", gap: 10, alignItems: "center",
          }}>
            <input
              className="adm-input"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSend()}
              placeholder={`Trả lời ${activeConv.clientName || "khách hàng"}...`}
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
        /* Chưa chọn hội thoại */
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
