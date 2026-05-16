import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { adminAPI } from "../../hooks/useProducts";
import "../../styles/admin/admin.css";

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const fmt = (n) => (n || 0).toLocaleString("vi-VN") + "đ";
const fmtNum = (n) => (n || 0).toLocaleString("vi-VN");

const STATUS_CONFIG = {
  draft:     { label: "Nháp",    icon: "📝", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  confirmed: { label: "Đã nhập", icon: "✅", color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
  cancelled: { label: "Đã hủy", icon: "❌", color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
};

const TABS = [
  { id: "list",      label: "Phiếu nhập",     icon: "📋" },
  { id: "create",    label: "Tạo phiếu mới",  icon: "➕" },
  { id: "suppliers", label: "Nhà cung cấp",   icon: "🏭" },
];

/* ══════════════════════════════════════════════════════
   PRICE CALCULATOR — Tính giá bán tự động
   ══════════════════════════════════════════════════════ */
const Row = ({ label, value, bold, accent }) => (
  <>
    <span style={{ color: "var(--adm-text-2)" }}>{label}</span>
    <span style={{ fontWeight: bold ? 700 : 400, color: accent ? "#f59e0b" : "inherit" }}>{value}</span>
  </>
);

const PriceCalculator = ({ items, totalQty }) => {
  const [shippingFee, setShippingFee] = useState("");
  const [otherCost, setOtherCost]     = useState("");
  const [marginPct, setMarginPct]     = useState("30");
  const [vatPct, setVatPct]           = useState("0");
  const [roundTo, setRoundTo]         = useState("1000");
  const [expanded, setExpanded]       = useState(false);

  if (!items || items.length === 0) return null;

  const totalCost   = items.reduce((sum, i) => sum + (parseInt(i.unit_cost) || 0) * (parseInt(i.qty) || 0), 0);
  const qty         = totalQty || items.reduce((sum, i) => sum + (parseInt(i.qty) || 0), 0);
  const shipPerUnit = qty > 0 ? (parseInt(shippingFee) || 0) / qty : 0;
  const otherPerUnit= qty > 0 ? (parseInt(otherCost)   || 0) / qty : 0;
  const unitCostAvg = qty > 0 ? totalCost / qty : 0;
  const landedCost  = unitCostAvg + shipPerUnit + otherPerUnit;
  const margin      = parseInt(marginPct) || 0;
  const vat         = parseInt(vatPct) || 0;
  const priceBeforeVat = margin < 100 ? landedCost / (1 - margin / 100) : landedCost;
  const priceWithVat   = priceBeforeVat * (1 + vat / 100);
  const roundFactor    = parseInt(roundTo) || 1;
  const suggestedPrice = Math.ceil(priceWithVat / roundFactor) * roundFactor;
  const actualMargin   = suggestedPrice > 0 ? ((suggestedPrice - landedCost) / suggestedPrice * 100).toFixed(1) : 0;

  return (
    <div style={{ marginTop: 16, border: "1px solid rgba(245,158,11,0.3)", borderRadius: 12, overflow: "hidden", background: "rgba(245,158,11,0.04)" }}>
      <button onClick={() => setExpanded(!expanded)}
        style={{ width: "100%", padding: "12px 16px", background: "none", border: "none",
          cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#f59e0b" }}>🧮 Tính giá bán tự động</span>
        <span style={{ color: "#f59e0b", fontSize: 18 }}>{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
            <div>
              <div className="adm-label" style={{ fontSize: 11 }}>Phí ship về kho (đ)</div>
              <input className="adm-input" type="number" min="0" placeholder="0"
                value={shippingFee} onChange={(e) => setShippingFee(e.target.value)} />
            </div>
            <div>
              <div className="adm-label" style={{ fontSize: 11 }}>Chi phí khác (đ)</div>
              <input className="adm-input" type="number" min="0" placeholder="Kho, nhân công..."
                value={otherCost} onChange={(e) => setOtherCost(e.target.value)} />
            </div>
            <div>
              <div className="adm-label" style={{ fontSize: 11 }}>Biên lợi nhuận (%)</div>
              <input className="adm-input" type="number" min="0" max="99" placeholder="30"
                value={marginPct} onChange={(e) => setMarginPct(e.target.value)} />
            </div>
            <div>
              <div className="adm-label" style={{ fontSize: 11 }}>VAT (%)</div>
              <input className="adm-input" type="number" min="0" placeholder="0 hoặc 10"
                value={vatPct} onChange={(e) => setVatPct(e.target.value)} />
            </div>
          </div>

          <div style={{ background: "var(--adm-surface)", borderRadius: 10, padding: 14,
            border: "1px solid var(--adm-border)", marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--adm-text-2)", marginBottom: 10 }}>
              📊 Chi tiết tính toán / đơn vị
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 20px", fontSize: 13 }}>
              <Row label="Giá vốn BQ"              value={fmt(Math.round(unitCostAvg))} />
              <Row label="Phí ship / đơn"          value={fmt(Math.round(shipPerUnit))} />
              <Row label="Chi phí khác / đơn"      value={fmt(Math.round(otherPerUnit))} />
              <Row label="Landed cost (giá vốn thực)" value={fmt(Math.round(landedCost))} bold accent />
              <Row label={`Giá trước VAT (margin ${margin}%)`} value={fmt(Math.round(priceBeforeVat))} />
              {vat > 0 && <Row label={`Giá sau VAT ${vat}%`} value={fmt(Math.round(priceWithVat))} />}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ background: "rgba(245,158,11,0.15)", borderRadius: 10, padding: "10px 18px",
              border: "1px solid rgba(245,158,11,0.4)", flex: 1 }}>
              <div style={{ fontSize: 11, color: "#f59e0b" }}>💰 Giá bán đề xuất</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#f59e0b" }}>{fmt(suggestedPrice)}</div>
              <div style={{ fontSize: 11, color: "var(--adm-text-2)", marginTop: 2 }}>
                Biên thực tế: <strong style={{ color: actualMargin >= 25 ? "#22c55e" : "#f59e0b" }}>{actualMargin}%</strong>
                {" "}· Lời / đơn: {fmt(Math.round(suggestedPrice - landedCost))}
              </div>
            </div>
            <div>
              <div className="adm-label" style={{ fontSize: 11 }}>Làm tròn đến</div>
              <select className="adm-input adm-select" value={roundTo} onChange={(e) => setRoundTo(e.target.value)} style={{ minWidth: 120 }}>
                <option value="1">Không làm tròn</option>
                <option value="500">500đ</option>
                <option value="1000">1.000đ</option>
                <option value="5000">5.000đ</option>
                <option value="10000">10.000đ</option>
              </select>
            </div>
          </div>

          {items.length > 1 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, color: "var(--adm-text-2)", marginBottom: 8 }}>Giá đề xuất theo từng mặt hàng:</div>
              <div className="adm-table-wrap">
                <table className="adm-table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr><th>Hàng hóa</th><th>Giá vốn/đv</th><th>Landed cost/đv</th><th>Giá bán đề xuất</th><th>Biên LN</th></tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const ic = parseInt(item.unit_cost) || 0;
                      const lc = ic + shipPerUnit + otherPerUnit;
                      const sp = Math.ceil((lc / (1 - margin / 100) * (1 + vat / 100)) / roundFactor) * roundFactor;
                      const m  = sp > 0 ? ((sp - lc) / sp * 100).toFixed(1) : 0;
                      return (
                        <tr key={idx}>
                          <td>{item.name || `Hàng ${idx + 1}`}</td>
                          <td className="adm-td-price">{fmt(ic)}</td>
                          <td className="adm-td-price">{fmt(Math.round(lc))}</td>
                          <td className="adm-td-price" style={{ color: "#f59e0b", fontWeight: 700 }}>{fmt(sp)}</td>
                          <td style={{ color: parseFloat(m) >= 25 ? "#22c55e" : "#f59e0b" }}>{m}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════════
   VARIANT SPLITTER — 2 bước: Tạo → Gán Product
   ══════════════════════════════════════════════════════ */

/* ── Bước 2: Gán vào Product ── */
const LinkToProduct = ({ token, createdVariants, inventoryItem, onDone }) => {
  const [mode, setMode]           = useState(null); // "new" | "existing" | null
  const [products, setProducts]   = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [productName, setProductName] = useState(inventoryItem?.name || "");
  const [productCat, setProductCat]   = useState("food");
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    if (mode === "existing") {
      fetch(`${API_BASE}/products`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json()).then((d) => setProducts(Array.isArray(d) ? d : []));
    }
  }, [mode, token]);

  const handleLink = async () => {
    setSaving(true);
    try {
      if (mode === "new") {
        if (!productName.trim()) return alert("Nhập tên sản phẩm");
        const res = await fetch(`${API_BASE}/products`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name: productName.trim(),
            category: productCat,
            description: "",
            image: "",
            variants: createdVariants.map((v) => ({
              name: v.name,
              price: v.price,
              inventory_item_id: v.inventory_item_id,
              qty_per_unit: v.qty_per_unit,
            })),
          }),
        });
        const data = await res.json();
        if (data.id || data.success) { alert(`✅ Đã tạo sản phẩm "${productName}" với ${createdVariants.length} biến thể!`); onDone(); }
        else alert(data.error || data.message || "Lỗi tạo sản phẩm");
      } else {
        if (!selectedId) return alert("Chọn sản phẩm muốn gán vào");
        const res = await fetch(`${API_BASE}/products/${selectedId}/variants/bulk`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            variants: createdVariants.map((v) => ({
              name: v.name,
              price: v.price,
              inventory_item_id: v.inventory_item_id,
              qty_per_unit: v.qty_per_unit,
            })),
          }),
        });
        const data = await res.json();
        if (data.success) { alert(`✅ Đã thêm ${createdVariants.length} biến thể vào sản phẩm!`); onDone(); }
        else alert(data.message || "Lỗi gán biến thể");
      }
    } catch { alert("Lỗi kết nối"); }
    finally { setSaving(false); }
  };

  const CATEGORIES = [
    { id: "food", label: "🍚 Hạt" }, { id: "pate", label: "🥫 Pate" },
    { id: "hygiene", label: "🧼 Vệ sinh" }, { id: "combo", label: "🎁 Combo" },
  ];

  return (
    <div>
      {/* Variant summary */}
      <div style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)",
        borderRadius: 10, padding: 14, marginBottom: 18 }}>
        <div style={{ fontSize: 12, color: "var(--adm-text-2)", marginBottom: 8 }}>
          ✅ Đã tạo <strong style={{ color: "#6366f1" }}>{createdVariants.length}</strong> biến thể từ kho
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {createdVariants.map((v, i) => (
            <span key={i} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20,
              background: "rgba(99,102,241,0.12)", color: "#6366f1", border: "1px solid rgba(99,102,241,0.25)" }}>
              {v.name} → {fmt(v.price)}
            </span>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Gán vào sản phẩm trưng bán</div>

      {/* Chọn hướng */}
      {!mode && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          {[
            { id: "new",      icon: "➕", title: "Tạo sản phẩm mới",    sub: "Tạo product mới với các variant này làm phân loại" },
            { id: "existing", icon: "🔗", title: "Gán vào sản phẩm có sẵn", sub: "Thêm variant vào product đã tồn tại" },
          ].map((opt) => (
            <button key={opt.id} onClick={() => setMode(opt.id)}
              style={{ background: "var(--adm-surface-2)", border: "1px solid var(--adm-border)", borderRadius: 10,
                padding: "16px 14px", cursor: "pointer", textAlign: "left", transition: ".15s" }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = "rgba(99,102,241,.5)"}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--adm-border)"}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>{opt.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--adm-text)", marginBottom: 4 }}>{opt.title}</div>
              <div style={{ fontSize: 11, color: "var(--adm-text-2)" }}>{opt.sub}</div>
            </button>
          ))}
        </div>
      )}

      {/* Tạo sản phẩm mới */}
      {mode === "new" && (
        <div style={{ background: "var(--adm-surface-2)", borderRadius: 10, padding: 16, border: "1px solid var(--adm-border)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, marginBottom: 12 }}>
            <div>
              <div className="adm-label" style={{ fontSize: 11 }}>Tên sản phẩm *</div>
              <input className="adm-input" placeholder="VD: Pate Royal Canin Kitten" value={productName}
                onChange={(e) => setProductName(e.target.value)} />
            </div>
            <div>
              <div className="adm-label" style={{ fontSize: 11 }}>Danh mục</div>
              <select className="adm-input adm-select" value={productCat} onChange={(e) => setProductCat(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ fontSize: 12, color: "var(--adm-text-2)", marginBottom: 12 }}>
            Sản phẩm sẽ được tạo với <strong>{createdVariants.length}</strong> phân loại từ kho.
            Ảnh và mô tả có thể bổ sung sau trong trang Quản lý sản phẩm.
          </div>
        </div>
      )}

      {/* Gán vào sản phẩm có sẵn */}
      {mode === "existing" && (
        <div style={{ background: "var(--adm-surface-2)", borderRadius: 10, padding: 16, border: "1px solid var(--adm-border)" }}>
          <div className="adm-label" style={{ fontSize: 11, marginBottom: 6 }}>Chọn sản phẩm</div>
          <select className="adm-input adm-select" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            <option value="">-- Chọn sản phẩm --</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.variants?.length || 0} variant hiện có)</option>
            ))}
          </select>
          {selectedId && (
            <div style={{ fontSize: 12, color: "var(--adm-text-2)", marginTop: 8 }}>
              ⚠️ {createdVariants.length} biến thể mới sẽ được thêm vào sản phẩm này. Variant cũ giữ nguyên.
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
        <button className="adm-btn-ghost" onClick={mode ? () => setMode(null) : onDone} style={{ fontSize: 12 }}>
          {mode ? "← Quay lại" : "Bỏ qua, chỉ lưu vào kho"}
        </button>
        {mode && (
          <button className="adm-btn-primary" onClick={handleLink} disabled={saving}>
            {saving ? "Đang lưu..." : mode === "new" ? "✅ Tạo sản phẩm" : "🔗 Gán vào sản phẩm"}
          </button>
        )}
      </div>
    </div>
  );
};

