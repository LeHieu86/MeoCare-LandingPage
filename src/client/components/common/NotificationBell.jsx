import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { getToken, getUser } from '../../utils/api';

const API_URL = 'https://api.meomeocare.io.vn';

const STATUS_ICON = {
  confirmed: '✅',
  shipping:  '🚚',
  delivered: '📦',
  cancelled: '❌',
};

const STATUS_COLOR = {
  confirmed: '#10B981',
  shipping:  '#8B5CF6',
  delivered: '#3B82F6',
  cancelled: '#EF4444',
};

const STORAGE_KEY = 'meocare_notifs';

// ── Web Audio "ding" ──────────────────────────────────────────────────────────
function playDing() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    // Note 1: cao
    const osc1  = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.type = 'sine';
    osc1.frequency.value = 1046; // C6
    gain1.gain.setValueAtTime(0, ctx.currentTime);
    gain1.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.01);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.5);

    // Note 2: thấp hơn, trễ 120ms → tạo cảm giác "ding-dong"
    const osc2  = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.type = 'sine';
    osc2.frequency.value = 784; // G5
    gain2.gain.setValueAtTime(0, ctx.currentTime + 0.12);
    gain2.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.13);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.65);
    osc2.start(ctx.currentTime + 0.12);
    osc2.stop(ctx.currentTime + 0.65);

    // Tự đóng context sau khi xong
    setTimeout(() => ctx.close(), 800);
  } catch { /* browser không hỗ trợ — bỏ qua */ }
}

function loadNotifs() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveNotifs(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 50)));
}

