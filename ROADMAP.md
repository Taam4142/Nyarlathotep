# ROADMAP.md — Nyarlathotep

> Where the tool is going. Phased so the low-risk, high-value work lands first. Risk IDs (R1–R13) refer
> to [`RISK_REVIEW.md`](RISK_REVIEW.md); feature/architecture IDs (F/A) are defined here.
> Testing procedure + fixtures: [`TESTING.md`](TESTING.md). Accessibility: [`A11Y_PLAN.md`](A11Y_PLAN.md).
> Last updated 2026-08-07.

---

## ▶ Next up — the remaining plan

Ordered by **ascending risk and dependency**, so cheap protective work lands first and the two big items
come last, informed by evidence. Each item is independently revertible; nothing here is a prerequisite for
using the tool as it stands.

| # | Item | Effort | Risk | Fully verifiable by me? | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | **CI** — GitHub Actions | S | Very low | Yes | ✅ **Done — 2026-08-06** |
| 2 | **R12** — Tesseract teardown + rasterize scale fallback | S | Low–Med | ⚠️ Partly | ✅ **Done — 2026-08-06** |
| 3 | **R8** — prompt-injection framing | S | **Med** | ⚠️ Partly | ✅ **Done — 2026-08-07** |
| 4 | *(engineer)* Run [`TESTING.md`](TESTING.md) on real PDFs | — | — | **No — needs you** | Fixtures delivered |
| 5 | **Drop `@ts-nocheck`** from `App.tsx` | **L** | **High** | Yes | Not started |
| 6 | **AI table-prompt** for messy tables | L | Med | Gated on #4 | Not started |
| 7 | **P5** (ESLint + jsx-a11y + axe) · **npm audit** decision | M | Low | Yes | Optional |

### 1. CI — GitHub Actions ✅ Done
[`​.github/workflows/ci.yml`](.github/workflows/ci.yml): triggered on push to `master` + pull requests —
`checkout → Node 22 (matches local v22.18.0, npm cache) → npm ci → typecheck → test → build`. Status badge
at the top of the README. **Verified, not just pushed:** watched the first real run (`gh run watch`) to
completion — every step green, 36s total. (One informational annotation, not a failure: GitHub flags
`actions/checkout@v4`/`actions/setup-node@v4` as internally targeting a Node version their runners are
deprecating; both actions auto-run on a newer one regardless, unrelated to our Node 22 build target.)

> ⚠️ **Important expectation:** this is **not** a deploy gate. Cloudflare Pages builds on push
> independently of GitHub Actions, so a red CI still deploys. What you get is a red ✗ on the commit and an
> email — a *notification*, not a gate. Making it a true gate needs branch protection + a PR workflow,
> which was **deliberately rejected**: the engineer is the sole committer pushing straight to `master`, so
> the ceremony would cost more than it saves.

**Why first:** it's cheap, and everything after it — especially the high-risk `@ts-nocheck` work — inherits
the safety net automatically instead of depending on manual discipline.

### 2. R12 — Tesseract memory ✅ Done *(see RISK_REVIEW R12)*
Shipped as planned, with one improvement found while implementing:
- **(a) Worker teardown** — `ocrPDFTesseract` now terminates the worker in a `finally` (success, error, and
  cancellation alike). **Better than the original plan:** checked `tesseract.js`'s own README before
  writing this, and it documents "create once → recognize → terminate once" as the *intended* pattern, and
  confirms the Thai/English language-pack files are cached separately (`cacheMethod`, not tied to the
  worker object) — so terminating after every run does **not** force a ~15 MB re-download as originally
  worried; the next run just re-initializes from cache. Freed the memory promptly instead of the more
  conservative "idle/unmount" policy first considered.
- **(b) Rasterize scale fallback** — `rasterizePage` now retries through a descending ladder
  (`3 → 2 → 1.5 → 1`) on render failure, implemented as the planned "retry on failure," not a preemptive
  downgrade — Thai OCR accuracy is unaffected on pages that render fine at scale 3.

**How this got verified despite the sandbox's `page.render()` limitation:** the pure ladder-selection logic
(`scaleFallbackLadder`) is unit-tested directly (5 cases). The retry *loop* itself was exercised for real —
the actual `rasterizePage` function, imported live — against a controlled fake `page` whose `render()`
fails at scale ≥3 and succeeds below it: confirmed it tries `[3, 2]` and returns a valid result, and
separately that a **total** failure tries all four rungs and propagates the *last* attempt's error rather
than masking it. The worker-teardown logic was checked by direct code reading (the reference-clearing line
runs synchronously before any `await`, so there's no window for a stale reference — not something that
needs a live test to be certain of) plus a live abort-path run that exercised real worker creation.

