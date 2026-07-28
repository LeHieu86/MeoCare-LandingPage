import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import {
  getPushState,
  enablePush,
  disablePush,
  isIosNeedsInstall,
} from "../../utils/push";

/**
 * Card "Thông báo đẩy" trong trang Tài khoản — cho khách bật/tắt Web Push.
 * Việc xin quyền BẮT BUỘC chạy sau cú click (ràng buộc trình duyệt) nên logic
 * nằm trong handler onClick, không tự động.
 */
const PushOptIn = () => {
  const [state, setState] = useState(null); // { supported, iosNeedsInstall, permission, subscribed }
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setState(await getPushState());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleEnable = async () => {
    setBusy(true);
    try {
      await enablePush();
      toast.success("Đã bật thông báo! Bạn sẽ nhận tin từ MeoCare ngay trên điện thoại 🎉");
      await refresh();
    } catch (e) {
      toast.error(e.message || "Không bật được thông báo.");
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    try {
      await disablePush();
      toast.success("Đã tắt thông báo trên thiết bị này.");
      await refresh();
    } catch (e) {
      toast.error(e.message || "Lỗi khi tắt thông báo.");
    } finally {
      setBusy(false);
    }
  };

  if (!state) return null; // đang dò trạng thái

  const muted = { fontSize: 13, margin: 0, lineHeight: 1.5 };

  return (
    <div className="cl-card">
      <h3 className="ai-section-title">🔔 Thông báo đẩy</h3>

      {/* Không hỗ trợ (trình duyệt cũ / iOS chưa cài PWA) */}
      {!state.supported && (
        isIosNeedsInstall() ? (
          <p className="cl-text-muted" style={muted}>
            Trên iPhone/iPad: bấm <b>Chia sẻ</b> → <b>Thêm vào Màn hình chính</b>, rồi mở
            MeoCare <b>từ icon</b> vừa tạo để bật thông báo (yêu cầu iOS 16.4 trở lên).
          </p>
        ) : (
          <p className="cl-text-muted" style={muted}>
            Trình duyệt hoặc thiết bị này không hỗ trợ thông báo đẩy.
          </p>
        )
      )}

      {/* Có hỗ trợ — quyền bị người dùng chặn trước đó */}
      {state.supported && state.permission === "denied" && (
        <p className="cl-text-muted" style={muted}>
          Bạn đã chặn thông báo cho trang này. Hãy vào cài đặt trình duyệt (biểu tượng 🔒
          cạnh địa chỉ web) → cho phép Thông báo, rồi tải lại trang.
        </p>
      )}

      {/* Có hỗ trợ — đang bật */}
      {state.supported && state.subscribed && state.permission !== "denied" && (
        <>
          <p className="cl-text-muted" style={muted}>
            ✅ Đang bật. Bạn sẽ nhận lời chào mỗi ngày và thông báo khi bé mèo được cho ăn.
          </p>
          <button
            className="cl-btn cl-btn-ghost"
            onClick={handleDisable}
            disabled={busy}
            style={{ marginTop: 12, width: "100%" }}
          >
            {busy ? "Đang xử lý..." : "🔕 Tắt thông báo"}
          </button>
        </>
      )}

      {/* Có hỗ trợ — chưa bật */}
      {state.supported && !state.subscribed && state.permission !== "denied" && (
        <>
          <p className="cl-text-muted" style={muted}>
            Nhận lời chào mỗi sáng và thông báo khi bé mèo của bạn được cho ăn — hiện ngay
            trên màn hình điện thoại, kể cả khi bạn không mở app.
          </p>
          <button
            className="cl-btn cl-btn-ghost"
            onClick={handleEnable}
            disabled={busy}
            style={{ marginTop: 12, width: "100%" }}
          >
            {busy ? "Đang xử lý..." : "🔔 Bật thông báo"}
          </button>
        </>
      )}
    </div>
  );
};

export default PushOptIn;
