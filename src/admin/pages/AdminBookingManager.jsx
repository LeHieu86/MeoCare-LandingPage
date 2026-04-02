import React, { useState, useEffect, useCallback } from "react";
import "../../styles/admin/admin.css";

const API = import.meta.env.VITE_API_URL || "/api";

// Helper: Map trạng thái ra text tiếng Việt
const getStatusLabel = (status) => {
  switch (status) {
    case 'pending': return '🟡 Chờ nhận';
    case 'active': return '🟢 Đang phục vụ';
    case 'completed': return '⚫ Hoàn thành';
    case 'cancelled': return '🔴 Đã hủy';
    default: return status;
  }
};

// Helper: Map trạng thái ra màu (Dùng inline style vì CSS của bạn chỉ có màu cho sản phẩm)
const getStatusStyle = (status) => {
  switch (status) {
    case 'pending':   return { background: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.2)' };
    case 'active':    return { background: 'rgba(52, 211, 153, 0.1)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.2)' };
    case 'completed': return { background: 'rgba(139, 144, 167, 0.1)', color: '#8b90a7', border: '1px solid rgba(139, 144, 167, 0.2)' };
    case 'cancelled': return { background: 'rgba(248, 113, 113, 0.1)', color: '#f87171', border: '1px solid rgba(248, 113, 113, 0.2)' };
    default: return {};
  }
};

const AdminBookingManager = () => {
  const token = localStorage.getItem("mc_admin_token");
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const fetchBookings = useCallback(() => {
    if (!token) return;
    setIsLoading(true);
    fetch(`${API}/bookings`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => {
        setBookings(d.data || []);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [token]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleUpdateStatus = async (id, newStatus) => {
    const confirmMsg = newStatus === 'active' 
      ? "Xác nhận khách đã đến gửi mèo?" 
      : newStatus === 'cancelled' 
      ? "Xác nhận HỦY đơn này?" 
      : "Xác nhận đơn đã hoàn thành?";
    
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch(`${API}/bookings/${id}/status`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        showToast(newStatus === 'cancelled' ? "Đã hủy đơn thành công" : "Cập nhật trạng thái thành công");
        fetchBookings();
      } else {
        showToast("Có lỗi xảy ra, vui lòng thử lại", "error");
      }
    } catch {
      showToast("Lỗi kết nối mạng", "error");
    }
  };

  const filteredBookings = bookings.filter(b => {
    if (filter === "all") return true;
    return b.status === filter;
  });

  return (
    <div>
      {/* Header */}
      <div className="adm-topbar">
        <div>
          <h1 className="adm-page-title">Quản lý đặt lịch</h1>
          <p className="adm-page-sub">Xử lý xác nhận, phân phòng và theo dõi dịch vụ</p>
        </div>
      </div>

      {/* Filters / Tabs */}
      <div className="adm-filters">
        <div className="adm-cat-tabs">
          <button className={`adm-cat-tab ${filter === 'pending' ? 'active' : ''}`} onClick={() => setFilter('pending')}>
            Chờ xử lý
          </button>
          <button className={`adm-cat-tab ${filter === 'active' ? 'active' : ''}`} onClick={() => setFilter('active')}>
            Đang phục vụ
          </button>
          <button className={`adm-cat-tab ${filter === 'completed' ? 'active' : ''}`} onClick={() => setFilter('completed')}>
            Hoàn thành
          </button>
          <button className={`adm-cat-tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
            Tất cả
          </button>
        </div>
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div className="adm-loading">
          <div className="adm-spinner adm-spinner-lg"></div>
          <span>Đang tải danh sách...</span>
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="adm-empty">
          <div className="adm-empty-icon">📋</div>
          <span>Không có đơn hàng nào ở trạng thái này</span>
        </div>
      ) : (
        <div className="adm-table-wrap" style={{ overflowX: 'auto' }}>
          <table className="adm-table">
            <thead>
              <tr>
                <th>Mã ĐH</th>
                <th>Khách hàng & Thú cưng</th>
                <th className="adm-td-center">Phòng</th>
                <th>Thời gian</th>
                <th className="adm-td-center">Trạng thái</th>
                <th className="adm-td-center">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.map((b) => (
                <tr key={b.id}>
                  {/* Mã đơn */}
                  <td className="adm-td-id">#{b.id}</td>
                  
                  {/* Thông tin */}
                  <td>
                    <div className="adm-product-name" style={{fontSize: '14px'}}>
                      🐱 {b.cat_name} {b.cat_breed ? `(${b.cat_breed})` : ""}
                    </div>
                    <div className="adm-product-desc">
                      👤 {b.owner_name} &nbsp;|&nbsp; 📞 {b.owner_phone}
                    </div>
                    {b.note && (
                      <div className="adm-product-desc" style={{ color: '#fbbf24', marginTop: 4 }}>
                        💬 {b.note}
                      </div>
                    )}
                  </td>

                  {/* Phòng */}
                  <td className="adm-td-center" style={{ fontWeight: 600 }}>
                    {b.room_name || <span style={{color: 'var(--adm-text-2)'}}>Chưa phân bổ</span>}
                  </td>

                  {/* Ngày */}
                  <td>
                    <div style={{ fontWeight: 500 }}>{b.check_in}</div>
                    <div className="adm-td-id">đến {b.check_out}</div>
                  </td>

                  {/* Trạng thái */}
                  <td className="adm-td-center">
                    <span className="adm-badge" style={getStatusStyle(b.status)}>
                      {getStatusLabel(b.status)}
                    </span>
                  </td>

                  {/* Hành động */}
                  <td className="adm-td-center">
                    <div className="adm-actions" style={{ justifyContent: 'center' }}>
                      
                      {b.status === 'pending' && (
                        <>
                          <button 
                            className="adm-action-btn adm-delete" 
                            onClick={() => handleUpdateStatus(b.id, 'cancelled')}
                            title="Từ chối/Hủy"
                          >
                            ❌ Hủy
                          </button>
                          <button 
                            className="adm-action-btn adm-edit" 
                            onClick={() => handleUpdateStatus(b.id, 'active')}
                            title="Xác nhận đã nhận mèo"
                            style={{ background: 'rgba(52, 211, 153, 0.1)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.2)' }}
                          >
                            ✅ Nhận mèo
                          </button>
                        </>
                      )}

                      {b.status === 'active' && (
                        <button 
                          className="adm-action-btn" 
                          onClick={() => handleUpdateStatus(b.id, 'completed')}
                          title="Khách đã lấy mèo về"
                          style={{ background: 'rgba(139, 144, 167, 0.1)', color: '#8b90a7', border: '1px solid rgba(139, 144, 167, 0.2)' }}
                        >
                          🏁 Hoàn thành
                        </button>
                      )}

                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Toast Notify */}
      {toast && (
        <div className={`adm-toast ${toast.type === 'error' ? 'adm-toast-error' : 'adm-toast-success'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default AdminBookingManager;