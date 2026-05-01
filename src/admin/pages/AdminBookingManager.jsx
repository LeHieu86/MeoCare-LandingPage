import React, { useState, useEffect, useCallback } from "react";
import AdminBookingDetail from "./AdminBookingDetail";
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
    case 'pending': return { background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.3)' };
    case 'active': return { background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.3)' };
    case 'completed': return { background: 'rgba(139, 144, 167, 0.15)', color: '#94a3b8', border: '1px solid rgba(139, 144, 167, 0.3)' };
    case 'cancelled': return { background: 'rgba(248, 113, 113, 0.15)', color: '#f87171', border: '1px solid rgba(248, 113, 113, 0.3)' };
    default: return {};
  }
};

const formatCurrency = (n) => n.toLocaleString("vi-VN") + "đ";

// ================= COMPONENT: MODAL XÁC NHẬN NHẬN MÈO (UPDATED) =================
const ConfirmReceiptModal = ({ isOpen, onClose, booking, onConfirm }) => {
  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Fetch phòng trống khi modal mở
  useEffect(() => {
    if (isOpen && booking) {
      setIsLoading(true);
      setSelectedRoomId("");  // ← Luôn bắt đầu rỗng
      fetch(`${API}/rooms/available`)  // ← Không cần query param nữa
        .then(r => r.json())
        .then(data => { setRooms(Array.isArray(data) ? data : []); setIsLoading(false); })
        .catch(() => setIsLoading(false));
    }
  }, [isOpen, booking]);

  const handleConfirm = () => {
    // Validate: Phải chọn phòng
    if (!selectedRoomId) return alert("Vui lòng chọn phòng để nhận mèo!");
    onConfirm(booking.id, selectedRoomId);
    onClose();
    // Không reset selectedRoomId ở đây để lần sau mở nếu cùng đơn thì vẫn còn, hoặc useEffect sẽ xử lý
  };

  if (!isOpen || !booking) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div style={{
        background: 'var(--adm-surface)', width: '100%', maxWidth: 450,
        borderRadius: 12, padding: 24, border: '1px solid var(--adm-border)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)'
      }}>
        <h3 style={{ margin: '0 0 16px', color: 'var(--adm-text)', fontSize: 18 }}>Xác nhận nhận mèo</h3>

        <div style={{ marginBottom: 16, padding: 12, background: 'var(--adm-bg)', borderRadius: 8, fontSize: 14, border: '1px solid var(--adm-border)' }}>
          <div style={{ marginBottom: 4 }}><strong>Khách:</strong> {booking.owner_name}</div>
          <div style={{ marginBottom: 4 }}><strong>Mèo:</strong> {booking.cat_name}</div>
          <div><strong>Thời gian:</strong> {booking.check_in} đến {booking.check_out}</div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 8, color: 'var(--adm-text-2)', fontSize: 13, fontWeight: 600 }}>
            Chọn phòng để nhận:
          </label>
          {isLoading ? (
            <div style={{ color: 'var(--adm-text-2)', padding: 10 }}>Đang kiểm tra phòng trống...</div>
          ) : rooms.length === 0 && !booking.room_id ? (
            <div style={{ color: '#f87171', padding: 10, background: 'rgba(248, 113, 113, 0.1)', borderRadius: 6 }}>
              Hiện tại không còn phòng trống!
            </div>
          ) : (
            <select
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              style={{ width: '100%', padding: 10, background: 'var(--adm-bg)', border: '1px solid var(--adm-border)', color: 'var(--adm-text)', borderRadius: 6 }}
            >
              <option value="">-- Chọn phòng --</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--adm-border)', color: 'var(--adm-text-2)', borderRadius: 6, cursor: 'pointer' }}>Hủy</button>
          <button
            onClick={handleConfirm}
            disabled={!selectedRoomId}
            style={{
              padding: '8px 16px', background: '#34d399', color: '#000', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer',
              opacity: !selectedRoomId ? 0.5 : 1
            }}
          >
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
};

