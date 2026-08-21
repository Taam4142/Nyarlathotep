# TESTING.md — Nyarlathotep

> How this project is verified: the automated suite, the sample PDFs, the manual walkthrough, and — most
> importantly — **what cannot be verified automatically and therefore needs a human**.
> Risk context: [`RISK_REVIEW.md`](RISK_REVIEW.md) · Plan: [`ROADMAP.md`](ROADMAP.md).
> Last updated 2026-08-20.

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

> `App.tsx` is 2,900+ lines and, as of 2026-08-07, type-checked (`@ts-nocheck` dropped — see
> [`ROADMAP.md`](ROADMAP.md) #5). That catches structural mistakes (wrong ref/state shapes), but the
> project's tsconfig keeps `strict`/`noImplicitAny` off, so most event handlers and function params still
> aren't required to be annotated — the type checker is a partial net here, not a full one. The 6 smoke
> tests are still the main protection for actual UI *behaviour*; be careful with UI changes regardless.

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
   *Expected, not a bug:* title/subtitle lines become their own rows. Note the splitter is **no longer**
   strictly "one line = one row" — since 2026-08-20 it rejoins lines that a requirement wrapped across,
   using line geometry (§3b). A requirement spanning several PDF lines should now appear as ONE row.
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

## 3b. The real-document pass (2026-08-20)

The synthetic fixtures in §2 are written by hand, which means they can only ever
confirm the assumptions used to write them. On 2026-08-20 the extraction path was
run against **three published Thai government TORs** — 45 pages, three agencies,
three sets of house conventions:

| Source | Document | Pages |
| --- | --- | ---: |
| Office of the Auditor General | equipment procurement | 9 |
| Rajamangala Univ. of Technology Srivijaya | CCTV / fingerprint system | 22 |
| Dairy Farming Promotion Organization | facility works | 14 |

**It found two real bugs within the hour, neither visible to the 137 tests then
passing.** Both were on the *default* path — Typhoon on a digital PDF reads the
text layer directly — not in a niche mode:

1. **Clause numbers written with spaced dots** (`๓ . ๑`) matched only their first
   component, so ๓.๑ through ๓.๗ all carried ref "๓".
2. **Token-splitting corrupted the requirement text.** `2,000,000.-` became
   `2,000, — 000. - ` — a verbatim-law violation on a budget figure.

A third finding, wrapped-line over-splitting, was fixed the same day.

### Repeating it

Not automated, because it needs documents this repo does not ship. To redo it:

1. Fetch a few public TOR PDFs (Thai agencies publish procurement TORs openly).
2. Copy them into `public/` temporarily — the dev server must serve them over
   HTTP so the app's own pdf.js can load them. **Remove them afterwards**; they
   are not committed.
3. In the browser console against `npm run dev`, import the real modules
   (`/src/lib/pdf.ts`, `/src/lib/extract.ts`, `/src/lib/tables.ts`) and run
   them directly — not a reimplementation.

### The three checks worth running every time

- **Verbatim integrity.** Concatenate every glyph pdf.js reports, strip
  whitespace, and compare against the extractor's output similarly stripped. They
  must contain the *same characters in the same counts*. Compare multisets rather
  than strings: the extractor deliberately reorders cells into visual reading
  order, while raw pdf.js follows the PDF's content stream, so a pure ordering
  difference is expected and correct.
- **Rows per page.** A TOR page holds perhaps 5–15 requirements. ~30 means the
  splitter is fragmenting; a very low number means it is over-merging.
- **Share of rows carrying a real clause reference.** Low means fragments are
  being emitted as requirements. It rose from 24–49 % to 61–84 % once wrapped
  lines were joined.

  > **Read this one with care on a bulleted document.** Where requirements are
  > dash-bulleted spec lines hanging off a numbered clause, most rows correctly
  > have no ref of their own, and the share stays low however good the split is.
  > On the AMR TOR it reads 28 % while the extraction is sound. Rows-per-page is
  > the reliable signal there.

---

## 3c. The first real *AMR* document (2026-08-20)

§3b used three published government TORs. This pass used a **real AMR equipment
TOR** (2 pages, scanned). It differed from all three in two ways that mattered:

- it is **scanned**, so it runs the **OCR path**, which §3b never exercised;
- its house style is **bulleted**, not paragraphed — most requirements are
  dash-bulleted spec lines hanging off a numbered clause, with no ref of their own.

**It immediately caught a regression shipped the same day.** `joinWrappedRows`
guarded against absorbing a line that opened a *clause reference*, but not one
that opened a *bullet*. Given three consecutive bullets where the first ran to
the margin, it welded all three into a single row — the exact failure the guard
existed to prevent. The three published TORs are paragraph-style and never
exercised it. Fixed by widening the guard to bullet markers (`opensNewItem`).

> A marker only counts as a bullet when whitespace follows it. That is what
> separates a bullet from a minus sign, and real TORs write both on one line:
> `- มีอุณหภูมิในการใช้งาน -๔๐ ถึง ๘๐ องศาเซลเซียส`.

### What the OCR path looks like on this document

Measured with the free local Tesseract engine and `structureWithoutAI`:

| Measure | Value | Healthy |
| --- | ---: | --- |
| Rows per page | **40** | 5–15 |
| Continuation fragments | **28 %** | near 0 |
| Page furniture emitted as requirements | **~7 %** | 0 |
| Rows carrying a real clause ref | **21 %** | 60 %+ |

Three things are **known-open** on the OCR path (none regressions — all
pre-existing, all now measured rather than assumed):

1. **Wrapped lines fragment.** ~~Open~~ **FIXED 2026-08-21**
   (`src/lib/ocrlines.ts`). Tesseract does report per-line bounding boxes — it
   just omits them unless the caller asks for `blocks`, and the code took only
   `data.text`. Asking for them makes the same geometric signal the digital path
   uses available here, so the line boxes are adapted into the `RowCell` shape
   and fed to the existing `joinWrappedRows` rather than growing a second,
   separately-wrong copy of the rule. On the AMR document: 75 → 61 rows,
   80 OCR lines → 65. Falls back to the flat text when no geometry is present —
   losing the rejoining is untidy, losing the text would be a correctness bug.
2. **Signature blocks and page numbers become requirements.** ~~Open~~ **FIXED
   2026-08-21** (`src/lib/furniture.ts`). Every page of a Thai government TOR ends
   with a committee signature block (`ลงชื่อ … ประธานกรรมการ`) and a centred page
   number; these were emitted as requirement rows, ~7 % here, scaling with page
   count rather than requirement count. Three rules, each needing a positive
   signal: the word `ลงชื่อ`; a line *ending* in a committee role (anchored to the
   end so a requirement mentioning a committee is untouched, and fuzzy in the
   middle because one scan read `ประธานกรรมการ` as `ปรัสสานกรรมาร`); and too few
   letters while carrying a digit. A line opening a clause ref or bullet is
   never furniture whatever its length — structure beats length, so a page
   number written `- 1 -` reads as a bullet and deliberately survives. On the AMR
   document: 80 → 75 rows, the 5 removed all genuine furniture. The count is
   always reported in the notice, so nothing disappears silently.
3. **OCR digit errors are silent.** Sampled against the page images, Tesseract
   systematically confuses Thai `๔` and `๕`. Observed: stainless `๓๐๔` read as
   `๓๐๕`; `IP ๖๘` as `IP ๒๕`; `๔๐ นิ้ว` as `๕๐ นิ้ว`; clause `๓.๑๑.๔` as `๓.๑๑.๕`;
   a list item `๔.` as `๕.`, which produced a **duplicate ref**. These are exactly
   the values an engineer checks. Tesseract reports per-word confidence and the
   code discards it; surfacing it would satisfy *flag, never silently fill*
   rather than presenting a confident wrong number.

### Why confidence-flagging was investigated and rejected

The obvious answer to (3) is to surface Tesseract's per-word confidence and flag
the low scores. **Measured on this document, that does not work**, and the
measurement is worth keeping so it is not re-proposed:

| Reading | Should be | Word confidence |
| --- | --- | ---: |
| `IP ๒๕` | `IP ๖๘` | **96, 96** |
| `HOMI` | `HDMI` | 84 |
| `Ethemet` | `Ethernet` | 84 |

Across 1,438 words on one page: median confidence **93**, only **30 below 70**,
and `choices` was **never** populated with an alternative (0 words had more than
one candidate). At symbol level the wrong `m` in `Ethemet` — two glyphs, `rn`,
read as one — scored **99**.

A threshold at 70 would flag ~2 % of words and miss every error in the table. It
would read as reassurance while the ingress rating is still wrong. **A signal
that lies is worse than no signal**, so none is shown.

Raising render scale is not a fix either. At scale 4, `HDMI` came out right but
the resolution figures degraded further (`๓,๘๔๐` → `ows`); page-segmentation mode
6 changed nothing. Correct on 3 of 8 checked spec values, versus 2 of 8 at the
current scale 3.

What IS reliable is the *shape* of the failure: it lands on numerals. So the
browser-OCR warning is keyed to that instead — it counts the rows holding a Thai
numeral and names the failure mode (`src/lib/ocrtrust.ts`). On this document, 54
of 80 rows. The real fix is a Thai-tuned engine; **Typhoon on this file has not
yet been measured** (it needs the deployed proxies and an explicit go-ahead to
spend API calls).

**None of this is visible to the test suite**, which is why it is written down
here. The engineer's own AMR documents remain the highest-value test input the
project has.

---

## 3d. Engine bake-off on a real scanned TOR (2026-08-21)

The same real AMR document (2 pages, scanned), read by **browser Tesseract** and
by **Typhoon** through the deployed site, scored against the source page images.

### Structure — the two now agree

| | rows | per page | furniture rows |
| --- | ---: | ---: | ---: |
| Tesseract (after the §3c fixes) | 61 | 30.5 | 0 |
| Typhoon | 60 | 30.0 | 0 |

Worth stating plainly: **the splitting is no longer the problem.** Before the
§3c fixes Tesseract produced 80 rows against Typhoon's 60; it now lands within
one row of a Thai-tuned VLM. Of Typhoon's 60 rows only 3 open with neither a
clause ref nor a bullet, and all 3 are genuine sub-headings or paragraph bodies
rather than fragments.

### Accuracy — the two do not agree at all

Tesseract got **every** checked specification value wrong. Typhoon got every one
right.

| Value | Source | Tesseract | Typhoon |
| --- | --- | --- | --- |
| screen size | `๔๐ นิ้ว` | `๕๐ นิ้ว` ✗ | ✓ |
| video port | `HDMI` | `HOMI` ✗ | ✓ |
| resolution | `๔,๐๙๖ x ๒,๑๖๐` | `๕,๐๑๒ x ๒,๑๒๐` ✗ | ✓ |
| aspect ratio | `๑๖:๙` | `๑๒:@` ✗ | ✓ |
| ingress rating | `IP ๖๘` | `IP ๒๕` ✗ | ✓ |
| power input | `๒๔ VDC` | `๒๕ VDC` ✗ | ✓ |
| signal output | `๔-๒๐mA` | `๕-๒๐กา#` ✗ | ✓ |
| temperature | `-๔๐ ถึง ๘๐` | `-๕๐ ถึง ๕๐` ✗ | ✓ |
| radar band | `๘๐ GHz` | `๕๐ GHz` ✗ | ✓ |
| beam angle | `๘°` | `๕*”` ✗ | ✓ |
| I/O ports | `AI ๔, DI ๑๔` | `Al ๕, Dl ๑๕` ✗ | ✓ |
| ethernet | `Ethernet` | `Ethemet` ✗ | ✓ |
| protocol | `Protocol Modbus` | `1๐1๐๕๐!` ✗ | ✓ |
| cellular | `๓G/๔G` | `๓6/๕6` ✗ | ✓ |
| GSM bands | `๘๕๐/๙๐๐/๑๘๐๐/๑๙๐๐MHz` | `๕๕๐/๕๐๐/๑๕๐๐/๑๕๐๐|ป12` ✗ | ✓ |
| serial | `RS-๒๓๒/RS-๔๘๕` | `พ5-๒๓๒/@35-๕๕๕` ✗ | ✓ |
| steel grade | `๓๐๔` | `๓๐๕` ✗ | ✓ |
| humidity | `๙๕%` | `๓๕%` ✗ | ✓ |
| clause ref | `๓.๑๑.๔` | `๓.๑๑.๕` ✗ | ✓ |
| list item | `๔.` | `๕.` — a **duplicate ref** ✗ | ✓ |

**Evidence classes**, since not all of these are equally verified. Read directly
off the page images at high magnification: screen size, video port, resolution,
aspect, ingress, power input, signal output, temperature. Corroborated by
sequence or by being a standard value rather than by direct reading: the clause
refs (`๓.๑๑.๓` → `๓.๑๑.๔` → `๓.๑๒`; `๒.๑`–`๒.๔`), stainless `๓๐๔`, `๘๐ GHz` radar,
quad-band GSM, RS-232/485, 3G/4G. Nothing here rests on Typhoon alone.

### The finding that matters

**The two engines fail in different places, and only one of them fails
dangerously.**

Tesseract's errors land on **numbers** — an ingress rating, a steel grade, a
temperature range — and it reports them at 92–99 % confidence (§3c). They are
invisible: nothing in the output says the value is suspect, and a plausible
wrong number reads exactly like a right one.

Typhoon's remaining errors land on **Thai words**: `ดัน` read as `ต้น`, `เสายึด` as
`เสาธียด`, `ควบคุม` as `ความคุม`, `บ่อสูบ` as `บ่อลอบ`, `คอนกรีต` as `คอนกรีท`. Any Thai
reader spots these immediately, and **none of them changes a specification
value.**

For a compliance matrix, where the numbers largely *are* the requirement, that
difference decides the engine. **On scanned Thai documents, prefer Typhoon.**
Browser OCR remains the right choice offline, for a first look, or where no
network is available — and it now carries a warning naming exactly this risk
(`src/lib/ocrtrust.ts`).

### Two things learned about the Typhoon API

- It **rejects JPEG with HTTP 400** and accepts PNG. `rasterizePage` returns PNG,
  so the app is fine — but anything sending it a snipped figure would not be.
- It is **layout-sensitive**. A cropped strip of four lines returned only the
  first; the same crop padded onto a page-shaped white canvas returned just
  `- 1 -`. It needs whole pages, which is what `ocrPDFTyphoon` sends.

---

## 3e. Accessibility audit with axe (release-time)

Run against the **deployed** site, not the dev server, and not jsdom. The CSP already
allows `cdn.jsdelivr.net` in `script-src` (tesseract.js needs it), so `axe-core` loads
with no config change:

1. **Clear `localStorage` first.** Autosave restores the last session, and a restored
   matrix puts controls in states the empty app never shows. One finding on 2026-08-21 was
   raised and withdrawn purely because a disabled button had been measured while rows were
   still restored.
2. Open the deploy, inject `https://cdn.jsdelivr.net/npm/axe-core@4.10.2/axe.min.js`.
3. `await axe.run(document, { resultTypes: ["violations"] })` in each state: empty/upload,
   populated matrix, drawer open, help modal open.
4. **Repeat at BOTH a desktop width and a mobile width — this is not optional.**
   On 2026-08-21 the mobile-only run reported the landmark rule on **one** node; the same
   rule at 1280 px fired on **19**, because the sidebar is collapsed behind the drawer at
   narrow widths and simply is not in the audited DOM. Conversely the scrollable-region
   finding exists *only* at narrow widths. Each width hides about half the findings.

Do not trust a violation without measuring it. Axe reports the rule; confirm the cause from
computed values (`scrollWidth` vs `clientWidth`, `tabIndex`, whether the region contains
focusable children) before changing anything.

Baseline as of 2026-08-21: **37–40 rules pass** in every state; three violations open, recorded
as findings K, L and M in [`A11Y_PLAN.md`](A11Y_PLAN.md) with the plan to fix them (P5).

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
