import React, { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { useConfirm } from "../../../hooks/useConfirm";
import api from "../../utils/api";
import "../../../styles/client/pets.css";

const EMPTY_FORM = {
  name: "",
  gender: "male",
  breed: "",
  age: "",
  fromShop: false,
  avatar: "",
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
      fromShop: !!pet.fromShop,
      avatar: pet.avatar || "",
    });
    setError("");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
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
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      const data = await api.upload("/pets/upload-avatar", fd);
      if (data.success) setForm(prev => ({ ...prev, avatar: data.url }));
    } catch (err) {
      setError("Upload ảnh thất bại: " + (err.message || "Lỗi không xác định"));
    } finally {
      setUploading(false);
    }
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
        fromShop: form.fromShop,
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
        <div className="pets-empty">
          <div className="empty-icon">🐱</div>
          <h3>Chưa có bé mèo nào</h3>
          <p>Thêm thú cưng để nhận chính sách ưu đãi và chăm sóc tốt nhất</p>
          <button className="btn-add-pet" onClick={openAddForm}>+ Thêm bé đầu tiên</button>
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
                <div className="pet-meta">
                  <span className={`pet-gender ${pet.gender}`}>
                    {pet.gender === "female" ? "♀ Cái" : "♂ Đực"}
                  </span>
                  <span className="pet-dot">·</span>
                  <span>{pet.age} tuổi</span>
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

      {showForm && (
        <div className="pet-modal-overlay" onClick={closeForm}>
          <div className="pet-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pet-modal-header">
              <h3>{editingId ? "Cập nhật thú cưng" : "Thêm thú cưng mới"}</h3>
              <button className="modal-close" onClick={closeForm}>✕</button>
            </div>

            <form className="pet-form" onSubmit={handleSubmit}>
              {/* Avatar Picker */}
              <div className="avatar-picker-section">
                <div
                  className={`avatar-picker ${uploading ? "uploading" : ""}`}
                  onClick={handleAvatarClick}
                  title="Nhấn để chọn ảnh"
                >
                  {uploading ? (
                    <div className="avatar-spinner" />
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
                  <span className="avatar-picker-cta" onClick={handleAvatarClick}>
                    {form.avatar ? "Đổi ảnh" : "Thêm ảnh đại diện"}
                  </span>
                  <span className="avatar-picker-sub">JPG, PNG, WebP · tối đa 5MB</span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: "none" }}
                  onChange={handleAvatarChange}
                />
              </div>

              <div className="form-group">
                <label>Tên *</label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Ví dụ: Miu, Bún, Mochi..."
                  maxLength={30}
                />
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
                  <input
                    type="text"
                    name="breed"
                    value={form.breed}
                    onChange={handleChange}
                    placeholder="Anh lông ngắn, Munchkin..."
                  />
                </div>
                <div className="form-group form-group-age">
                  <label>Tuổi *</label>
                  <input
                    type="number"
                    name="age"
                    value={form.age}
                    onChange={handleChange}
                    placeholder="0"
                    min="0"
                    max="30"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Nguồn gốc *</label>
                <div className="source-options">
                  <label className={`source-card ${form.fromShop ? "active" : ""}`}>
                    <input type="radio" name="fromShop" checked={form.fromShop === true} onChange={() => setForm(prev => ({ ...prev, fromShop: true }))} />
                    <div className="source-icon">⭐</div>
                    <div className="source-text">
                      <strong>Mua từ MeoMeoCare</strong>
                      <span>Được hưởng ưu đãi đặc biệt</span>
                    </div>
                  </label>
                  <label className={`source-card ${!form.fromShop ? "active" : ""}`}>
                    <input type="radio" name="fromShop" checked={form.fromShop === false} onChange={() => setForm(prev => ({ ...prev, fromShop: false }))} />
                    <div className="source-icon">🏠</div>
                    <div className="source-text">
                      <strong>Thú cưng của tôi</strong>
                      <span>Đã có sẵn từ trước</span>
                    </div>
                  </label>
                </div>
              </div>

              {error && <div className="form-error">{error}</div>}

              <div className="pet-form-actions">
                <button type="button" className="btn-cancel" onClick={closeForm}>Hủy</button>
                <button type="submit" className="btn-submit" disabled={submitting || uploading}>
                  {submitting ? "Đang lưu..." : (editingId ? "Cập nhật" : "Thêm mèo")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PetList;
