import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import useSocket from "../../../hooks/useSocket";

const API = import.meta.env.VITE_API_URL || "/api";

export default function ClientChat({ userPhone }) {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState("list"); // "list" = chọn chi nhánh | "thread" = đang chat
  const [channels, setChannels] = useState([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [activeChannel, setActiveChannel] = useState(null); // { storeId, storeName }
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [pendingCat, setPendingCat] = useState(null); // thẻ mèo đính kèm, gửi cùng tin kế tiếp
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

  // "Nhắn giữ bé" từ trang chi tiết mèo → mở thẳng phòng chat của chi nhánh + điền sẵn thông tin bé.
  useEffect(() => {
    const handler = async (e) => {
      const { storeId, storeName, prefill } = e.detail || {};
      if (!userPhone) {
        toast.error("Vui lòng đăng nhập để nhắn cho cửa hàng.");
        return;
      }
      setChatHidden(false);
      setIsOpen(true);
      await openChannel({ storeId, storeName });
      if (e.detail?.cat) setPendingCat({ meta: e.detail.cat, content: e.detail.content || `Quan tâm bé "${e.detail.cat.name}"` });
      if (prefill) setInputText(prefill);
    };
    window.addEventListener("open-branch-chat", handler);
    return () => window.removeEventListener("open-branch-chat", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPhone]);

  const socket = useSocket(conversationId);

  // Nạp sẵn danh sách kênh khi vào trang để hiện badge tổng chưa đọc trên nút chat.
  useEffect(() => {
    if (userPhone) loadChannels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPhone]);

  // Có tin trả lời mới từ cửa hàng (NotificationBell phát) → cập nhật badge chưa đọc.
  useEffect(() => {
    const onChatUpdated = () => { if (userPhone) loadChannels(); };
    window.addEventListener("chat-updated", onChatUpdated);
    return () => window.removeEventListener("chat-updated", onChatUpdated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPhone]);

  const totalUnread = channels.reduce((s, c) => s + (c.unread || 0), 0);

  // Mở chat → tải danh sách chi nhánh có thể nhắn
  const handleToggleChat = () => {
    if (!isOpen) {
      if (!userPhone) {
        toast.error("Vui lòng đăng nhập để sử dụng tính năng chat.");
        return;
      }
      setIsOpen(true);
      setView("list");
      loadChannels();
    } else {
      setIsOpen(false);
    }
  };

  const loadChannels = async () => {
    setLoadingChannels(true);
    try {
      const res = await fetch(`${API}/chat/my-branches?phone=${encodeURIComponent(userPhone)}`);
      const data = await res.json();
      setChannels(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Lỗi tải danh sách chi nhánh:", err);
      toast.error("Không tải được danh sách chi nhánh.");
    } finally {
      setLoadingChannels(false);
    }
  };

  const markSeen = (convId) => {
    if (!convId) return;
    fetch(`${API}/chat/client-seen/${convId}`, { method: "PUT" }).catch(() => {});
  };

  const openChannel = async (ch) => {
    try {
      const res = await fetch(`${API}/chat/room`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: userPhone, name: "Khách hàng", storeId: ch.storeId }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || "Không thể mở phòng chat.");
        return;
      }
      setActiveChannel({ storeId: data.storeId, storeName: data.storeName });
      setConversationId(data.conversationId);
      setMessages([]);
      setView("thread");
      markSeen(data.conversationId); // mở ra là coi như đã đọc

      // Tải lịch sử NGAY tại đây — không phụ thuộc effect [conversationId];
      // nếu mở lại đúng hội thoại cũ (id không đổi) effect sẽ không chạy → trống.
      try {
        const hRes = await fetch(`${API}/chat/history/${data.conversationId}`);
        const hist = await hRes.json();
        setMessages(Array.isArray(hist) ? hist : []);
      } catch (e) {
        console.error("Lỗi tải lịch sử chat:", e);
      }
    } catch (err) {
      console.error("Lỗi mở phòng chat:", err);
      toast.error("Không thể mở phòng chat.");
    }
  };

  const backToList = () => {
    markSeen(conversationId); // đánh dấu đã đọc các tin nhận khi đang mở
    setConversationId(null);
    setActiveChannel(null);
    setPendingCat(null);
    setView("list");
    loadChannels(); // refresh tin nhắn cuối + badge
  };

  // (Lịch sử được tải trực tiếp trong openChannel để luôn hiện ngay lần đầu.)

  // Gắn LẠI listener mỗi khi đổi hội thoại — vì useSocket tạo socket MỚI theo
  // conversationId; nếu chỉ phụ thuộc [socket] (ref ổn định) thì listener dính
  // vào socket cũ → tin nhắn không hiện ngay (phải thoát vào lại).
  useEffect(() => {
    if (!conversationId || !socket.current) return;
    const handleNewMessage = (newMsg) => setMessages((prev) => [...prev, newMsg]);
    socket.current.on("receiveMessage", handleNewMessage);
    return () => socket.current?.off("receiveMessage", handleNewMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!socket.current) return;
    const text = inputText.trim();
    if (!text && !pendingCat) return;

    // Gửi thẻ mèo trước (nếu có đính kèm) → hiện card trong khung chat
    if (pendingCat) {
      socket.current.emit("sendMessage", {
        conversationId,
        content: pendingCat.content,
        senderType: "client",
        messageType: "cat",
        meta: pendingCat.meta,
      });
      setPendingCat(null);
    }
    if (text) {
      socket.current.emit("sendMessage", {
        conversationId,
        content: text,
        senderType: "client",
        messageType: "text",
      });
      setInputText("");
    }
  };

  if (chatHidden) return null;

  const headerTitle =
    view === "thread" && activeChannel
      ? activeChannel.storeName
      : "💬 Chọn nơi cần hỗ trợ";

  return (
    <>
      {/* FAB */}
      {!isOpen && (
        <div
          onClick={handleToggleChat}
          style={{
            position: "fixed",
            bottom: isMobile ? 85 : 24,
            right: 24,
            width: 60,
            height: 60,
            borderRadius: "50%",
            backgroundColor: "#0084ff",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
            cursor: "pointer",
            boxShadow: "0 4px 15px rgba(0,132,255,0.4)",
            zIndex: 999,
            transition: "bottom 0.3s ease",
          }}
        >
          💬
          {totalUnread > 0 && (
            <span style={{
              position: "absolute", top: -2, right: -2,
              minWidth: 22, height: 22, padding: "0 6px", borderRadius: 11,
              backgroundColor: "#fa3e3e", color: "#fff", fontSize: 12, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "2px solid #fff", boxSizing: "border-box",
            }}>
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          )}
        </div>
      )}

      {/* Khung Chat */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            right: 0,
            width: "100%",
            maxWidth: 400,
            height: isMobile ? "calc(100vh - 70px)" : "500px",
            backgroundColor: "#fff",
            boxShadow: "0 -4px 20px rgba(0,0,0,0.15)",
            display: "flex",
            flexDirection: "column",
            zIndex: 1000,
            border: "1px solid #e0e0e0",
          }}
        >
          {/* Header */}
          <div style={{ padding: "15px", backgroundColor: "#0084ff", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              {view === "thread" && (
                <button
                  onClick={backToList}
                  title="Quay lại"
                  style={{ background: "none", border: "none", color: "#fff", fontSize: 20, cursor: "pointer", padding: 0 }}
                >
                  ←
                </button>
              )}
              <span style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {headerTitle}
              </span>
            </div>
            <button onClick={() => setIsOpen(false)} style={{ background: "none", border: "none", color: "#fff", fontSize: 20, cursor: "pointer" }}>✕</button>
          </div>

          {/* ── VIEW: Danh sách chi nhánh ── */}
          {view === "list" && (
            <div style={{ flex: 1, overflowY: "auto", backgroundColor: "#f9f9f9" }}>
              <div style={{ padding: "14px 16px", fontSize: 13, color: "#666" }}>
                Chọn chi nhánh đang giữ mèo để hỏi trực tiếp, hoặc nhắn kênh hỗ trợ chung.
              </div>
              {loadingChannels && (
                <div style={{ padding: 24, textAlign: "center", color: "#888", fontSize: 14 }}>Đang tải...</div>
              )}
              {!loadingChannels && channels.map((ch) => {
                const isGeneral = ch.storeId == null;
                return (
                  <div
                    key={ch.storeId ?? "general"}
                    onClick={() => openChannel(ch)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 16px",
                      cursor: "pointer",
                      borderBottom: "1px solid #eee",
                      backgroundColor: "#fff",
                    }}
                  >
                    <div style={{
                      width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
                      backgroundColor: isGeneral ? "#e8f0fe" : "#e6f7ee",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
                    }}>
                      {isGeneral ? "🎧" : "🏬"}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: ch.unread > 0 ? 700 : 600, fontSize: 14, color: "#222" }}>{ch.storeName}</div>
                      <div style={{ fontSize: 12, color: ch.unread > 0 ? "#333" : "#888", fontWeight: ch.unread > 0 ? 600 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {ch.lastMessage
                          ? `${ch.lastSenderType === "client" ? "Bạn: " : ""}${ch.lastMessage}`
                          : (isGeneral ? "Hỏi đáp chung, đặt lịch, thanh toán..." : "Hỏi tình trạng bé mèo của bạn")}
                      </div>
                    </div>
                    {ch.unread > 0 ? (
                      <span style={{
                        minWidth: 20, height: 20, padding: "0 6px", borderRadius: 10,
                        backgroundColor: "#fa3e3e", color: "#fff", fontSize: 11, fontWeight: 700,
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}>
                        {ch.unread > 99 ? "99+" : ch.unread}
                      </span>
                    ) : (
                      <span style={{ color: "#ccc", fontSize: 18 }}>›</span>
                    )}
                  </div>
                );
              })}
              {!loadingChannels && channels.length === 0 && (
                <div style={{ padding: 24, textAlign: "center", color: "#888", fontSize: 14 }}>
                  Chưa có chi nhánh nào.
                </div>
              )}
            </div>
          )}

          {/* ── VIEW: Cuộc trò chuyện ── */}
          {view === "thread" && (
            <>
              <div style={{ flex: 1, padding: "15px", overflowY: "auto", backgroundColor: "#f9f9f9", display: "flex", flexDirection: "column", gap: "10px" }}>
                {messages.length === 0 && (
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#888", fontSize: "14px", textAlign: "center" }}>
                    Chào bạn! Hãy nhập câu hỏi, {activeChannel?.storeName} sẽ phản hồi sớm nhất.
                  </div>
                )}
                {messages.map((msg, i) => {
                  const mine = msg.senderType === "client";
                  const time = new Date(msg.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

                  // Thẻ mèo (Shopee-style): ảnh + tên + thông số + giá
                  if (msg.messageType === "cat" && msg.meta) {
                    const m = msg.meta;
                    return (
                      <div key={i} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "88%" }}>
                        <div style={{ display: "flex", gap: 10, background: "#fff", border: "1px solid #ffd3e1", borderRadius: 14, padding: 8, width: 232, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                          <div style={{ width: 58, height: 58, borderRadius: 10, background: "#FBEAF0", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>
                            {m.image ? <img src={m.image} alt={m.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "🐱"}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#993556", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>
                            <div style={{ fontSize: 11, color: "#888", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {[m.breed, m.gender === "female" ? "Cái ♀" : "Đực ♂", m.age].filter(Boolean).join(" · ")}
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: "#FF6B9D", marginTop: 4 }}>
                              {Number(m.price || 0).toLocaleString("vi-VN")}đ
                            </div>
                          </div>
                        </div>
                        <div style={{ fontSize: 10, color: "#888", textAlign: mine ? "right" : "left", marginTop: 2 }}>{time}</div>
                      </div>
                    );
                  }

                  return (
                    <div key={i} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "80%" }}>
                      <div style={{
                        padding: "10px 14px", borderRadius: "15px",
                        backgroundColor: mine ? "#0084ff" : "#fff",
                        color: mine ? "#fff" : "#333",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.1)", fontSize: "14px", lineHeight: "1.4",
                        overflowWrap: "anywhere", whiteSpace: "pre-wrap"
                      }}>
                        {msg.content}
                        <div style={{ fontSize: "10px", color: mine ? "rgba(255,255,255,0.8)" : "#888", textAlign: mine ? "right" : "left", marginTop: 4 }}>
                          {time}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <div style={{ padding: "15px", borderTop: "1px solid #e0e0e0", backgroundColor: "#fff" }}>
                {/* Thẻ mèo đính kèm chờ gửi (ghim trên ô soạn, kiểu Shopee) */}
                {pendingCat && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#FFF7FB", border: "1px solid #ffd3e1", borderRadius: 12, padding: 6, marginBottom: 8 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: "#FBEAF0", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                      {pendingCat.meta.image ? <img src={pendingCat.meta.image} alt={pendingCat.meta.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "🐱"}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#993556", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>🐱 {pendingCat.meta.name}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#FF6B9D" }}>{Number(pendingCat.meta.price || 0).toLocaleString("vi-VN")}đ</div>
                    </div>
                    <button onClick={() => setPendingCat(null)} title="Bỏ đính kèm" style={{ border: "none", background: "none", color: "#999", fontSize: 16, cursor: "pointer", padding: 4 }}>✕</button>
                  </div>
                )}
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
                  disabled={!inputText.trim() && !pendingCat}
                  style={{
                    width: "100%", padding: "12px", borderRadius: 20, border: "none",
                    backgroundColor: (inputText.trim() || pendingCat) ? "#0084ff" : "#ccc", color: "#fff",
                    cursor: (inputText.trim() || pendingCat) ? "pointer" : "not-allowed", fontWeight: "bold", fontSize: "14px"
                  }}
                >
                  Gửi tin nhắn
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
