import React, { useEffect, useState } from "react";
import axios from "axios";
import "../../styles/admin/admin.css";

const API = import.meta.env.VITE_API_URL || "/api";

const STATUS_LABEL = {
  empty: { label: "Trống", color: "var(--adm-success)" },
  occupied: { label: "Có người", color: "var(--adm-warning)" },
};

const defaultForm = { id: "", name: "", status: "empty", camera_id: "" };

export default function AdminRooms() {
  const [rooms, setRooms] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(defaultForm);
  const [editTarget, setEditTarget] = useState(null); // room đang edit
  const [showModal, setShowModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const token = localStorage.getItem("mc_admin_token");
  const headers = { Authorization: `Bearer ${token}` };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchAll = async () => {
    try {
      const [rRes, cRes] = await Promise.all([
        axios.get(`${API}/rooms`, { headers }),
        axios.get(`${API}/cameras`, { headers }),
      ]);
      setRooms(rRes.data);
      setCameras(cRes.data);
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

  const openEdit = (room) => {
    setEditTarget(room);
    setForm({ id: room.id, name: room.name, status: room.status || "empty", camera_id: room.camera_id || "" });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.id.trim() || !form.name.trim()) return showToast("Vui lòng điền đầy đủ ID và tên phòng", "error");
    setSaving(true);
    try {
      if (editTarget) {
        await axios.put(`${API}/rooms/${editTarget.id}`, form, { headers });
        showToast("Đã cập nhật phòng");
      } else {
        await axios.post(`${API}/rooms`, form, { headers });
        showToast("Đã thêm phòng mới");
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
      await axios.delete(`${API}/rooms/${deleteTarget.id}`, { headers });
      showToast("Đã xoá phòng");
      setDeleteTarget(null);
      fetchAll();
    } catch {
      showToast("Lỗi xoá phòng", "error");
    }
  };

  const getCameraName = (cid) => {
    const c = cameras.find((c) => String(c.id) === String(cid));
    return c ? c.name : null;
  };

  return (
    <div>
      {/* Topbar */}
      <div className="adm-topbar">
        <div>
          <h1 className="adm-page-title">🏠 Quản lý phòng</h1>
          <p className="adm-page-sub">Danh sách phòng, trạng thái và camera gắn kèm</p>
        </div>
        <button className="adm-btn-primary" onClick={openCreate}>
          + Thêm phòng
        </button>
      </div>

      {/* Table */}
      <div className="adm-table-wrap">
        {loading ? (
          <div className="adm-loading">
            <div className="adm-spinner adm-spinner-lg" />
            <span>Đang tải...</span>
          </div>
        ) : rooms.length === 0 ? (
          <div className="adm-empty">
            <div className="adm-empty-icon">🏠</div>
            <span>Chưa có phòng nào</span>
            <button className="adm-btn-primary" onClick={openCreate}>+ Thêm phòng đầu tiên</button>
          </div>
        ) : (
          <table className="adm-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Tên phòng</th>
                <th>Trạng thái</th>
                <th>Camera gắn</th>
                <th style={{ textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => {
                const st = STATUS_LABEL[r.status] || STATUS_LABEL.empty;
                const camName = getCameraName(r.camera_id);
                return (
                  <tr key={r.id}>
                    <td className="adm-td-id">{r.id}</td>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    <td>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        fontSize: 13, fontWeight: 600, color: st.color,
                        background: st.color + "18", padding: "4px 10px",
                        borderRadius: 20, border: `1px solid ${st.color}40`,
                      }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: st.color, display: "inline-block" }} />
                        {st.label}
                      </span>
                    </td>
                    <td>
                      {camName ? (
                        <span style={{ fontSize: 13, color: "var(--adm-accent)" }}>
                          📷 {camName}
                        </span>
                      ) : (
                        <span style={{ fontSize: 13, color: "var(--adm-text-2)" }}>—</span>
                      )}
                    </td>
                    <td>
                      <div className="adm-actions" style={{ justifyContent: "flex-end" }}>
                        <button className="adm-action-btn adm-edit" onClick={() => openEdit(r)}>✏️ Sửa</button>
                        <button className="adm-action-btn adm-delete" onClick={() => setDeleteTarget(r)}>🗑 Xoá</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal thêm/sửa */}
      {showModal && (
        <div className="adm-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="adm-modal adm-modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="adm-modal-header">
              <h2>{editTarget ? "✏️ Sửa phòng" : "➕ Thêm phòng"}</h2>
              <button className="adm-modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="adm-modal-body">
              <div className="adm-field">
                <label className="adm-label">ID phòng *</label>
                <input
                  className="adm-input"
                  placeholder="A1, B2..."
                  value={form.id}
                  disabled={!!editTarget}
                  onChange={(e) => setForm({ ...form, id: e.target.value })}
                />
              </div>
              <div className="adm-field">
                <label className="adm-label">Tên phòng *</label>
                <input
                  className="adm-input"
                  placeholder="Phòng ngủ, Phòng khách..."
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="adm-field">
                <label className="adm-label">Trạng thái</label>
                <select
                  className="adm-input adm-select"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="empty">Trống</option>
                  <option value="occupied">Có người</option>
                </select>
              </div>
              <div className="adm-field">
                <label className="adm-label">Gán camera</label>
                <select
                  className="adm-input adm-select"
                  value={form.camera_id}
                  onChange={(e) => setForm({ ...form, camera_id: e.target.value })}
                >
                  <option value="">— Không gán —</option>
                  {cameras.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="adm-modal-actions">
                <button className="adm-btn-ghost" onClick={() => setShowModal(false)}>Huỷ</button>
                <button className="adm-btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? <span className="adm-spinner" /> : null}
                  {editTarget ? "Lưu thay đổi" : "Thêm phòng"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal xác nhận xoá */}
      {deleteTarget && (
        <div className="adm-modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="adm-modal adm-modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="adm-modal-header">
              <h2>🗑 Xoá phòng</h2>
              <button className="adm-modal-close" onClick={() => setDeleteTarget(null)}>✕</button>
            </div>
            <div className="adm-modal-body">
              <p className="adm-delete-msg">
                Bạn có chắc muốn xoá phòng <strong>{deleteTarget.name}</strong> ({deleteTarget.id})?
                Hành động này không thể hoàn tác.
              </p>
              <div className="adm-modal-actions">
                <button className="adm-btn-ghost" onClick={() => setDeleteTarget(null)}>Huỷ</button>
                <button className="adm-btn-danger" onClick={handleDelete}>Xoá phòng</button>
              </div>
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