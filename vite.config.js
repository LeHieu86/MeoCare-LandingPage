import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,        // 👈 BẮT BUỘC
    port: 5173,
  },
});
