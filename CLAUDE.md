# CLAUDE.md — working context for Nyarlathotep

> Thai/English TOR PDF → editable compliance matrix → signed-off `.xlsx`.
> React 18 + TypeScript + Vite, deployed on Cloudflare Pages at
> **https://nyarlathotep-a6o.pages.dev/**. Repo `Taam4142/Nyarlathotep`.
>
> This file is the orientation doc — commands, conventions, layout, and the rules that
> otherwise get re-explained every session. Prompt design lives in [`PROMPTS.md`](PROMPTS.md).

---

## 1. The one rule that outranks everything

> **The `requirement` field is copied character-for-character from the source TOR.**
> Never paraphrase, translate, summarise, or reword. Thai characters reproduced exactly.

The matrix is a contractual document. A reworded requirement is a disputable compliance
claim. This constrains more than prompts: it is why extraction is verified by comparing
**character multisets** against raw pdf.js output, and why a wrong value must be *flagged*
rather than silently filled. See [`PROMPTS.md`](PROMPTS.md) for how it is enforced in the
prompt, and [`TESTING.md`](TESTING.md) §3b for how it is verified.

---

## 2. Commands

```bash
npm run dev         # Vite dev server. NOTE: /api/* proxies do NOT exist here.
npm run typecheck   # tsc --noEmit
npm run test        # vitest run — 185 tests
npm run build       # vite build → dist/
```

Definition of done for any change: **typecheck exit 0 · all tests pass · build green**, plus
the relevant manual pass in [`TESTING.md`](TESTING.md) §3.

> **Check the exit code of the command that matters.** `npm run typecheck | tail -3 && git
> commit` reports the *pipeline's* status, not tsc's — that once pushed a failing typecheck.

---

## 3. Layout

```
src/
  App.tsx            ~2,900 lines. ALL UI. The one risky, under-tested surface.
  styles.css         All CSS, including the token definitions (see DESIGN_TOKENS.md).
  lib/*.ts           Pure logic, one concern per file, each with a .test.ts beside it.
functions/api/       Cloudflare Pages Functions — claude · typhoon · vision · _guard.
tools/fixtures/      Synthetic test PDFs. Own package.json ON PURPOSE — never in the bundle.
```

**`src/lib` map** — extraction path first, then support:

| File | Concern |
| --- | --- |
| `pdf.ts` | pdf.js loading, `detectPDFType`, `rasterizePage` (**PNG**), digital text extraction |
| `tables.ts` | Column-aware reconstruction of a digital PDF's text layer, from cell geometry |
| `ocrlines.ts` · `clauseref.ts` | Rejoining wrapped OCR lines · shared clause-ref regex |
| `furniture.ts` | Strips signature blocks and page numbers that are not requirements |
| `ocr.ts` · `typhoon.ts` | The four OCR engines · unwrapping Typhoon's JSON envelope |
| `extract.ts` | Prompt building, AI calls, `structureWithoutAI` (the no-AI splitter) |
| `ocrtrust.ts` · `textquality.ts` | How far to trust OCR output · digital fast-path guard |
| `xlsx.ts` · `storage.ts` | Excel export (ExcelJS) · autosave + JSON save/load |
| `rows.ts` · `history.ts` · `review.ts` | Row ops by id · undo/redo · search & duplicates |
| `contrast.ts` | WCAG contrast maths over the stylesheet — a CI guard, not app code |
| `models.ts` · `breakpoints.ts` · `constants.ts` · `net.ts` | Registries, media queries, retrying fetch |

---

## 4. Conventions

- **Logic goes in `src/lib` as a pure function with a test. `App.tsx` gets the wiring.**
  Anything reusable, geometric, or fiddly belongs in a module — that is why the risky parts
  are testable at all.
- **Model → view, never the reverse.** Never read state back out of the DOM.
- **Comment the *why*, not the *what*.** The codebase's comments carry measurements and
  the reason a decision was made; match that density. Non-obvious fixes cite their evidence.
- **`App.tsx` is type-checked but `strict`/`noImplicitAny` are off** — a partial net. The 13
  smoke tests in `App.test.tsx` are the main protection for UI *behaviour*; `App.a11y.test.tsx`
  covers semantics only. Neither is full coverage: manual verification still matters.
