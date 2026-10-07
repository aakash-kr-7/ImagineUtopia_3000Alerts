import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  cacheDir: "runtime/node_modules/.vite",
  plugins: [react()],
  build: {
    outDir: "dist/client",
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ["recharts"],
          validation: ["zod"],
          documents: ["papaparse", "fflate"],
        },
      },
    },
  },
  server: { host: "127.0.0.1" },
});
