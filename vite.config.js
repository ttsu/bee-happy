import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { execSync } from "node:child_process";

const getCommitHash = () => {
  try {
    return execSync("git rev-parse --short=6 HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "nogit";
  }
};

const commitHash = getCommitHash();

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "icon_180.png", "icon_192.png", "icon_512.png"],
      injectManifest: {
        sourcemap: false,
      },
      manifest: {
        name: "Bee Happy",
        short_name: "Bee Happy",
        description: "Build and manage a thriving bee colony.",
        theme_color: "#1b2838",
        background_color: "#1b2838",
        display: "standalone",
        start_url: "./",
        icons: [
          {
            src: "icon_192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon_512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash),
  },
  optimizeDeps: {
    exclude: ["excalibur"],
  },
  build: {
    assetsInlineLimit: 0,
    sourcemap: true,
    rollupOptions: {
      output: {
        format: "es",
      },
    },
  },
});
