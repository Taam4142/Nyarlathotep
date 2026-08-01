# Changelog

All notable changes to Yog-Sothoth (formerly TOR-Extract). Format loosely follows [Keep a Changelog](https://keepachangelog.com/).
There are no version tags yet, so released history below is grouped by date and git commit.

## [Unreleased]

### Added
- **Cancel button** on the progress overlay — a running OCR/extraction can now be stopped. An
  `AbortController` threads through every engine call; multi-page loops stop between pages; a cancelled run
  reports "Extraction cancelled" instead of an error. (RISK_REVIEW R10.)
- **Proxy hardening** (`functions/api/_guard.js`) — the three API proxies now enforce an origin allow-list,
  a model allow-list, a body-size cap (8 MB), a per-IP rate limit (KV-backed), and an optional shared
  secret. Every layer degrades gracefully, so landing this does not break an existing deploy — activate the
  layers by setting `ALLOWED_ORIGINS` (and optionally binding a `RATE_LIMIT` KV namespace, `PROXY_SECRET`,
  or `ALLOWED_MODELS`) in Cloudflare. (RISK_REVIEW R6.)
- **Centralized model registry** (`src/lib/models.ts`) — Claude and Gemini model IDs/labels now live in one
  place instead of scattered literals in `App.tsx`. Refreshed to the current lineup: Claude
  `claude-sonnet-5` / `claude-opus-5` (was `claude-sonnet-4-20250514` / `claude-opus-4-5`) and Gemini
  `gemini-3.6-flash` / `gemini-3.1-pro` (was `gemini-2.0-flash` / `gemini-2.5-pro-preview-06-05`) — the old
  IDs predated the current models and could reject. (RISK_REVIEW A1.)
- **Retry/backoff on all API calls** (`src/lib/net.ts` `fetchWithRetry`) — exponential backoff with jitter,
  honoring `Retry-After`, on 408/425/429/5xx/529 and transient network errors, across every extraction and
  OCR engine (Claude, Gemini, Typhoon, Google Vision). Takes an `AbortSignal` (groundwork for cancellation).
  (RISK_REVIEW R9.)
- **Typhoon OCR engine** (default) — Thai-specialized, free tier via the `/api/typhoon` proxy; usable both
  standalone (OCR → heuristic rows) and as an OCR feeder for the Claude/Gemini engines.
- **Google Cloud Vision** OCR feeder (via `functions/api/vision.js`) — free tier 1,000 pages/month, good
  Thai; chosen over OCR.space, which external Thai-OCR research rated weak for Thai.
- `OCR_RESEARCH.md` — survey of the OCR landscape and the lineup decision.

### Changed
- **Typhoon OCR model → `typhoon-ocr` (v1.5).** The default OCR engine now targets Typhoon OCR 1.5, the
  current model. The old `typhoon-ocr-preview` (v1) was deprecated on 2025-12-31, so it was likely already
  failing. The response unwrap (`extractTyphoonText`) is format-agnostic, so it handles v1.5's output
  whether it's the `{"natural_text": …}` envelope or plain layout-aware Markdown.
- **Migrated to a Vite + React + TypeScript build.** The app is now bundled (minified, code-hashed,
  cached) instead of compiled in the browser by Babel-standalone on every load — much faster first paint.
  The single `index.html` was decomposed into typed, unit-tested modules in `src/lib/` (`pdf`, `ocr`,
  `extract`, `constants`, `types`), the UI in `src/App.tsx`, and styles in `src/styles.css`; added Vitest.
  Behavior and look are unchanged. **Deploy change:** the Cloudflare Pages build command is now
  `npm run build` with output directory `dist`.
- **Migrated hosting from Vercel to Cloudflare Pages.** Proxies moved to Pages Functions
  (`functions/api/{claude,typhoon,vision}.js`); the app is served as `index.html`; removed `vercel.json`
  and the `api/` folder. Default engine is now Typhoon.
- **Renamed the project to Yog-Sothoth** — app title/brand, all docs, and the GitHub repo
  (`Taam4142/TOR-Extract` → `Taam4142/Yog-Sothoth`); "TOR" kept only where it means the document type.
- **Minimal auto light/dark redesign** — the UI now follows the viewer's `prefers-color-scheme` (light is
  the new default), via a light-default + dark-override CSS token system; amber-tinted borders neutralized.

