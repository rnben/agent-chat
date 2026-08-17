import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    host: "0.0.0.0", // 内网其他机器可访问；仅本机调试可改 127.0.0.1
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
        xfwd: true, // 转发真实客户端 IP（X-Forwarded-For），后端白名单/隔离按它判定
      },
    },
  },
});