// ================= MAIN ADMIN MANAGER =================
const AdminBookingManager = () => {
  const token = localStorage.getItem("mc_admin_token");
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);

  // State quản lý Modal
  const [modalConfig, setModalConfig] = useState({ isOpen: false, booking: null });

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

  // Mở Modal chọn phòng
  const handleRequestReceipt = (booking) => {
    setModalConfig({ isOpen: true, booking });
  };

  // Xử lý khi Admin xác nhận trong Modal
  const handleConfirmReceipt = async (bookingId, roomId) => {
    try {
      const res = await fetch(`${API}/bookings/${bookingId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'active', room_id: roomId })
      });
      if (res.ok) {
        showToast("Đã nhận mèo thành công!");
        fetchBookings();
        // Nếu đang ở trang chi tiết, quay về danh sách để cập nhật trạng thái UI
        if (selectedBooking) setSelectedBooking(null);
      } else {
        const errData = await res.json();
        showToast(errData.error || "Lỗi", "error");
      }
    } catch {
      showToast("Lỗi mạng", "error");
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
          onUpdateStatus={handleRequestReceipt} // Truyền hàm mở modal xuống
          getStatusLabel={getStatusLabel}
          getStatusStyle={getStatusStyle}
          formatCurrency={formatCurrency}
        />
        {toast && <div className={`adm-toast ${toast.type === 'error' ? 'adm-toast-error' : 'adm-toast-success'}`}>{toast.msg}</div>}
      </div>
    );
  }

  // ================= RENDER TABLE VIEW =================
  return (
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
                const isExpiringSoon = b.status === 'active' && (new Date(b.check_out).getTime() - Date.now() <= 24 * 60 * 60 * 1000) && !isLate;

                return (
                  <tr
                    key={b.id}
                    onClick={() => setSelectedBooking(b)}
                    style={{
                      cursor: 'pointer',
                      background: isLate ? 'rgba(248, 113, 113, 0.1)' : isExpiringSoon ? 'rgba(251, 191, 36, 0.1)' : 'transparent',
                      transition: 'background 0.2s'
                    }}
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
                    <td className="adm-td-center" style={{ fontWeight: 600, color: 'var(--adm-text)' }}>{b.room_name || <span style={{ color: 'var(--adm-text-2)' }}>Chưa PB</span>}</td>
                    <td>
                      <div style={{ fontWeight: 500, color: 'var(--adm-text)' }}>{b.check_in}</div>
                      <div className="adm-td-id" style={{ color: 'var(--adm-text-2)' }}>đến {b.check_out}</div>
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
                            <button className="adm-action-btn adm-delete" onClick={() => {
                              // Logic hủy đơn (giữ nguyên cũ, không cần modal phòng)
                              if (window.confirm("Xác nhận HỦY đơn này?")) {
                                // Gọi API hủy đơn tại đây (tương tự handleUpdateStatus cũ)
                                fetch(`${API}/bookings/${b.id}/status`, {
                                  method: "PUT",
                                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                  body: JSON.stringify({ status: 'cancelled' })
                                }).then(() => {
                                  showToast("Đã hủy đơn");
                                  fetchBookings();
                                });
                              }
                            }}>❌ Hủy</button>

                            {/* Nút Nhận mèo -> Mở Modal */}
                            <button
                              className="adm-action-btn adm-edit"
                              onClick={() => handleRequestReceipt(b)}
                              style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.3)' }}
                            >
                              ✅ Nhận mèo
                            </button>
                          </>
                        )}
                        {b.status === 'active' && (
                          <button
                            className="adm-action-btn"
                            onClick={() => {
                              if (window.confirm("Xác nhận đơn đã hoàn thành?")) {
                                fetch(`${API}/bookings/${b.id}/status`, {
                                  method: "PUT",
                                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                  body: JSON.stringify({ status: 'completed' })
                                }).then(() => {
                                  showToast("Đã hoàn thành");
                                  fetchBookings();
                                });
                              }
                            }}
                            style={{ background: 'rgba(139, 144, 167, 0.15)', color: '#94a3b8', border: '1px solid rgba(139, 144, 167, 0.3)' }}
                          >
                            🏁 Hoàn thành
                          </button>
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

      {/* Hiển thị Modal Xác nhận Nhận mèo */}
      <ConfirmReceiptModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ isOpen: false, booking: null })}
        booking={modalConfig.booking}
        onConfirm={handleConfirmReceipt}
      />

      {toast && <div className={`adm-toast ${toast.type === 'error' ? 'adm-toast-error' : 'adm-toast-success'}`}>{toast.msg}</div>}
    </div>
  );
};

export default AdminBookingManager;