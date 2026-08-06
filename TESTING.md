# TESTING.md — Nyarlathotep

> How this project is verified: the automated suite, the sample PDFs, the manual walkthrough, and — most
> importantly — **what cannot be verified automatically and therefore needs a human**.
> Risk context: [`RISK_REVIEW.md`](RISK_REVIEW.md) · Plan: [`ROADMAP.md`](ROADMAP.md).
> Last updated 2026-08-07.

---

## 1. Automated checks

```bash
npm run typecheck   # tsc --noEmit
npm run test        # vitest run  — 90 tests
npm run build       # vite build → dist/
```

**Coverage shape — know what these do and don't cover:**

| Layer | Covered by | Notes |
| --- | --- | --- |
| `src/lib/*` — pure logic | 84 unit tests | The well-tested core: pdf, tables, extract, review, history, snip, storage, xlsx, net, textquality, typhoon, models, rows. |
| `src/App.tsx` — the UI | 6 smoke tests (`src/App.test.tsx`) | Testing Library + jsdom. **Smoke only**: renders, control labels, add row, edit cell, bulk status-set, undo, search. It is *not* full coverage — most UI behaviour still needs the manual pass in §3. |
| Everything else | — | Extraction against live APIs, OCR, PDF rendering, Excel output fidelity: **manual**. |

> `App.tsx` is 2,900+ lines carrying `@ts-nocheck`, so the type checker isn't helping there either. This
> is the single biggest reason to be careful with UI changes — see [`ROADMAP.md`](ROADMAP.md) #5.

### Gotcha: `App.test.tsx` and the auto-focus race
`addRow()` in `App.tsx` schedules a `setTimeout(…, 60)` that focuses the new row's textarea. Under load
that deferred focus can land *after* a subsequent `user.type()` has begun and steal keystrokes, causing
flaky failures. The tests use an `addRow(user)` helper that waits past that window. If you add a test that
clicks "+ Row", **use the helper** rather than clicking the button directly. Vitest also doesn't inject
Jest-style globals here, so RTL's auto-cleanup doesn't fire — `afterEach(cleanup)` is explicit and must
stay.

---

## 2. Sample PDFs

Two generated fixtures live in [`tools/fixtures/`](tools/fixtures/):

| File | What it exercises |
| --- | --- |
| `TOR-Sample-Digital.pdf` (3pp) | Real embedded digital text in **Thai + English**; all seven clause-ref styles (`3.1`, `๓.๒`, `3.3`, `ข้อ 4`, `(5)`, `๖.`, nested `๖.๑๑.๒`); a **3-column equipment table**; a **vector-drawn** single-line diagram; and an **embedded raster photo**. |
| `TOR-Sample-Scanned.pdf` (1p) | An **image-only page with no text layer**, forcing `detectPDFType → "scanned"` and the OCR path. |

**These are synthetic.** They prove the pipeline runs correctly on realistic Thai/English content, but they
are *clean* — no scanner noise, skew, or compression artifacts. **They do not validate real-world OCR
accuracy.** A genuine scanned TOR remains the one test only the engineer can provide.

Both carry an on-page notice that they are test fixtures, not real project documents.

### Regenerating them
Requires Windows with `TH Sarabun New` installed (`C:\Windows\Fonts\THSarabunNew.ttf`) — the same font the
Excel export targets, embedded so the Thai is genuinely extractable rather than drawn as shapes.

```bash
cd tools/fixtures && npm install && npm run build
```

`tools/fixtures/` has **its own `package.json` on purpose** — `pdf-lib`, `@pdf-lib/fontkit`, and
`@napi-rs/canvas` are dev-only fixture tooling and must never enter the app's dependency tree or bundle.
(`@napi-rs/canvas` ships prebuilt binaries, so no native build toolchain is needed.)

---

## 3. Manual walkthrough

Run after any UI change, and in full before a release. ~15–20 min.

**Where:** steps needing **Typhoon / Claude / Google Vision** must run on the **deployed site** — those go
through Cloudflare Pages Functions that don't exist under `npm run dev`. **Browser OCR**, **Text PDF**, and
**Gemini** (own key) work locally.

