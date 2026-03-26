import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
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
  plugins: [react()],
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
