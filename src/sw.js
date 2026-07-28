// Service worker tuỳ biến (vite-plugin-pwa strategy: injectManifest).
// Giữ nguyên hành vi cũ (precache + SPA fallback + luồng auto-update qua SKIP_WAITING)
// và THÊM Web Push: hiển thị thông báo đẩy ra khay hệ thống điện thoại + mở app khi bấm.

import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { clientsClaim } from "workbox-core";

// Cho phép app kích hoạt SW mới ngay (usePWAUpdate gọi updateServiceWorker(true) → postMessage).
self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST); // BẮT BUỘC có __WB_MANIFEST cho injectManifest
clientsClaim();

// SPA navigation fallback → index.html, chừa mọi request /api.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL("index.html"), { denylist: [/^\/api/] })
);

// ── Web Push ────────────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "MeoCare";
  const options = {
    body: data.body || "",
    icon: data.icon || "/logo.png?v=4",
    badge: data.badge || "/logo.png?v=4",
    data: { url: data.url || "/" },
    tag: data.tag || undefined,
    renotify: !!data.tag,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Đã có tab mở đúng trang → focus; nếu không → mở tab mới.
      for (const c of wins) {
        if (c.url.includes(url) && "focus" in c) return c.focus();
      }
      if (wins.length && "focus" in wins[0]) {
        await wins[0].focus();
        if ("navigate" in wins[0]) return wins[0].navigate(url);
        return;
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })()
  );
});
