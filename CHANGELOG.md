# Changelog

All notable changes to Nyarlathotep (formerly Yog-Sothoth, formerly TOR-Extract). Format loosely follows [Keep a Changelog](https://keepachangelog.com/).
Tagged releases start at `v0.1.0`; older history below is grouped by date and git commit.

## [Unreleased]

### Added
- **The app now works on a phone.** Previously the matrix got 87 px of a 375 px screen (23 %) and only 2 of
  13 top-bar controls could be reached at all. Now: the sidebar is an off-canvas drawer below 1120 px, the
  top bar never clips, and below 700 px **the matrix renders as a card list** — one card per requirement,
  with the verbatim text full-width and readable at 15 px, Category and Status paired, and no sideways
  scrolling. The matrix holds **64 % of a phone screen** (about 70 % once the restored-session notice is
  dismissed). Desktop is unchanged at every step, measured against its pre-responsive baseline.
  Full detail and the measurements in [`RESPONSIVE_PLAN.md`](RESPONSIVE_PLAN.md).

### Fixed
- **Top-bar controls are no longer clipped away** (RESPONSIVE_PLAN R1). The bar needed 1505 px of width
  but sits inside an `overflow: hidden` container with no scroll, so anything past the viewport was
  simply unreachable — at 1280 px, an ordinary laptop width, **"Load .json" and "New" were completely
  hidden** with nothing on screen indicating they existed, and on a phone only 2 of 13 controls could be
  reached. The secondary actions (+ Row, Snip, Save/Load .json, New) now live in a **"⋯ More actions"
  menu** with Export kept inline, and the bar **wraps** instead of clipping. Intrinsic width 1505 → 1173 px;
  zero clipped controls at 375 / 1120 / 1280 px; desktop visually unchanged (still one 56 px line).

## [0.5.0] — 2026-08-19

**Checkpoint release: the last state before the responsive/mobile rewrite begins.** Cut deliberately so
there is a clean point to return to if that work is unwanted or goes wrong — the same reason `v0.4.0`
was cut before the accessibility pass. To roll back: `git checkout v0.5.0`, or redeploy this tag from
Cloudflare Pages.

Accessibility is complete for its scope in this release: the contrast guard's allowlist is **empty**, and
every `color`/`background` pairing in the stylesheet clears WCAG AA in both themes.


### Added
- **Automated contrast guard** (`src/lib/contrast.ts` + `contrast.test.ts`, 17 tests) — reads
  `styles.css` and asserts every real `color`/`background` pairing clears WCAG AA in both themes.
  It exists because a Lighthouse score structurally cannot catch this class of bug: Lighthouse audits the
  DOM present at audit time, so anything behind a closed modal, an inactive filter or an unshown banner is
  invisible to it. The maths is anchored against published WCAG reference pairs before any result is
  trusted. It found three dark-theme failures on its first run that neither the audit nor a manual review
  had spotted — including the primary action button at 4.47:1.
- **[`DESIGN_TOKENS.md`](DESIGN_TOKENS.md)** — canonical reference for every colour token and
  interactive size: full light/dark tables, the generated contrast matrix, measured target sizes, and the
  invariants that govern changes (notably that `STAT_COLORS` is shared with the Excel export and must
  never be edited to fix an on-screen problem).
- **[`LIGHTHOUSE_AUDIT.md`](LIGHTHOUSE_AUDIT.md)** and **[`RESPONSIVE_PLAN.md`](RESPONSIVE_PLAN.md)** —
  the 2026-08-07 audit baseline with its findings and phasing, and the measured mobile/responsive plan
  (nothing implemented yet).
- **Tooltips + clearer labels on the engine pickers** — the top-bar extraction-engine dropdown and the
  scanned-PDF OCR-feeder buttons (under Claude/Gemini) now show a one-line "why pick this" summary on
  hover, and the Claude/Gemini options in the top-bar dropdown gained a short suffix (`— Paid API` /
  `— Your key`) so the cost/key distinction is visible without hovering at all — tooltips are a bonus
  layer, not the only place the information lives. Sourced from one new registry
  (`EXTRACTION_ENGINES`/`OCR_FEEDERS` in `src/lib/models.ts`) so the label/tooltip text can't drift out of
  sync with itself across the two pickers.
- **Accessibility: keyboard focus visibility, screen-reader labels/live-regions, reduced motion.**
  Phases P1/P2/P3a of [`A11Y_PLAN.md`](A11Y_PLAN.md). Strictly additive — no feature or behaviour change;
  see that doc's §4 for the full verification log.
  - **Focus is now visible everywhere**, including the compliance-status and category dropdowns and the
    requirement/remarks editors, which previously had **no** focus indicator at all. One `:focus-visible`
    CSS rule; unchanged for mouse-clicked buttons, a small additive ring on mouse-clicked text fields
    (browsers apply `:focus-visible` to text inputs on click, not just keyboard — a real, if minor,
    visual delta, called out rather than glossed over).
  - **Every control now has a real accessible name** (project name, verified-by, search, the engine/model
    dropdowns, the Gemini key field, and each row's Ref/Requirement/Translation/Category/Status/Remarks) —
    placeholders stay exactly as they were.
  - **Live regions**: the extraction progress overlay and the info/warning/error banners now announce to
    screen readers (`role="status"`/`aria-live="polite"`, `role="alert"` on errors).
  - The figure lightbox gained `role="dialog"` + `aria-modal` + Escape-to-close, matching the existing
    modals; all table headers got `scope="col"`; the document's `lang` is now `en` (was `th`, though the
    UI is English — Thai is field content).
  - `prefers-reduced-motion` now stops/slows the brand pulse, progress bar, spinner, and modal fade for
    users who've set that OS preference; unchanged for everyone else.
  - **Secondary text darkened to pass AA contrast** (P3b): `--txt3` light `#98a1b3`→`#6a7790`,
    dark `#6b7484`→`#7a8393`. One token, ~27 call sites. **Superseded later in this same release** —
    those values were verified against white only and still failed the other four surfaces; see the
    contrast entry below for the corrected ones.
- **UI smoke tests** — `src/App.test.tsx` (Testing Library + jsdom, 6 tests): renders; key controls have
  accessible names; add row; edit a cell; bulk status-set; undo; search. The first automated coverage of
  `App.tsx`, which previously had none (the existing 84 tests cover only `src/lib/*`). 90 tests total.

### Changed
- **Accessibility and SEO fixes from the Lighthouse audit** (no visible design change) — the page now
  has a real `<main>` landmark (the content column became `<main class="content">`; layout verified
  unchanged at 1280×900), the row-actions table column has a screen-reader-only header so its cells are
  no longer header-less, and a new `.sr-only` utility exists for that purpose. Added
  `public/robots.txt` — there was none, so `/robots.txt` fell through to the SPA and returned
  `index.html`, which Lighthouse parsed as 19 robots syntax errors — and a `<meta name="description">`.
  Together these take SEO 82 → 100 and Accessibility 90 → ~93. The remaining items (colour contrast,
  touch-target size) were visible design changes and shipped separately after sign-off — see the contrast
  and target-size entries below.
- **Build now emits source maps** (`vite.config.ts`) so production stack traces are readable. No secret
  is exposed: the source is public and all keys live server-side in Cloudflare env vars.
- **Corrected the deploy URL throughout the docs** — the live site is `nyarlathotep-a6o.pages.dev`; the
  previously documented `yog-sothoth.pages.dev` no longer resolves at all. This included a user-facing
  error message in `App.tsx` that told users to allow-list the dead domain.
- **`App.tsx` is now type-checked** — the file-wide `@ts-nocheck` pragma is gone (ROADMAP #5). Measured
  first: a dry-run `tsc --noEmit` with the pragma disabled found 13 errors, not the "large effort" the
  roadmap had estimated sight-unseen, because the project's `strict`/`noImplicitAny` compiler flags stay
  off by existing design — so this newly catches structural mistakes (wrong ref/state shapes), not every
  untyped handler. All 13 fixed: three refs (`fileRef`/`tableRef`/`jsonRef`) properly typed with
  `useRef<T>(null)` instead of bare `useRef()` (and a real latent bug caught in passing — a missing `?.`
  on one of them), the undo/redo snapshot ref initialized from real state instead of `{}`, and two
  `status`/`position` fields that had widened from their literal types re-typed precisely (one accurate
  `as Status` cast at the single `<select>` bound to exactly those four values). No behavior change —
  verified via the full suite plus a live in-browser pass of the two paths that touched real runtime code
  (library-add end-to-end, file/JSON-load buttons). Full detail in `ROADMAP.md` #5.

### Fixed
- **Colour contrast now clears WCAG AA everywhere, in both themes.** Three separate fixes, all with the
  ratios measured in-browser against real composited backgrounds rather than estimated:
  - `--txt3` (tertiary text) light `#6a7790`→`#5d697f`, dark `#7a8393`→`#8a92a0`. The
    earlier P3b values were verified against white alone and still failed the other four surfaces.
  - **Every status colour failed on its own tint** — one root cause with 13 symptoms across the status
    pills, active filter buttons, help tags and alert banners. `--comply`→`#127136`,
    `--partial`/`--warn`→`#9e4908`, `--notcomply`/`--danger`→`#bb2020`,
    `--na`→`#546175`. Measured after: 5.08–5.20, up from 3.93–4.22.
  - A dark-theme accent conflict with no single-value solution: two selectors used the accent as *text*
    (needing it lighter) while the primary button uses it as a *fill* under white text (needing it
    darker). Resolved semantically — the text usages now point at `--accent-text`, which already
    existed for that role, freeing the fill colour to darken.
  - The library card label no longer draws from `STAT_COLORS`: 2.03:1 → 5.45:1, **and** it finally
    follows the dark theme instead of showing light-theme greens. Excel exports are unchanged.
- **Undersized tap targets** — three controls raised to the WCAG 2.2 minimum of 24×24 (the library remove
  button was 7.6×15.2). Two others were measured as exempt under the criterion's spacing rule and left
  alone rather than visibly enlarging a checkbox for no gain. Row height and table width are unchanged.
- **Tesseract (Browser OCR) no longer leaks memory for the rest of the session** (RISK_REVIEW R12) — the
  worker is now terminated after every run instead of being created once and held forever; the Thai/English
  language pack stays cached separately, so this doesn't bring back the old "re-download every time"
  problem, it just stops the worker's memory from lingering. Also: rasterizing a PDF page for OCR now
  retries at a lower render scale if the initial (higher-accuracy) scale fails, instead of the whole
  extraction crashing on an unusually large page.
- **CI**: added a GitHub Actions workflow (typecheck + tests + build on every push/PR) — nothing was
  automatically checking pushes before this.

### Security
- **Security response headers on the deployed site** (`public/_headers`) — the 2026-08-07 Lighthouse
  audit found four High-severity gaps that the Best Practices score (100) did not reflect, because
  Lighthouse weights them at zero: no Content-Security-Policy, no HSTS, no COOP, no frame-control.
  Added an **enforcing** CSP plus `X-Frame-Options: DENY`, HSTS (1 year, no `preload`),
  `Cross-Origin-Opener-Policy: same-origin`, and a `Permissions-Policy`. This matters here more than on
  a typical static site because users paste a Gemini API key into the page. The CSP was verified against
  the real production build served with the policy in enforcing mode — Google Fonts, the tesseract.js
  blob worker, its WebAssembly core, the jsdelivr language-data fetches, the pdf.js worker, `data:`
  figure images, the Gemini endpoint, and the dynamic ExcelJS import were each exercised individually,
  with negative controls confirming the policy was actually active rather than silently absent. Full
  method, the one unverified path (PDF rendering), and the rollback note are in
  [`LIGHTHOUSE_AUDIT.md`](LIGHTHOUSE_AUDIT.md) §1.
- **Prompt-injection framing around untrusted document text** (RISK_REVIEW R8) — both extraction prompts
  (`buildSystemPrompt` for Claude, `buildGeminiPrompt` for Gemini, in `src/lib/extract.ts`) now state
  up front that document content — including OCR'd text — is data to extract from, never instructions to
  follow, and instruct the model to copy any instruction-like text verbatim as a requirement rather than
  obey it. The scanned-PDF path additionally wraps the untrusted OCR text in `<document_text>` delimiter
  tags at the point it's interpolated into the request, so the boundary between "prompt" and "document"
  is explicit rather than one long unmarked string. Every existing verbatim/output-format rule is
  unchanged — new paragraphs were inserted, nothing old was reworded or removed, and 6 new unit tests
  assert both the new framing and the survival of the old rules. Digital-PDF extraction (the other path)
  already sent the file as a native `document`/`inline_data` block rather than raw interpolated text, so
  it wasn't part of this specific gap, but gets the same general framing paragraph for free since that's
  unconditional in both prompt builders. Blast radius was already small (output is verbatim-copied and
  human-reviewed before use) — this closes the gap rather than responding to an incident.
- **Gemini API key no longer travels in the URL** (RISK_REVIEW R7) — all three call sites (extraction,
  the Vision-OCR feeder, Test Connection) now send it via the `x-goog-api-key` request header instead of
  `?key=` in the query string, so it can no longer land in server/proxy access logs or browser history.
  Verified against the live API (a dummy key in the header got a genuine `API_KEY_INVALID`, confirming the
  endpoint reads it there) and by intercepting the app's own request in-browser to confirm the URL is clean.

## [0.4.0] — 2026-08-04

_Stable checkpoint before the accessibility work begins._

> **Housekeeping:** this section is the changelog's long-running `[Unreleased]` bucket, finally versioned.
> It therefore aggregates everything since **v0.1.0** — including the items already published as the
> **v0.2.0** pre-release (Typhoon/Vision engines, Vercel → Cloudflare, the Yog-Sothoth rename) and the
> `0.3.0` Vite migration, which was bumped in `package.json` but never cut as a release. Entries below are
> newest-first, so the genuinely new-in-0.4.0 work is at the top of each subsection.

### Changed
- **Dependencies:** dropped `xlsx` (SheetJS) in favour of `exceljs` for the spreadsheet export. This
  **retires the `xlsx@0.18.5` security advisory** (no styled-write support was the reason to switch anyway).
- **Renamed the project to Nyarlathotep** — the Lovecraft Messenger of a thousand forms fits a tool that
  translates and converts between formats; the earlier "Yog-Sothoth" (all-knowledge) did not. App title/
  brand, `package.json`, and all docs updated. The GitHub repo and the `yog-sothoth.pages.dev` deploy URL
  are unchanged (separate, engineer-triggered renames).

### Added
- **Undo / redo** — a history stack (up to 60 steps) reverses edits, bulk status-set, add/insert/delete,
  reorder, snip-attach, figure-removal, Load, and even **New/clear**. Use the **↶ / ↷** buttons in the top
  bar or **Ctrl+Z / Ctrl+Y** (Ctrl+Shift+Z also redoes). Shortcuts are ignored while a text field is focused
  so the field's own native undo still works; a run of edits to one cell collapses into a single undo step.
  History is session-only (cleared on reload). Pure core in `src/lib/history.ts` (unit-tested).
- **📷 Snip a figure from the PDF** — with a PDF loaded, a **Snip** button opens a viewer where you drag a
  box over any diagram, table, or picture; the crop is compressed to a JPEG and attached to a row (existing
  or new). The figure shows as a thumbnail (click to enlarge) and is **embedded into the `.xlsx` export**
  (a new "Figure" column). Works on **every** figure type — including vector-drawn diagrams — because it
  crops the *rendered* page, not just embedded images. Deterministic (no AI). Pixel-mapping math is pure and
  unit-tested (`src/lib/snip.ts`). Figures travel in Save/Load `.json` and the export; the browser autosave
  keeps text safe by dropping only the (large) images if they'd exceed the storage quota.
- **Review-speed tools for large matrices** (ROADMAP F5) — a **search box** filters rows by ref /
  requirement / translation / remarks text (combined with the status filter, with a live match count);
  **bulk status-set** via per-row checkboxes + a "select all shown" header checkbox and an action bar
  (*N selected · set Comply/Partial/Not Comply/N-A · Clear*); and **duplicate flagging** — rows whose
  requirement text is identical (after normalization) get a "⧉ Duplicate" badge, with a count in the
  toolbar. Pure logic in `src/lib/review.ts` (unit-tested). Drag-reorder stays disabled while searching
  (same rule as the status filters).
- **Digital PDFs skip OCR automatically** — with **Typhoon** or **Browser OCR** selected, a *digital* PDF
  is now read from its exact embedded text layer instead of being OCR-ed (instant, lossless, free — the same
  path as the "Text PDF" engine). A text-quality guard (`src/lib/textquality.ts`) checks the layer first: if
  it's empty or garbled — common with broken Thai font/ToUnicode maps — the tool **auto-falls-back to the
  OCR you picked** and says why. The success notice always offers a one-click **"Re-run with OCR"** for the
  subtle-corruption cases a heuristic can't catch. Scanned PDFs and the AI engines (Claude/Gemini) are
  unaffected.
- **Auto-filled "Verified By" / "Date" on export** — a new **Verified by…** field in the top bar
  pre-fills the sign-off columns of the `.xlsx` (every row gets the reviewer name + today's date), instead
  of leaving them blank for manual entry. Both stay editable in Excel. The reviewer name persists with the
  matrix (autosave + Save/Load `.json`). Completes the original F2 scope.
- **"How to use" guide** — a **How to use** button in the top bar opens an in-app modal that walks through
  the 5-step workflow, the extraction engines (when to use each), editing the matrix, and saving/exporting.
  Closes on ✕, backdrop click, or Escape. No routing — it's a self-contained overlay (`HelpModal` in
  `App.tsx`), styled from the existing design tokens (light/dark aware).
- **ExcelJS export with a Thai-capable font** (`src/lib/xlsx.ts`) — the exported `.xlsx` now sets
  **"TH Sarabun New"** on every cell, so Thai renders on open with **no manual "change the column font"
  step**. The sheet also gets a title block, colour-coded compliance-status cells, a frozen header row, and
  borders; the filename keeps Thai project names. ExcelJS is **dynamic-imported**, so it code-splits out of
  the initial bundle and only loads when the user clicks Export. (A font still can't be *embedded* in
  `.xlsx` — if a reviewer's PC lacks the font, Excel substitutes a similar one — but the common case no
  longer needs a manual step.) Replaces SheetJS (`xlsx`).
- **Row reordering & insert-between** — drag a row (grip handle, @dnd-kit) to reorder, and an "insert below"
  (+) button on each row; pure ops in `src/lib/rows.ts`.
- **"Text PDF — No AI · exact" engine** — reads a digital PDF's embedded text layer directly (instant, free,
  lossless) into the matrix; `src/lib/pdf.ts`. Includes **multi-column table detection** (`src/lib/tables.ts`):
  a table row's columns are joined into the Requirement with a ` — ` delimiter, column 1 → Ref.
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
