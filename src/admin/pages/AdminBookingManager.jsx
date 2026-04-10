import React, { useState, useEffect, useCallback } from "react";
import "../../styles/admin/admin.css";

const API = import.meta.env.VITE_API_URL || "/api";

// ================= UTILITIES =================
const getStatusLabel = (status) => {
  switch (status) {
    case 'pending': return '🟡 Chờ nhận';
    case 'active': return '🟢 Đang phục vụ';
    case 'completed': return '⚫ Hoàn thành';
    case 'cancelled': return '🔴 Đã hủy';
    default: return status;
  }
};

const getStatusStyle = (status) => {
  switch (status) {
    case 'pending':   return { background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.3)' };
    case 'active':    return { background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.3)' };
    case 'completed': return { background: 'rgba(139, 144, 167, 0.15)', color: '#94a3b8', border: '1px solid rgba(139, 144, 167, 0.3)' };
    case 'cancelled': return { background: 'rgba(248, 113, 113, 0.15)', color: '#f87171', border: '1px solid rgba(248, 113, 113, 0.3)' };
    default: return {};
  }
};

const formatCurrency = (n) => n.toLocaleString("vi-VN") + "đ";
const calculateServiceCost = (ci, co) => {
  const days = Math.max(1, Math.ceil((new Date(co) - new Date(ci)) / (1000*60*60*24)));
  const unitPrice = days === 1 ? 70000 : 50000;
  return { days, unitPrice, total: days * unitPrice };
};
const calculateLateFee = (co) => {
  const end = new Date(co).getTime(); const now = Date.now();
  if (now <= end) return { isLate: false, fee: 0, hours: 0, days: 0 };
  const hours = Math.ceil((now - end) / (1000*60*60));
  const days = Math.floor(hours / 24);
  let fee = hours <= 4 ? hours * 10000 : 40000 + (days * 50000);
  return { isLate: true, fee, hours, days };
};

