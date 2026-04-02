import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { adminAPI } from "../../hooks/useProducts";
import "../../styles/admin/admin.css";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

const CATEGORIES = [
  { id: "food",    label: "🍚 Hạt" },
  { id: "pate",    label: "🥫 Pate" },
  { id: "hygiene", label: "🧼 Vệ sinh" },
  { id: "combo",   label: "🎁 Combo" },
];

const CAT_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));

const emptyForm = () => ({
  name: "",
  category: "food",
  image: "",
  description: "",
  variants: [{ name: "", price: "" }],
});

const VariantEditor = ({ variants, onChange }) => {
  const update = (idx, field, value) => {
    const next = variants.map((v, i) => (i === idx ? { ...v, [field]: value } : v));
    onChange(next);
  };
  const add = () => onChange([...variants, { name: "", price: "" }]);
  const remove = (idx) => onChange(variants.filter((_, i) => i !== idx));

  return (
    <div className="adm-variants">
      <div className="adm-variants-header">
        <span className="adm-label">Phân loại (variants)</span>
        <button type="button" className="adm-add-variant" onClick={add}>+ Thêm</button>
      </div>
      {variants.map((v, idx) => (
        <div key={idx} className="adm-variant-row">
          <input
            className="adm-input adm-variant-name"
            placeholder="Tên biến thể, vd: Thịt Gà - 5 Gói"
            value={v.name}
            onChange={(e) => update(idx, "name", e.target.value)}
          />
          <input
            className="adm-input adm-variant-price"
            placeholder="Giá (VNĐ)"
            type="number"
            min="0"
            value={v.price}
            onChange={(e) => update(idx, "price", e.target.value)}
          />
          {variants.length > 1 && (
            <button type="button" className="adm-remove-variant" onClick={() => remove(idx)}>✕</button>
          )}
        </div>
      ))}
    </div>
  );
};

