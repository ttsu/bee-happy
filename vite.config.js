import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

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
const packageVersion = JSON.parse(readFileSync("./package.json", "utf-8")).version;

const emitVersionJson = () => ({
  name: "emit-version-json",
  generateBundle() {
    this.emitFile({
      type: "asset",
      fileName: "version.json",
      source: JSON.stringify({
        commit: commitHash.slice(0, 6),
        releaseId: packageVersion,
      }),
    });
  },
});

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    emitVersionJson(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["favicon.ico", "icon_180.png", "icon_192.png", "icon_512.png"],
      injectManifest: {
        sourcemap: false,
        globIgnores: ["**/version.json"],
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
