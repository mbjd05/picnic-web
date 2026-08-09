import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: [
        "icons/apple-touch-icon.png",
        "icons/picnic-web.svg",
        "icons/picnic-web-192.png",
        "icons/picnic-web-512.png",
        "icons/picnic-web-maskable-512.png",
      ],
      manifest: {
        name: "Picnic Web",
        short_name: "Picnic Web",
        description: "Unofficial web interface for Picnic grocery browsing and ordering.",
        theme_color: "#e1171e",
        background_color: "#fafafa",
        lang: "nl",
        display: "standalone",
        start_url: "/",
        scope: "/",
        categories: ["food", "shopping", "utilities"],
        icons: [
          {
            src: "/icons/picnic-web.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "/icons/picnic-web-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/picnic-web-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/picnic-web-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,ico,png,webmanifest}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  root: rootDir,
  build: {
    outDir: "dist",
  },
  resolve: {
    alias: {
      "@": resolve(rootDir, "../../src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
        configure(proxy) {
          proxy.on("proxyReq", (proxyRequest) => {
            proxyRequest.setHeader("origin", "http://127.0.0.1:8787");
          });
        },
      },
    },
  },
});
