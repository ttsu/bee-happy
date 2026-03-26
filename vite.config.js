import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
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
