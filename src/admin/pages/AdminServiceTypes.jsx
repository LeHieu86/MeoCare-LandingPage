/**
 * AdminServiceTypes.jsx
 * Quản lý loại dịch vụ + gói dịch vụ (packages) ngay trong cùng trang
 */
import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import "../../styles/admin/admin.css";

const API = import.meta.env.VITE_API_URL || "/api";

const PRICING_TYPES = [
  { value: "per_day",   label: "📅 Theo ngày",      hint: "Tính giá nhân số ngày (boarding)" },
  { value: "package",   label: "📦 Chọn gói",        hint: "Khách chọn 1 trong N gói cố định (grooming)" },
  { value: "procedure", label: "🏥 Chọn ca/thủ thuật",hint: "Khách chọn loại dịch vụ y tế (medical)" },
];

const STAGE_PRESETS = {
  boarding: [
    { key: "pending",     label: "Chờ nhận" },
    { key: "received",    label: "Đã nhận" },
    { key: "active",      label: "Đang chăm sóc" },
    { key: "almost_done", label: "Sắp trả" },
    { key: "completed",   label: "Hoàn tất" },
  ],
  grooming: [
    { key: "pending",   label: "Chờ" },
    { key: "active",    label: "Đang grooming" },
    { key: "ready",     label: "Sẵn sàng nhận" },
    { key: "completed", label: "Hoàn tất" },
  ],
  medical: [
    { key: "pending",   label: "Chờ khám" },
    { key: "active",    label: "Đang khám" },
    { key: "treatment", label: "Điều trị" },
    { key: "completed", label: "Hoàn tất" },
  ],
};

const EMPTY_FORM = {
  key: "", icon: "🐾", name: "", subtitle: "", description: "",
  priceFrom: "Liên hệ", pricePerDay: 0, priceMultiDay: 0,
  color: "linear-gradient(135deg, #C7B8EA 0%, #9F8FD9 100%)",
  accent: "#9F8FD9",
  bgAccent: "linear-gradient(135deg, #C7B8EA 0%, #9F8FD9 100%)",
  available: false, useTimeProgress: false,
  pricingType: "per_day", stages: [], sortOrder: 0,
};

const EMPTY_PKG = {
  name: "", description: "", price: 0,
  duration: "", includes: [], isPopular: false, isActive: true, sortOrder: 0,
};

const fmt = (n) => Number(n || 0).toLocaleString("vi-VN");

/* ════════════════════════════════════════════════════════════════
   PackageCard — hiển thị + edit inline 1 gói dịch vụ
   ════════════════════════════════════════════════════════════════ */
