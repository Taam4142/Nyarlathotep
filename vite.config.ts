import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Cloudflare Pages serves the built output in `dist`; the `functions/` proxies are unaffected.
export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist" },
  test: {
    environment: "node",
    // .tsx is for the new App-level smoke test (App.test.tsx), which opts into
    // jsdom per-file via a `// @vitest-environment jsdom` comment — the pure
    // src/lib/* tests stay on the faster "node" environment, unaffected.
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
