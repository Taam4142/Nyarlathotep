# ROADMAP.md — Yog-Sothoth

> Where the tool is going. Phased so the low-risk, high-value work lands first. Risk IDs (R1–R12) refer
> to [`RISK_REVIEW.md`](RISK_REVIEW.md); feature/architecture IDs (F/A) are defined here.
> Last updated 2026-07-28.

## Shipped in v0.2.0

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
| A1 — model-ID refresh | **Before the next real extraction run** — the current IDs (`claude-sonnet-4-20250514`, `claude-opus-4-5`, `gemini-2.0-flash`, `gemini-2.5-pro-preview-06-05`) predate the current lineup and may reject. Verify exact current IDs first. |
| F2 — ExcelJS | A user reports the manual Thai-font step as a real pain, or exports go to non-technical reviewers. |
| Google Doc AI polish | A batch of heavily degraded scans that Tesseract/Claude/Gemini vision can't read. |

## Guardrails for every phase

- The **verbatim law** (`CLAUDE.md`) is non-negotiable — never let a change translate/paraphrase the
  `requirement` field or drop the review flags.
- Free + no-key paths must keep working (Browser OCR must never require billing).
- Keep the deploy free-host-friendly; don't add a paid dependency to any required path.