### 3. R8 — prompt-injection framing ✅ Done *(see RISK_REVIEW R8)*
Shipped exactly as planned. Both prompt builders (`buildSystemPrompt`, `buildGeminiPrompt` in
`extract.ts`) open with an unconditional "document content is data, not instructions" paragraph, and their
`isOCR` branch adds a second paragraph pointing at the `<document_text>`-delimited block that follows. The
two call sites that interpolate raw `ocrText` (`extractRequirements`, `extractWithGemini`) now wrap it in
`<document_text>` tags with the framing sentence restated right next to the interpolation — so the
boundary is explicit at the one place untrusted text was previously just concatenated into a longer string.
Every existing verbatim/output-format rule is byte-identical; only new paragraphs were inserted. First-ever
unit tests on `buildSystemPrompt`/`buildGeminiPrompt` (6 new) assert both the new framing and the survival
of the old rules. See RISK_REVIEW R8 for the full verification detail and what's still unverified (live
model behaviour against a real injection attempt needs the deployed proxy / a real Gemini key).

### 5. Drop `@ts-nocheck` — the biggest remaining risk
`App.tsx` is **2,907 lines with no type annotations**. Removing `@ts-nocheck` will surface a large number of
implicit-any errors, and some may be latent real bugs whose fixes change behaviour. Plan: incremental, in
sections, one commit per section, with CI + the 6 smoke tests as the net. Do **after** CI (#1).

### 6. AI table-prompt — deliberately gated
The deterministic column detector (`src/lib/tables.ts`) only handles clean, aligned tables. An AI-assisted
path for messy/borderless/merged tables is the obvious next capability — **but its value is unproven until
real-PDF testing (#4) shows the deterministic path actually falls short.** Building it before that evidence
risks solving a problem that doesn't exist in practice. Must stay extract-only + human-reviewed per
[`CLAUDE.md`](CLAUDE.md).

### 7. Optional
- **P5** — ESLint + `eslint-plugin-jsx-a11y` + axe. Note this means **introducing ESLint from scratch**
  (the project has no config and no `lint` script), so it's larger than "add a plugin."
- **npm audit** — 2 moderate advisories, both **pre-existing, dev-only, transitive**: `esbuild` (via
  vitest's own toolchain) and `uuid` (via `exceljs`). Neither ships to the browser. Fixing either needs a
  **breaking major bump** (vitest 4.x / exceljs 3.x) — an engineer decision, not a silent change.
- **F5 leftovers** — keyboard cell nav, column reorder.

_The accessibility pass ([`A11Y_PLAN.md`](A11Y_PLAN.md)) is complete for its scope; P4 (Snip keyboard
access) stays parked unless a real need surfaces._

---

## Shipped

**R8 — prompt-injection framing (2026-08-07):** `buildSystemPrompt`/`buildGeminiPrompt` now open with an
unconditional "document content is data, not instructions" paragraph, reinforced in the `isOCR` branch; the
two call sites that interpolate raw OCR text wrap it in `<document_text>` delimiter tags. Every existing
verbatim/output-format rule is byte-identical — see §3 above and RISK_REVIEW R8 for the full detail. 6 new
unit tests (106 total); typecheck/build green. This closes the risk register down to R13 (npm audit,
open by design).

**R12 — Tesseract memory (2026-08-06):** `ocrPDFTesseract` terminates its worker in a `finally` (success,
error, cancellation alike); `rasterizePage` retries a render failure through a `3 → 2 → 1.5 → 1` scale
ladder instead of downgrading Thai OCR accuracy up front. See §2 above for what was found while
implementing (termination doesn't force a language-pack re-download, contrary to the original plan's
worry) and exactly how it was verified around the sandbox's rendering limitation.

**CI — GitHub Actions (2026-08-06):** [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs
typecheck + the 90 tests + build on every push to `master` and on pull requests. Status badge in the
README. Confirmed with a real watched run, not just a push — see §1 above for the result and the "not a
deploy gate" caveat.

**Test fixtures + procedure (2026-08-06):** [`TESTING.md`](TESTING.md) — a step-by-step verification
checklist covering the whole feature surface, plus two generated sample PDFs (`tools/fixtures/`) that
exercise digital text, Thai + ASCII + Thai-numeral clause refs, a multi-column table, a vector diagram, an
embedded image, and a no-text-layer scanned page. Written so the engineer's real-PDF pass is a
follow-the-steps job rather than a recall exercise.

**R7 — Gemini key out of the URL (2026-08-06):** the key now travels in the `x-goog-api-key` header at all
three call sites instead of `?key=` in the query string, so it can't land in server/proxy access logs or
browser history. Verified against the **live** API (a dummy key in the header returned a genuine
`API_KEY_INVALID`, proving the endpoint reads it there) and by intercepting the app's own request
in-browser — not by trusting documentation, which was actually inconsistent on this point.

**Accessibility pass — P0 through P3b (2026-08-05):** full audit, phasing, and risk register in
[`A11Y_PLAN.md`](A11Y_PLAN.md) (baseline `v0.4.0`); §4 has the complete per-phase implementation log,
including two bugs caught and fixed during verification (not shipped, not found later) — a focus-visible
claim corrected after real-click testing, and an inverted darken/lighten direction caught before publishing
the contrast-comparison artifact. **P1** (invisible): `lang="en"`, `scope="col"` on all `<th>`, real
accessible names on every previously placeholder-only control, live regions on the progress/alert banners,
dialog semantics + Escape on the figure lightbox. **P2**: one `:focus-visible` rule restores keyboard focus
visibility on every control that had none (the compliance-status and category dropdowns had **zero**
indication before this). **P3a**: `prefers-reduced-motion` support. **P3b**: darkened `--txt3` to clear
WCAG AA contrast in both themes — approved after viewing a live before/after comparison (published as an
Artifact, ratios computed in-page) rather than judging hex codes in chat. **Also added**: a minimal UI
smoke-test suite (`src/App.test.tsx`, Testing Library + jsdom, 6 tests) — the first automated coverage of
`App.tsx`, which until now had none. 90 tests total. P4 (Snip keyboard access) deliberately skipped — the
only phase that would add interaction rather than fix a label/style.

**Undo / redo (2026-08-04):** a snapshot history (≤60 steps) reverses edits, bulk status-set, add/insert/
delete, reorder, snip-attach, figure-remove, Load, and New/clear — via **↶/↷** buttons or **Ctrl+Z/Ctrl+Y**
(skipped while a text field is focused; consecutive edits to one cell coalesce). Session-only. Pure core in
`src/lib/history.ts` (unit-tested). Safety net for the destructive one-click review tools.

**Snip a figure from the PDF (2026-08-04):** a **📷 Snip** tool renders the source pages, lets the user
drag-crop any figure (works on vector diagrams too, since it crops the *rendered* page), and attaches the
compressed JPEG to a row — shown as a thumbnail (click to enlarge) and **embedded in the `.xlsx`** (new
"Figure" column). Deterministic, no AI. `src/lib/snip.ts` (pure pixel-mapping, unit-tested) + `Row.image`.
Figures persist in Save/Load `.json` + export; autosave degrades to text-only if images exceed the quota so
text is never lost. _(Live in-modal page-render + drag verified by construction — the crop util, export
embed, thumbnail, lightbox, and persistence all pass; pdf.js `render` can't run in a hidden preview pane.)_
_Follow-ons:_ auto-list embedded raster images; AI figure-locator (suggestion only).

**Review-speed tools — F5 (2026-08-03):** text **search** (ref/requirement/translation/remarks, combined
with the status filter, live match count), **bulk status-set** (per-row checkboxes + select-all + action
bar), and **duplicate-requirement flagging** (badge + toolbar count). Pure logic in `src/lib/review.ts`
(`matchesQuery` / `findDuplicateIds`, unit-tested). Attacks the biggest time sink — reviewing a large TOR.

**Digital-PDF fast path (2026-08-03):** Typhoon / Browser OCR now auto-read a **digital** PDF's exact
embedded text layer instead of OCR-ing the pages (instant, lossless, free) — reuses `extractDigitalText`.
Guarded by a text-quality check (`src/lib/textquality.ts`): an empty/garbled text layer (common with broken
Thai font maps) auto-falls-back to the chosen OCR with a reason; the success notice always offers a
one-click **Re-run with OCR** for subtle corruption the guard can't catch. AI engines unchanged.

**Verified-By / Date auto-fill (2026-08-03):** a **Verified by…** top-bar field pre-fills the `.xlsx`
sign-off columns (reviewer name + today's date on every row, still editable in Excel); the name persists
with the matrix. Closes the F2 follow-up that was deferred out of the ExcelJS work. `src/lib/xlsx.ts` +
`storage.ts` (unit-tested).

**F2 — ExcelJS export (2026-08-03):** replaced SheetJS (`xlsx`) with **ExcelJS** so the exported `.xlsx`
sets **"TH Sarabun New"** per cell — Thai renders on open with **no manual "change the column font" step**.
Also a title block, colour-coded status cells, frozen header, borders, and a Thai-safe filename. ExcelJS is
**dynamic-imported** so it code-splits out of the initial bundle (loads only on Export). This also
**retires the `xlsx@0.18.5` security advisory**. `src/lib/xlsx.ts` (unit-tested). _Deferred:_ auto-fill
"Verified By"/"Date" from project metadata. Verified end-to-end (typecheck/57 tests/build + in-browser
export → valid xlsx, no manual font step).

**F1 — Persistence (2026-08-01):** localStorage **autosave** of the matrix + project + comply-library +
column toggles (restores on reload, with a one-time "restored your session" notice) · explicit **Save /
Load matrix as JSON** + a **New** button · row ids switched to **UUIDs** so loaded sessions never collide ·
imported rows validated/coerced. `src/lib/storage.ts` (pure, unit-tested). Gemini key intentionally not
persisted. Verified end-to-end.

**Post-Phase-2 features (2026-08-01):**
- **OCR row-splitter fix** — one-row-per-line + Thai-numeral clause detection (`๓.๑๑.๒.๒` → Ref).
- **Reorderable rows** — drag-to-reorder (@dnd-kit) + per-row "insert below"; `src/lib/rows.ts`.
- **"Text PDF — No AI · exact" mode** — reads a digital PDF's embedded text layer directly (instant, free,
  lossless) into the matrix; `src/lib/pdf.ts` `extractDigitalText`.
- **Multi-column table support** — column detection in the Text-PDF mode; a table row's columns are joined
  into the Requirement with a ` — ` delimiter, col1 → Ref; `src/lib/tables.ts`. _(Deterministic; clean
  aligned tables only — messy/borderless tables would want an AI table-prompt.)_

**Phase 2 (2026-08-01) — correctness, reliability & security. Fix list complete:**
- **A1** — model IDs refreshed + centralized in `src/lib/models.ts` (Claude → `claude-sonnet-5` /
  `claude-opus-5`; Gemini → `gemini-3.6-flash` / `gemini-3.1-pro`).
- **R9** — retry/backoff on all engine calls (`src/lib/net.ts` `fetchWithRetry`).
- **R11** — Gemini pinned to JSON output.
- **R5** — multi-page `detectPDFType` sampling.
- **R10** — cancellation: `AbortController` threaded through every engine call + a Cancel button in the
  progress overlay.
- **R6** — proxies hardened **in place** (`functions/api/_guard.js`): origin allow-list, model allow-list,
  body-size cap, per-IP KV rate limit, optional shared secret. Chose in-place hardening over a login/backend
  (keeps the tool public, no access-model change). **Engineer action to activate:** set `ALLOWED_ORIGINS`
  (and optionally bind a `RATE_LIMIT` KV namespace / set `PROXY_SECRET` / `ALLOWED_MODELS`) in Cloudflare.
- _Deferred to a later pass:_ R7, R8, R12; and the bigger backend/persistence work is Phase 3.

**v0.3.0 — modernization Phase 1:**
- **A2 — Vite + React + TypeScript build.** Retired in-browser Babel; the single file is decomposed into
  typed, unit-tested `src/lib/*` modules + `src/App.tsx` + `src/styles.css`. Faster load, types, tests.
- **R1 / R2 / R3 / R4** fixed during the port (dead code, large-PDF base64, robust JSON parsing).
- _Trigger for the priority re-order:_ the "free / no-backend" constraint was dropped; now optimizing for
  efficiency/correctness/performance. Next: Phase 2 (remaining fixes + hardened backend), Phase 3
  (persistence + optional self-hosted OCR).

**v0.2.0:**
- **Free Thai OCR** — added the Typhoon engine (default) + Google Cloud Vision feeder (free tier, good
  Thai); removed Google Doc AI. (OCR.space was evaluated and dropped — weak Thai.)
- **Cloudflare Pages** migration (retired Vercel); proxies are now Pages Functions.
- **Minimal auto light/dark redesign** — UI follows `prefers-color-scheme` (light is the new default).
- **Renamed** the project to **Yog-Sothoth** (app, docs, and GitHub repo).

## Phase 0 — safety & correctness quick wins (do first, low risk)

Small, self-contained, mostly bug/security hardening. None changes the UX shape.

- **R1** — delete the dead + broken `ocrPDFClaude()`.
- **R2** — fix large-PDF base64 (chunked / `FileReader`) so big digital PDFs stop crashing.
- **R3 / R4** — handle truncated + prose-wrapped JSON (cap detection, balanced-array recovery).
- **R6** — harden the proxy: origin allow-list, model allow-list, body cap, basic rate limit.
- **R11** — pin Gemini output to JSON (`responseMimeType`).
- **A1 (model IDs)** — refresh + centralize the model strings (see Deferred → trigger).

## Phase 1 — reliability & the biggest UX gap

- **R9** — retry/backoff on 429/529/network across all engines.
- **R10** — cancellation via `AbortController` + a Cancel button.
- **F1 — Persistence** *(highest user value)*: localStorage autosave + explicit **Save/Load matrix as
  JSON** (import/export). Today a refresh loses everything. If added, switch row IDs from the `_rc`
  counter to UUIDs to avoid collisions across saved sessions.
- **F2 — ExcelJS export**: replace SheetJS with ExcelJS (also free) to embed *TH Sarabun New* so Thai
  renders correctly with no manual font step; auto-fill "Verified By"/"Date" from project metadata.

## Phase 2 — architecture (unblocks everything cleanly)

- **A2 — Migrate off in-browser Babel** to a Vite + React + TypeScript build; split the 3,118-line file
  into modules; keep the same static Cloudflare Pages deploy. Removes the ~3 MB Babel download and per-load compile.
- **A3 — Unit tests** for the pure functions (`structureWithoutAI`, `validateAndMap`, `isLikelyTranslated`,
  the JSON-clean step) — matches the ancestor project's "pure core with tests" rule.
- **A4 — DRY** the near-duplicate `buildSystemPrompt`/`buildGeminiPrompt` and the inline Claude-Vision
  fetch (see R1) into shared helpers.
- **A5 — Docs**: keep README/SKILL/CLAUDE reconciled as the code changes.

## Phase 3 — feature depth

- **F3** — page-range selector for very large TORs (R-adjacent to document limits).
- **F4** — live cost/token estimate per engine/model (before and after a run, from usage in responses).
- **F5** — editor niceties: undo/redo, row reordering (drag), bulk status set, text search/filter,
  duplicate-row detection, keyboard cell nav.
- **F6** — prompt roadmap (from `CLAUDE.md`): requirement-type tagging (`mandatory|preferred|
  informational`), cross-reference detection, ambiguity flags, BOQ linkage.
- **R5** — multi-page `detectPDFType` sampling.
- **R12** — Tesseract scale fallback + worker teardown.
- **R7 / R8** — Gemini-key transport review; prompt-injection framing hardening.

## Deferred (with trigger)

| Item | Trigger to pick it up |
| ---- | --------------------- |
| A2 — Vite/TS migration | First-paint load time becomes a complaint, or more than one person starts editing the file regularly. |
| ~~A1 — model-ID refresh~~ | ✅ **Done (Phase 2, 2026-08-01)** — centralized in `src/lib/models.ts`, refreshed to `claude-sonnet-5` / `claude-opus-5` / `gemini-3.6-flash` / `gemini-3.1-pro`. |
| ~~F2 — ExcelJS~~ | ✅ **Done (2026-08-03)** — `src/lib/xlsx.ts`; Thai font set per cell, no manual step; retired the `xlsx` advisory. |
| Google Doc AI polish | A batch of heavily degraded scans that Tesseract/Claude/Gemini vision can't read. |

## Guardrails for every phase

- The **verbatim law** (`CLAUDE.md`) is non-negotiable — never let a change translate/paraphrase the
  `requirement` field or drop the review flags.
- Free + no-key paths must keep working (Browser OCR must never require billing).
- Keep the deploy free-host-friendly; don't add a paid dependency to any required path.
