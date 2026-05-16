import React, { useEffect, useState } from "react";
import axios from "axios";
import CameraPlayer from "../components/CameraPlayer";
import "../../styles/admin/admin.css";

const API = import.meta.env.VITE_API_URL || "/api";

// Cấu hình Go2RTC
const GO2RTC_URL = import.meta.env.VITE_GO2RTC_URL || "http://localhost:1984";

const defaultForm = { name: "", rtsp_url: "", rtsp_sub_url: "", room_id: "", status: "online" };

export default function AdminCameras() {
  const [cameras, setCameras] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(defaultForm);
  const [editTarget, setEditTarget] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [copied, setCopied] = useState(null);
  
  // ✅ THÊM STATE MỚI ĐỂ MỞ FULLSCREEN CAMERA
  const [viewingCamera, setViewingCamera] = useState(null);

  const token = localStorage.getItem("mc_admin_token");
  const headers = { Authorization: `Bearer ${token}` };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchAll = async () => {
    try {
      const [cRes, rRes] = await Promise.all([
        axios.get(`${API}/cameras`, { headers }),
        axios.get(`${API}/rooms`, { headers }),
      ]);
      setCameras(cRes.data);
      setRooms(rRes.data);
    } catch {
      showToast("Không thể tải dữ liệu", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const openCreate = () => {
    setEditTarget(null);
    setForm(defaultForm);
    setShowModal(true);
  };

  const openEdit = (cam) => {
    setEditTarget(cam);
    setForm({
      name: cam.name,
      rtsp_url: cam.rtsp_url || "",
      rtsp_sub_url: cam.rtsp_sub_url || "",
      room_id: cam.room_id || "",
      status: cam.status || "online",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return showToast("Vui lòng nhập tên camera", "error");
    setSaving(true);
    try {
      if (editTarget) {
        await axios.put(`${API}/cameras/${editTarget.id}`, form, { headers });
        showToast("Đã cập nhật camera");
      } else {
        await axios.post(`${API}/cameras`, form, { headers });
        showToast("Đã thêm camera mới");
      }
      setShowModal(false);
      fetchAll();
    } catch (e) {
      showToast(e?.response?.data?.error || "Lỗi lưu dữ liệu", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API}/cameras/${deleteTarget.id}`, { headers });
      showToast("Đã xoá camera");
      setDeleteTarget(null);
      fetchAll();
    } catch {
      showToast("Lỗi xoá camera", "error");
    }
  };

  const copyUrl = (url) => {
    navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 2000);
  };

  const getRoomName = (rid) => {
    const r = rooms.find((r) => String(r.id) === String(rid));
    return r ? r.name : null;
  };

  // Tạo link stream cho iframe
  const getStreamUrl = (camId) => {
    return `${GO2RTC_URL}/stream.html?src=cam_${camId}&media=mse`;
  };

  return (
    <div>
      {/* Topbar */}
      <div className="adm-topbar">
        <div>
          <h1 className="adm-page-title">📷 Quản lý camera</h1>
          <p className="adm-page-sub">Danh sách camera, RTSP stream và phòng gắn kèm</p>
        </div>
        <button className="adm-btn-primary" onClick={openCreate}>
          + Thêm camera
        </button>
      </div>

      {/* Table */}
      <div className="adm-table-wrap">
        {loading ? (
          <div className="adm-loading">
            <div className="adm-spinner adm-spinner-lg" />
            <span>Đang tải...</span>
          </div>
        ) : cameras.length === 0 ? (
          <div className="adm-empty">
            <div className="adm-empty-icon">📷</div>
            <span>Chưa có camera nào</span>
            <button className="adm-btn-primary" onClick={openCreate}>+ Thêm camera đầu tiên</button>
          </div>
        ) : (
          <table className="adm-table">
            <thead>
              <tr>
                <th>Tên camera</th>
                <th>RTSP / Stream URL</th>
                <th>Phòng gắn</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {cameras.map((cam) => {
                const isOnline = cam.status === "online";
                const roomName = getRoomName(cam.room_id);
                return (
                  <tr key={cam.id}>
                    <td style={{ fontWeight: 600 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                          width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                          background: isOnline ? "var(--adm-success)" : "var(--adm-danger)",
                          boxShadow: isOnline ? "0 0 6px var(--adm-success)" : "none",
                        }} />
                        {cam.name}
                      </div>
                    </td>
                    <td>
                      {cam.rtsp_url ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <code style={{
                            fontSize: 12, background: "var(--adm-surface-2)",
                            padding: "3px 8px", borderRadius: 6, color: "var(--adm-accent)",
                            maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis",
                            whiteSpace: "nowrap", display: "block",
                          }}>
                            {cam.rtsp_url}
                          </code>
                          <button
                            onClick={() => copyUrl(cam.rtsp_url)}
                            style={{
                              flexShrink: 0, border: "none", background: "transparent",
                              color: copied === cam.rtsp_url ? "var(--adm-success)" : "var(--adm-text-2)",
                              cursor: "pointer", fontSize: 14, padding: "2px 4px",
                            }}
                            title="Copy URL"
                          >
                            {copied === cam.rtsp_url ? "✅" : "📋"}
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 13, color: "var(--adm-text-2)" }}>— Chưa cấu hình —</span>
                      )}
                    </td>
                    <td>
                      {roomName ? (
                        <span style={{ fontSize: 13, color: "var(--adm-warning)" }}>
                          🏠 {roomName}
                        </span>
                      ) : (
                        <span style={{ fontSize: 13, color: "var(--adm-text-2)" }}>—</span>
                      )}
                    </td>
                    <td>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        fontSize: 13, fontWeight: 600,
                        color: isOnline ? "var(--adm-success)" : "var(--adm-danger)",
                        background: isOnline ? "rgba(52,211,153,0.1)" : "var(--adm-danger-bg)",
                        padding: "4px 10px", borderRadius: 20,
                        border: `1px solid ${isOnline ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`,
                      }}>
                        {isOnline ? "Online" : "Offline"}
                      </span>
                    </td>
                    <td>
                      <div className="adm-actions" style={{ justifyContent: "flex-end" }}>
                        {/* ✅ THÊM NÚT XEM CAMERA Ở ĐÂY */}
                        <button 
                          className="adm-action-btn" 
                          style={{ background: "rgba(129, 140, 248, 0.1)", color: "#818cf8" }}
                          onClick={() => setViewingCamera(cam)}
                          title="Xem trực tiếp"
                        >
                          👁 Xem
                        </button>
                        <button className="adm-action-btn adm-edit" onClick={() => openEdit(cam)}>✏️ Sửa</button>
                        <button className="adm-action-btn adm-delete" onClick={() => setDeleteTarget(cam)}>🗑 Xoá</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Thêm/Sửa */}
      {showModal && (
        <div className="adm-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="adm-modal adm-modal-sm" onClick={(e) => e.stopPropagation()}>
            {/* ... Code Modal Thêm/Sửa giữ nguyên ... */}
            <div className="adm-modal-header">
              <h2>{editTarget ? "✏️ Sửa camera" : "➕ Thêm camera"}</h2>
              <button className="adm-modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="adm-modal-body">
              <div className="adm-field">
                <label className="adm-label">Tên camera *</label>
                <input className="adm-input" placeholder="Camera cửa chính, Phòng ngủ..." value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="adm-field">
                <label className="adm-label">Main Stream — H.265 (dùng để ghi NAS)</label>
                <input className="adm-input" placeholder="rtsp://admin:pass@192.168.1.x:554/Streaming/Channels/101" value={form.rtsp_url} onChange={(e) => setForm({ ...form, rtsp_url: e.target.value })} />
              </div>
              <div className="adm-field">
                <label className="adm-label">Sub Stream — H.264 (dùng để xem live)</label>
                <input className="adm-input" placeholder="rtsp://admin:pass@192.168.1.x:554/Streaming/Channels/102" value={form.rtsp_sub_url} onChange={(e) => setForm({ ...form, rtsp_sub_url: e.target.value })} />
                <small style={{ color: "var(--adm-text-2)", fontSize: 11, marginTop: 4 }}>
                  Để trống nếu camera đã encode H.264 ở main — go2rtc sẽ tự fallback sang main stream.
                </small>
              </div>
              <div className="adm-field">
                <label className="adm-label">Gán vào phòng</label>
                <select className="adm-input adm-select" value={form.room_id} onChange={(e) => setForm({ ...form, room_id: e.target.value })}>
                  <option value="">— Không gán —</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>{r.name} ({r.id})</option>
                  ))}
                </select>
              </div>
              <div className="adm-field">
                <label className="adm-label">Trạng thái</label>
                <select className="adm-input adm-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                </select>
              </div>
              <div className="adm-modal-actions">
                <button className="adm-btn-ghost" onClick={() => setShowModal(false)}>Huỷ</button>
                <button className="adm-btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? <span className="adm-spinner" /> : null}
                  {editTarget ? "Lưu thay đổi" : "Thêm camera"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xác nhận xoá */}
      {deleteTarget && (
        <div className="adm-modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="adm-modal adm-modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="adm-modal-header">
              <h2>🗑 Xoá camera</h2>
              <button className="adm-modal-close" onClick={() => setDeleteTarget(null)}>✕</button>
            </div>
            <div className="adm-modal-body">
              <p className="adm-delete-msg">Bạn có chắc muốn xoá camera <strong>{deleteTarget.name}</strong>? Hành động này không thể hoàn tác.</p>
              <div className="adm-modal-actions">
                <button className="adm-btn-ghost" onClick={() => setDeleteTarget(null)}>Huỷ</button>
                <button className="adm-btn-danger" onClick={handleDelete}>Xoá camera</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✅ MODAL XEM CAMERA TOÀN MÀN HÌNH (FULLSCREEN) */}
      {viewingCamera && (
        <div className="adm-modal-overlay" onClick={() => setViewingCamera(null)}>
          <div 
            className="adm-modal" 
            style={{ maxWidth: '90vw', width: '90vw', height: '85vh' }} 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="adm-modal-header">
              <h2>📹 {viewingCamera.name} {viewingCamera.room_id ? `(Phòng ${viewingCamera.room_id})` : ""}</h2>
              <div style={{ display: "flex", gap: 8 }}>
                {/* Nút mở ra tab mới nếu muốn xem siêu fullscreen */}
                <a 
                  href={getStreamUrl(viewingCamera.id)} 
                  target="_blank" 
                  rel="noreferrer"
                  className="adm-btn-ghost" 
                  style={{ textDecoration: 'none', fontSize: '13px', padding: '6px 12px' }}
                >
                  Mở tab mới
                </a>
                <button className="adm-modal-close" onClick={() => setViewingCamera(null)}>✕</button>
              </div>
            </div>
            <div className="adm-modal-body" style={{ padding: 0, height: 'calc(100% - 60px)', background: '#000' }}>
              <CameraPlayer cameraId={viewingCamera.id} mode="mse,mp4,mjpeg" />
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`adm-toast adm-toast-${toast.type}`}>{toast.msg}</div>
      )}
    </div>
  );
}