- **Never edit `STAT_COLORS`** — shared with the Excel export (`xlsx.ts:103`).
- **Commit as `Taam4142 <nat.kati.04@gmail.com>`**, one coherent change per commit, message
  ending with the `Co-Authored-By` line. Docs updated **in the same commit** as the code.
- **Push is pre-authorised** for verified changes; still pause for risky or unverified ones.

---

## 5. Engines — what is true now

| Engine | Where it runs | Use it for |
| --- | --- | --- |
| **Text PDF (no AI)** | Browser | Digital PDFs. Instant, free, exact. |
| **Typhoon** | `/api/typhoon` proxy | **Scanned Thai — the default choice.** Thai-tuned. |
| **Browser OCR** (Tesseract) | Browser, offline | No network, or a first look. **Misreads Thai digits.** |
| **Claude / Gemini / Vision** | Proxy · user key | Structuring fuzzy input; Vision for OCR. |

Measured on a real scanned AMR TOR ([`TESTING.md`](TESTING.md) §3d): Tesseract got **every
one of 20** specification values wrong — `IP ๖๘` as `IP ๒๕`, stainless `๓๐๔` as `๓๐๕` — while
reporting 92–99 % confidence. Typhoon got every one right. **Its errors land on numbers,
which are invisible; Typhoon's land on Thai words, which a reader catches.**

- **API keys are server-side only**, in Cloudflare env vars. Gemini's user key is deliberately
  **not** persisted to localStorage.
- **Typhoon takes PNG only** — JPEG returns HTTP 400 — and needs whole pages, not crops.
- **Never call a paid/proxied engine without explicit permission.**

---

## 6. Rules learned the hard way

- **Measure; do not assume.** Estimates here have been wrong by an order of magnitude in both
  directions. Before "this is large", count it.
- **Verify with `getComputedStyle`, never by reading the CSS.** Cascade collisions have
  silently undone four edits while every test passed.
- **rgba is not opaque.** Composite translucent layers before computing contrast, or you get
  a confidently wrong ratio.
- **Audit UI at BOTH desktop and mobile widths.** Each hides about half the findings — one
  rule reported 1 node at 371 px and 19 at 1280 px.
- **Clear `localStorage` before auditing.** Autosave restores state the empty app never shows;
  one finding was raised and withdrawn over exactly this.
- **Synthetic fixtures only confirm the assumptions used to write them.** Every real bug came
  from real documents.
- **`read_console_messages` keeps stale entries across reloads** — use a fresh tab, or check
  the DOM for ground truth.

---

## 7. Where everything else lives

| Doc | For |
| --- | --- |
| [`README.md`](README.md) | What the tool is, stack, quick start |
| [`PROMPTS.md`](PROMPTS.md) | Prompt design, the verbatim rule's enforcement, iteration log |
| [`TESTING.md`](TESTING.md) | Commands, manual walkthrough, real-document passes, axe procedure |
| [`ROADMAP.md`](ROADMAP.md) | What is planned, deferred, and why |
| [`RISK_REVIEW.md`](RISK_REVIEW.md) | Project risk register **R1–R13** |
| [`A11Y_PLAN.md`](A11Y_PLAN.md) | Accessibility findings A–O, phases P0–P5, and its **own** register **R1–R14** |
| [`DESIGN_TOKENS.md`](DESIGN_TOKENS.md) | Colour/spacing tokens and the contrast rules |
| [`RESPONSIVE_PLAN.md`](RESPONSIVE_PLAN.md) · [`LIGHTHOUSE_AUDIT.md`](LIGHTHOUSE_AUDIT.md) | Mobile layout · performance/security audit |
| [`DEPLOY.md`](DEPLOY.md) | Cloudflare Pages setup, env vars, proxy config |
| [`CHANGELOG.md`](CHANGELOG.md) | User-visible history |

> **Two risk registers, overlapping IDs.** `RISK_REVIEW.md` R1–R13 are project risks;
> `A11Y_PLAN.md` R1–R14 are accessibility risks. "R5" means different things in each. Always
> name the file.

> `SKILL.md` was **deleted** on 2026-08-21. Most of it duplicated code or other docs, and
> much of what did not was wrong. Its one unique piece — the Excel output contract — is now
> in [`README.md`](README.md), corrected.