### A. Digital PDF — `TOR-Sample-Digital.pdf`
1. **Upload** → expect *"Digital PDF detected — ready for extraction."*
2. **Extract** with Typhoon → expect it to report reading the **exact text layer, skipping OCR**, offering
   *"Re-run with OCR"*. If it instead says it fell back to OCR, the text-quality guard mis-scored a clean
   file — that's a bug worth reporting.
3. Switch to **✎ Text PDF — No AI · exact**, re-extract → expect identical rows, instantly, no network.
4. **Check refs:** `3.1`, `๓.๒`, `3.3`, `4` (from `ข้อ 4`), `5` (from `(5)`), `๖`, `๖.๑๑.๒`.
   *Expected, not a bug:* title/subtitle lines become their own rows — the splitter is deliberately
   "one line = one row" rather than guessing what to merge.
5. **Table (p2):** the five equipment rows should join their three columns with ` — `
   (e.g. `1 — ตู้ควบคุม MDB ขนาด 400A — Siemens หรือเทียบเท่า`), not mash together and not split into
   separate rows.
6. **📷 Snip (p3):** crop the **vector diagram**, attach to a row → thumbnail appears, click to enlarge.
   Repeat cropping the **photo**. *(Covers both figure types; see §4 — this is unverifiable in the sandbox.)*
7. **Review tools:** search filters with a match count · tick rows → bulk status-set · duplicate a
   requirement verbatim → both rows get **⧉ Duplicate** · **Ctrl+Z / Ctrl+Y** reverts and redoes.
8. **Persistence:** reload → session restored incl. figures · **Save .json** → **New** → **Load .json**.
9. **Export:** set **Verified by…**, click **↓ Export .xlsx**, open in Excel → Thai renders with no font
   fiddling, status cells colour-coded, figures in a "Figure" column, Verified By + Date pre-filled.
10. **Accessibility:** Tab through the row fields → a visible focus ring on every control **including the
    Compliance Status and Category dropdowns**. With OS "reduce motion" on, the brand dot and progress bar
    should not animate.

### B. Scanned PDF — `TOR-Sample-Scanned.pdf`
11. **New**, then upload → expect *"Scanned PDF detected."*
12. Extract with **🆓 Browser OCR** (offline, no key; first run downloads a Thai language pack) → expect
    legible Thai/English roughly matching the source. OCR is never perfect; gibberish is a bug, minor
    character errors are not.
13. *Optional, deployed:* compare **✦ Typhoon** on the same file — it's Thai-tuned and should generally
    read Thai more accurately.

### Reporting a problem
Give the step number, expected vs. actual, a screenshot if visual, and the exact text of any banner.

---

## 4. What cannot be verified in the sandbox

Full table with reasons: [`RISK_REVIEW.md`](RISK_REVIEW.md) → *Verification limits*. In short, these need a
real browser or a deployed environment, and **must never be reported as verified without one**:

- **Snip's page render + drag-crop**, and **all OCR page rasterization** — `pdf.js` `render()` depends on
  `requestAnimationFrame`, which is paused in a hidden pane. (Not a code bug.)
- **Typhoon / Claude / Google Vision** — the `/api/*` proxies only exist on the deploy.
- **Gemini** — needs a real user-supplied key.
- **Screen-reader behaviour** — semantics verifiable by DOM inspection only.
- **`prefers-reduced-motion`** — the OS toggle can't be emulated.

---

## 5. Definition of done for a change

1. `typecheck` clean · all tests pass · `build` green.
2. The relevant part of §3 re-run — **no behaviour differs** unless the change intended it.
3. Keyboard-only pass over any changed UI.
4. An honest statement of what was verified **and what could not be** (§4).
5. Docs updated in the same commit: [`CHANGELOG.md`](CHANGELOG.md) (user-visible) ·
   [`ROADMAP.md`](ROADMAP.md) (plans/status) · [`RISK_REVIEW.md`](RISK_REVIEW.md) (risks) · this file
   (procedure/fixtures) · [`A11Y_PLAN.md`](A11Y_PLAN.md) (accessibility). One topic, one file.
