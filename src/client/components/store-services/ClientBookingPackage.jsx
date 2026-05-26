/**
 * ClientBookingPackage.jsx
 * Form đặt lịch cho dịch vụ grooming / medical:
 *   Bước 1: Chọn gói / ca
 *   Bước 2: Chọn ngày giờ + thông tin thú cưng
 *   Bước 3: Xác nhận
 */
import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import api from "../../utils/api";
import ServicePackagePicker from "./ServicePackagePicker";
import "../../../styles/client/client_portal.css";

const API = import.meta.env.VITE_API_URL || "/api";
const fmt = (n) => Number(n || 0).toLocaleString("vi-VN");

/* ── Step indicator ─────────────────────────────────────────── */
const StepProgress = ({ current, accent }) => {
  const steps = [
    { label: "Chọn gói",     icon: "📦" },
    { label: "Thông tin",    icon: "📋" },
    { label: "Xác nhận",     icon: "✅" },
  ];
  return (
    <div className="cp-step-progress">
      {steps.map((s, i) => {
        const num   = i + 1;
        const state = num < current ? "done" : num === current ? "active" : "";
        return (
          <div key={i} className={`cp-step-item ${state}`}>
            <div className="cp-step-dot" style={state === "active" ? { background: accent, borderColor: accent } : {}}>
              {num < current ? "✓" : s.icon}
            </div>
            <span className="cp-step-label">{s.label}</span>
          </div>
        );
      })}
    </div>
  );
};

