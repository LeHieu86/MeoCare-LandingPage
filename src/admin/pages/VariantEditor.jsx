import { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

/* ══════════════════════════════════════════════════
   VARIANT EDITOR — có tab "Import từ kho"
   ══════════════════════════════════════════════════ */
const VariantEditor = ({ variants, onChange, token }) => {
  const [tab, setTab]           = useState("manual"); // "manual" | "import"
  const [invItems, setInvItems] = useState([]);
  const [loadingInv, setLoadingInv] = useState(false);
  const [selectedInvId, setSelectedInvId] = useState("");
  const [invVariants, setInvVariants]     = useState([]);
  const [loadingVars, setLoadingVars]     = useState(false);
  const [imported, setImported]           = useState([]); // đã chọn để import

  // Load inventory items khi mở tab Import
  useEffect(() => {
    if (tab !== "import" || invItems.length > 0) return;
    let cancelled = false;
    (async () => {
      setLoadingInv(true);
      try {
        const r = await fetch(`${API_BASE}/inventory`, { headers: { Authorization: `Bearer ${token}` } });
        const d = await r.json();
        if (!cancelled && d.success) setInvItems(d.items || []);
      } finally {
        if (!cancelled) setLoadingInv(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tab, token, invItems.length]);

  // Load variants của inventory item đã chọn
  useEffect(() => {
    if (!selectedInvId) { setInvVariants([]); return; }
    let cancelled = false;
    (async () => {
      setLoadingVars(true);
      try {
        const r = await fetch(`${API_BASE}/inventory/${selectedInvId}/variants`, { headers: { Authorization: `Bearer ${token}` } });
        const d = await r.json();
        if (!cancelled && d.success) setInvVariants(d.variants || []);
      } finally {
        if (!cancelled) setLoadingVars(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedInvId, token]);

  const toggleImport = (v) => {
    setImported((prev) =>
      prev.find((x) => x.id === v.id) ? prev.filter((x) => x.id !== v.id) : [...prev, v]
    );
  };

  const applyImport = () => {
    if (imported.length === 0) return;
    const newVariants = imported.map((v) => ({
      name: v.name,
      price: String(v.price),
      inventory_item_id: v.inventory_item_id,
      qty_per_unit: v.qty_per_unit || 1,
    }));
    // Merge: giữ variant thủ công cũ + thêm variant từ kho (không trùng tên)
    const existingNames = variants.map((x) => x.name.toLowerCase());
    const toAdd = newVariants.filter((v) => !existingNames.includes(v.name.toLowerCase()));
    onChange([...variants, ...toAdd]);
    setImported([]);
    setTab("manual"); // quay lại tab manual sau khi import
  };

  // ── Tab Manual: giống VariantEditor cũ ──
  const update = (idx, field, value) =>
    onChange(variants.map((v, i) => (i === idx ? { ...v, [field]: value } : v)));
  const add    = () => onChange([...variants, { name: "", price: "" }]);
  const remove = (idx) => onChange(variants.filter((_, i) => i !== idx));

  const fmt = (n) => (n || 0).toLocaleString("vi-VN") + "đ";

  return (
    <div className="adm-variants">
      {/* Tab switcher */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {[
          { id: "manual", label: "✏️ Nhập thủ công" },
          { id: "import", label: "📦 Import từ kho" },
        ].map((t) => (
          <button key={t.id} type="button"
            onClick={() => setTab(t.id)}
            style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid",
              cursor: "pointer", fontSize: 12, fontWeight: 500,
              background: tab === t.id ? "rgba(245,158,11,0.15)" : "transparent",
              color: tab === t.id ? "#f59e0b" : "var(--adm-text-2)",
              borderColor: tab === t.id ? "rgba(245,158,11,0.4)" : "var(--adm-border)" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Manual tab ── */}
      {tab === "manual" && (
        <>
          <div className="adm-variants-header">
            <span className="adm-label">Phân loại (variants)</span>
            <button type="button" className="adm-add-variant" onClick={add}>+ Thêm</button>
          </div>
          {variants.map((v, idx) => (
            <div key={idx} className="adm-variant-row">
              <input className="adm-input adm-variant-name" placeholder="Tên biến thể, vd: Thịt Gà - 5 Gói"
                value={v.name} onChange={(e) => update(idx, "name", e.target.value)} />
              <input className="adm-input adm-variant-price" placeholder="Giá (VNĐ)" type="number" min="0"
                value={v.price} onChange={(e) => update(idx, "price", e.target.value)} />
              {/* Hiển thị badge nếu variant này link từ kho */}
              {v.inventory_item_id && (
                <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, whiteSpace: "nowrap",
                  background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)" }}>
                  🔗 Kho
                </span>
              )}
              {variants.length > 1 && (
                <button type="button" className="adm-remove-variant" onClick={() => remove(idx)}>✕</button>
              )}
            </div>
          ))}
          {/* Hint nếu đang có variant từ kho */}
          {variants.some((v) => v.inventory_item_id) && (
            <div style={{ fontSize: 11, color: "var(--adm-text-2)", marginTop: 6 }}>
              🔗 Variant được link từ kho sẽ tự cập nhật tồn khi có đơn bán
            </div>
          )}
        </>
      )}

      {/* ── Import tab ── */}
      {tab === "import" && (
        <div>
          <div className="adm-label" style={{ marginBottom: 6 }}>Chọn mặt hàng trong kho</div>
          {loadingInv ? (
            <div style={{ color: "var(--adm-text-2)", fontSize: 12 }}>Đang tải...</div>
          ) : (
            <select className="adm-input adm-select" value={selectedInvId}
              onChange={(e) => { setSelectedInvId(e.target.value); setImported([]); }}
              style={{ marginBottom: 12 }}>
              <option value="">-- Chọn mặt hàng --</option>
              {invItems.map((item) => (
                <option key={item.id} value={item.id}>
                  [{item.sku}] {item.name} · Tồn: {item.current_stock} {item.unit}
                </option>
              ))}
            </select>
          )}

          {selectedInvId && (
            <>
              {loadingVars ? (
                <div style={{ color: "var(--adm-text-2)", fontSize: 12 }}>Đang tải biến thể...</div>
              ) : invVariants.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--adm-text-2)", padding: "10px 0" }}>
                  Chưa có biến thể nào trong kho.
                  Tạo biến thể trong trang <strong>Nhập hàng → Chi tiết phiếu → 🎨 Tạo biến thể</strong> trước.
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 11, color: "var(--adm-text-2)", marginBottom: 8 }}>
                    Chọn biến thể muốn thêm vào sản phẩm này:
                  </div>
                  {invVariants.map((v) => {
                    const alreadyLinked = variants.some((x) => x.inventory_item_id === v.inventory_item_id && x.name === v.name);
                    const isSelected    = imported.find((x) => x.id === v.id);
                    return (
                      <div key={v.id} onClick={() => !alreadyLinked && toggleImport(v)}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                          borderRadius: 8, marginBottom: 5, cursor: alreadyLinked ? "default" : "pointer",
                          background: isSelected ? "rgba(99,102,241,0.1)" : "var(--adm-surface-2)",
                          border: `1px solid ${isSelected ? "rgba(99,102,241,0.4)" : "var(--adm-border)"}`,
                          opacity: alreadyLinked ? 0.5 : 1 }}>
                        <input type="checkbox" checked={!!isSelected} readOnly disabled={alreadyLinked}
                          style={{ width: 14, height: 14, pointerEvents: "none" }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{v.name}</div>
                          <div style={{ fontSize: 11, color: "var(--adm-text-2)" }}>
                            {fmt(v.price)}{v.qty_per_unit > 1 ? ` · combo ${v.qty_per_unit} đơn vị` : ""}
                          </div>
                        </div>
                        {alreadyLinked && (
                          <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10,
                            background: "rgba(34,197,94,0.12)", color: "#22c55e" }}>Đã có</span>
                        )}
                        {isSelected && !alreadyLinked && (
                          <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10,
                            background: "rgba(99,102,241,0.12)", color: "#6366f1" }}>✓ Chọn</span>
                        )}
                      </div>
                    );
                  })}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                    <span style={{ fontSize: 11, color: "var(--adm-text-2)" }}>
                      {imported.length > 0 ? `Đã chọn ${imported.length} biến thể` : "Chưa chọn gì"}
                    </span>
                    <button type="button" className="adm-btn-primary"
                      style={{ fontSize: 12, padding: "6px 14px" }}
                      disabled={imported.length === 0} onClick={applyImport}>
                      ✅ Thêm {imported.length > 0 ? `${imported.length} ` : ""}variant vào sản phẩm
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default VariantEditor;