/* ── Main VariantSplitter modal ── */
const ATTR_PRESETS_VS = [
  { name: "Combo",     vals: ["Lẻ ×1", "×3", "×5", "×10", "×20"] },
  { name: "Hương vị",  vals: ["Cá hồi", "Gà", "Bò", "Mix"] },
  { name: "Kích cỡ",   vals: ["85g", "170g", "400g"] },
  { name: "Đối tượng", vals: ["Kitten", "Adult", "Senior"] },
];

const VariantSplitter = ({ token, inventoryItem, onClose, onSaved }) => {
  const [step, setStep]               = useState(1);
  const [vsMode, setVsMode]           = useState("matrix");
  const [attrs, setAttrs]             = useState([]);
  const [variants, setVariants]       = useState([]);
  const [freeRows, setFreeRows]       = useState([{ name: "", price: "", qty_per_unit: "", note: "" }]);
  const [shippingFee, setShippingFee] = useState("");
  const [otherCost, setOtherCost]     = useState("");
  const [marginPct, setMarginPct]     = useState("30");
  const [roundTo, setRoundTo]         = useState("1000");
  const [saving, setSaving]           = useState(false);
  const [createdVariants, setCreatedVariants] = useState([]);
  const [attrId, setAttrId]           = useState(0);

  if (!inventoryItem) return null;

  const unitCost    = inventoryItem.average_cost || 0;
  const totalQty    = inventoryItem.current_stock || 1;
  const roundFactor = parseInt(roundTo) || 1;
  const margin      = parseInt(marginPct) || 0;

  const calcPrice = (comboQty = 1) => {
    const ship  = (parseInt(shippingFee) || 0) / totalQty;
    const other = (parseInt(otherCost)   || 0) / totalQty;
    const lc    = (unitCost + ship + other) * comboQty;
    return margin < 100 ? Math.ceil((lc / (1 - margin / 100)) / roundFactor) * roundFactor : Math.ceil(lc / roundFactor) * roundFactor;
  };

  const extractQty = (val) => { const m = String(val).match(/\d+/); return m ? parseInt(m[0]) : 1; };

  const buildVariants = (currentAttrs) => {
    const valid = currentAttrs.filter((a) => a.name && a.vals.length > 0);
    if (!valid.length) { setVariants([]); return; }
    let combos = [[]];
    valid.forEach((a) => {
      const next = [];
      combos.forEach((c) => a.vals.forEach((v) => next.push([...c, { attr: a.name, val: v }])));
      combos = next;
    });
    setVariants((prev) => combos.map((combo, i) => {
      const comboAttr = combo.find((c) => /combo|lẻ|×|\d+/i.test(c.val));
      const qty = comboAttr ? extractQty(comboAttr.val) : 1;
      return { combo, price: prev[i]?.price || "", note: prev[i]?.note || "", qty };
    }));
  };

  const addAttr = (name = "", vals = []) => {
    const id = attrId + 1; setAttrId(id);
    const next = [...attrs, { id, name, vals }];
    setAttrs(next); buildVariants(next);
  };

  const updateAttr = (id, field, value) => {
    const next = attrs.map((a) => a.id === id ? { ...a, [field]: value } : a);
    setAttrs(next); buildVariants(next);
  };

  const addVal = (atId, val) => {
    val = val.trim(); if (!val) return;
    const next = attrs.map((a) => a.id === atId && !a.vals.includes(val) ? { ...a, vals: [...a.vals, val] } : a);
    setAttrs(next); buildVariants(next);
  };

  const removeVal = (atId, val) => {
    const next = attrs.map((a) => a.id === atId ? { ...a, vals: a.vals.filter((v) => v !== val) } : a);
    setAttrs(next); buildVariants(next);
  };

  const removeAttr = (id) => {
    const next = attrs.filter((a) => a.id !== id);
    setAttrs(next); buildVariants(next);
  };

  const autoFillMatrix = () =>
    setVariants((prev) => prev.map((v) => ({ ...v, price: String(calcPrice(v.qty || 1)) })));

  const applyQuick = (type) => {
    const sortedQtys = [...new Set(variants.map((v) => v.qty || 1))].sort((a, b) => a - b);
    setVariants((prev) => prev.map((v) => {
      const base = parseInt(v.price) || calcPrice(v.qty || 1);
      if (type === "premium" && (v.qty || 1) === 1) return { ...v, price: String(Math.ceil(base * 1.1 / roundFactor) * roundFactor) };
      if (type === "discount") { const tier = sortedQtys.indexOf(v.qty || 1); return { ...v, price: String(Math.ceil(base * (1 - tier * 0.05) / roundFactor) * roundFactor) }; }
      if (type === "round") return { ...v, price: String(Math.ceil(base / 1000) * 1000) };
      if (type === "reset") return { ...v, price: "" };
      return v;
    }));
  };

  const activeVariants = vsMode === "matrix"
    ? variants.filter((v) => v.price)
    : freeRows.filter((r) => r.name && r.price);

  const handleSaveVariants = async () => {
    if (activeVariants.length === 0) return alert("Cần ít nhất 1 biến thể có giá bán");
    setSaving(true);
    try {
      const payload = vsMode === "matrix"
        ? activeVariants.map((v) => ({ name: v.combo.map((c) => c.val).join(" · "), price: parseInt(v.price), qty_per_unit: v.qty || 1, note: v.note }))
        : activeVariants.map((r) => ({ name: r.name.trim(), price: parseInt(r.price), qty_per_unit: parseInt(r.qty_per_unit) || extractQty(r.name) || 1, note: r.note || "" }));
      const res = await fetch(`${API_BASE}/inventory/${inventoryItem.id}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ variants: payload }),
      });
      const data = await res.json();
      if (data.success) {
        setCreatedVariants(data.variants || payload.map((v, i) => ({ ...v, id: i, inventory_item_id: inventoryItem.id })));
        setStep(2); onSaved?.();
      } else alert(data.message || "Lỗi tạo biến thể");
    } catch { alert("Lỗi kết nối"); }
    finally { setSaving(false); }
  };

  const tagStyle = { fontSize: 11, padding: "3px 9px", borderRadius: 20, background: "rgba(99,102,241,0.12)",
    color: "#6366f1", border: "1px solid rgba(99,102,241,0.25)", display: "inline-flex", alignItems: "center", gap: 4 };

  const QUICK_ACTIONS = [
    ["⚡ Tự tính tất cả", autoFillMatrix],
    ["+10% lẻ", () => applyQuick("premium")],
    ["-5%/tier combo", () => applyQuick("discount")],
    ["Làm tròn 1K", () => applyQuick("round")],
    ["Reset", () => applyQuick("reset")],
  ];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 1100,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={step === 1 ? onClose : undefined}>
      <div style={{ background: "var(--adm-surface)", borderRadius: 16, width: "100%",
        maxWidth: 780, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.5)" }}
        onClick={(e) => e.stopPropagation()}>

        {/* Header + step indicator */}
        <div style={{ padding: "18px 24px 14px", borderBottom: "1px solid var(--adm-border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>🎨 Tạo biến thể bán hàng</div>
              <div style={{ fontSize: 12, color: "var(--adm-text-2)", marginTop: 3 }}>
                <strong>{inventoryItem.name}</strong>
                {" "}· Tồn: {fmtNum(inventoryItem.current_stock)} {inventoryItem.unit}
                {" "}· Giá vốn BQ: <strong style={{ color: "#f59e0b" }}>{fmt(unitCost)}</strong>
              </div>
            </div>
            <button className="adm-btn-ghost" onClick={onClose} style={{ padding: "5px 10px", fontSize: 12 }}>✕</button>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 12 }}>
            {[{ n: 1, label: "Tạo biến thể" }, { n: 2, label: "Gán sản phẩm" }].map((s, i) => (
              <React.Fragment key={s.n}>
                {i > 0 && <div style={{ flex: 1, height: 1, background: step >= s.n ? "#6366f1" : "var(--adm-border)" }} />}
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: 11, fontWeight: 700,
                    background: step >= s.n ? "#6366f1" : "var(--adm-surface-2)",
                    color: step >= s.n ? "#fff" : "var(--adm-text-2)",
                    border: `1px solid ${step >= s.n ? "#6366f1" : "var(--adm-border)"}` }}>
                    {step > s.n ? "✓" : s.n}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: step === s.n ? 600 : 400,
                    color: step >= s.n ? "var(--adm-text)" : "var(--adm-text-2)" }}>{s.label}</span>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        <div style={{ padding: 24 }}>

          {/* ══ BƯỚC 1: Tạo variant ══ */}
          {step === 1 && (
            <>
              {/* Mode toggle */}
              <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                {[{ id: "matrix", label: "📐 Matrix (thuộc tính × giá trị)" }, { id: "free", label: "✏️ Tự do hoàn toàn" }].map((m) => (
                  <button key={m.id} onClick={() => setVsMode(m.id)}
                    style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid", cursor: "pointer", fontSize: 12, fontWeight: 500,
                      background: vsMode === m.id ? "rgba(245,158,11,0.15)" : "transparent",
                      color: vsMode === m.id ? "#f59e0b" : "var(--adm-text-2)",
                      borderColor: vsMode === m.id ? "rgba(245,158,11,0.4)" : "var(--adm-border)" }}>
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Pricing config */}
              <div style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)",
                borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#f59e0b", marginBottom: 10 }}>🧮 Cấu hình giá</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                  <div><div className="adm-label" style={{ fontSize: 10 }}>Phí ship (đ)</div>
                    <input className="adm-input" type="number" placeholder="0" value={shippingFee} onChange={(e) => setShippingFee(e.target.value)} /></div>
                  <div><div className="adm-label" style={{ fontSize: 10 }}>Chi phí khác (đ)</div>
                    <input className="adm-input" type="number" placeholder="0" value={otherCost} onChange={(e) => setOtherCost(e.target.value)} /></div>
                  <div><div className="adm-label" style={{ fontSize: 10 }}>Biên LN (%)</div>
                    <input className="adm-input" type="number" min="0" max="99" value={marginPct} onChange={(e) => setMarginPct(e.target.value)} /></div>
                  <div><div className="adm-label" style={{ fontSize: 10 }}>Làm tròn</div>
                    <select className="adm-input adm-select" value={roundTo} onChange={(e) => setRoundTo(e.target.value)}>
                      <option value="1">Không làm tròn</option><option value="500">500đ</option>
                      <option value="1000">1.000đ</option><option value="5000">5.000đ</option><option value="10000">10.000đ</option>
                    </select></div>
                </div>
              </div>

              {/* Matrix mode */}
              {vsMode === "matrix" && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Thuộc tính sản phẩm</div>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: "var(--adm-text-2)" }}>Nhanh:</span>
                      {ATTR_PRESETS_VS.map((p) => {
                        const used = attrs.find((a) => a.name === p.name);
                        return (
                          <button key={p.name} onClick={() => !used && addAttr(p.name, p.vals)}
                            style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, cursor: used ? "default" : "pointer",
                              border: "1px solid var(--adm-border)",
                              background: used ? "rgba(99,102,241,.12)" : "transparent",
                              color: used ? "#6366f1" : "var(--adm-text-2)", opacity: used ? 0.6 : 1 }}>
                            {p.name}{used ? " ✓" : ""}
                          </button>
                        );
                      })}
                      <button className="adm-add-variant" onClick={() => addAttr()}>+ Mới</button>
                    </div>
                  </div>
                  {attrs.map((a) => (
                    <div key={a.id} style={{ background: "var(--adm-surface-2)", border: "1px solid var(--adm-border)", borderRadius: 9, padding: "10px 12px", marginBottom: 8 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                        <input className="adm-input" value={a.name} placeholder="Tên thuộc tính..." style={{ flex: 1, fontWeight: 600, fontSize: 12 }}
                          onChange={(e) => updateAttr(a.id, "name", e.target.value)} />
                        <button className="adm-remove-variant" onClick={() => removeAttr(a.id)}>✕</button>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
                        {a.vals.map((v) => (
                          <span key={v} style={tagStyle}>{v}
                            <span onClick={() => removeVal(a.id, v)} style={{ cursor: "pointer", opacity: 0.6, fontSize: 10 }}>✕</span>
                          </span>
                        ))}
                        <input className="adm-input" placeholder="+ Thêm giá trị, nhấn Enter" id={`vi-${a.id}`} style={{ width: 180, fontSize: 11 }}
                          onKeyDown={(e) => { if (e.key === "Enter") { addVal(a.id, e.target.value); e.target.value = ""; } }} />
                      </div>
                    </div>
                  ))}
                  {variants.length > 0 && (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "14px 0 8px" }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>
                          💰 Định giá · <span style={{ fontWeight: 400, color: "var(--adm-text-2)" }}>{variants.length} tổ hợp</span>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {QUICK_ACTIONS.map(([label, fn]) => (
                            <button key={label} className="adm-btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }} onClick={fn}>{label}</button>
                          ))}
                        </div>
                      </div>
                      {variants.map((v, i) => {
                        const label = v.combo.map((c) => c.val).join(" · ");
                        const suggested = calcPrice(v.qty || 1);
                        const lc = (unitCost + (parseInt(shippingFee)||0)/totalQty + (parseInt(otherCost)||0)/totalQty) * (v.qty||1);
                        const m  = v.price && parseInt(v.price) > 0 ? ((parseInt(v.price) - lc) / parseInt(v.price) * 100).toFixed(1) : null;
                        return (
                          <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1.3fr 0.6fr 1fr",
                            gap: 8, alignItems: "end", padding: "8px 10px", borderRadius: 8, marginBottom: 5,
                            background: "var(--adm-surface-2)", border: "1px solid var(--adm-border)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={tagStyle}>{label}</span>
                              {(v.qty||1) > 1 && <span style={{ fontSize: 10, color: "var(--adm-text-2)" }}>×{v.qty}</span>}
                            </div>
                            <div>
                              <div style={{ fontSize: 10, color: "var(--adm-text-2)", marginBottom: 3 }}>Giá bán · gợi ý: <span style={{ color: "#f59e0b" }}>{fmt(suggested)}</span></div>
                              <input className="adm-input" type="number" placeholder={String(suggested)} value={v.price}
                                style={{ textAlign: "right", color: "#f59e0b", fontWeight: 700 }}
                                onChange={(e) => setVariants((prev) => prev.map((x, j) => j === i ? { ...x, price: e.target.value } : x))} />
                            </div>
                            <div style={{ textAlign: "center" }}>
                              {m !== null && (<><div style={{ fontWeight: 700, fontSize: 12, color: parseFloat(m) >= 25 ? "#22c55e" : "#f59e0b" }}>{m}%</div><div style={{ fontSize: 10, color: "var(--adm-text-2)" }}>biên LN</div></>)}
                            </div>
                            <div>
                              <div style={{ fontSize: 10, color: "var(--adm-text-2)", marginBottom: 3 }}>Ghi chú</div>
                              <input className="adm-input" placeholder="Tuỳ chọn..." value={v.note}
                                onChange={(e) => setVariants((prev) => prev.map((x, j) => j === i ? { ...x, note: e.target.value } : x))} />
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </>
              )}

              {/* Free mode */}
              {vsMode === "free" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 1fr 30px", gap: 6, marginBottom: 5,
                    fontSize: 10, color: "var(--adm-text-2)", padding: "0 4px" }}>
                    <span>Tên biến thể</span><span style={{ textAlign: "right" }}>Giá bán (đ)</span><span>Số lượng/combo</span><span>Ghi chú</span><span />
                  </div>
                  {freeRows.map((r, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 1fr 30px", gap: 6, marginBottom: 6, alignItems: "end" }}>
                      <input className="adm-input" placeholder="VD: Pate cá hồi combo 5 hộp" value={r.name}
                        onChange={(e) => setFreeRows((prev) => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                      <input className="adm-input" type="number" placeholder={String(calcPrice(extractQty(r.name)||1))} value={r.price}
                        style={{ textAlign: "right", color: "#f59e0b", fontWeight: 700 }}
                        onChange={(e) => setFreeRows((prev) => prev.map((x, j) => j === i ? { ...x, price: e.target.value } : x))} />
                      <input className="adm-input" type="number" min="1" placeholder="1" value={r.qty_per_unit || ""}
                        onChange={(e) => setFreeRows((prev) => prev.map((x, j) => j === i ? { ...x, qty_per_unit: e.target.value } : x))} />
                      <input className="adm-input" placeholder="Ghi chú..." value={r.note || ""}
                        onChange={(e) => setFreeRows((prev) => prev.map((x, j) => j === i ? { ...x, note: e.target.value } : x))} />
                      <button className="adm-remove-variant" onClick={() => setFreeRows((prev) => prev.filter((_, j) => j !== i))} disabled={freeRows.length <= 1}>✕</button>
                    </div>
                  ))}
                  <button className="adm-add-variant" style={{ marginTop: 4 }}
                    onClick={() => setFreeRows((prev) => [...prev, { name: "", price: "", qty_per_unit: "", note: "" }])}>
                    + Thêm dòng
                  </button>
                </>
              )}

              {/* Preview */}
              {activeVariants.length > 0 && (
                <div style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 9, padding: 12, marginTop: 14 }}>
                  <div style={{ fontSize: 11, color: "var(--adm-text-2)", marginBottom: 7 }}>
                    📋 Sẽ tạo <strong style={{ color: "#6366f1" }}>{activeVariants.length}</strong> biến thể
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {activeVariants.map((v, i) => {
                      const name = vsMode === "matrix" ? v.combo.map((c) => c.val).join(" · ") : v.name;
                      return <span key={i} style={tagStyle}>{name} → {fmt(parseInt(v.price))}</span>;
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
                <button className="adm-btn-ghost" onClick={onClose}>Hủy</button>
                <button className="adm-btn-primary" onClick={handleSaveVariants} disabled={saving || activeVariants.length === 0}>
                  {saving ? "Đang lưu..." : "Lưu & Gán sản phẩm →"}
                </button>
              </div>
            </>
          )}

          {/* ══ BƯỚC 2: Gán Product ══ */}
          {step === 2 && (
            <LinkToProduct token={token} createdVariants={createdVariants} inventoryItem={inventoryItem} onDone={onClose} />
          )}

        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════
   SUPPLIER MANAGER
   ══════════════════════════════════════════════════════ */
const SupplierManager = ({ token }) => {
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm]           = useState({ name: "", phone: "", address: "", note: "" });
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving]       = useState(false);

  const fetchSuppliers = useCallback(async () => {
    const res  = await fetch(`${API_BASE}/suppliers`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.success) setSuppliers(data.suppliers);
  }, [token]);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  const resetForm  = () => { setForm({ name: "", phone: "", address: "", note: "" }); setEditingId(null); };

  const handleSave = async () => {
    if (!form.name.trim()) return alert("Tên NCC không được trống");
    setSaving(true);
    try {
      const url    = editingId ? `${API_BASE}/suppliers/${editingId}` : `${API_BASE}/suppliers`;
      const method = editingId ? "PUT" : "POST";
      const res    = await fetch(url, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(form) });
      const data   = await res.json();
      if (data.success) { resetForm(); fetchSuppliers(); } else alert(data.message);
    } catch { alert("Lỗi kết nối"); } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Xóa nhà cung cấp này?")) return;
    const res  = await fetch(`${API_BASE}/suppliers/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.success) fetchSuppliers(); else alert(data.message);
  };

  return (
    <div>
      <div style={{ background: "var(--adm-surface)", borderRadius: 12, padding: 20, border: "1px solid var(--adm-border)", marginBottom: 20 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15 }}>{editingId ? "✏️ Sửa NCC" : "➕ Thêm NCC mới"}</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <input className="adm-input" placeholder="Tên NCC *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="adm-input" placeholder="Số điện thoại" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className="adm-input" placeholder="Địa chỉ" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <input className="adm-input" placeholder="Ghi chú" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "flex-end" }}>
          {editingId && <button className="adm-btn-ghost" onClick={resetForm}>Hủy</button>}
          <button className="adm-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Đang lưu..." : editingId ? "Cập nhật" : "Thêm NCC"}
          </button>
        </div>
      </div>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead><tr><th>Tên NCC</th><th>SĐT</th><th>Địa chỉ</th><th>Số phiếu</th><th>Thao tác</th></tr></thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id}>
                <td><strong>{s.name}</strong></td>
                <td>{s.phone || "—"}</td>
                <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{s.address || "—"}</td>
                <td className="adm-td-center">{s.totalOrders}</td>
                <td>
                  <div className="adm-actions">
                    <button className="adm-action-btn adm-edit"
                      onClick={() => { setEditingId(s.id); setForm({ name: s.name, phone: s.phone||"", address: s.address||"", note: s.note||"" }); }}>
                      ✏️ Sửa
                    </button>
                    <button className="adm-action-btn adm-delete" onClick={() => handleDelete(s.id)}>🗑️ Xóa</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════
   CREATE PO FORM
   ══════════════════════════════════════════════════════ */
const BLANK_ITEM = { mode: "manual", inventory_item_id: "", name: "", sku: "", unit: "hộp", unit_cost: "", qty: "1" };

const CreatePoForm = ({ token, onCreated }) => {
  const [suppliers, setSuppliers]   = useState([]);
  const [inventory, setInventory]   = useState([]);
  const [supplierId, setSupplierId] = useState("");
  const [note, setNote]             = useState("");
  const [items, setItems]           = useState([{ ...BLANK_ITEM }]);
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/suppliers`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((d) => d.success && setSuppliers(d.suppliers));
    fetch(`${API_BASE}/inventory`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((d) => d.success && setInventory(d.items));
  }, [token]);

  const updateItem = (idx, field, value) => {
    const next = [...items];
    next[idx] = { ...next[idx], [field]: value };
    if (field === "inventory_item_id" && value) {
      const inv = inventory.find((i) => i.id === parseInt(value));
      if (inv) { next[idx].unit = inv.unit; if (inv.average_cost > 0) next[idx].unit_cost = String(inv.average_cost); }
    }
    setItems(next);
  };

  const switchMode = (idx, mode) => {
    const next = [...items];
    next[idx] = { ...BLANK_ITEM, mode, unit_cost: next[idx].unit_cost, qty: next[idx].qty };
    setItems(next);
  };

  const addItem    = () => setItems([...items, { ...BLANK_ITEM }]);
  const removeItem = (idx) => items.length > 1 && setItems(items.filter((_, i) => i !== idx));
  const totalCost  = items.reduce((sum, i) => sum + (parseInt(i.unit_cost)||0) * (parseInt(i.qty)||0), 0);
  const getInvItem = (id) => inventory.find((i) => i.id === parseInt(id));

  const calcItems = items.map((i) => {
    if (i.mode === "existing") {
      const inv = getInvItem(i.inventory_item_id);
      return { name: inv?.name || "", unit_cost: i.unit_cost || inv?.average_cost || 0, qty: i.qty };
    }
    return { name: i.name, unit_cost: i.unit_cost, qty: i.qty };
  }).filter((i) => i.unit_cost && i.qty);

  const handleSubmit = async () => {
    if (!supplierId) return alert("Chưa chọn nhà cung cấp");
    for (const item of items) {
      if (item.mode === "manual"   && !item.name.trim())           return alert("Tên hàng hóa không được trống");
      if (item.mode === "existing" && !item.inventory_item_id)     return alert("Chưa chọn hàng hóa từ kho");
      if (!item.unit_cost || parseInt(item.unit_cost) <= 0)        return alert("Giá nhập phải > 0");
      if (!item.qty       || parseInt(item.qty)       <= 0)        return alert("Số lượng phải > 0");
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/purchase-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          supplier_id: parseInt(supplierId), note,
          items: items.map((i) =>
            i.mode === "existing"
              ? { inventory_item_id: parseInt(i.inventory_item_id), unit_cost: parseInt(i.unit_cost), qty: parseInt(i.qty) }
              : { name: i.name.trim(), sku: i.sku.trim()||undefined, unit: i.unit.trim()||"hộp", unit_cost: parseInt(i.unit_cost), qty: parseInt(i.qty) }
          ),
        }),
      });
      const data = await res.json();
      if (data.success) { alert(`Tạo phiếu ${data.po_number} thành công!`); onCreated(); }
      else alert(data.message);
    } catch { alert("Lỗi kết nối"); } finally { setSaving(false); }
  };

  return (
    <div style={{ background: "var(--adm-surface)", borderRadius: 12, padding: 24, border: "1px solid var(--adm-border)" }}>
      <h3 style={{ margin: "0 0 20px", fontSize: 16 }}>📝 Tạo phiếu nhập hàng</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
        <div>
          <label className="adm-label">Nhà cung cấp *</label>
          <select className="adm-input adm-select" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">-- Chọn NCC --</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}{s.phone ? ` (${s.phone})` : ""}</option>)}
          </select>
        </div>
        <div>
          <label className="adm-label">Ghi chú</label>
          <input className="adm-input" placeholder="Ghi chú phiếu nhập..." value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <label className="adm-label" style={{ margin: 0 }}>Hàng hóa nhập</label>
          <button className="adm-add-variant" onClick={addItem}>+ Thêm dòng</button>
        </div>

        {items.map((item, idx) => {
          const inv = item.mode === "existing" ? getInvItem(item.inventory_item_id) : null;
          return (
            <div key={idx} style={{ background: "var(--adm-surface-2)", borderRadius: 10,
              padding: "12px 14px", marginBottom: 10, border: "1px solid var(--adm-border)" }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                {["manual", "existing"].map((mode) => (
                  <button key={mode} onClick={() => switchMode(idx, mode)}
                    style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, border: "1px solid", cursor: "pointer",
                      background: item.mode === mode ? (mode === "manual" ? "#f59e0b" : "#6366f1") : "transparent",
                      color: item.mode === mode ? (mode === "manual" ? "#000" : "#fff") : "var(--adm-text-2)",
                      borderColor: item.mode === mode ? (mode === "manual" ? "#f59e0b" : "#6366f1") : "var(--adm-border)" }}>
                    {mode === "manual" ? "✏️ Nhập thủ công" : "📦 Chọn từ kho"}
                  </button>
                ))}
                {items.length > 1 && (
                  <button className="adm-remove-variant" style={{ marginLeft: "auto" }} onClick={() => removeItem(idx)}>✕ Xóa dòng</button>
                )}
              </div>

              {item.mode === "manual" ? (
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 0.8fr 1fr 0.8fr", gap: 10 }}>
                  {[
                    { label: "Tên hàng hóa *", field: "name", placeholder: "VD: Thức ăn hạt Royal Canin..." },
                    { label: "SKU (để trống tự sinh)", field: "sku", placeholder: "VD: RC-001" },
                    { label: "Đơn vị", field: "unit", placeholder: "hộp / gói / kg..." },
                  ].map(({ label, field, placeholder }) => (
                    <div key={field}>
                      <div className="adm-label" style={{ fontSize: 11 }}>{label}</div>
                      <input className="adm-input" placeholder={placeholder} value={item[field]}
                        onChange={(e) => updateItem(idx, field, e.target.value)} />
                    </div>
                  ))}
                  <div>
                    <div className="adm-label" style={{ fontSize: 11 }}>Giá nhập (đ) *</div>
                    <input className="adm-input" type="number" min="0" placeholder="VNĐ"
                      value={item.unit_cost} onChange={(e) => updateItem(idx, "unit_cost", e.target.value)} />
                  </div>
                  <div>
                    <div className="adm-label" style={{ fontSize: 11 }}>Số lượng *</div>
                    <input className="adm-input" type="number" min="1"
                      value={item.qty} onChange={(e) => updateItem(idx, "qty", e.target.value)} />
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "2.5fr 0.8fr 1fr 0.8fr", gap: 10 }}>
                  <div>
                    <div className="adm-label" style={{ fontSize: 11 }}>Hàng hóa trong kho</div>
                    <select className="adm-input adm-select" value={item.inventory_item_id}
                      onChange={(e) => updateItem(idx, "inventory_item_id", e.target.value)}>
                      <option value="">-- Chọn hàng hóa --</option>
                      {inventory.map((i) => <option key={i.id} value={i.id}>[{i.sku}] {i.name}</option>)}
                    </select>
                    {inv && (
                      <div style={{ fontSize: 11, color: "var(--adm-text-2)", marginTop: 4 }}>
                        Tồn: {inv.current_stock} {inv.unit} · Giá vốn BQ: {fmt(inv.average_cost)}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="adm-label" style={{ fontSize: 11 }}>ĐVT</div>
                    <div className="adm-input" style={{ background: "var(--adm-surface)", color: "var(--adm-text-2)", display: "flex", alignItems: "center", height: 38 }}>
                      {inv?.unit || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="adm-label" style={{ fontSize: 11 }}>Giá nhập (đ) *</div>
                    <input className="adm-input" type="number" min="0" placeholder="VNĐ"
                      value={item.unit_cost} onChange={(e) => updateItem(idx, "unit_cost", e.target.value)} />
                    {inv && item.unit_cost && parseInt(item.unit_cost) !== inv.average_cost && (
                      <div style={{ fontSize: 11, marginTop: 4, color: parseInt(item.unit_cost) > inv.average_cost ? "#ef4444" : "#22c55e" }}>
                        {parseInt(item.unit_cost) > inv.average_cost ? "▲" : "▼"} so với BQ {fmt(inv.average_cost)}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="adm-label" style={{ fontSize: 11 }}>Số lượng *</div>
                    <input className="adm-input" type="number" min="1"
                      value={item.qty} onChange={(e) => updateItem(idx, "qty", e.target.value)} />
                  </div>
                </div>
              )}

              {item.unit_cost && item.qty && (
                <div style={{ textAlign: "right", marginTop: 8, fontSize: 13, color: "#f59e0b", fontWeight: 600 }}>
                  {item.mode === "manual" ? item.name || "Hàng hóa" : inv?.name || "—"}
                  {" "}× {item.qty} = {fmt((parseInt(item.unit_cost)||0) * (parseInt(item.qty)||0))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 🧮 Price Calculator */}
      <PriceCalculator items={calcItems} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
        paddingTop: 16, marginTop: 16, borderTop: "2px solid var(--adm-border)" }}>
        <div>
          <div style={{ fontSize: 13, color: "var(--adm-text-2)" }}>Tổng giá trị phiếu nhập</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#f59e0b" }}>{fmt(totalCost)}</div>
        </div>
        <button className="adm-btn-primary" onClick={handleSubmit} disabled={saving}>
          {saving ? "Đang tạo..." : "📝 Tạo phiếu nhập"}
        </button>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════
   PO DETAIL MODAL
   ══════════════════════════════════════════════════════ */
const PoDetailModal = ({ token, poId, onClose }) => {
  const [detail, setDetail]           = useState(null);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/purchase-orders/${poId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((d) => { if (d.success) setDetail(d.order); }).finally(() => setLoading(false));
  }, [token, poId]);

  const cfg = detail ? (STATUS_CONFIG[detail.status] || STATUS_CONFIG.draft) : null;

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
        <div style={{ background: "var(--adm-surface)", borderRadius: 16, padding: 28, width: "100%",
          maxWidth: 720, maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}
          onClick={(e) => e.stopPropagation()}>
          {loading ? (
            <div className="adm-loading"><span className="adm-spinner adm-spinner-lg" /></div>
          ) : !detail ? <p>Không tìm thấy phiếu</p> : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#f59e0b", fontFamily: "monospace" }}>{detail.po_number}</div>
                  <div style={{ fontSize: 13, color: "var(--adm-text-2)", marginTop: 4 }}>
                    NCC: <strong>{detail.supplier?.name}</strong>{detail.supplier?.phone && ` · ${detail.supplier.phone}`}
                  </div>
                  {detail.note && <div style={{ fontSize: 13, color: "var(--adm-text-2)", marginTop: 2 }}>Ghi chú: {detail.note}</div>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span className="adm-badge" style={{ background: cfg.bg, color: cfg.color, border: "none" }}>{cfg.icon} {cfg.label}</span>
                  <button className="adm-btn-ghost" style={{ padding: "6px 12px" }} onClick={onClose}>✕ Đóng</button>
                </div>
              </div>

              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th>SKU</th><th>Tên hàng hóa</th><th>ĐVT</th><th>Giá nhập</th><th>SL</th><th>Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((item) => (
                      <tr key={item.id}>
                        <td><code style={{ fontSize: 12 }}>{item.inventoryItem.sku}</code></td>
                        <td><strong>{item.inventoryItem.name}</strong></td>
                        <td className="adm-td-center">{item.inventoryItem.unit}</td>
                        <td className="adm-td-price">{fmt(item.unit_cost)}</td>
                        <td className="adm-td-center">{item.qty}</td>
                        <td className="adm-td-price" style={{ color: "#f59e0b", fontWeight: 700 }}>{fmt(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16, paddingTop: 12, borderTop: "2px solid var(--adm-border)" }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, color: "var(--adm-text-2)" }}>Tổng giá trị</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#f59e0b" }}>{fmt(detail.total_cost)}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 24, marginTop: 12, fontSize: 12, color: "var(--adm-text-2)" }}>
                <span>Tạo lúc: {new Date(detail.created_at).toLocaleString("vi-VN")}</span>
                {detail.confirmed_at && <span>Nhập kho: {new Date(detail.confirmed_at).toLocaleString("vi-VN")}</span>}
              </div>
            </>
          )}
        </div>
      </div>

    </>
  );
};

/* ══════════════════════════════════════════════════════
   PO LIST
   ══════════════════════════════════════════════════════ */
const PoList = ({ token, onRefresh }) => {
  const [orders, setOrders]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [filter, setFilter]           = useState("all");
  const [profitStats, setProfitStats] = useState(null);
  const [detailPoId, setDetailPoId]   = useState(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const [poRes, profitRes] = await Promise.all([
        fetch(`${API_BASE}/purchase-orders`,             { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/purchase-orders/stats/profit`,{ headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [poData, profitData] = await Promise.all([poRes.json(), profitRes.json()]);
      if (poData.success)     setOrders(poData.orders);
      if (profitData.success) setProfitStats(profitData.stats);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchOrders(); }, [fetchOrders, onRefresh]);

  const handleAction = async (id, action) => {
    const labels = { confirm: "xác nhận nhập kho", cancel: "hủy phiếu" };
    if (!window.confirm(`Bạn muốn ${labels[action]} phiếu này?`)) return;
    const res  = await fetch(`${API_BASE}/purchase-orders/${id}/${action}`, { method: "PUT", headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.success) { alert(data.message); fetchOrders(); } else alert(data.message);
  };

  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  return (
    <div>
      {profitStats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Doanh thu (đã giao)", value: fmt(profitStats.revenue), color: "#3b82f6" },
            { label: "COGS thực tế",        value: fmt(profitStats.cogs),    color: "#f59e0b" },
            { label: "Lợi nhuận",           value: fmt(profitStats.profit),  color: profitStats.profit >= 0 ? "#22c55e" : "#ef4444" },
            { label: "Biên lợi nhuận",      value: `${profitStats.margin}%`, color: profitStats.margin >= 30 ? "#22c55e" : "#f59e0b" },
          ].map((s) => (
            <div key={s.label} style={{ background: "var(--adm-surface)", borderRadius: 12, border: "1px solid var(--adm-border)", padding: "14px 18px" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "var(--adm-text-2)", marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="adm-cat-tabs" style={{ marginBottom: 16 }}>
        {[{ id: "all", label: "Tất cả" }, { id: "draft", label: "📝 Nháp" }, { id: "confirmed", label: "✅ Đã nhập" }, { id: "cancelled", label: "❌ Đã hủy" }].map((tab) => (
          <button key={tab.id} className={`adm-cat-tab ${filter === tab.id ? "active" : ""}`}
            onClick={() => setFilter(tab.id)}>{tab.label}</button>
        ))}
      </div>

      {loading ? (
        <div className="adm-loading"><span className="adm-spinner adm-spinner-lg" /></div>
      ) : filtered.length === 0 ? (
        <div className="adm-empty"><div className="adm-empty-icon">📦</div><p>Không có phiếu nhập nào</p></div>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr><th>Mã phiếu</th><th>NCC</th><th>Mặt hàng</th><th>Tổng giá vốn</th><th>Trạng thái</th><th>Ngày tạo</th><th>Thao tác</th></tr>
            </thead>
            <tbody>
              {filtered.map((po) => {
                const cfg = STATUS_CONFIG[po.status] || STATUS_CONFIG.draft;
                return (
                  <tr key={po.id}>
                    <td><span style={{ color: "#f59e0b", fontWeight: 600, fontSize: 13, fontFamily: "monospace" }}>{po.po_number}</span></td>
                    <td>
                      <strong>{po.supplier_name}</strong>
                      {po.supplier_phone && <div style={{ fontSize: 11, color: "var(--adm-text-2)" }}>{po.supplier_phone}</div>}
                    </td>
                    <td className="adm-td-center">{po.item_count} mặt hàng</td>
                    <td className="adm-td-price">{fmt(po.total_cost)}</td>
                    <td><span className="adm-badge" style={{ background: cfg.bg, color: cfg.color, border: "none" }}>{cfg.icon} {cfg.label}</span></td>
                    <td style={{ fontSize: 12, color: "var(--adm-text-2)" }}>
                      {new Date(po.created_at).toLocaleString("vi-VN")}
                      {po.confirmed_at && <div>Nhập: {new Date(po.confirmed_at).toLocaleDateString("vi-VN")}</div>}
                    </td>
                    <td>
                      <div className="adm-actions">
                        <button className="adm-action-btn" style={{ background: "rgba(99,102,241,0.1)", color: "#6366f1" }}
                          onClick={() => setDetailPoId(po.id)}>🔍 Chi tiết</button>
                        {po.status === "draft" && (
                          <>
                            <button className="adm-action-btn" style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}
                              onClick={() => handleAction(po.id, "confirm")}>✅ Nhập kho</button>
                            <button className="adm-action-btn adm-delete" onClick={() => handleAction(po.id, "cancel")}>❌ Hủy</button>
                          </>
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
      {detailPoId && <PoDetailModal token={token} poId={detailPoId} onClose={() => setDetailPoId(null)} />}
    </div>
  );
};

/* ══════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════ */
const AdminPurchaseOrders = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("list");
  const [refresh, setRefresh]     = useState(0);
  const token = localStorage.getItem("mc_admin_token");

  useEffect(() => {
    if (!token) { navigate("/admin/login"); return; }
    adminAPI.verifyToken().then((r) => {
      if (!r.valid) { localStorage.removeItem("mc_admin_token"); navigate("/admin/login"); }
    });
  }, [navigate, token]);

  return (
    <div>
      <div className="adm-topbar">
        <div>
          <h1 className="adm-page-title">📦 Nhập hàng</h1>
          <p className="adm-page-sub">Phiếu nhập · Tồn kho · Lợi nhuận thật</p>
        </div>
      </div>
      <div className="adm-filters">
        <div className="adm-cat-tabs">
          {TABS.map((tab) => (
            <button key={tab.id} className={`adm-cat-tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}>{tab.icon} {tab.label}</button>
          ))}
        </div>
      </div>
      {activeTab === "list"      && <PoList token={token} onRefresh={refresh} />}
      {activeTab === "create"    && <CreatePoForm token={token} onCreated={() => { setActiveTab("list"); setRefresh((r) => r + 1); }} />}
      {activeTab === "suppliers" && <SupplierManager token={token} />}
    </div>
  );
};

export default AdminPurchaseOrders;