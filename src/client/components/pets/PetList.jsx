import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import toast from "react-hot-toast";
import { useConfirm } from "../../../hooks/useConfirm";
import api from "../../utils/api";
import { catAge } from "../../utils/geo";
import "../../../styles/client/pets.css";

const EMPTY_FORM = {
  name: "",
  gender: "male",
  breed: "",
  age: "",
  birth_date: "",
  note: "",
  avatar: "",
  cat_code: "", // mã định danh (chỉ đọc, chỉ có với mèo mua tại MeoCare)
};

// Có ngày sinh → hiện theo tháng cho mèo con (<1 năm); không có → fallback theo năm.
const petAgeLabel = (pet) => {
  if (pet.birth_date) {
    const a = catAge(pet.birth_date);
    if (a) return a;
  }
  const y = Number(pet.age) || 0;
  return y >= 1 ? `${y} tuổi` : "Dưới 1 tuổi";
};

const PetList = () => {
  const confirm = useConfirm();
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    api.get("/pets")
      .then(data => { if (data.success) setPets(data.pets || []); })
      .catch(err => console.error("Lỗi tải danh sách thú cưng:", err))
      .finally(() => setLoading(false));
  }, []);

  const openAddForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowForm(true);
  };

  const openEditForm = (pet) => {
    setEditingId(pet.id);
    setForm({
      name: pet.name || "",
      gender: pet.gender || "male",
      breed: pet.breed || "",
      age: String(pet.age ?? ""),
      birth_date: pet.birth_date ? String(pet.birth_date).slice(0, 10) : "",
      note: pet.note || "",
      avatar: pet.avatar || "",
      cat_code: pet.cat_code || "",
    });
    setError("");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
    setUploadError("");
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    if (error) setError("");
  };

  const handleAvatarClick = () => {
    if (!uploading) fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setUploadError("Định dạng không hỗ trợ. Vui lòng dùng JPG, PNG hoặc WebP (ảnh HEIC của iPhone cần chuyển đổi trước)");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError(`Ảnh quá lớn (${(file.size / 1024 / 1024).toFixed(1)}MB), tối đa 10MB`);
      return;
    }

    setUploading(true);
    setUploadError("");
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      const data = await api.upload("/pets/upload-avatar", fd);
      if (data.success) setForm(prev => ({ ...prev, avatar: data.url }));
    } catch (err) {
      setUploadError(err.message || "Upload thất bại");
    } finally {
      setUploading(false);
    }
  };

  const retryAvatarUpload = () => {
    setUploadError("");
    fileInputRef.current?.click();
  };

  const validate = () => {
    if (!form.name.trim()) return "Vui lòng nhập tên thú cưng";
    if (!form.breed.trim()) return "Vui lòng nhập giống loài";
    const ageNum = Number(form.age);
    if (form.age === "" || Number.isNaN(ageNum) || ageNum < 0 || ageNum > 30) {
      return "Tuổi không hợp lệ (0 - 30)";
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        gender: form.gender,
        breed: form.breed.trim(),
        age: Number(form.age),
        birth_date: form.birth_date || null,
        note: form.note.trim() || null,
        avatar: form.avatar || null,
      };

      const data = editingId
        ? await api.put(`/pets/${editingId}`, payload)
        : await api.post("/pets", payload);

      if (editingId) {
        setPets(prev => prev.map(p => p.id === editingId ? data.pet : p));
      } else {
        setPets(prev => [...prev, data.pet]);
      }
      closeForm();
    } catch (err) {
      setError(err.message || "Có lỗi xảy ra");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (pet) => {
    if (!await confirm(`Xóa "${pet.name}" khỏi danh sách?`)) return;
    try {
      await api.delete(`/pets/${pet.id}`);
      setPets(prev => prev.filter(p => p.id !== pet.id));
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="pets-container">
      <div className="pets-header">
        <div>
          <h2 className="pets-title">Thú Cưng Của Bạn</h2>
          <p className="pets-subtitle">Quản lý các bé mèo trong gia đình</p>
        </div>
        <button className="btn-add-pet" onClick={openAddForm}>
          <span>+</span> Thêm Mèo
        </button>
      </div>

      {loading ? (
        <div className="pets-empty"><p>Đang tải...</p></div>
      ) : pets.length === 0 ? (
        <div className="pets-empty pets-empty-emotional">
          <div className="empty-icon pets-empty-bounce">🐱</div>
          <h3>Bé nhà bạn chưa có mặt ở đây!</h3>
          <p>Thêm thú cưng để chúng tôi hiểu và chăm sóc bé tốt hơn — từ chế độ ăn đến lịch ngủ.</p>
          <div className="pets-empty-perks">
            <span>📋 Hồ sơ riêng cho bé</span>
            <span>💌 Cập nhật tiến trình hàng ngày</span>
            <span>📸 Ảnh lưu niệm từng lần gửi</span>
          </div>
          <button className="btn-add-pet" onClick={openAddForm}>🐾 Thêm bé đầu tiên</button>
        </div>
      ) : (
        <div className="pets-grid">
          {pets.map(pet => (
            <div key={pet.id} className="pet-card">
              <div className="pet-avatar">
                {pet.avatar
                  ? <img src={pet.avatar} alt={pet.name} className="pet-avatar-img" />
                  : (pet.gender === "female" ? "🐈" : "🐈‍⬛")
                }
              </div>
              <div className="pet-info">
                <div className="pet-name-row">
                  <h3 className="pet-name">{pet.name}</h3>
                  {pet.fromShop && (
                    <span className="pet-badge-shop" title="Mua từ MeoMeoCare">⭐ MeoMeoCare</span>
                  )}
                </div>
                {pet.cat_code && (
                  <div className="pet-cat-code" title="Mã định danh mèo tại MeoCare">🆔 {pet.cat_code}</div>
                )}
                <div className="pet-meta">
                  <span className={`pet-gender ${pet.gender}`}>
                    {pet.gender === "female" ? "♀ Cái" : "♂ Đực"}
                  </span>
                  <span className="pet-dot">·</span>
                  <span>{petAgeLabel(pet)}</span>
                  <span className="pet-dot">·</span>
                  <span className="pet-breed">{pet.breed}</span>
                </div>
              </div>
              <div className="pet-actions">
                <button className="btn-pet-edit" onClick={() => openEditForm(pet)}>Sửa</button>
                <button className="btn-pet-delete" onClick={() => handleDelete(pet)}>Xóa</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && ReactDOM.createPortal(
        <div className="pet-modal-overlay" onClick={closeForm}>
          <div className="pet-modal" onClick={(e) => e.stopPropagation()}>

            {/* ── DRAG HANDLE (mobile hint) ── */}
            <div className="pet-modal-handle" />

            {/* ── HEADER — không scroll ── */}
            <div className="pet-modal-header">
              <h3>{editingId ? "Cập nhật thú cưng" : "Thêm thú cưng mới"}</h3>
              <button className="modal-close" onClick={closeForm} type="button">✕</button>
            </div>

            {/* ── BODY — scroll ── */}
            <div className="pet-modal-body">
              <div className="avatar-picker-section">
                <div
                  className={`avatar-picker ${uploading ? "uploading" : ""} ${uploadError ? "upload-error" : ""}`}
                  onClick={!uploading && !uploadError ? handleAvatarClick : undefined}
                  title={uploading ? "Đang tải lên..." : "Nhấn để chọn ảnh"}
                >
                  {uploading ? (
                    <div className="avatar-spinner" />
                  ) : uploadError ? (
                    <div className="avatar-error-state">
                      <span className="avatar-error-icon">⚠️</span>
                    </div>
                  ) : form.avatar ? (
                    <img src={form.avatar} alt="Preview" className="avatar-preview-img" />
                  ) : (
                    <div className="avatar-placeholder">
                      <span className="avatar-placeholder-emoji">
                        {form.gender === "female" ? "🐈" : "🐈‍⬛"}
                      </span>
                      <span className="avatar-placeholder-hint">📷</span>
                    </div>
                  )}
                </div>
                <div className="avatar-picker-info">
                  {uploadError ? (
                    <>
                      <span className="avatar-upload-error-msg">{uploadError}</span>
                      <button type="button" className="avatar-retry-btn" onClick={retryAvatarUpload}>Thử lại</button>
                    </>
                  ) : (
                    <>
                      <span className="avatar-picker-cta" onClick={!uploading ? handleAvatarClick : undefined}>
                        {uploading ? "Đang tải lên..." : form.avatar ? "Đổi ảnh" : "Thêm ảnh đại diện"}
                      </span>
                      <span className="avatar-picker-sub">JPG, PNG, WebP · tối đa 10MB</span>
                    </>
                  )}
                </div>
                <input ref={fileInputRef} type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  style={{ display: "none" }} onChange={handleAvatarChange} />
              </div>

              {form.cat_code && (
                <div className="form-group">
                  <label>🆔 Mã định danh (MeoCare)</label>
                  <input type="text" value={form.cat_code} disabled readOnly className="pet-readonly-field" />
                  <span className="pet-readonly-hint">Mã riêng của bé tại MeoCare — chỉ xem, không sửa được.</span>
                </div>
              )}

              <div className="form-group">
                <label>Tên *</label>
                <input type="text" name="name" value={form.name}
                  onChange={handleChange} placeholder="Ví dụ: Miu, Bún, Mochi..." maxLength={30} />
              </div>

              <div className="form-group">
                <label>Giới tính *</label>
                <div className="radio-row">
                  <label className={`radio-pill ${form.gender === "male" ? "active" : ""}`}>
                    <input type="radio" name="gender" value="male" checked={form.gender === "male"} onChange={handleChange} />
                    ♂ Đực
                  </label>
                  <label className={`radio-pill ${form.gender === "female" ? "active" : ""}`}>
                    <input type="radio" name="gender" value="female" checked={form.gender === "female"} onChange={handleChange} />
                    ♀ Cái
                  </label>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Giống loài *</label>
                  <input type="text" name="breed" value={form.breed}
                    onChange={handleChange} placeholder="Anh lông ngắn, Munchkin..." />
                </div>
                <div className="form-group form-group-age">
                  <label>Tuổi *</label>
                  <input type="number" name="age" value={form.age}
                    onChange={handleChange} placeholder="0" min="0" max="30" />
                </div>
              </div>

              <div className="form-group">
                <label>Ngày sinh (nếu biết)</label>
                <input type="date" name="birth_date" value={form.birth_date}
                  onChange={handleChange} max={new Date().toISOString().slice(0, 10)} />
                <span className="avatar-picker-sub">Có ngày sinh sẽ hiện tuổi theo tháng cho mèo con (dưới 1 năm).</span>
              </div>

              <div className="form-group">
                <div className="pet-note-header">
                  <label>Ghi chú</label>
                  <span className="pet-note-counter">{form.note.length}/300</span>
                </div>
                <textarea name="note" value={form.note} onChange={handleChange}
                  placeholder="Đặc điểm nhận dạng, tình trạng sức khỏe, lưu ý khi chăm sóc..."
                  rows={3} maxLength={300} />
              </div>

              {error && <div className="form-error">{error}</div>}
            </div>

            {/* ── FOOTER — không scroll, luôn hiển thị ── */}
            <div className="pet-modal-footer">
              <button type="button" className="btn-cancel" onClick={closeForm}>Hủy</button>
              <button type="button" className="btn-submit"
                disabled={submitting || uploading}
                onClick={handleSubmit}
              >
                {submitting ? "Đang lưu..." : (editingId ? "Cập nhật" : "Thêm mèo")}
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default PetList;