export default function NotificationBell({ onGoToOrders }) {
  const [notifs, setNotifs]   = useState(loadNotifs);
  const [open, setOpen]       = useState(false);
  const [flash, setFlash]     = useState(false);
  const socketRef             = useRef(null);
  const panelRef              = useRef(null);

  const unread = notifs.filter(n => !n.read).length;

  // ── Socket connection ──────────────────────────────────────────────────────
  useEffect(() => {
    const token = getToken();
    const user  = getUser();
    if (!token || !user?.id) return;

    const socket = io(API_URL, {
      transports: ['websocket'],
      auth: { token },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      // Join room cá nhân để nhận thông báo đơn hàng
      socket.emit('joinCustomerRoom', { userId: user.id });
    });

    socket.on('order:status_changed', (data) => {
      const notif = {
        id:        `${data.orderId}_${data.status}_${Date.now()}`,
        orderId:   data.orderId,
        invoiceNo: data.invoiceNo,
        status:    data.status,
        label:     data.statusLabel,
        time:      new Date().toISOString(),
        read:      false,
      };
      setNotifs(prev => {
        const next = [notif, ...prev];
        saveNotifs(next);
        return next;
      });
      // Âm thanh + flash
      playDing();
      setFlash(true);
      setTimeout(() => setFlash(false), 1200);
      // Browser notification nếu được cấp quyền
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('MeoCare — Cập nhật đơn hàng', {
          body: `Đơn #${data.invoiceNo}: ${data.statusLabel}`,
          icon: '/pwa-192x192.png',
        });
      }
    });

    socket.on('booking:status_changed', (data) => {
      const notif = {
        id:       `booking_${data.bookingId}_${data.status}_${Date.now()}`,
        type:     'booking',
        catName:  data.catName,
        status:   data.status,
        label:    data.statusLabel,
        time:     new Date().toISOString(),
        read:     false,
      };
      setNotifs(prev => {
        const next = [notif, ...prev];
        saveNotifs(next);
        return next;
      });
      playDing();
      setFlash(true);
      setTimeout(() => setFlash(false), 1200);
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('MeoCare — Cập nhật lịch dịch vụ', {
          body: `${data.catName || 'Bé mèo'}: ${data.statusLabel}`,
          icon: '/pwa-192x192.png',
        });
      }
      // Báo cho màn "Dịch vụ đang hoạt động" tải lại trạng thái
      window.dispatchEvent(new CustomEvent('booking-updated'));
    });

    // Cửa hàng/chi nhánh trả lời tin nhắn → khách được báo
    socket.on('chat:newMessage', (data) => {
      const notif = {
        id:      `chat_${data.conversationId}_${Date.now()}`,
        type:    'chat',
        preview: data.preview || 'Bạn có tin nhắn mới',
        time:    new Date().toISOString(),
        read:    false,
      };
      setNotifs(prev => {
        const next = [notif, ...prev];
        saveNotifs(next);
        return next;
      });
      playDing();
      setFlash(true);
      setTimeout(() => setFlash(false), 1200);
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('MeoCare — Tin nhắn mới', {
          body: data.preview || 'Bạn có tin nhắn mới từ cửa hàng',
          icon: '/pwa-192x192.png',
        });
      }
      // Cập nhật badge chưa đọc trên nút chat
      window.dispatchEvent(new CustomEvent('chat-updated'));
    });

    return () => { socket.disconnect(); socketRef.current = null; };
  }, []); // chỉ mount 1 lần

  // ── Click ngoài để đóng panel ─────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // ── Xin quyền push notification khi mount ─────────────────────────────────
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission();
  }, []);

  const markAllRead = useCallback(() => {
    setNotifs(prev => {
      const next = prev.map(n => ({ ...n, read: true }));
      saveNotifs(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setNotifs([]);
    saveNotifs([]);
  }, []);

  const handleNotifClick = useCallback((n) => {
    // Mark as read
    setNotifs(prev => {
      const next = prev.map(x => x.id === n.id ? { ...x, read: true } : x);
      saveNotifs(next);
      return next;
    });
    setOpen(false);
    if (onGoToOrders) onGoToOrders();
  }, [onGoToOrders]);

  function fmtTime(iso) {
    try {
      const d = new Date(iso);
      const now = new Date();
      const diff = Math.floor((now - d) / 1000);
      if (diff < 60)  return 'Vừa xong';
      if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
      if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
      return d.toLocaleDateString('vi-VN');
    } catch { return ''; }
  }

  return (
    <div className="notif-bell-wrapper" ref={panelRef}>
      {/* ── Bell button ── */}
      <button
        className={`notif-bell-btn${flash ? ' notif-flash' : ''}`}
        onClick={() => { setOpen(o => !o); if (!open) markAllRead(); }}
        aria-label="Thông báo"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread > 0 && (
          <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {/* ── Dropdown panel ── */}
      {open && (
        <div className="notif-panel">
          <div className="notif-panel-header">
            <span className="notif-panel-title">🔔 Thông báo</span>
            <div className="notif-panel-actions">
              {notifs.length > 0 && (
                <>
                  <button className="notif-action-btn" onClick={markAllRead}>
                    Đọc tất cả
                  </button>
                  <button className="notif-action-btn notif-clear-btn" onClick={clearAll}>
                    Xóa hết
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="notif-list">
            {notifs.length === 0 ? (
              <div className="notif-empty">
                <span className="notif-empty-icon">🔕</span>
                <p>Chưa có thông báo nào</p>
              </div>
            ) : (
              notifs.map(n => (
                <button
                  key={n.id}
                  className={`notif-item${n.read ? '' : ' notif-unread'}`}
                  onClick={() => handleNotifClick(n)}
                >
                  <span className="notif-item-icon"
                    style={{ color: STATUS_COLOR[n.status] || '#888' }}>
                    {STATUS_ICON[n.status] || '📋'}
                  </span>
                  <div className="notif-item-body">
                    <p className="notif-item-title">
                      {n.type === 'booking'
                        ? <>Lịch dịch vụ <strong>{n.catName || ''}</strong></>
                        : n.type === 'chat'
                          ? <>💬 Tin nhắn mới</>
                          : <>Đơn <strong>#{n.invoiceNo}</strong></>}
                    </p>
                    <p className="notif-item-sub"
                      style={{ color: STATUS_COLOR[n.status] || '#888' }}>
                      {n.type === 'chat' ? n.preview : n.label}
                    </p>
                    <p className="notif-item-time">{fmtTime(n.time)}</p>
                  </div>
                  {!n.read && <span className="notif-dot" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