const ProductModal = ({ product, onSave, onClose, saving }) => {
  const isEdit = !!product?.id;
  const [form, setForm] = useState(
    isEdit
      ? { ...product, variants: product.variants.map((v) => ({ name: v.name, price: String(v.price) })) }
      : emptyForm()
  );
  const [err, setErr] = useState("");

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setErr("Tên sản phẩm không được trống.");
    if (form.variants.some((v) => !v.name.trim() || v.price === ""))
      return setErr("Tất cả biến thể phải có tên và giá.");
    setErr("");
    onSave({ ...form, variants: form.variants.map((v) => ({ name: v.name.trim(), price: parseInt(v.price) })) });
  };

  return (
    <div className="adm-modal-overlay" onClick={onClose}>
      <div className="adm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="adm-modal-header">
          <h2>{isEdit ? "✏️ Chỉnh sửa sản phẩm" : "➕ Thêm sản phẩm mới"}</h2>
          <button className="adm-modal-close" onClick={onClose}>✕</button>
        </div>
        <form className="adm-modal-body" onSubmit={handleSubmit}>
          <div className="adm-field">
            <label className="adm-label">Tên sản phẩm *</label>
            <input className="adm-input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Hạt Keres Formula+ 2Kg" required />
          </div>
          <div className="adm-field-row">
            <div className="adm-field">
              <label className="adm-label">Danh mục *</label>
              <select className="adm-input adm-select" value={form.category} onChange={(e) => set("category", e.target.value)}>
                {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div className="adm-field adm-field-grow">
              <label className="adm-label">URL ảnh</label>
              <input className="adm-input" value={form.image} onChange={(e) => set("image", e.target.value)} placeholder="https://..." />
            </div>
          </div>
          {form.image && (
            <div className="adm-img-preview">
              <img src={form.image} alt="preview" onError={(e) => (e.target.style.display = "none")} />
            </div>
          )}
          <div className="adm-field">
            <label className="adm-label">Mô tả</label>
            <input className="adm-input" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Mô tả ngắn gọn..." />
          </div>
          <VariantEditor variants={form.variants} onChange={(v) => set("variants", v)} />
          {err && <div className="adm-error">{err}</div>}
          <div className="adm-modal-actions">
            <button type="button" className="adm-btn-ghost" onClick={onClose}>Hủy</button>
            <button type="submit" className="adm-btn-primary" disabled={saving}>
              {saving ? <span className="adm-spinner" /> : isEdit ? "Lưu thay đổi" : "Tạo sản phẩm"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const DeleteConfirm = ({ product, onConfirm, onClose, deleting }) => (
  <div className="adm-modal-overlay" onClick={onClose}>
    <div className="adm-modal adm-modal-sm" onClick={(e) => e.stopPropagation()}>
      <div className="adm-modal-header">
        <h2>🗑️ Xác nhận xóa</h2>
        <button className="adm-modal-close" onClick={onClose}>✕</button>
      </div>
      <div className="adm-modal-body">
        <p className="adm-delete-msg">
          Bạn có chắc muốn xóa sản phẩm <strong>"{product.name}"</strong>?<br />
          Hành động này không thể hoàn tác.
        </p>
        <div className="adm-modal-actions">
          <button className="adm-btn-ghost" onClick={onClose}>Hủy</button>
          <button className="adm-btn-danger" onClick={onConfirm} disabled={deleting}>
            {deleting ? <span className="adm-spinner" /> : "Xóa sản phẩm"}
          </button>
        </div>
      </div>
    </div>
  </div>
);

const Toast = ({ message, type, onDone }) => {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  return <div className={`adm-toast adm-toast-${type}`}>{message}</div>;
};

const AdminPanel = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");

  useEffect(() => {
    const token = localStorage.getItem("mc_admin_token");
    if (!token) { navigate("/admin/login"); return; }
    adminAPI.verifyToken().then((res) => {
      if (!res.valid) { localStorage.removeItem("mc_admin_token"); navigate("/admin/login"); }
    });
  }, [navigate]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/products`);
      const data = await res.json();
      setProducts(data);
    } catch {
      showToast("Không thể tải sản phẩm.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const showToast = (message, type = "success") => setToast({ message, type });

  const handleSave = async (formData) => {
    setSaving(true);
    try {
      const isEdit = !!formData.id;
      const res = isEdit
        ? await adminAPI.updateProduct(formData.id, formData)
        : await adminAPI.createProduct(formData);
      if (res.error) throw new Error(res.error);
      showToast(isEdit ? "Đã cập nhật sản phẩm!" : "Đã tạo sản phẩm mới!");
      setModal(null);
      fetchProducts();
    } catch (err) {
      showToast(err.message || "Có lỗi xảy ra.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await adminAPI.deleteProduct(modal.product.id);
      if (res.error) throw new Error(res.error);
      showToast("Đã xóa sản phẩm!");
      setModal(null);
      fetchProducts();
    } catch (err) {
      showToast(err.message || "Không thể xóa.", "error");
    } finally {
      setDeleting(false);
    }
  };

  const filtered = products.filter((p) => {
    const bySearch = p.name.toLowerCase().includes(search.toLowerCase());
    const byCat = catFilter === "all" || p.category === catFilter;
    return bySearch && byCat;
  });

  return (
    <div>
      <div className="adm-topbar">
        <div>
          <h1 className="adm-page-title">Quản lý sản phẩm</h1>
          <p className="adm-page-sub">{products.length} sản phẩm hiện có</p>
        </div>
        <button className="adm-btn-primary" onClick={() => setModal({ mode: "create" })}>
          + Thêm sản phẩm
        </button>
      </div>

      <div className="adm-filters">
        <input
          className="adm-input adm-search"
          placeholder="🔍 Tìm sản phẩm..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="adm-cat-tabs">
          <button className={`adm-cat-tab ${catFilter === "all" ? "active" : ""}`} onClick={() => setCatFilter("all")}>Tất cả</button>
          {CATEGORIES.map((c) => (
            <button key={c.id} className={`adm-cat-tab ${catFilter === c.id ? "active" : ""}`} onClick={() => setCatFilter(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="adm-loading">
          <span className="adm-spinner adm-spinner-lg" />
          <p>Đang tải...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="adm-empty">
          <div className="adm-empty-icon">📦</div>
          <p>Không có sản phẩm nào</p>
        </div>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Ảnh</th>
                <th>Tên sản phẩm</th>
                <th>Danh mục</th>
                <th>Số variant</th>
                <th>Giá từ</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td className="adm-td-id">#{p.id}</td>
                  <td>
                    {p.image ? (
                      <img className="adm-thumb" src={p.image} alt={p.name} />
                    ) : (
                      <div className="adm-thumb adm-thumb-empty">📷</div>
                    )}
                  </td>
                  <td>
                    <div className="adm-product-name">{p.name}</div>
                    <div className="adm-product-desc">{p.description}</div>
                  </td>
                  <td>
                    <span className={`adm-badge adm-badge-${p.category}`}>
                      {CAT_LABEL[p.category] || p.category}
                    </span>
                  </td>
                  <td className="adm-td-center">{p.variants.length}</td>
                  <td className="adm-td-price">
                    {Math.min(...p.variants.map((v) => v.price)).toLocaleString("vi-VN")}đ
                  </td>
                  <td>
                    <div className="adm-actions">
                      <button className="adm-action-btn adm-edit" onClick={() => setModal({ mode: "edit", product: p })}>
                        ✏️ Sửa
                      </button>
                      <button className="adm-action-btn adm-delete" onClick={() => setModal({ mode: "delete", product: p })}>
                        🗑️ Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(modal?.mode === "create" || modal?.mode === "edit") && (
        <ProductModal product={modal.product} onSave={handleSave} onClose={() => setModal(null)} saving={saving} />
      )}
      {modal?.mode === "delete" && (
        <DeleteConfirm product={modal.product} onConfirm={handleDelete} onClose={() => setModal(null)} deleting={deleting} />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
};

export default AdminPanel;