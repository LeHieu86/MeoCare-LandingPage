import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { getPushState, enablePush, isStandalone } from "../../utils/push";

/**
 * Banner TỰ HIỆN mời bật thông báo — chiến lược "nhắc bền bỉ + đúng lúc":
 *  - Tự nổi khi mở PWA đã cài (standalone) hoặc vừa cài xong ('appinstalled').
 *  - "Để sau" chỉ hoãn trong PHIÊN hiện tại (sessionStorage) → lần mở app sau lại mời,
 *    nên khách khó quên (khác với snooze dài ngày).
 *  - Lắng nghe event 'push:prompt' để các nơi khác (vd: sau khi ĐẶT DỊCH VỤ GIỮ MÈO)
 *    mời MẠNH đúng lúc khách đang cần — bỏ qua "Để sau" của phiên vì đây là lúc cao điểm.
 *
 * LƯU Ý: trình duyệt KHÔNG cho bật 0-chạm — xin quyền phải nằm trong 1 cú chạm của khách.
 * Ép quá tay khiến khách bấm "Chặn" ở popup gốc = mất VĨNH VIỄN, nên chỉ nhắc bền bỉ.
 */
const DISMISS_KEY = "pushPromptDismissed"; // sessionStorage → reset mỗi phiên

const DEFAULT_DESC =
  "Nhận lời chào mỗi sáng và tin khi bé mèo của bạn được cho ăn — hiện ngay trên màn hình điện thoại.";

const PushAutoPrompt = () => {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [desc, setDesc] = useState(DEFAULT_DESC);

  const maybeShow = useCallback(async ({ force = false, ignoreDismiss = false, message = null } = {}) => {
    const st = await getPushState();
    if (!st.supported || st.subscribed || st.permission === "denied") return;
    // Auto (không force) chỉ hiện khi mở từ PWA đã cài.
    if (!force && !isStandalone()) return;
    // "Để sau" trong phiên → bỏ qua trừ khi là lời mời cao điểm (ignoreDismiss).
    if (!ignoreDismiss && sessionStorage.getItem(DISMISS_KEY)) return;
    setDesc(message || DEFAULT_DESC);
    setShow(true);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => maybeShow({ force: false }), 1200);
    const onInstalled = () => maybeShow({ force: true, ignoreDismiss: true });
    const onPrompt = (e) => maybeShow({ force: true, ignoreDismiss: true, message: e.detail?.message });
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("push:prompt", onPrompt);
    return () => {
      clearTimeout(t);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("push:prompt", onPrompt);
    };
  }, [maybeShow]);

  const handleEnable = async () => {
    setBusy(true);
    try {
      await enablePush(); // xin quyền NGAY trong cú chạm này (thoả ràng buộc trình duyệt)
      toast.success("Đã bật thông báo! Bạn sẽ nhận tin từ MeoCare ngay trên điện thoại 🎉");
      setShow(false);
    } catch (e) {
      toast.error(e.message || "Không bật được thông báo.");
      setShow(false); // lỗi/từ chối → ẩn, không làm phiền tiếp trong phiên
    } finally {
      setBusy(false);
    }
  };

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1"); // chỉ hoãn trong phiên này
    setShow(false);
  };

  if (!show) return null;

  return (
    <div style={S.wrap} role="dialog" aria-label="Bật thông báo">
      <div style={S.card}>
        <div style={S.bell}>🔔</div>
        <div style={S.text}>
          <div style={S.title}>Bật thông báo MeoCare?</div>
          <div style={S.desc}>{desc}</div>
        </div>
        <div style={S.actions}>
          <button style={S.btnGhost} onClick={dismiss} disabled={busy}>Để sau</button>
          <button style={S.btnPrimary} onClick={handleEnable} disabled={busy}>
            {busy ? "Đang bật..." : "Bật ngay"}
          </button>
        </div>
      </div>
    </div>
  );
};

const S = {
  wrap: {
    position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 9999,
    display: "flex", justifyContent: "center",
    padding: "12px 12px calc(12px + env(safe-area-inset-bottom))",
    pointerEvents: "none",
  },
  card: {
    pointerEvents: "auto", width: "100%", maxWidth: 440,
    background: "#fff", borderRadius: 16, padding: 16,
    boxShadow: "0 8px 30px rgba(0,0,0,0.18)", border: "1px solid #ffe0ec",
    display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12,
    fontFamily: "'Nunito', sans-serif",
  },
  bell: { fontSize: 28, lineHeight: 1 },
  text: { flex: "1 1 200px", minWidth: 0 },
  title: { fontWeight: 800, fontSize: 15, color: "#1f2937", marginBottom: 2 },
  desc: { fontSize: 12.5, color: "#6b7280", lineHeight: 1.45 },
  actions: { display: "flex", gap: 8, marginLeft: "auto" },
  btnGhost: {
    padding: "9px 14px", borderRadius: 10, border: "1px solid #e5e7eb",
    background: "#fff", color: "#6b7280", fontWeight: 700, fontSize: 13, cursor: "pointer",
  },
  btnPrimary: {
    padding: "9px 18px", borderRadius: 10, border: "none",
    background: "linear-gradient(135deg,#FF6B9D,#FF9B71)", color: "#fff",
    fontWeight: 800, fontSize: 13, cursor: "pointer",
  },
};

export default PushAutoPrompt;
