import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const fmt = (n) => (n || 0).toLocaleString("vi-VN") + "đ";

const VerifyInvoice = () => {
  const { invoiceNo } = useParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/sign/verify/${invoiceNo}`)
      .then((r) => r.json())
      .then((d) => { setResult(d); setLoading(false); })
      .catch(() => { setResult({ valid: false, error: "Không thể kết nối server" }); setLoading(false); });
  }, [invoiceNo]);

  return (
    <div style={styles.root}>
      <div style={styles.card}>
        <div style={styles.brand}>🐱 Meo Care</div>
        <div style={styles.title}>Xác thực hóa đơn</div>
        <div style={styles.invoiceNo}>#{invoiceNo}</div>

        {loading ? (
          <div style={styles.loading}>⏳ Đang xác thực...</div>
        ) : (
          <>
            <div style={{ ...styles.badge, background: result.valid ? "#f0fdf4" : "#fef2f2", border: `2px solid ${result.valid ? "#16a34a" : "#dc2626"}` }}>
              <div style={{ fontSize: 48 }}>{result.valid ? "✅" : "❌"}</div>
              <div style={{ ...styles.badgeText, color: result.valid ? "#16a34a" : "#dc2626" }}>
                {result.message || result.error}
              </div>
            </div>

            {result.valid && (
              <div style={styles.details}>
                <div style={styles.row}>
                  <span style={styles.label}>Khách hàng</span>
                  <span style={styles.val}>{result.customerName}</span>
                </div>
                <div style={styles.row}>
                  <span style={styles.label}>Tổng tiền</span>
                  <span style={{ ...styles.val, color: "#16a34a", fontWeight: 700 }}>{fmt(result.total)}</span>
                </div>
                <div style={styles.row}>
                  <span style={styles.label}>Ngày tạo</span>
                  <span style={styles.val}>{new Date(result.createdAt).toLocaleString("vi-VN")}</span>
                </div>
              </div>
            )}

            <div style={styles.footer}>
              Được ký bởi Meo Care · Powered by OpenSSL RSA-SHA256
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const styles = {
  root: { minHeight: "100vh", background: "#f9f7f5", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "system-ui, sans-serif" },
  card: { background: "#fff", borderRadius: 20, padding: "32px 28px", maxWidth: 420, width: "100%", boxShadow: "0 8px 32px rgba(0,0,0,.1)", textAlign: "center" },
  brand: { fontSize: 20, fontWeight: 900, marginBottom: 6 },
  title: { fontSize: 14, color: "#6b7280", marginBottom: 4 },
  invoiceNo: { fontSize: 22, fontWeight: 800, marginBottom: 20, color: "#1c1917" },
  loading: { padding: 40, color: "#6b7280" },
  badge: { borderRadius: 14, padding: "20px 16px", marginBottom: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 },
  badgeText: { fontSize: 15, fontWeight: 700, lineHeight: 1.4 },
  details: { background: "#f9f7f5", borderRadius: 12, padding: "14px 16px", textAlign: "left", marginBottom: 20, display: "flex", flexDirection: "column", gap: 10 },
  row: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14 },
  label: { color: "#6b7280" },
  val: { fontWeight: 600, color: "#1c1917" },
  footer: { fontSize: 12, color: "#a8a29e" },
};

export default VerifyInvoice;