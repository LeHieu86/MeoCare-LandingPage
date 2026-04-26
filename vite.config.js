import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa"; // ✅ Thêm dòng này

export default defineConfig({
  plugins: [
    react(),
    // ✅ Thêm đoạn cấu hình PWA này
    VitePWA({
      registerType: 'autoUpdate', // Tự động cập nhật khi bạn đẩy code mới lên host
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
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});