### Removed
- **Google Document AI** OCR path (paid + heavy setup) — engine option, credential panel, and its code.

### Fixed
- **Typhoon OCR one-giant-row bug** — the `typhoon-ocr` model returns its result as a JSON envelope
  `{"natural_text": "…\n…"}` with escaped newlines, not plain text. That whole blob was fed to the row
  splitter, collapsing a page into a single row full of literal `\n` symbols. `extractTyphoonText`
  (`src/lib/typhoon.ts`) now unwraps `natural_text` (restoring real newlines), so Typhoon splits into
  per-clause rows exactly like the Browser-OCR path — with better OCR quality.
- **R5** — `detectPDFType` now samples up to 5 pages (summing extracted-text length, early-exiting on a
  real text layer) instead of page 1 only, so a scanned cover no longer misclassifies a digital PDF.
- **R11** — Gemini extraction is pinned to JSON output (`responseMimeType: "application/json"`), so it
  stops wrapping results in prose that trips the parser.
- **R2** — large-PDF crash: base64 encoding is now chunked (`fileToBase64`), replacing
  `btoa(String.fromCharCode(...))` which overflowed the call stack on big PDFs.
- **R3 / R4** — extraction now uses a robust `parseJsonArray` that survives markdown fences, surrounding
  prose, trailing commas, and truncated responses (salvaging complete rows) instead of failing outright.
- **R1** — removed the dead, broken `ocrPDFClaude` function.
- **Cloudflare deploy redirect loop** — renamed the app to `index.html` and removed the `_redirects`
  catch-all, which caused `ERR_TOO_MANY_REDIRECTS` (it collided with Cloudflare Pages' clean-URL handling).
  README now spells out that the project must be a **Pages** deployment, not Workers.

## [0.1.0] - 2026-07-27

First tagged release (pre-release). Captures the current working tool — four extraction engines
(Browser OCR, Claude, Gemini) with selectable OCR feeders, editable compliance matrix, comply library,
and `.xlsx` export — plus the project's first proper documentation set. Marked pre-release because known
bugs/security items are still open; see [`RISK_REVIEW.md`](RISK_REVIEW.md).

### Added
- Project documentation: `README.md`, `ROADMAP.md`, `RISK_REVIEW.md`, and this `CHANGELOG.md`.

### Changed
- Reconciled `SKILL.md` (and light touch-ups to `CLAUDE.md`) to describe the current four-engine reality
  instead of the earlier Claude-only, two-engine tool.

_The dated entries below are the development history leading up to this release._

---

## 2026-05-30

### Added
- **Browser OCR engine** (`a547bdd`) — Tesseract.js runs fully client-side (Thai+English) with heuristic
  row-splitting, giving a zero-key, offline, no-billing path. Restructured the engine selection around it.
- **Test Connection button** (`a2b7cba`) for Claude and Gemini, with plain-language error mapping
  (quota, invalid key, missing credits, proxy-not-found).

### Fixed
- **Deprecated Gemini model** (`a2b7cba`) updated to a working model string.

## 2026-05-29

### Added
- **Initial release** (`dc595e9`) — single-file React app: PDF upload, digital-vs-scanned detection,
  Claude extraction of verbatim requirements, editable compliance matrix, comply library of standard
  responses, and `.xlsx` export.
- **AI analysis as selectable options** (`b3de40c`) — reworked extraction into configurable engine/OCR
  options rather than a single fixed path; expanded `CLAUDE.md` prompt guidance.
- **Gemini support + Claude proxy** (`0928914`) — added the `api/claude.js` serverless proxy (keeps
  `ANTHROPIC_API_KEY` server-side) and a direct-from-browser Gemini path; added `vercel.json`.

### Fixed
- **Vercel deploy** (`2ee7c5d`) — bypassed the build process so the static HTML app deploys cleanly;
  added `SKILL.md` and `CLAUDE.md`.
