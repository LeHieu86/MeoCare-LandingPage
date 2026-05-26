import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa"; // ✅ Thêm dòng này

export default defineConfig({
  plugins: [
    react(),
    // ✅ Thêm đoạn cấu hình PWA này
    VitePWA({
      // 'prompt' = app tự quyết định khi nào reload,
      // ta sẽ show toast → auto reload sau vài giây
      registerType: 'prompt',
      workbox: {
        // skipWaiting: false (mặc định) — ta dùng updateServiceWorker(true) để kích hoạt
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
      },
      manifest: {
        name: 'Meo Care - Khách sạn mèo',
        short_name: 'Meo Care',
        description: 'Hệ thống giữ mèo & mua sắm phụ kiện',
        theme_color: '#FF9B71',     // Màu cam chủ đạo
        background_color: '#FFF8F0', // Màu nền kem
        display: 'standalone',       // Ẩn thanh URL, trông như App thật
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.png', 
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png', 
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png', 
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable' // Dùng cho ảnh nền khi mở app trên Android/iOS
          }
        ]
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-pdf":    ["html2canvas", "jspdf"],
          "vendor-socket": ["socket.io-client"],
          "vendor-react":  ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      // Proxy go2rtc cho dev — giống hệt nginx prod, để test stream qua /go2rtc/
      "/go2rtc": {
        target: "http://localhost:1984",
        changeOrigin: true,
        ws: true, // WebSocket proxy
        rewrite: (path) => path.replace(/^\/go2rtc/, ""),
      },
    },
  },
});