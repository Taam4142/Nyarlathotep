# ROADMAP.md — Nyarlathotep

> Where the tool is going. Phased so the low-risk, high-value work lands first. Risk IDs (R1–R12) refer
> to [`RISK_REVIEW.md`](RISK_REVIEW.md); feature/architecture IDs (F/A) are defined here.
> Last updated 2026-08-01.

## ▶ Next up (locked with the engineer, 2026-08-01)

**F1 — Persistence** is the agreed next work — the single biggest gap (a refresh wipes all work):
- localStorage **autosave** of the current matrix + project name (survives refresh).
- Explicit **Save / Load matrix as JSON** (export/import) to keep, share, or resume a document.
- Switch row IDs from the `_rc` counter to **UUIDs** so loaded sessions never collide.

Strong runner-up: **F2 — ExcelJS export with embedded Thai font** (fixes the manual-Thai-font step for
reviewers **and** retires the `xlsx@0.18.5` security advisory in one move).

## Shipped

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
| F2 — ExcelJS | A user reports the manual Thai-font step as a real pain, or exports go to non-technical reviewers. |
| Google Doc AI polish | A batch of heavily degraded scans that Tesseract/Claude/Gemini vision can't read. |

## Guardrails for every phase

- The **verbatim law** (`CLAUDE.md`) is non-negotiable — never let a change translate/paraphrase the
  `requirement` field or drop the review flags.
- Free + no-key paths must keep working (Browser OCR must never require billing).
- Keep the deploy free-host-friendly; don't add a paid dependency to any required path.