const PackageCard = ({ pkg, onSave, onDelete, accent }) => {
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState(pkg);
  const [includesStr, setIncludesStr] = useState(
    Array.isArray(pkg.includes) ? pkg.includes.join("\n") : ""
  );

  const set = (f, v) => setForm((p) => ({ ...p, [f]: v }));

  const handleSave = async () => {
    const data = {
      ...form,
      includes: includesStr.split("\n").map((s) => s.trim()).filter(Boolean),
    };
    await onSave(data);
    setEditing(false);
  };

  if (!editing) return (
    <div style={{
      background: "var(--adm-bg)", border: `1px solid ${pkg.isActive ? "var(--adm-border)" : "rgba(248,113,113,0.2)"}`,
      borderRadius: 10, padding: 12, opacity: pkg.isActive ? 1 : 0.55,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: "var(--adm-text)" }}>{pkg.name}</span>
            {pkg.isPopular && <span style={{ fontSize: 10, padding: "2px 7px", background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.4)", color: "#fbbf24", borderRadius: 20 }}>⭐ Phổ biến</span>}
            {!pkg.isActive && <span style={{ fontSize: 10, padding: "2px 7px", background: "rgba(248,113,113,0.15)", color: "#f87171", borderRadius: 20 }}>Ẩn</span>}
          </div>
          {pkg.description && <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--adm-text-2)", lineHeight: 1.4 }}>{pkg.description}</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: accent }}>{fmt(pkg.price)}đ</span>
            {pkg.duration && <span style={{ fontSize: 11, color: "var(--adm-text-2)" }}>⏱ {pkg.duration}</span>}
          </div>
          {Array.isArray(pkg.includes) && pkg.includes.length > 0 && (
            <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
              {pkg.includes.map((item, i) => (
                <span key={i} style={{ fontSize: 11, padding: "2px 7px", background: "rgba(91,124,246,0.1)", border: "1px solid rgba(91,124,246,0.2)", color: "#5b7cf6", borderRadius: 20 }}>✓ {item}</span>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0, marginLeft: 8 }}>
          <button onClick={() => setEditing(true)} style={smallBtnStyle("#5b7cf6")}>✏️</button>
          <button onClick={() => onDelete(pkg)} style={smallBtnStyle("#f87171")}>🗑️</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ background: "var(--adm-bg)", border: `2px solid ${accent}44`, borderRadius: 10, padding: 14 }}>
      <div style={gridStyle}>
        <div>
          <label style={labelStyle}>Tên gói *</label>
          <input value={form.name} onChange={(e) => set("name", e.target.value)} style={inputStyle} placeholder="Gói Cơ Bản" />
        </div>
        <div>
          <label style={labelStyle}>Giá (đồng) *</label>
          <input type="number" value={form.price} onChange={(e) => set("price", parseInt(e.target.value) || 0)} style={inputStyle} min={0} step={1000} />
          <p style={hintStyle}>{fmt(form.price)}đ</p>
        </div>
      </div>
      <div style={gridStyle}>
        <div>
          <label style={labelStyle}>Thời gian thực hiện</label>
          <input value={form.duration || ""} onChange={(e) => set("duration", e.target.value)} style={inputStyle} placeholder="45-60 phút" />
        </div>
        <div>
          <label style={labelStyle}>Thứ tự</label>
          <input type="number" value={form.sortOrder} onChange={(e) => set("sortOrder", parseInt(e.target.value) || 0)} style={inputStyle} min={0} />
        </div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={labelStyle}>Mô tả ngắn</label>
        <input value={form.description} onChange={(e) => set("description", e.target.value)} style={inputStyle} placeholder="Phù hợp mèo ngắn lông..." />
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={labelStyle}>Bao gồm (mỗi dòng 1 mục)</label>
        <textarea
          value={includesStr}
          onChange={(e) => setIncludesStr(e.target.value)}
          style={{ ...inputStyle, height: 80, resize: "vertical" }}
          placeholder={"Tắm sạch chuyên dụng\nSấy khô hoàn toàn\nCắt móng"}
        />
      </div>
      <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer", fontSize: 13 }}>
          <input type="checkbox" checked={form.isPopular} onChange={(e) => set("isPopular", e.target.checked)} style={{ accentColor: "#fbbf24" }} />
          ⭐ Gói phổ biến
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer", fontSize: 13 }}>
          <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} style={{ accentColor: "#34d399" }} />
          ✅ Hiển thị
        </label>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={() => setEditing(false)} style={cancelBtnStyle}>Hủy</button>
        <button onClick={handleSave} style={saveBtnStyle}>💾 Lưu gói</button>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════
   PackageManager — quản lý toàn bộ packages của 1 service type
   ════════════════════════════════════════════════════════════════ */
const PackageManager = ({ serviceType }) => {
  const token = localStorage.getItem("token");
  const [packages,    setPackages]    = useState(serviceType.packages || []);
  const [addingNew,   setAddingNew]   = useState(false);
  const [newPkg,      setNewPkg]      = useState(EMPTY_PKG);
  const [newIncludes, setNewIncludes] = useState("");

  const refetch = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/service-packages/admin?serviceTypeId=${serviceType.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setPackages(json.data || []);
    } catch { /* ignore */ }
  }, [serviceType.id, token]);

  const handleSaveExisting = async (data) => {
    try {
      const res = await fetch(`${API}/service-packages/admin/${data.id}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Đã cập nhật gói!");
      refetch();
    } catch (err) { toast.error(err.message || "Lỗi lưu gói"); }
  };

  const handleDelete = async (pkg) => {
    if (!window.confirm(`Ẩn gói "${pkg.name}"?`)) return;
    try {
      const res = await fetch(`${API}/service-packages/admin/${pkg.id}`, {
        method:  "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Đã ẩn gói");
      refetch();
    } catch (err) { toast.error(err.message || "Lỗi"); }
  };

  const handleAddNew = async () => {
    if (!newPkg.name.trim()) { toast.error("Tên gói là bắt buộc"); return; }
    try {
      const res = await fetch(`${API}/service-packages/admin`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({
          ...newPkg,
          serviceTypeId: serviceType.id,
          includes: newIncludes.split("\n").map((s) => s.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Đã thêm gói mới!");
      setAddingNew(false);
      setNewPkg(EMPTY_PKG);
      setNewIncludes("");
      refetch();
    } catch (err) { toast.error(err.message || "Lỗi thêm gói"); }
  };

  const setN = (f, v) => setNewPkg((p) => ({ ...p, [f]: v }));
  const pricingLabel = serviceType.pricingType === "procedure" ? "ca/thủ thuật" : "gói";

  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--adm-border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h4 style={{ margin: 0, fontSize: 13, color: "var(--adm-text-2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {serviceType.pricingType === "procedure" ? "🏥 Danh sách ca / thủ thuật" : "📦 Danh sách gói"}
          <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 400, background: "var(--adm-bg)", border: "1px solid var(--adm-border)", padding: "2px 7px", borderRadius: 20 }}>{packages.filter(p => p.isActive).length} hiển thị</span>
        </h4>
        <button
          onClick={() => setAddingNew(true)}
          style={{ fontSize: 12, padding: "5px 12px", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", color: "#34d399", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}
        >
          + Thêm {pricingLabel}
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {packages.map((pkg) => (
          <PackageCard
            key={pkg.id}
            pkg={pkg}
            accent={serviceType.accent}
            onSave={handleSaveExisting}
            onDelete={handleDelete}
          />
        ))}
        {packages.length === 0 && (
          <p style={{ color: "var(--adm-text-2)", fontSize: 13, textAlign: "center", padding: "12px 0" }}>
            Chưa có {pricingLabel} nào. Nhấn "+ Thêm" để bắt đầu.
          </p>
        )}

        {/* Form thêm mới */}
        {addingNew && (
          <div style={{ background: "var(--adm-bg)", border: `2px solid ${serviceType.accent}44`, borderRadius: 10, padding: 14 }}>
            <h5 style={{ margin: "0 0 12px", color: "var(--adm-text)", fontSize: 13 }}>Thêm {pricingLabel} mới</h5>
            <div style={gridStyle}>
              <div>
                <label style={labelStyle}>Tên *</label>
                <input value={newPkg.name} onChange={(e) => setN("name", e.target.value)} style={inputStyle} placeholder={serviceType.pricingType === "procedure" ? "Khám Tổng Quát" : "Gói Cơ Bản"} />
              </div>
              <div>
                <label style={labelStyle}>Giá (đồng) *</label>
                <input type="number" value={newPkg.price} onChange={(e) => setN("price", parseInt(e.target.value) || 0)} style={inputStyle} min={0} step={1000} />
                <p style={hintStyle}>{fmt(newPkg.price)}đ</p>
              </div>
            </div>
            <div style={gridStyle}>
              <div>
                <label style={labelStyle}>Thời gian</label>
                <input value={newPkg.duration} onChange={(e) => setN("duration", e.target.value)} style={inputStyle} placeholder="45-60 phút" />
              </div>
              <div>
                <label style={labelStyle}>Thứ tự</label>
                <input type="number" value={newPkg.sortOrder} onChange={(e) => setN("sortOrder", parseInt(e.target.value) || 0)} style={inputStyle} min={0} />
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>Mô tả</label>
              <input value={newPkg.description} onChange={(e) => setN("description", e.target.value)} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>Bao gồm (mỗi dòng 1 mục)</label>
              <textarea value={newIncludes} onChange={(e) => setNewIncludes(e.target.value)} style={{ ...inputStyle, height: 70, resize: "vertical" }} placeholder={"Tắm sạch\nSấy khô\nCắt móng"} />
            </div>
            <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer", fontSize: 13, marginBottom: 12 }}>
              <input type="checkbox" checked={newPkg.isPopular} onChange={(e) => setN("isPopular", e.target.checked)} style={{ accentColor: "#fbbf24" }} />
              ⭐ Gói phổ biến
            </label>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => { setAddingNew(false); setNewPkg(EMPTY_PKG); setNewIncludes(""); }} style={cancelBtnStyle}>Hủy</button>
              <button onClick={handleAddNew} style={saveBtnStyle}>➕ Thêm</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════
   StageEditor
   ════════════════════════════════════════════════════════════════ */
const StageEditor = ({ stages, onChange }) => {
  const addStage    = () => onChange([...stages, { key: "", label: "" }]);
  const update      = (i, f, v) => onChange(stages.map((s, idx) => idx === i ? { ...s, [f]: v } : s));
  const removeStage = (i) => onChange(stages.filter((_, idx) => idx !== i));
  return (
    <div>
      {stages.map((s, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          <input placeholder="key" value={s.key} onChange={(e) => update(i, "key", e.target.value)} style={inputStyle} />
          <input placeholder="nhãn" value={s.label} onChange={(e) => update(i, "label", e.target.value)} style={{ ...inputStyle, flex: 2 }} />
          <button type="button" onClick={() => removeStage(i)} style={{ background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>✕</button>
        </div>
      ))}
      <button type="button" onClick={addStage} style={{ marginTop: 4, background: "rgba(91,124,246,0.15)", border: "1px solid rgba(91,124,246,0.3)", color: "#5b7cf6", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>+ Thêm stage</button>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════
   ServiceForm — modal tạo / chỉnh sửa ServiceTypeDef
   ════════════════════════════════════════════════════════════════ */
const ServiceForm = ({ initial, onSave, onClose, isEdit }) => {
  const [form,   setForm]   = useState(initial || EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const set = (f, v) => setForm((p) => ({ ...p, [f]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.key.trim() || !form.name.trim()) { toast.error("Key và Tên là bắt buộc"); return; }
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, color: "var(--adm-text)", fontSize: 18 }}>
            {isEdit ? "✏️ Sửa loại dịch vụ" : "➕ Thêm loại dịch vụ mới"}
          </h3>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          {/* Key + Icon */}
          <div style={gridStyle}>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Key (slug) *</label>
              <input value={form.key} onChange={(e) => set("key", e.target.value.toLowerCase().replace(/\s+/g, "_"))} placeholder="boarding/grooming/medical..." style={inputStyle} disabled={isEdit} />
              {isEdit && <p style={hintStyle}>Key không thể thay đổi sau khi tạo</p>}
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Icon (emoji)</label>
              <input value={form.icon} onChange={(e) => set("icon", e.target.value)} style={{ ...inputStyle, fontSize: 22, textAlign: "center" }} maxLength={4} />
            </div>
          </div>

          {/* Tên + Subtitle */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Tên dịch vụ *</label>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Subtitle</label>
            <input value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Mô tả</label>
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)} style={{ ...inputStyle, height: 64, resize: "vertical" }} />
          </div>

          {/* Kiểu tính giá */}
          <div style={{ marginBottom: 14, padding: 12, background: "var(--adm-bg)", borderRadius: 8, border: "1px solid var(--adm-border)" }}>
            <label style={{ ...labelStyle, marginBottom: 10 }}>💰 Kiểu tính giá</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {PRICING_TYPES.map((pt) => (
                <label key={pt.value} style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", padding: "8px 10px", background: form.pricingType === pt.value ? "rgba(91,124,246,0.08)" : "transparent", border: `1px solid ${form.pricingType === pt.value ? "rgba(91,124,246,0.35)" : "transparent"}`, borderRadius: 7 }}>
                  <input type="radio" name="pricingType" value={pt.value} checked={form.pricingType === pt.value} onChange={() => set("pricingType", pt.value)} style={{ marginTop: 2, accentColor: "#5b7cf6" }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--adm-text)" }}>{pt.label}</div>
                    <div style={{ fontSize: 11.5, color: "var(--adm-text-2)" }}>{pt.hint}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Giá hiển thị + thứ tự */}
          <div style={gridStyle}>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Giá hiển thị (chuỗi)</label>
              <input value={form.priceFrom} onChange={(e) => set("priceFrom", e.target.value)} style={inputStyle} placeholder="Từ 100.000đ / Liên hệ" />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Thứ tự hiển thị</label>
              <input type="number" value={form.sortOrder} onChange={(e) => set("sortOrder", parseInt(e.target.value) || 0)} style={inputStyle} min={0} />
            </div>
          </div>

          {/* Giá theo ngày — chỉ hiện khi per_day */}
          {form.pricingType === "per_day" && (
            <div style={gridStyle}>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Giá ngày đầu (đồng)</label>
                <input type="number" value={form.pricePerDay} onChange={(e) => set("pricePerDay", parseInt(e.target.value) || 0)} style={inputStyle} min={0} step={1000} />
                <p style={hintStyle}>{fmt(form.pricePerDay)}đ</p>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Giá ngày thứ 2+ (đồng)</label>
                <input type="number" value={form.priceMultiDay} onChange={(e) => set("priceMultiDay", parseInt(e.target.value) || 0)} style={inputStyle} min={0} step={1000} />
                <p style={hintStyle}>{form.priceMultiDay > 0 ? fmt(form.priceMultiDay) + "đ" : "= ngày đầu"}</p>
              </div>
            </div>
          )}

          {/* Màu sắc */}
          <div style={{ marginBottom: 14, padding: 12, background: "var(--adm-bg)", borderRadius: 8, border: "1px solid var(--adm-border)" }}>
            <label style={{ ...labelStyle, marginBottom: 8, display: "block" }}>🎨 Màu sắc</label>
            <div style={gridStyle}>
              <div style={{ marginBottom: 10 }}>
                <label style={hintStyle}>Gradient card</label>
                <input value={form.color} onChange={(e) => set("color", e.target.value)} style={inputStyle} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={hintStyle}>Accent (màu chủ đạo)</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <input type="color" value={form.accent} onChange={(e) => set("accent", e.target.value)} style={{ width: 36, height: 36, border: "none", cursor: "pointer", background: "transparent" }} />
                  <input value={form.accent} onChange={(e) => set("accent", e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                </div>
              </div>
            </div>
            <div style={{ marginBottom: 6 }}>
              <label style={hintStyle}>bgAccent (gradient icon)</label>
              <input value={form.bgAccent} onChange={(e) => set("bgAccent", e.target.value)} style={inputStyle} />
            </div>
            <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: form.bgAccent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{form.icon}</div>
              <div style={{ flex: 1, height: 5, borderRadius: 3, background: form.accent, opacity: 0.6 }} />
              <span style={{ fontSize: 11, color: "var(--adm-text-2)" }}>Preview</span>
            </div>
          </div>

          {/* Checkboxes */}
          <div style={{ display: "flex", gap: 20, marginBottom: 14, flexWrap: "wrap" }}>
            <label style={{ display: "flex", gap: 7, alignItems: "center", cursor: "pointer", fontSize: 13 }}>
              <input type="checkbox" checked={form.available} onChange={(e) => set("available", e.target.checked)} style={{ accentColor: "#34d399" }} />
              ✅ Mở cho khách đặt
            </label>
            <label style={{ display: "flex", gap: 7, alignItems: "center", cursor: "pointer", fontSize: 13 }}>
              <input type="checkbox" checked={form.useTimeProgress} onChange={(e) => set("useTimeProgress", e.target.checked)} style={{ accentColor: "#5b7cf6" }} />
              ⏱️ Dùng thanh thời gian
            </label>
          </div>

          {/* Stages */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <label style={labelStyle}>Stages tiến trình</label>
              <div style={{ display: "flex", gap: 5 }}>
                {Object.keys(STAGE_PRESETS).map((pk) => (
                  <button key={pk} type="button" onClick={() => set("stages", STAGE_PRESETS[pk])} style={{ fontSize: 10, padding: "2px 7px", background: "var(--adm-bg)", border: "1px solid var(--adm-border)", color: "var(--adm-text-2)", borderRadius: 4, cursor: "pointer" }}>{pk}</button>
                ))}
              </div>
            </div>
            <StageEditor stages={form.stages || []} onChange={(s) => set("stages", s)} />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20, paddingTop: 14, borderTop: "1px solid var(--adm-border)" }}>
            <button type="button" onClick={onClose} style={cancelBtnStyle}>Hủy</button>
            <button type="submit" disabled={saving} style={saveBtnStyle}>
              {saving ? "Đang lưu..." : (isEdit ? "💾 Cập nhật" : "➕ Tạo mới")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════
   MAIN
   ════════════════════════════════════════════════════════════════ */
const AdminServiceTypes = () => {
  const token = localStorage.getItem("token");
  const [services, setServices] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/service-types/admin`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      setServices(json.data || []);
    } catch { toast.error("Không tải được danh sách"); }
    finally  { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleToggle = async (svc) => {
    const prev = [...services];
    setServices((s) => s.map((x) => x.id === svc.id ? { ...x, available: !x.available } : x));
    try {
      const res = await fetch(`${API}/service-types/admin/${svc.id}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ available: !svc.available }),
      });
      if (!res.ok) throw new Error();
      toast.success(svc.available ? `Đã ẩn "${svc.name}"` : `Đã mở "${svc.name}"`);
    } catch { setServices(prev); toast.error("Lỗi cập nhật"); }
  };

  const handleSave = async (form) => {
    const isEdit = modal?.edit;
    const url    = isEdit ? `${API}/service-types/admin/${isEdit.id}` : `${API}/service-types/admin`;
    try {
      const res  = await fetch(url, {
        method:  isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Lỗi server");
      toast.success(isEdit ? "Đã cập nhật!" : "Đã tạo mới!");
      setModal(null);
      fetchAll();
    } catch (err) { toast.error(err.message); }
  };

  const handleDelete = async (svc) => {
    if (!window.confirm(`Xóa "${svc.name}"?`)) return;
    try {
      const res = await fetch(`${API}/service-types/admin/${svc.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Đã xóa");
      fetchAll();
    } catch (err) { toast.error(err.message); }
  };

  const pricingBadge = (type) => {
    const map = { per_day: { label: "Theo ngày", color: "#fbbf24" }, package: { label: "Theo gói", color: "#5b7cf6" }, procedure: { label: "Theo ca", color: "#7BB6E0" } };
    const t = map[type] || { label: type, color: "#94a3b8" };
    return <span style={{ fontSize: 11, padding: "2px 8px", background: `${t.color}22`, border: `1px solid ${t.color}55`, color: t.color, borderRadius: 20 }}>{t.label}</span>;
  };

  return (
    <div style={{ background: "var(--adm-bg)", minHeight: "100vh", color: "var(--adm-text)" }}>
      <div className="adm-topbar">
        <div>
          <h1 className="adm-page-title">Quản lý Loại Dịch Vụ</h1>
          <p className="adm-page-sub">Tạo loại dịch vụ, quản lý gói / ca và bật/tắt hiển thị cho khách</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="adm-btn-ghost" onClick={fetchAll}>🔄</button>
          <button onClick={() => setModal("create")} style={{ padding: "8px 16px", background: "rgba(91,124,246,0.15)", border: "1px solid rgba(91,124,246,0.4)", color: "#5b7cf6", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>➕ Thêm dịch vụ</button>
        </div>
      </div>

      {loading ? (
        <div className="adm-loading"><div className="adm-spinner adm-spinner-lg" /><span>Đang tải...</span></div>
      ) : services.length === 0 ? (
        <div className="adm-empty">
          <div className="adm-empty-icon">🐾</div>
          <span>Chưa có loại dịch vụ nào</span>
        </div>
      ) : (
        <div style={{ padding: "0 24px 40px", display: "flex", flexDirection: "column", gap: 20 }}>
          {services.map((svc) => (
            <div key={svc.id} style={{ background: "var(--adm-surface)", border: `1px solid ${svc.available ? "rgba(52,211,153,0.2)" : "var(--adm-border)"}`, borderLeft: `4px solid ${svc.accent || "#9F8FD9"}`, borderRadius: 12, padding: 20, opacity: svc.available ? 1 : 0.7 }}>
              {/* Header row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ width: 46, height: 46, borderRadius: 10, background: svc.bgAccent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{svc.icon}</div>
                  <div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 16, color: "var(--adm-text)" }}>{svc.name}</span>
                      {pricingBadge(svc.pricingType)}
                      <span style={{ fontSize: 11, padding: "2px 8px", background: svc.available ? "rgba(52,211,153,0.12)" : "rgba(139,144,167,0.12)", border: `1px solid ${svc.available ? "rgba(52,211,153,0.3)" : "rgba(139,144,167,0.3)"}`, color: svc.available ? "#34d399" : "#94a3b8", borderRadius: 20 }}>{svc.available ? "🟢 Mở" : "⚫ Ẩn"}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--adm-text-2)", marginTop: 3 }}>{svc.subtitle} · <code style={{ fontSize: 11, background: "var(--adm-bg)", padding: "1px 5px", borderRadius: 4 }}>{svc.key}</code> · {svc.priceFrom}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => handleToggle(svc)} style={{ padding: "6px 12px", fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: "pointer", background: svc.available ? "rgba(248,113,113,0.1)" : "rgba(52,211,153,0.1)", border: svc.available ? "1px solid rgba(248,113,113,0.3)" : "1px solid rgba(52,211,153,0.3)", color: svc.available ? "#f87171" : "#34d399" }}>{svc.available ? "🔒 Ẩn" : "🔓 Mở"}</button>
                  <button onClick={() => setModal({ edit: svc })} style={{ padding: "6px 12px", fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: "pointer", background: "rgba(91,124,246,0.1)", border: "1px solid rgba(91,124,246,0.3)", color: "#5b7cf6" }}>✏️ Sửa</button>
                  <button onClick={() => handleDelete(svc)} style={{ padding: "6px 12px", fontSize: 12, borderRadius: 6, cursor: "pointer", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171" }}>🗑️</button>
                </div>
              </div>

              {/* Package manager — chỉ hiện với package / procedure */}
              {(svc.pricingType === "package" || svc.pricingType === "procedure") && (
                <PackageManager serviceType={svc} />
              )}
            </div>
          ))}
        </div>
      )}

      {modal === "create" && <ServiceForm isEdit={false} onSave={handleSave} onClose={() => setModal(null)} />}
      {modal?.edit && <ServiceForm isEdit={true} initial={modal.edit} onSave={handleSave} onClose={() => setModal(null)} />}
    </div>
  );
};

export default AdminServiceTypes;

/* ── Shared styles ─────────────────────────────────── */
const overlayStyle = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "20px 16px", overflowY: "auto" };
const modalStyle   = { background: "var(--adm-surface)", width: "100%", maxWidth: 620, borderRadius: 14, padding: 24, border: "1px solid var(--adm-border)", boxShadow: "0 20px 40px -5px rgba(0,0,0,0.5)", marginTop: 20 };
const inputStyle   = { width: "100%", padding: "9px 12px", background: "var(--adm-bg)", border: "1px solid var(--adm-border)", color: "var(--adm-text)", borderRadius: 7, fontSize: 13, outline: "none", boxSizing: "border-box" };
const labelStyle   = { display: "block", marginBottom: 5, fontSize: 12.5, fontWeight: 600, color: "var(--adm-text-2)" };
const hintStyle    = { margin: "3px 0 0", fontSize: 11, color: "var(--adm-text-2)", opacity: 0.7 };
const gridStyle    = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };
const closeBtnStyle = { background: "transparent", border: "1px solid var(--adm-border)", color: "var(--adm-text-2)", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 16 };
const cancelBtnStyle = { padding: "8px 16px", background: "transparent", border: "1px solid var(--adm-border)", color: "var(--adm-text-2)", borderRadius: 8, cursor: "pointer", fontSize: 13 };
const saveBtnStyle   = { padding: "8px 20px", background: "rgba(91,124,246,0.2)", border: "1px solid rgba(91,124,246,0.5)", color: "#5b7cf6", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 };
const smallBtnStyle  = (color) => ({ padding: "5px 9px", fontSize: 12, background: `${color}18`, border: `1px solid ${color}44`, color, borderRadius: 6, cursor: "pointer" });