const ClientBookingPackage = ({ serviceType, onSuccess, onGoToActive }) => {
  const accent      = serviceType?.accent      || "#9F8FD9";
  const bgAccent    = serviceType?.bgAccent    || "linear-gradient(135deg, #C7B8EA 0%, #9F8FD9 100%)";
  const packages    = serviceType?.packages    || [];
  const pricingType = serviceType?.pricingType || "package";
  const svcLabel    = pricingType === "procedure" ? "ca" : "gói";

  const [step,          setStep]         = useState(1);
  const [selectedPkg,   setSelectedPkg]  = useState(null);
  const [submitting,    setSubmitting]   = useState(false);

  /* Thông tin thú cưng + khách */
  const [profile, setProfile] = useState({ fullName: "", phone: "" });
  const [pets,    setPets]    = useState([]);
  const [form,    setForm]    = useState({
    catName:    "",
    catBreed:   "",
    ownerName:  "",
    ownerPhone: "",
    bookDate:   "",    // ngày đặt lịch (YYYY-MM-DD)
    bookTime:   "09:00",
    note:       "",
  });

  /* Load profile tự động */
  useEffect(() => {
    api.get("/service/booking-profile")
      .then((res) => {
        if (res.success) {
          setProfile(res.profile);
          setPets(res.pets || []);
          setForm((p) => ({ ...p, ownerName: res.profile.fullName || "", ownerPhone: res.profile.phone || "" }));
        }
      })
      .catch(() => {});
  }, []);

  const set = (f, v) => setForm((p) => ({ ...p, [f]: v }));

  const fillFromPet = (pet) => {
    setForm((p) => ({ ...p, catName: pet.name, catBreed: pet.breed || "" }));
  };

  /* Ngày min = ngày mai */
  const minDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  })();

  /* Validate bước 2 */
  const isStep2Valid = form.catName.trim() && form.ownerName.trim() && form.ownerPhone.trim() && form.bookDate;

  /* ── Submit ─────────────────────────────────────────────── */
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // check_in = bookDate, check_out = bookDate + 1 day (placeholder cho non-boarding)
      const checkIn  = form.bookDate;
      const checkOut = (() => {
        const d = new Date(form.bookDate);
        d.setDate(d.getDate() + 1);
        return d.toISOString().split("T")[0];
      })();

      await api.post("/bookings", {
        cat_name:     form.catName.trim(),
        cat_breed:    form.catBreed.trim(),
        owner_name:   form.ownerName.trim(),
        owner_phone:  form.ownerPhone.trim(),
        service:      pricingType,
        service_type: serviceType.key,
        package_id:   selectedPkg?.id,
        check_in:     checkIn,
        check_out:    checkOut,
        note:         `[${form.bookTime}] ${form.note}`.trim(),
      });

      toast.success("🎉 Đặt lịch thành công! Admin sẽ liên hệ xác nhận sớm nhất.", { duration: 5000 });
      onSuccess?.("Đặt lịch thành công!");
      onGoToActive?.();
    } catch (err) {
      toast.error(err.message || "Lỗi đặt lịch");
    } finally {
      setSubmitting(false);
    }
  };

  /* ════════════════════════
     STEP 1 — Chọn gói
     ════════════════════════ */
  if (step === 1) return (
    <div className="cp-booking-wrapper">
      <StepProgress current={1} accent={accent} />
      <div className="cp-booking-card">
        <div className="cp-booking-header" style={{ background: bgAccent }}>
          <span style={{ fontSize: 28 }}>{serviceType?.icon}</span>
          <div>
            <h3>{serviceType?.name}</h3>
            <p>Chọn {svcLabel} phù hợp với bé nhà bạn</p>
          </div>
        </div>
        <div className="cp-booking-body">
          <ServicePackagePicker
            packages={packages}
            selectedId={selectedPkg?.id}
            onSelect={setSelectedPkg}
            accent={accent}
            pricingType={pricingType}
          />

          <button
            className="cp-btn-primary"
            disabled={!selectedPkg}
            onClick={() => setStep(2)}
            style={{ marginTop: 20, background: selectedPkg ? accent : undefined, borderColor: selectedPkg ? accent : undefined }}
          >
            {selectedPkg ? `Tiếp theo — ${selectedPkg.name} (${fmt(selectedPkg.price)}đ)` : `Vui lòng chọn ${svcLabel}`} →
          </button>
        </div>
      </div>
    </div>
  );

  /* ════════════════════════
     STEP 2 — Thông tin
     ════════════════════════ */
  if (step === 2) return (
    <div className="cp-booking-wrapper">
      <StepProgress current={2} accent={accent} />
      <div className="cp-booking-card">
        <div className="cp-booking-header" style={{ background: bgAccent }}>
          <span style={{ fontSize: 28 }}>{serviceType?.icon}</span>
          <div>
            <h3>{selectedPkg?.name}</h3>
            <p style={{ fontWeight: 700, fontSize: 16 }}>{fmt(selectedPkg?.price)}đ</p>
          </div>
        </div>

        <div className="cp-booking-body">
          {/* Chọn thú cưng nhanh */}
          {pets.length > 0 && (
            <div className="cp-form-group" style={{ marginBottom: 16 }}>
              <label className="cp-form-label">Chọn nhanh từ thú cưng của bạn</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {pets.map((p) => (
                  <button key={p.id} type="button" onClick={() => fillFromPet(p)}
                    style={{ padding: "6px 12px", fontSize: 12, background: "rgba(91,124,246,0.1)", border: "1px solid rgba(91,124,246,0.3)", color: "#5b7cf6", borderRadius: 20, cursor: "pointer" }}>
                    🐱 {p.name}{p.breed ? ` (${p.breed})` : ""}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tên mèo */}
          <div className="cp-form-row">
            <div className="cp-form-group">
              <label className="cp-form-label">Tên bé mèo *</label>
              <input className="cp-input" value={form.catName} onChange={(e) => set("catName", e.target.value)} placeholder="Miu, Tom, Luna..." />
            </div>
            <div className="cp-form-group">
              <label className="cp-form-label">Giống mèo</label>
              <input className="cp-input" value={form.catBreed} onChange={(e) => set("catBreed", e.target.value)} placeholder="Mèo ta, Anh lông ngắn..." />
            </div>
          </div>

          {/* Chủ */}
          <div className="cp-form-row">
            <div className="cp-form-group">
              <label className="cp-form-label">Tên chủ nhân *</label>
              <input className="cp-input" value={form.ownerName} onChange={(e) => set("ownerName", e.target.value)} placeholder="Họ và tên" />
            </div>
            <div className="cp-form-group">
              <label className="cp-form-label">Số điện thoại *</label>
              <input className="cp-input" value={form.ownerPhone} onChange={(e) => set("ownerPhone", e.target.value)} placeholder="09xx..." type="tel" />
            </div>
          </div>

          {/* Ngày + Giờ */}
          <div className="cp-form-row">
            <div className="cp-form-group">
              <label className="cp-form-label">Ngày hẹn *</label>
              <input className="cp-input" type="date" value={form.bookDate} min={minDate} onChange={(e) => set("bookDate", e.target.value)} />
            </div>
            <div className="cp-form-group">
              <label className="cp-form-label">Giờ hẹn</label>
              <select className="cp-input" value={form.bookTime} onChange={(e) => set("bookTime", e.target.value)}>
                {["08:00","08:30","09:00","09:30","10:00","10:30","11:00","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00"].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Ghi chú */}
          <div className="cp-form-group">
            <label className="cp-form-label">Ghi chú thêm</label>
            <textarea className="cp-input" rows={2} value={form.note} onChange={(e) => set("note", e.target.value)} placeholder="Tình trạng sức khoẻ, yêu cầu đặc biệt..." style={{ resize: "vertical" }} />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button className="cp-btn-outline" onClick={() => setStep(1)}>← Quay lại</button>
            <button className="cp-btn-primary" disabled={!isStep2Valid} onClick={() => setStep(3)}
              style={{ flex: 1, background: isStep2Valid ? accent : undefined, borderColor: isStep2Valid ? accent : undefined }}>
              Xem xác nhận →
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  /* ════════════════════════
     STEP 3 — Xác nhận
     ════════════════════════ */
  return (
    <div className="cp-booking-wrapper">
      <StepProgress current={3} accent={accent} />
      <div className="cp-booking-card">
        <div className="cp-booking-header" style={{ background: bgAccent }}>
          <span style={{ fontSize: 28 }}>✅</span>
          <div>
            <h3>Xác nhận đặt lịch</h3>
            <p>Kiểm tra lại thông tin trước khi gửi</p>
          </div>
        </div>

        <div className="cp-booking-body">
          {/* Tóm tắt */}
          <div style={{ background: "rgba(0,0,0,0.15)", borderRadius: 10, padding: 16, marginBottom: 16, border: "1px solid rgba(255,255,255,0.06)" }}>
            <Row label="Dịch vụ"  value={serviceType?.name} />
            <Row label={`${svcLabel.charAt(0).toUpperCase() + svcLabel.slice(1)} đã chọn`} value={selectedPkg?.name} accent={accent} />
            <Row label="Thời gian thực hiện" value={selectedPkg?.duration || "—"} />
            <Row label="Bé mèo"   value={`${form.catName}${form.catBreed ? ` (${form.catBreed})` : ""}`} />
            <Row label="Chủ nhân" value={form.ownerName} />
            <Row label="SĐT"      value={form.ownerPhone} />
            <Row label="Ngày hẹn" value={`${form.bookDate} lúc ${form.bookTime}`} />
            {form.note && <Row label="Ghi chú" value={form.note} />}
          </div>

          {/* Tổng */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: `${accent}18`, border: `1px solid ${accent}44`, borderRadius: 10, marginBottom: 20 }}>
            <span style={{ fontWeight: 600, color: "#e8eaf0" }}>Tổng thanh toán</span>
            <span style={{ fontWeight: 800, fontSize: 20, color: accent }}>{fmt(selectedPkg?.price)}đ</span>
          </div>

          <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16, lineHeight: 1.6 }}>
            📞 Sau khi gửi, admin sẽ liên hệ qua số <strong>{form.ownerPhone}</strong> để xác nhận lịch hẹn. Thanh toán tại cửa hàng.
          </p>

          <div style={{ display: "flex", gap: 10 }}>
            <button className="cp-btn-outline" onClick={() => setStep(2)}>← Sửa</button>
            <button
              className="cp-btn-primary"
              disabled={submitting}
              onClick={handleSubmit}
              style={{ flex: 1, background: accent, borderColor: accent }}
            >
              {submitting ? "Đang gửi..." : "🎉 Xác nhận đặt lịch"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Row helper ── */
const Row = ({ label, value, accent }) => (
  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
    <span style={{ color: "#94a3b8" }}>{label}</span>
    <span style={{ fontWeight: 600, color: accent || "#e8eaf0", textAlign: "right", maxWidth: "60%" }}>{value}</span>
  </div>
);

export default ClientBookingPackage;
