/**
 * push.js — Web Push phía client: xin quyền, subscribe với VAPID key, lưu về backend.
 * Dùng chung `api` (tự gắn JWT nếu đã đăng nhập → backend ghép user_id để gửi
 * thông báo cho ăn đúng chủ mèo). Khách chưa đăng nhập vẫn subscribe được (nhận lời chào).
 */

import api from "./api";

export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
    window.navigator.standalone === true
  );
}

export function isIos() {
  const ua = navigator.userAgent || "";
  return /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** iOS chỉ push được khi PWA đã "Thêm vào Màn hình chính" (standalone) & iOS ≥ 16.4. */
export function isIosNeedsInstall() {
  return isIos() && !isStandalone();
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function currentSubscription() {
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

/** Trạng thái để UI hiển thị đúng nút (bật / tắt / cần cài PWA / không hỗ trợ). */
export async function getPushState() {
  if (!isPushSupported()) {
    return { supported: false, iosNeedsInstall: isIosNeedsInstall(), permission: "unsupported", subscribed: false };
  }
  let subscribed = false;
  try {
    subscribed = !!(await currentSubscription());
  } catch { /* ignore */ }
  return { supported: true, iosNeedsInstall: false, permission: Notification.permission, subscribed };
}

/** Bật thông báo — PHẢI gọi sau cú click của khách (ràng buộc trình duyệt). */
export async function enablePush() {
  if (!isPushSupported()) throw new Error("Trình duyệt không hỗ trợ thông báo đẩy.");
  if (isIosNeedsInstall()) throw new Error('iOS: hãy bấm "Chia sẻ → Thêm vào Màn hình chính", mở app từ icon rồi bật lại.');

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Bạn chưa cho phép nhận thông báo.");

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const { key } = await api.get("/push/vapid-public-key");
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });
  }
  await api.post("/push/subscribe", { subscription: sub.toJSON() });
  return true;
}

/** Đồng bộ lặng lẽ user_id sau khi đăng nhập (không xin quyền, không mở popup). */
export async function syncPushUser() {
  try {
    if (!isPushSupported() || Notification.permission !== "granted") return;
    const sub = await currentSubscription();
    if (sub) await api.post("/push/subscribe", { subscription: sub.toJSON() });
  } catch { /* ignore */ }
}

/** Logout → gỡ liên kết user (giữ subscription để vẫn nhận lời chào chung). */
export async function detachPush() {
  try {
    const sub = await currentSubscription();
    if (sub) await api.post("/push/detach", { endpoint: sub.endpoint });
  } catch { /* ignore */ }
}

/** Tắt hẳn thông báo trên thiết bị này. */
export async function disablePush() {
  try {
    const sub = await currentSubscription();
    if (sub) {
      await api.post("/push/unsubscribe", { endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
  } catch { /* ignore */ }
  return true;
}
