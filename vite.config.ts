import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Cloudflare Pages serves the built output in `dist`; the `functions/` proxies are unaffected.
export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist" },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