// ================= ADMIN BOOKING DETAIL PAGE =================
const AdminBookingDetail = ({ booking, onBack, onUpdateStatus }) => {
  const pricing = calculateServiceCost(booking.check_in, booking.check_out);
  const lateInfo = calculateLateFee(booking.check_out);
  
  // Logic cảnh báo cho Admin
  const now = Date.now();
  const endTime = new Date(booking.check_out).getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;
  let alertConfig = null;

  if (booking.status === 'active') {
    if (endTime - now <= oneDayMs && endTime - now > 0) {
      alertConfig = { type: 'warning', icon: '⏰', msg: 'DỊCH VỤ SẮP HẾT HẠN (Còn dưới 24h)', sub: 'Hãy chủ động gọi điện nhắc khách đến nhận mèo đúng giờ!' };
    } else if (now > endTime && now <= endTime + 7 * oneDayMs) {
      alertConfig = { type: 'danger', icon: '🚨', msg: 'KHÁCH ĐÃ NHẬN MÈO TRỄ', sub: `Đã trễ ${lateInfo.hours} giờ. Phí phụ thu hiện tại là ${formatCurrency(lateInfo.fee)}. Vui lòng liên hệ khách.` };
    } else if (now > endTime + 7 * oneDayMs) {
      alertConfig = { type: 'critical', icon: '🆘', msg: 'NGUY CƠ BỎ MÈO RẤT CAO', sub: 'Đơn đã quá hạn trên 7 ngày. Kiểm tra lại hợp đồng và quy định xử lý bỏ mèo!' };
    }
  }

  const alertStyles = {
    // Điều chỉnh màu background của Alert cho phù hợp Dark Mode (màu đậm hơn chút để đỡ chói)
    warning: { bg: 'rgba(251, 191, 36, 0.1)', border: '#f59e0b', color: '#fbbf24' },
    danger: { bg: 'rgba(248, 113, 113, 0.1)', border: '#ef4444', color: '#f87171' },
    critical: { bg: 'rgba(220, 38, 38, 0.2)', border: '#dc2626', color: '#ef4444' }
  };

  return (
    <div style={{ background: 'var(--adm-bg)', minHeight: '100%', color: 'var(--adm-text)' }}>
      {/* Top Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, background: 'var(--adm-surface)', padding: '16px 20px', borderRadius: 12, border: '1px solid var(--adm-border)', boxShadow: '0 4px 6px rgba(0,0,0,0.2)' }}>
        <button onClick={onBack} style={{ fontSize: 24, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--adm-text)' }}>←</button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: 'var(--adm-text)' }}>Đơn hàng #{booking.id} - 🐱 {booking.cat_name}</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--adm-text-2)' }}>Phòng: {booking.room_name || 'Chưa phân bổ'} • Tạo: {booking.created_at}</p>
        </div>
        <span className="adm-badge" style={getStatusStyle(booking.status)}>{getStatusLabel(booking.status)}</span>
      </div>

      {/* Admin Alerts */}
      {alertConfig && (
        <div style={{ background: alertStyles[alertConfig.type].bg, border: `2px solid ${alertStyles[alertConfig.type].border}`, borderRadius: 12, padding: 20, marginBottom: 24, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ fontSize: 30 }}>{alertConfig.icon}</div>
          <div>
            <h3 style={{ margin: '0 0 4px', color: alertStyles[alertConfig.type].color, fontSize: 16 }}>{alertConfig.msg}</h3>
            <p style={{ margin: 0, color: alertStyles[alertConfig.type].color, fontSize: 14, opacity: 0.9 }}>{alertConfig.sub}</p>
            {lateInfo.isLate && (
              <div style={{ marginTop: 10, fontSize: 20, fontWeight: 800, fontFamily: 'monospace', color: alertStyles[alertConfig.type].color }}>
                Phí trễ: +{formatCurrency(lateInfo.fee)}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* COL 1: Info & Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Khách hàng & Thú cưng */}
          <div style={{ background: 'var(--adm-surface)', padding: 20, borderRadius: 12, border: '1px solid var(--adm-border)', boxShadow: '0 4px 6px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, borderBottom: '1px solid var(--adm-border)', paddingBottom: 8, color: 'var(--adm-text)' }}>Thông tin liên hệ</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              <InfoRow label="Tên chủ" value={`${booking.owner_name}`} />
              <InfoRow label="Số điện thoại" value={`📞 ${booking.owner_phone}`} />
              <InfoRow label="Tên mèo" value={`🐱 ${booking.cat_name} ${booking.cat_breed ? `(${booking.cat_breed})` : ''}`} />
              {booking.note && <InfoRow label="Ghi chú" value={`💬 ${booking.note}`} isNote />}
            </div>
          </div>

          {/* Timeline */}
          <div style={{ background: 'var(--adm-surface)', padding: 20, borderRadius: 12, border: '1px solid var(--adm-border)', boxShadow: '0 4px 6px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, borderBottom: '1px solid var(--adm-border)', paddingBottom: 8, color: 'var(--adm-text)' }}>Tiến trình</h3>
            <div style={{ paddingLeft: 12, borderLeft: '2px solid var(--adm-border)', display: 'flex', flexDirection: 'column', gap: 20 }}>
              <TimelineStep label="Đặt lịch thành công" time={booking.created_at} isDone />
              <TimelineStep label="Nhận mèo vào cửa hàng" time={booking.check_in} isDone={booking.status !== 'pending'} />
              <TimelineStep label="Trả mèo / Hết hạn" time={booking.check_out} isDone={booking.status === 'completed' || lateInfo.isLate} isLate={lateInfo.isLate} />
              <TimelineStep label="Hoàn tất đơn hàng" isDone={booking.status === 'completed'} />
            </div>
          </div>
        </div>

        {/* COL 2: Pricing & Contract */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Chi phí */}
          <div style={{ background: 'var(--adm-surface)', padding: 20, borderRadius: 12, border: '1px solid var(--adm-border)', boxShadow: '0 4px 6px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, borderBottom: '1px solid var(--adm-border)', paddingBottom: 8, color: 'var(--adm-text)' }}>Bảng giá & Chi phí</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14, color: 'var(--adm-text-2)' }}>
              <span>{pricing.days} ngày x {formatCurrency(pricing.unitPrice)}/ngày</span>
              <span style={{ color: 'var(--adm-text)' }}>{formatCurrency(pricing.total)}</span>
            </div>
            {lateInfo.isLate && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px dashed rgba(248, 113, 113, 0.5)', borderBottom: '1px dashed rgba(248, 113, 113, 0.5)', color: '#f87171', fontSize: 14 }}>
                <span>Phí phụ thu ({lateInfo.hours}h / {lateInfo.days}d)</span>
                <span style={{ fontWeight: 700 }}>+{formatCurrency(lateInfo.fee)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '2px solid var(--adm-border)', fontSize: 18, fontWeight: 800 }}>
              <span style={{ color: 'var(--adm-text)' }}>Tổng cộng:</span>
              <span style={{ color: '#34d399' }}>{formatCurrency(pricing.total + (lateInfo.isLate ? lateInfo.fee : 0))}</span>
            </div>
          </div>

          {/* Hợp đồng điện tử */}
          <div style={{ background: 'var(--adm-surface)', padding: 20, borderRadius: 12, border: '1px solid var(--adm-border)', boxShadow: '0 4px 6px rgba(0,0,0,0.2)', flex: 1 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, borderBottom: '1px solid var(--adm-border)', paddingBottom: 8, color: 'var(--adm-text)' }}>
              Hợp đồng điện tử 
              <span style={{ marginLeft: 8, fontSize: 12, padding: '2px 8px', borderRadius: 20, background: booking.contract_status === 'signed' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(248, 113, 113, 0.15)', color: booking.contract_status === 'signed' ? '#34d399' : '#f87171' }}>
                {booking.contract_status === 'signed' ? '✅ Đã ký' : '❌ Chưa ký'}
              </span>
            </h3>
            
            {booking.contract_status === 'signed' && booking.signature ? (
              <div>
                <p style={{ fontSize: 13, color: 'var(--adm-text-2)', marginBottom: 12 }}>Chữ ký xác nhận của khách hàng tại quầy:</p>
                <div style={{ border: '1px solid var(--adm-border)', borderRadius: 8, padding: 10, background: 'var(--adm-bg)' }}>
                  <img src={booking.signature} alt="Customer Signature" style={{ width: '100%', height: 'auto', maxHeight: 150, objectFit: 'contain' }} />
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--adm-text-2)' }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>📝</div>
                <p>Khách hàng chưa ký hợp đồng</p>
                <p style={{ fontSize: 12, margin: '4px 0 0' }}>Hợp đồng chỉ được ký khi khách đến đưa mèo trực tiếp.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div style={{ position: 'sticky', bottom: 0, background: 'var(--adm-surface)', marginTop: 24, padding: 16, borderRadius: '12px 12px 0 0', borderTop: '1px solid var(--adm-border)', display: 'flex', justifyContent: 'flex-end', gap: 12, zIndex: 10 }}>
        {booking.status === 'pending' && (
          <>
            <button className="adm-action-btn adm-delete" onClick={() => { onUpdateStatus(booking.id, 'cancelled'); onBack(); }} style={{ padding: '10px 20px' }}>❌ Hủy đơn</button>
            <button className="adm-action-btn" onClick={() => { onUpdateStatus(booking.id, 'active'); onBack(); }} style={{ padding: '10px 20px', background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.3)' }}>✅ Xác nhận đã nhận mèo</button>
          </>
        )}
        {booking.status === 'active' && (
          <button className="adm-action-btn" onClick={() => { onUpdateStatus(booking.id, 'completed'); onBack(); }} style={{ padding: '10px 20px', background: 'rgba(139, 144, 167, 0.15)', color: '#94a3b8', border: '1px solid rgba(139, 144, 167, 0.3)' }}>🏁 Xác nhận trả mèo</button>
        )}
      </div>
    </div>
  );
};

// Sub-components for Detail Page
const InfoRow = ({ label, value, isNote }) => (
  <div style={{ display: 'flex', gap: 12, fontSize: 14 }}>
    <span style={{ fontWeight: 600, width: 100, color: 'var(--adm-text-2)', flexShrink: 0 }}>{label}:</span>
    <span style={{ color: isNote ? '#fbbf24' : 'var(--adm-text)', fontStyle: isNote ? 'italic' : 'normal' }}>{value}</span>
  </div>
);

const TimelineStep = ({ label, time, isDone, isLate }) => (
  <div style={{ position: 'relative', paddingLeft: 24 }}>
    <div style={{ position: 'absolute', left: -7, top: 0, width: 14, height: 14, borderRadius: '50%', background: isLate ? '#ef4444' : isDone ? '#10b981' : '#475569', border: '2px solid var(--adm-bg)' }}></div>
    <div style={{ fontSize: 14, fontWeight: isDone ? 600 : 400, color: isDone ? 'var(--adm-text)' : 'var(--adm-text-2)' }}>{label}</div>
    {time && <div style={{ fontSize: 12, color: 'var(--adm-text-2)', marginTop: 2 }}>{time}</div>}
  </div>
);


// ================= MAIN ADMIN MANAGER =================
const AdminBookingManager = () => {
  const token = localStorage.getItem("mc_admin_token");
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);

  const fetchBookings = useCallback(() => {
    if (!token) return;
    setIsLoading(true);
    fetch(`${API}/bookings`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setBookings(d.data || []); setIsLoading(false); })
      .catch(() => setIsLoading(false));
  }, [token]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleUpdateStatus = async (id, newStatus) => {
    const confirmMsg = newStatus === 'active' ? "Xác nhận khách đã đến gửi mèo?" : newStatus === 'cancelled' ? "Xác nhận HỦY đơn này?" : "Xác nhận đơn đã hoàn thành?";
    if (!window.confirm(confirmMsg)) return false;

    try {
      const res = await fetch(`${API}/bookings/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        showToast(newStatus === 'cancelled' ? "Đã hủy đơn thành công" : "Cập nhật trạng thái thành công");
        fetchBookings();
        return true;
      } else {
        showToast("Có lỗi xảy ra", "error");
        return false;
      }
    } catch {
      showToast("Lỗi kết nối mạng", "error");
      return false;
    }
  };

  const filteredBookings = bookings.filter(b => filter === "all" ? true : b.status === filter);

  // ================= RENDER DETAIL VIEW =================
  if (selectedBooking) {
    return (
      <div>
        <AdminBookingDetail 
          booking={selectedBooking} 
          onBack={() => setSelectedBooking(null)} 
          onUpdateStatus={handleUpdateStatus} 
        />
        {toast && <div className={`adm-toast ${toast.type === 'error' ? 'adm-toast-error' : 'adm-toast-success'}`}>{toast.msg}</div>}
      </div>
    );
  }

  // ================= RENDER TABLE VIEW =================
  return (
    // Thêm background cho toàn bộ container chính
    <div style={{ background: 'var(--adm-bg)', minHeight: '100vh', color: 'var(--adm-text)' }}>
      <div className="adm-topbar">
        <div>
          <h1 className="adm-page-title">Quản lý đặt lịch</h1>
          <p className="adm-page-sub">Nhấn vào bất kỳ đơn hàng nào để xem chi tiết, hợp đồng và cảnh báo</p>
        </div>
      </div>

      <div className="adm-filters">
        <div className="adm-cat-tabs">
          {['pending', 'active', 'completed', 'all'].map(f => (
            <button key={f} className={`adm-cat-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'pending' ? 'Chờ xử lý' : f === 'active' ? 'Đang phục vụ' : f === 'completed' ? 'Hoàn thành' : 'Tất cả'}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="adm-loading"><div className="adm-spinner adm-spinner-lg"></div><span>Đang tải...</span></div>
      ) : filteredBookings.length === 0 ? (
        <div className="adm-empty"><div className="adm-empty-icon">📋</div><span>Không có đơn hàng nào</span></div>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Mã ĐH</th>
                <th>Khách hàng & Thú cưng</th>
                <th className="adm-td-center">Phòng</th>
                <th>Thời gian</th>
                <th className="adm-td-center">Trạng thái</th>
                <th className="adm-td-center">Hợp đồng</th>
                <th className="adm-td-center">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.map((b) => {
                const isLate = b.status === 'active' && new Date(b.check_out).getTime() < Date.now();
                const isExpiringSoon = b.status === 'active' && (new Date(b.check_out).getTime() - Date.now() <= 24*60*60*1000) && !isLate;
                
                return (
                  <tr 
                    key={b.id} 
                    onClick={() => setSelectedBooking(b)} 
                    style={{ 
                      cursor: 'pointer', 
                      // Thay đổi background khi hover và theo trạng thái
                      background: isLate ? 'rgba(248, 113, 113, 0.1)' : isExpiringSoon ? 'rgba(251, 191, 36, 0.1)' : 'transparent', 
                      transition: 'background 0.2s' 
                    }}
                    // Sửa hiệu ứng hover cho Dark Mode
                    onMouseOver={(e) => e.currentTarget.style.background = isLate ? 'rgba(248, 113, 113, 0.15)' : isExpiringSoon ? 'rgba(251, 191, 36, 0.15)' : 'rgba(255, 255, 255, 0.03)'}
                    onMouseOut={(e) => e.currentTarget.style.background = isLate ? 'rgba(248, 113, 113, 0.1)' : isExpiringSoon ? 'rgba(251, 191, 36, 0.1)' : 'transparent'}
                  >
                    <td className="adm-td-id">#{b.id}</td>
                    <td>
                      <div className="adm-product-name">🐱 {b.cat_name} {b.cat_breed ? `(${b.cat_breed})` : ""}</div>
                      <div className="adm-product-desc">👤 {b.owner_name} | 📞 {b.owner_phone}</div>
                      {isLate && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4, fontWeight: 700 }}>🚨 ĐANG TRỄ HẠN</div>}
                      {isExpiringSoon && <div style={{ color: '#fbbf24', fontSize: 12, marginTop: 4, fontWeight: 700 }}>⏰ SẮP HẾT HẠN HÔM NAY</div>}
                    </td>
                    <td className="adm-td-center" style={{ fontWeight: 600, color: 'var(--adm-text)' }}>{b.room_name || <span style={{color: 'var(--adm-text-2)'}}>Chưa PB</span>}</td>
                    <td>
                      <div style={{ fontWeight: 500, color: 'var(--adm-text)' }}>{b.check_in}</div>
                      <div className="adm-td-id" style={{color: 'var(--adm-text-2)'}}>đến {b.check_out}</div>
                    </td>
                    <td className="adm-td-center"><span className="adm-badge" style={getStatusStyle(b.status)}>{getStatusLabel(b.status)}</span></td>
                    <td className="adm-td-center">
                      <span style={{ fontSize: 13, color: b.contract_status === 'signed' ? '#34d399' : '#64748b' }}>
                        {b.contract_status === 'signed' ? '✅ Đã ký' : '⬜ Rỗng'}
                      </span>
                    </td>
                    <td className="adm-td-center" onClick={(e) => e.stopPropagation()}>
                      <div className="adm-actions" style={{ justifyContent: 'center' }}>
                        {b.status === 'pending' && (
                          <>
                            <button className="adm-action-btn adm-delete" onClick={() => handleUpdateStatus(b.id, 'cancelled')}>❌ Hủy</button>
                            <button className="adm-action-btn adm-edit" onClick={() => handleUpdateStatus(b.id, 'active')} style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.3)' }}>✅ Nhận mèo</button>
                          </>
                        )}
                        {b.status === 'active' && (
                          <button className="adm-action-btn" onClick={() => handleUpdateStatus(b.id, 'completed')} style={{ background: 'rgba(139, 144, 167, 0.15)', color: '#94a3b8', border: '1px solid rgba(139, 144, 167, 0.3)' }}>🏁 Hoàn thành</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {toast && <div className={`adm-toast ${toast.type === 'error' ? 'adm-toast-error' : 'adm-toast-success'}`}>{toast.msg}</div>}
    </div>
  );
};

export default AdminBookingManager;