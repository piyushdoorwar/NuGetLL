import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Builds into ../dist/webview with stable file names so the extension can
// reference index.js / index.css without hashing.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "../dist/webview",
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        entryFileNames: "index.js",
        chunkFileNames: "[name].js",
        assetFileNames: "index.[ext]"
      }
    }
  }
});
