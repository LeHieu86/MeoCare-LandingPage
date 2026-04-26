import React, { useState } from "react";

const ScrollPicker = ({ label, items, selected, onSelect, getKey, getLabel, disabled, placeholder }) => {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState("");
  const listRef = React.useRef(null);

  const filtered = items.filter(i =>
    getLabel(i).toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (item) => { onSelect(item); setOpen(false); setSearch(""); };

  React.useEffect(() => {
    if (open && selected && listRef.current) {
      const el = listRef.current.querySelector(".sp-item.active");
      if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [open]);

  return (
    <div className="sp-wrap">
      <label className="om-field-label">{label}</label>
      <button
        type="button"
        className={`sp-trigger ${disabled ? "sp-disabled" : ""} ${selected ? "sp-has-value" : ""}`}
        onClick={() => !disabled && setOpen(true)}
        disabled={disabled}
      >
        <span className="sp-value">
          {selected ? getLabel(selected) : <span className="sp-placeholder">{placeholder}</span>}
        </span>
        <span className="sp-arrow">▾</span>
      </button>

      {open && (
        <div className="sp-backdrop" onClick={() => { setOpen(false); setSearch(""); }}>
          <div className="sp-sheet" onClick={e => e.stopPropagation()}>
            <div className="sp-sheet-handle" />
            <div className="sp-sheet-header">
              <span className="sp-sheet-title">{label}</span>
              <button className="sp-sheet-close" onClick={() => { setOpen(false); setSearch(""); }}>✕</button>
            </div>
            <div className="sp-search-wrap">
              <span className="sp-search-icon">🔍</span>
              <input className="sp-search" placeholder={`Tìm ${label.toLowerCase()}...`}
                value={search} onChange={e => setSearch(e.target.value)} autoFocus />
              {search && <button className="sp-search-clear" onClick={() => setSearch("")}>✕</button>}
            </div>
            <div className="sp-list" ref={listRef}>
              {filtered.length === 0 ? (
                <div className="sp-empty">Không tìm thấy kết quả</div>
              ) : filtered.map(item => (
                <button key={getKey(item)} type="button"
                  className={`sp-item ${selected && getKey(selected) === getKey(item) ? "active" : ""}`}
                  onClick={() => handleSelect(item)}>
                  <span>{getLabel(item)}</span>
                  {selected && getKey(selected) === getKey(item) && <span className="sp-tick">✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScrollPicker;