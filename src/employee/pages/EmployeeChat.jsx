/**
 * EmployeeChat — Hộp thư CSKH cho cổng nhân viên (web, responsive cho điện thoại).
 * Nhân viên/quản lý (admin, manager) đọc & trả lời chat khách hàng từ bất kỳ đâu.
 *
 * Tái dùng nguyên giao thức đang chạy:
 *   REST:   GET /chat/conversations · GET /chat/history/:id · PUT /chat/read/:id
 *   Socket: joinRoom · sendMessage(senderType:"admin") · receiveMessage · markAsRead
 *           + chat:newMessage (báo có tin khách mới → refresh danh sách)
 *
 * Tin của Trợ lý AI (isBot) được gắn nhãn riêng để nhân viên biết bot đã trả gì.
 */
import React, { useEffect, useRef, useState, useCallback } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import toast from "react-hot-toast";
import "../../styles/employee/employee-chat.css";

const API = import.meta.env.VITE_API_URL || "/api";
const SOCKET_URL = API.replace(/\/api$/, "");

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

function fmtTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

export default function EmployeeChat() {
  const { user } = useOutletContext() || {};
  const navigate = useNavigate();

  // CHỈ admin được dùng web inbox này (manager gõ thẳng URL sẽ bị đưa về Tổng quan).
  useEffect(() => {
    if (user && user.role !== "admin") navigate("/employee", { replace: true });
  }, [user, navigate]);

  const [conversations, setConversations] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [active, setActive] = useState(null);       // conversation đang mở
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  const socketRef = useRef(null);
  const activeIdRef = useRef(null);                 // tránh stale closure trong listener
  const msgEndRef = useRef(null);
  const refreshTimer = useRef(null);

  // ── Tải danh sách hội thoại ──────────────────────────────────────────────
  const loadConversations = useCallback(async (silent = false) => {
    if (!silent) setLoadingList(true); else setRefreshing(true);
    try {
      const res = await fetch(`${API}/chat/conversations`, { headers: authHeaders() });
      if (res.status === 403) {
        toast.error("Vai trò của bạn không dùng chat khách hàng.");
        setConversations([]);
        return;
      }
      const data = await res.json();
      setConversations(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("[ec] loadConversations", e);
      if (!silent) toast.error("Không tải được danh sách chat.");
    } finally {
      setLoadingList(false);
      setRefreshing(false);
    }
  }, []);

  const scheduleListRefresh = useCallback(() => {
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => loadConversations(true), 400);
  }, [loadConversations]);

  // ── Socket: 1 kết nối cho cả trang ───────────────────────────────────────
  useEffect(() => {
    loadConversations();

    const socket = io(SOCKET_URL, { transports: ["websocket"], withCredentials: true });
    socketRef.current = socket;

    socket.on("connect", () => {
      // Vào phòng để nhận báo có tin khách mới (admin: tất cả; manager: chi nhánh mình)
      if (user?.role === "admin") socket.emit("joinAdminRoom");
      socket.emit("joinStoreChatRoom", { storeId: user?.storeId ?? null });
    });

    // Tin mới trong phòng hội thoại đang mở → hiện ngay
    socket.on("receiveMessage", (msg) => {
      if (String(msg.conversationId) === String(activeIdRef.current)) {
        setMessages((prev) =>
          prev.some((m) => String(m._id) === String(msg._id)) ? prev : [...prev, msg]
        );
      }
      scheduleListRefresh();
    });

    // Báo có tin khách mới (ở hội thoại khác) → cập nhật danh sách
    socket.on("chat:newMessage", () => scheduleListRefresh());

    return () => {
      clearTimeout(refreshTimer.current);
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, user?.storeId]);

  // Auto-scroll khi có tin mới
  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Mở 1 hội thoại ───────────────────────────────────────────────────────
  const openConversation = async (conv) => {
    setActive(conv);
    activeIdRef.current = conv._id;
    setMessages([]);
    socketRef.current?.emit("joinRoom", { conversationId: conv._id });
    try {
      const res = await fetch(`${API}/chat/history/${conv._id}`, { headers: authHeaders() });
      const hist = await res.json();
      setMessages(Array.isArray(hist) ? hist : []);
    } catch (e) {
      console.error("[ec] history", e);
      toast.error("Không tải được lịch sử.");
    }
    // Đánh dấu đã đọc (socket + REST cho chắc) + xoá badge cục bộ
    socketRef.current?.emit("markAsRead", { conversationId: conv._id });
    fetch(`${API}/chat/read/${conv._id}`, { method: "PUT", headers: authHeaders() }).catch(() => {});
    setConversations((prev) => prev.map((c) => (c._id === conv._id ? { ...c, unread: 0 } : c)));
  };

  const backToList = () => {
    activeIdRef.current = null;
    setActive(null);
    loadConversations(true);
  };

  // ── Gửi tin (nhân viên = senderType "admin") ─────────────────────────────
  const send = () => {
    const text = input.trim();
    if (!text || !active || !socketRef.current) return;
    socketRef.current.emit("sendMessage", {
      conversationId: active._id,
      content: text,
      senderType: "admin",
      messageType: "text",
    });
    setInput("");
  };

  const onInputKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className={`ec-wrap ${active ? "viewing-thread" : ""}`}>

      {/* ── Danh sách ── */}
      <div className="ec-list">
        <div className="ec-list-head">
          <span className="ec-list-title">💬 Chat khách hàng</span>
          <button className="ec-refresh" disabled={refreshing} onClick={() => loadConversations(true)}>
            {refreshing ? "Đang tải…" : "↻ Làm mới"}
          </button>
        </div>
        <div className="ec-list-scroll">
          {loadingList ? (
            <div className="ec-empty"><span>Đang tải…</span></div>
          ) : conversations.length === 0 ? (
            <div className="ec-empty">
              <span className="ec-empty-icon">📭</span>
              <span>Chưa có hội thoại nào</span>
            </div>
          ) : (
            conversations.map((c) => (
              <div
                key={c._id}
                className={`ec-conv ${active?._id === c._id ? "active" : ""}`}
                onClick={() => openConversation(c)}
              >
                <div className="ec-avatar">
                  {c.avatar ? <img src={c.avatar} alt="" /> : "🐱"}
                </div>
                <div className="ec-conv-mid">
                  <div className="ec-conv-top">
                    <span className="ec-conv-name">{c.clientName || c.phone || "Khách"}</span>
                    <span className="ec-conv-time">{fmtTime(c.updatedAt)}</span>
                  </div>
                  <div className={`ec-conv-last ${c.unread ? "unread" : ""}`}>
                    {c.lastSenderType === "admin" ? "Bạn: " : ""}{c.lastMessage || "—"}
                  </div>
                  <span className="ec-tag">{c.storeName}</span>
                </div>
                {c.unread > 0 && <span className="ec-badge">{c.unread}</span>}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Khung tin nhắn ── */}
      <div className="ec-thread">
        {!active ? (
          <div className="ec-empty">
            <span className="ec-empty-icon">👈</span>
            <span>Chọn một hội thoại để bắt đầu trả lời khách</span>
          </div>
        ) : (
          <>
            <div className="ec-thread-head">
              <button className="ec-back" onClick={backToList}>‹</button>
              <div className="ec-avatar">{active.avatar ? <img src={active.avatar} alt="" /> : "🐱"}</div>
              <div>
                <div className="ec-thread-name">{active.clientName || active.phone || "Khách"}</div>
                <div className="ec-thread-sub">{active.storeName}{active.phone ? ` · ${active.phone}` : ""}</div>
              </div>
            </div>

            <div className="ec-msgs">
              {messages.map((m) => {
                const isClient = m.senderType === "client";
                const isBot = !isClient && m.isBot;
                return (
                  <div key={m._id} className={`ec-row ${isClient ? "client" : isBot ? "staff bot" : "staff"}`}>
                    <div>
                      <div className="ec-bubble">{m.content}</div>
                      <div className="ec-meta">
                        {isBot && <span className="ec-bot-tag">🤖 Trợ lý AI · </span>}
                        {fmtTime(m.createdAt)}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={msgEndRef} />
            </div>

            <div className="ec-input-bar">
              <textarea
                className="ec-input"
                placeholder="Nhập tin nhắn trả lời khách…"
                value={input}
                rows={1}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onInputKey}
              />
              <button className="ec-send" disabled={!input.trim()} onClick={send}>➤</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
