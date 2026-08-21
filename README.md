# Nyarlathotep

[![CI](https://github.com/Taam4142/Nyarlathotep/actions/workflows/ci.yml/badge.svg)](https://github.com/Taam4142/Nyarlathotep/actions/workflows/ci.yml)

> A **TOR Compliance Matrix** tool (formerly *TOR-Extract*).

Turn a Thai/English **Terms of Reference (TOR)** PDF into an editable **compliance matrix**, then export
it as a signed-off `.xlsx` ready for bid submission.

> **Core law:** the AI copies requirement text **verbatim** — it never translates, paraphrases, or
> invents. A human reviews every row and sets the compliance status. See [`CLAUDE.md`](CLAUDE.md).

## Pipeline

```
TOR PDF → detect digital vs scanned → [OCR if scanned] → AI extracts verbatim clauses to JSON
        → user edits Status + Remarks → export .xlsx
```

## Extraction engines

Pick an engine from the top-bar dropdown. **Typhoon is the default** — the free, Thai-first path. For a
**scanned** PDF under Claude/Gemini, you also pick an OCR feeder (Typhoon, Google Vision, Tesseract, Claude
Vision, or Gemini Vision).

| Engine | Free? | Thai | How it works |
| ------ | ----- | ---- | ------------ |
| **✦ Typhoon** *(default)* | ✅ free tier (20 req/min) | **Best — Thai-tuned** | Reads each page via the `/api/typhoon` proxy; rows split heuristically (or structured by Claude/Gemini when used as a feeder). |
| **🆓 Browser OCR** | ✅ 100% free, offline | Weak | Tesseract.js in the browser + heuristic row-splitting. No key, works offline. |
| **⚡ Claude** | ❌ paid API | Good | Claude reads the PDF / page images and structures to JSON via the `/api/claude` proxy. Highest verbatim fidelity. |
| **✦ Gemini** | ~ free tier | Good | Gemini reads the PDF / page images directly from the browser (key held in-session). |

**OCR feeders** (scanned PDF under Claude/Gemini): **Typhoon** (Thai, via proxy) · **Google Vision** (free
tier 1,000 pages/mo, good Thai, via proxy) · **Tesseract** (offline) · **Claude Vision** · **Gemini
Vision**.

> Google Document AI was removed in v0.2.0 (paid + heavy setup). See [`OCR_RESEARCH.md`](OCR_RESEARCH.md)
> for the full survey of OCR options and why this lineup was chosen.

## Tech stack

- **Vite + React 18 + TypeScript.** The app is bundled (minified, cached) — no in-browser compile.
  Source lives in [`src/`](src): `App.tsx` (UI) imports typed, unit-tested logic from
  [`src/lib/`](src/lib) (`pdf.ts`, `ocr.ts`, `extract.ts`, `net.ts`, `models.ts`, `typhoon.ts`,
  `constants.ts`, `types.ts`); styles in
  [`src/styles.css`](src/styles.css). `npm run build` emits `dist/`.
- **npm dependencies** (bundled, not CDN): `react`/`react-dom`, `pdfjs-dist`, `tesseract.js`, `exceljs`
  (Excel export — dynamic-imported so it code-splits out of the initial bundle), `@dnd-kit/*` (row
  drag-reorder). Fonts (Inter / Sarabun / JetBrains Mono) load from Google Fonts via `index.html`.
- **Serverless proxies (Cloudflare Pages Functions):** [`functions/api/claude.js`](functions/api/claude.js),
  [`functions/api/typhoon.js`](functions/api/typhoon.js), and [`functions/api/vision.js`](functions/api/vision.js)
  forward to the Anthropic / Typhoon / Google Vision APIs and inject the keys server-side, so those keys
  never reach the browser.
- **Hosting:** Cloudflare Pages builds the app (`npm run build`) and serves `dist/`; `/api/*` is handled
  by the Functions (which run alongside the built output). No client-side routing.

## Setup & deploy (Cloudflare Pages)

1. Create a free **Cloudflare** account.
2. Dashboard → **Workers & Pages → Create**. Choose the **Pages** tab (⚠️ **not** Workers) →
   **Connect to Git** → select `Taam4142/Nyarlathotep`. This must be a **Pages** project — a Workers
   project runs `wrangler deploy` and cannot serve the `functions/` dir or the static file (see
   Troubleshooting).
3. Build settings: **Framework preset = None** (or Vite), **Build command = `npm run build`**, **Build
   output directory = `dist`**. (⚠️ If you previously used `exit 0` / `/`, you **must** change it to this,
   or the deploy will publish the unbuilt source and the page will fail to load.)
4. **Settings → Environment variables** (add to Production *and* Preview):
   - `ANTHROPIC_API_KEY` — from `console.anthropic.com` (a claude.ai subscription is **not** API credits).
   - `TYPHOON_API_KEY` — a free key from `opentyphoon.ai` (verify current free-tier limits there).
   - `GOOGLE_VISION_API_KEY` *(optional — only for the Google Vision feeder)* — a Cloud Vision API key
     (Google Cloud account + card; free tier 1,000 pages/month).
5. **Deploy.** Note the `*.pages.dev` URL. Functions under `functions/` are picked up automatically.
6. **Continuous deployment is automatic.** Once the project is connected to Git, every push to `master`
   triggers a fresh build + deploy — no manual step. Pushes to other branches produce **preview**
   deployments at their own `*.pages.dev` subdomain. (To redeploy without a push — e.g. after changing an
   env var — use **Deployments → latest → ⋯ → Retry deployment**.)
7. Optional local dev of the Functions: `npx wrangler pages dev . --compatibility-date=2024-01-01` (or run
   `npm run build` first and point wrangler at `dist`). Needed to exercise the `/api/*` proxies locally.
8. Optional **custom domain**: **your Pages project → Custom domains → Set up a domain**. If the domain's
   DNS is already on Cloudflare it's one click; otherwise add the shown CNAME. After it's live, **add the
   new origin to `ALLOWED_ORIGINS`** (below) or the app will 403 its own API calls from that domain.

> 🔒 **Secure the proxies before you share the URL.** The `/api/*` routes are public and spend your API
> credits. At minimum set `ALLOWED_ORIGINS` and bind a `RATE_LIMIT` KV namespace — full click-by-click
> steps (with `curl` checks) are in [`DEPLOY.md`](DEPLOY.md).

### Troubleshooting

**Build log shows `npx wrangler deploy` and `Could not detect a directory containing static files`.**
The project was created as a **Workers** project, not **Pages**. `wrangler deploy` is the Workers command;
it ignores the `functions/` file-based routing and the static file. Fix: delete that project and create a
**Pages** project (step 2). Do not set a custom "deploy command" — a Pages project just uploads the output
directory and runs `functions/` automatically; there is no `wrangler deploy` step.

The Gemini key is entered in the UI at runtime (held in React state only, cleared on reload). Typhoon and
Google Vision keys stay server-side in the Cloudflare env vars above.

## Running locally

Requires **Node 20+**. Install once, then run the dev server:

```bash
npm install
npm run dev      # http://localhost:5173 — hot-reloading dev server
```

Other scripts: `npm run build` (→ `dist/`), `npm run preview` (serve the build), `npm run typecheck`,
`npm run test` (Vitest). Caveats:

- The **Typhoon** and **Claude** engines and the **Google Vision** feeder call `/api/*`, which only exist
  on the deployed Cloudflare site (or via `npx wrangler pages dev` against the build). Locally they fail
  with a network error.
- **Browser OCR** and **Gemini** work fully locally.

## Excel output

What the exported `.xlsx` contains, from [`src/lib/xlsx.ts`](src/lib/xlsx.ts). Useful when a
reviewer asks why a column is missing, or when something downstream parses the file.

**Sheet structure** — title row (project name, merged, 16 pt bold), a generated-on subtitle,
a spacer, then the header row. The view is **frozen below the header**, so column titles stay
visible while scrolling a long matrix.

**Columns, in order.** Three are conditional, which is why the letters shift:

| # | Column | Present |
| ---: | --- | --- |
| 1 | Item No. | always |
| 2 | Reference | always |
| 3 | Requirement / Specification | always — Thai, verbatim |
| — | English Translation | only if the translation toggle is on **and** some row has one |
| — | Category | only if the category toggle is on |
| — | Compliance Status | always — cell text colour-coded per status |
| — | Remarks | always |
| — | Verified By · Date | always — pre-filled from the "Verified by…" field |
| — | Figure | only if at least one row has a snipped figure |

**Thai font.** Every cell is set to **TH Sarabun New** up front, so Thai renders on open with
no manual font step. A font cannot be *embedded* in a `.xlsx`, so a machine without it
installed gets a substitute — Thai stays legible either way.

**Filename:** `<project>_Compliance_Matrix_<YYYY-MM-DD>.xlsx`.

> Status colours come from `STAT_COLORS` in [`src/lib/constants.ts`](src/lib/constants.ts),
> shared with the on-screen matrix so the two cannot drift apart. Don't edit one without the
> other.

---

## Known limitations

- **Local-only persistence** — the matrix autosaves to `localStorage` and restores on reload;
  **Save / Load .json** moves it between machines. There is no account or server-side sync, so
  clearing the browser, or opening the tool on another device without the JSON, loses it.
- **Large PDFs** — very long TORs (~100+ pages) can exceed model document limits.
- **Browser OCR / heuristic rows** — Tesseract and the Typhoon standalone path split rows heuristically
  (review clause boundaries); for clean rows, use Typhoon as a feeder under Claude/Gemini.
- **Excel Thai font** — the export sets *TH Sarabun New* on every cell automatically (via ExcelJS), so
  Thai renders on open with no manual step. A font can't be *embedded* in a `.xlsx`, so if a reviewer's PC
  doesn't have that font installed, Excel substitutes a similar one (still legible Thai).

See [`RISK_REVIEW.md`](RISK_REVIEW.md) for known bugs/security items and [`ROADMAP.md`](ROADMAP.md) for
what's planned.

## Repository layout

| Path                         | Purpose                                                        |
| ---------------------------- | -------------------------------------------------------------- |
| `index.html`                 | Vite entry (mounts `src/main.tsx`).                            |
| `src/App.tsx`                | Root UI component (state + render).                            |
| `src/lib/`                   | Typed, unit-tested logic: pdf, ocr, extract, net (retry), models, typhoon, tables, review, history, snip, storage, xlsx, textquality, constants, types. |
| `src/App.test.tsx`           | UI smoke tests (Testing Library + jsdom).                      |
| `src/styles.css`             | Design tokens + all component styles.                          |
| `tools/fixtures/`            | Generators + the two sample TOR PDFs used by `TESTING.md` (isolated `package.json` — dev-only, never bundled). |
| `functions/api/claude.js`    | Cloudflare Pages Function — proxy to the Anthropic API.         |
| `functions/api/typhoon.js`   | Cloudflare Pages Function — proxy to the Typhoon OCR API.       |
| `functions/api/vision.js`    | Cloudflare Pages Function — proxy to the Google Vision API.     |
| `functions/api/_guard.js`    | Shared proxy hardening — origin/model allow-list, body cap, rate limit (R6). |
| `DEPLOY.md`                  | Cloudflare deploy + proxy-hardening click-steps.               |
| `CLAUDE.md`                  | Prompt engineering + AI behaviour rules.                       |
| `OCR_RESEARCH.md`            | Survey of OCR options + the lineup decision.                   |
| `ROADMAP.md`                 | Phased development plan + deferred items.                      |
| `RISK_REVIEW.md`             | Known bugs, security, robustness risks — and the **verification limits** (what can't be tested in a sandbox). |
| `TESTING.md`                 | How this project is verified: automated suite, sample PDFs, manual walkthrough, definition of done. |
| `A11Y_PLAN.md`               | Accessibility audit, phased plan, and a11y risk register.      |
| `LIGHTHOUSE_AUDIT.md`        | Lighthouse baseline (2026-08-07), findings, what shipped, and what awaits sign-off. |
| `DESIGN_TOKENS.md`           | **Canonical palette + sizing reference**: every colour token, the real contrast matrix, target sizes, and the rules that govern changes. |
| `RESPONSIVE_PLAN.md`         | Mobile/responsive plan — what breaks below 1500px (incl. a live desktop bug), the breakpoint design, and phasing. |
| `CHANGELOG.md`               | Version history.                                               |
