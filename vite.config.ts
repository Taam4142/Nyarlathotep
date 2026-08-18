import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Cloudflare Pages serves the built output in `dist`; the `functions/` proxies are unaffected.
export default defineConfig({
  plugins: [react()],
  // sourcemap: Lighthouse flagged the bundle as unmapped (2026-08-07 audit).
  // Maps make production stack traces readable; they expose no secret (the
  // source is public on GitHub, and all keys live server-side in Pages env vars).
  build: { outDir: "dist", sourcemap: true },
  test: {
    environment: "node",
    // .tsx is for the new App-level smoke test (App.test.tsx), which opts into
    // jsdom per-file via a `// @vitest-environment jsdom` comment — the pure
    // src/lib/* tests stay on the faster "node" environment, unaffected.
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
