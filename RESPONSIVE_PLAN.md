# RESPONSIVE_PLAN.md — making Nyarlathotep work below 1500px

> Status: **plan only, nothing implemented.** Written 2026-08-18 after the engineer reported the app is
> "not functional at all" on mobile. Every number below is measured on the running app, not estimated.
>
> **Scope settled 2026-08-18: option (a), review-focused** — see §7.
>
> **Rollback point: [`v0.5.0`](https://github.com/Taam4142/Nyarlathotep/releases/tag/v0.5.0)** — the last
> state before any of this work. Cut 2026-08-19 at commit `79749a3`. `git checkout v0.5.0`, or roll
> back the deployment from Cloudflare Pages. Verified by actually checking the tag out and back.
>
> **All phases shipped 2026-08-19 (R1, R2, R2.5, R3, R4, R5).**

---

## 1. What is actually broken

`src/styles.css` contains **no width-based media query at all** — the only two are `prefers-color-scheme`
and `prefers-reduced-motion`. The layout has never been responsive; it was built for one screen size.

### 1.1 The fixed costs

| Element | Needs | Why |
| --- | ---: | --- |
| Sidebar | **288 px** | `--sb`, a hard width |
| Matrix table | **817 px** | sum of its column widths (Requirement alone is 285 px, Remarks 180 px) |
| Top bar | **1505 px** | 13 controls in a single `flex-wrap: nowrap` row |

So the two-pane layout needs **≈1105 px** before margins, and the top bar needs **1505 px** — more than a
1440 px laptop.

### 1.2 At 375 px (the screenshot)

| | |
| --- | --- |
| Sidebar | 288 px — **77 % of the screen** |
| Matrix | **87 px — 23 % of the screen**, for a table needing 817 px |
| Top-bar controls reachable | **2 of 13** |

The unreachable eleven: Project name, Verified by, Undo, Redo, engine picker, + Row, Snip, **Export
.xlsx**, Save .json, Load .json, New.

They are not merely off-screen — they are **unreachable**. `.topbar` is `flex-wrap: nowrap` with
`overflow: visible`, sitting inside `.app` which is `overflow: hidden`. So the excess is *clipped*, and
`scrollWidth > clientWidth` with no scroll container means there is no gesture that reaches them. On a
phone you cannot export your work, undo a mistake, or name the project.

### 1.3 A live desktop bug found while measuring this

The top bar overflows at **every** width tested, including 1440 px. At **1280 px — an ordinary laptop —
three controls are clipped**: "Save .json" is half-cut, and **"Load .json" and "New" are completely
hidden**.

This is not a mobile issue. Desktop users at 1280 px cannot load a previously saved matrix or start a new
one, and nothing on screen indicates the buttons exist.

> Honest note: this overflow was measured once before, during the engine-picker tooltip work, and
> correctly identified as pre-existing rather than caused by that change. But the check stopped there —
> nobody asked whether the pre-existing condition was itself harmful. It is. "Not caused by my change" and
> "not a problem" are different findings, and only the first was established.

### 1.4 Where it breaks, by width

| Viewport | Content after sidebar | Verdict |
| ---: | ---: | --- |
| 375 / 414 | 87 / 126 px | **unusable** |
| 768 | 480 px | table scrolls sideways; top bar clipped |
| 1024 | 736 px | table scrolls sideways; top bar clipped |
| 1280 | 992 px | table fits; **top bar clips 3 controls** |
| 1440 | 1152 px | table fits; top bar still clips |
| 1505+ | — | everything fits |

---

## 2. What mobile is actually *for*

This decides the whole design, so it is worth stating before drawing anything.

The workflow is: upload a TOR PDF → choose an engine → extract (OCR/AI) → **review ~77 rows, setting a
compliance status and remarks on each** → export `.xlsx`.

Sorted by how well each step suits a phone:

| Step | On a phone |
| --- | --- |
| **Review + set status/remarks** | **Genuinely good.** Read one requirement, tap a status, move on — this is triage, and triage is what phones are for. It is also the longest, most tedious part of the job. |
| Upload a PDF | Fine — the file picker works. |
| Extraction | Fine for the server-side engines (Typhoon/Claude/Gemini/Vision). Browser OCR is tesseract WASM — heavy on a phone, but it already warns it is the slow option. |
| Export `.xlsx` | Fine — it is a download. |
| Snip a figure | **Bad.** It is a mouse drag-crop, already known to be mouse-only (`A11Y_PLAN.md` P4, deferred). |
| Compare columns side by side | **Bad.** Inherently a wide-screen task. |

**Recommendation: build for review, not for parity.** The tool should let someone work through the matrix
on a phone — and should be honest about the two things that belong on a desktop, rather than shipping a
drag-crop that cannot work on touch.

This is the one open decision; see §7.

---

## 3. Design

### 3.1 Breakpoints derived from the measurements, not from a framework

| Range | Name | Layout |
| --- | --- | --- |
| **≥ 1120 px** | Desktop | Today's two-pane layout, unchanged. (1105 px is the real minimum; 1120 is the round number above it.) |
| **700–1119 px** | Compact | Sidebar collapses to an off-canvas drawer behind a toggle. That returns 288 px to the matrix, so the table fits from ~1000 px and only scrolls sideways below that. |
| **< 700 px** | Phone | Sidebar is a drawer; **the matrix becomes a card list**; the top bar collapses to brand + drawer toggle + overflow menu. |

700 px is chosen because that is roughly where the table stops being readable even with the sidebar gone
(817 px needed, and squeezing Requirement below ~250 px makes Thai text unreadable).

### 3.2 The table → card transformation (the core of it)

A dense 8-column table cannot be made to work at 375 px by shrinking. The standard, correct answer is to
stop being a table. One card per requirement:

```
┌──────────────────────────────────────┐
│ #3   Ref 3.2                  ⧉ dup  │   identity strip
│                                      │
│ ระบบควบคุมจะต้องใช้ PLC ยี่ห้อ Siemens    │   the verbatim requirement —
│ รุ่น S7-1500 เท่านั้น                    │   the primary content, full width
│                                      │
│ ┌────────┬─────────┬────────┬──────┐ │
│ │✓Comply │~Partial │✗Not C. │ —N/A │ │   status as a segmented control,
│ └────────┴─────────┴────────┴──────┘ │   not a <select> — one tap, no menu
│                                      │
│ Remarks ───────────────────────────  │
│ [                                  ] │
│                                      │
│ ▸ Translation · Category             │   collapsed by default
└──────────────────────────────────────┘
```

Why this shape:

- **The requirement text gets the full width.** It is the thing being read, it is often Thai, and it is
  the field the whole tool exists to preserve verbatim. Everything else is secondary.
- **Status becomes a segmented control, not a dropdown.** It is the single most-repeated action in the
  workflow; on touch, four visible targets beat a `<select>` that opens an OS picker. Four 24 px+ targets
  fit comfortably at 375 px.
- **Translation and Category collapse.** The app already has `showTr` / `showCat` toggles, so "these
  columns are optional" is an established concept — the card just applies it by default.
- **Row actions de-emphasised.** Insert/delete move behind the card's overflow, since accidental deletion
  on touch is worse than an extra tap.

The card list reuses the existing filter/search/bulk-select logic untouched — it is a different rendering
of the same rows, not a different data path.

### 3.3 Top bar

Three groups, collapsing in priority order as width shrinks:

| Group | Contents | Desktop | Compact | Phone |
| --- | --- | --- | --- | --- |
| Identity | brand, Help | always | always | always |
| Session | Project name, Verified by | inline | **into drawer** | into drawer |
| History | Undo / Redo | inline | inline | inline (they are frequent) |
| Engine | engine picker | inline | inline | into drawer |
| Actions | + Row, Snip, Export, Save, Load, New | inline | **overflow menu** | overflow menu |

**This also fixes §1.3 for desktop** — collapsing Actions into an overflow menu below ~1500 px means
nothing is ever clipped, at any width. One change, two problems.

### 3.4 Sidebar as a drawer

Below 1120 px the sidebar slides in from the left over a scrim, opened by a toggle in the top bar. It
keeps its current content and order (PDF upload, engine panel, comply library) — only its container
changes. Closing on scrim tap, Escape, and route-less state means no router work.

Focus management matters here and the pattern already exists in the codebase: `HelpModal` and `SnipModal`
already do `role="dialog"` + `aria-modal` + Escape. The drawer should match them, and should *also* get
the focus trap that `A11Y_PLAN.md` §3-G records as still missing on those two.

---

## 4. Phases

Ordered so the highest-value, lowest-risk work lands first, and so the desktop bug is fixed before any
layout is restructured. One phase = one commit = one revert.

| Phase | Change | Risk | Fixes |
| --- | --- | --- | --- |
| **R1** | Top-bar overflow menu + wrapping | **low** | the live desktop bug (§1.3) *and* 11 unreachable phone controls — ✅ **Done** |
| **R2** | Sidebar → drawer below 1120 px | med | returns 288 px to the matrix at every size below desktop — ✅ **Done** |
| **R2.5** | Reclaim vertical space on phones | low | 36 % → **64 %** of a phone screen — ✅ **Done** |
| **R3** | Matrix → card list below 700 px (CSS, not a second component) | ~~high~~ **low** | makes the phone genuinely usable — ✅ **Done** |
| **R4** | Touch/mobile polish | low | iOS input-zoom, safe-area insets, 40 px targets — ✅ **Done** |
| **R5** | Honest degradation | low | Snip disabled on coarse pointer, with a stated reason — ✅ **Done** |

**R1 is worth doing on its own even if nothing else follows**, because it fixes a real bug that affects
people using the tool today on ordinary laptops.

**R3 is the expensive one.** It is a second rendering of the row, so the risk is divergence: a fix applied
to the table row and not the card. Mitigation is to extract the per-row logic (status set, remarks edit,
duplicate flag, selection) so both renderings call the same handlers, and to make the smoke tests run at
both widths.

---

### R1 — shipped 2026-08-19

Two changes, together guaranteeing nothing is ever clipped at any width:

1. **The secondary actions moved into an overflow menu** (`+ Row`, Snip, Save/Load `.json`, New).
   Export stays inline as the primary output action. The menu is **permanent, not behind a media query** —
   one rendering cannot drift from a duplicate (risk V2), and the inline row did not fit even at 1440 px.
2. **`.topbar` now wraps** (`flex-wrap: wrap` + `min-height` instead of a fixed `height`).
   The menu alone was not enough: it cut the requirement from 1505 px to 1173 px, which fixes 1280 px but
   still clipped at 1120 px. Wrapping turns any remaining overflow into a taller bar rather than an
   unreachable control — a guarantee that holds at every width regardless of how many controls the bar
   later holds.

| | before | after |
| --- | ---: | ---: |
| Intrinsic width needed | 1505 px | **1173 px** |
| Clipped controls at 1280 px | 3 (incl. Load `.json`, New) | **0** |
| Reachable controls at 375 px | 2 of 13 | **8 of 8** |
| Top-bar height at 1280 px | 56 px | **56 px** (unchanged — does not wrap) |

**Desktop is visually unchanged**: at ≥1173 px the bar still fits on one 56 px line.

Accessibility: `aria-haspopup="menu"`, `aria-expanded`, `role="menu"`/`menuitem`, closes on
Escape and on outside click — matching the existing modal patterns.

**Verified:** typecheck exit 0, 125 tests, build green. In-browser at 375 / 1120 / 1280: zero horizontal
page overflow and zero clipped controls at every one; menu opens, every item fires, Escape and
outside-click both close it, and the menu closes after an action. No console errors.

The 5 UI smoke tests failed on first run because they clicked the top-bar `+ Row` that had just moved —
the tests catching a real interaction change. Their helper now uses the always-visible `+ Add Row`
beneath the table (same handler, keeps those tests about editing rather than about the menu), and **two new
tests** cover the menu itself.

⚠️ **Still ugly on a phone, by design of the phasing.** At 375 px the bar wraps to ~200 px tall because the
project-name and verified-by fields are still inline. R2 moves them into the drawer, which is what shrinks
it. R1's promise was *reachable*, not *pretty*.

---

### R2 — shipped 2026-08-19

Below 1120 px the sidebar slides off-canvas behind a ☰ toggle, over a scrim. Above it, nothing applies —
the sidebar is the plain 288 px column it has always been.

| At 375 px | before | after |
| --- | ---: | ---: |
| Matrix width | 87 px (23 % of screen) | **375 px (100 %)** |
| Top-bar height | 200 px (R1) | **160 px** |

The drawer is a real dialog while compact — `role="dialog"`, `aria-modal`, scrim, Escape, focus moves in
and returns to the toggle on close — and **none of those semantics apply on desktop**, where it is just a
column. That is why the breakpoint is mirrored in JS (`useMediaQuery`) and not only in CSS.

The top-bar reduction came from letting the three hard-width controls flex, **not** from moving them into
the drawer as §3.3 first suggested — moving them would mean a second rendering of the same inputs, which
is exactly risk V2. Same markup, different sizing.

**Three bugs found and fixed during verification**, each by a check that could have been skipped:

1. **Focus never entered the drawer.** The first focusable descendant is the `display:none` file input
   behind the upload zone; focusing it silently does nothing, so focus stayed on the toggle, outside the
   dialog. Now filtered to visible controls.
2. **The visibility filter used `offsetParent !== null`**, which is also null for `position:fixed`
   elements (a false negative) and null for *everything* under jsdom, which does no layout — so it was
   both subtly wrong and untestable. Switched to computed `display`/`visibility`.
3. **`useMediaQuery` crashed every App test.** jsdom does not implement `matchMedia`. Now guarded,
   falling back to the desktop layout when the environment cannot answer.

**Verified:** typecheck exit 0, 130 tests, build green. Desktop measured against its pre-responsive
baseline and byte-identical (sidebar 0,56 288×844; main 288,56 992×844; topbar 56 px; `position: static`;
no dialog role; toggle hidden; no scrim). At 1024 and 375: drawer opens/closes via toggle, scrim and
Escape; focus moves in and returns; no page overflow; every top-bar control reachable. A new jsdom test
covers the drawer with a `matchMedia` stub, since without one that path is invisible to CI.

### R2.5 — reclaim vertical space on phones

**Why this was not in the original plan.** The plan was written around the *horizontal* problem: a 288 px
sidebar and an 817 px table crammed into 375 px. That framing was right as far as it went, and R1/R2 fixed
it — the matrix went from 87 px wide (23 % of the screen) to the full 375 px. But width was only half the
story. Once the matrix had the full width, the vertical stack became the binding constraint, and the plan
had almost nothing to say about it.

Measured at 375 × 812 after R2:

| Band | Height | Share of screen |
| --- | ---: | ---: |
| Top bar | 160 px | 20 % |
| Alert banner | 82 px | 10 % |
| **Toolbar** | **205 px** | **25 %** |
| **Matrix** | **295 px** | **36 %** |
| Bottom bar | 51 px | 6 % |

Chrome takes **517 px — 64 % of the screen** — to show 295 px of matrix. The toolbar is the largest single
consumer: stats 36 + separator 16 + filters 37 + search 29 + toggles 18, plus roughly 69 px of padding and
gaps that were tuned for a desktop bar.

**R3 would not have fixed this.** Cards change how a row *renders*, not how much vertical room the list is
given. Cards in a 295 px window means seeing about two of them — the highest-risk phase would have shipped
and the screen would still feel cramped. Hence R2.5 first.

**Target: the matrix gets more than 50 % of the screen.**

| Change | Saves | Notes |
| --- | ---: | --- |
| Project name, Verified by and the engine picker **move into the drawer at phone width** | ~104 px | This is what §3.3 specified for Phone all along. R2 flexed them instead, which was the right call for tablet widths but leaves four wrapped rows on a phone. **Moved, not duplicated** — one rendering, placed conditionally, so risk V2 does not apply. |
| Column toggles → drawer; phone-tuned toolbar padding; filters as one scrollable strip | ~115 px | The toggles are view settings, not per-moment actions, so they belong with the other settings. |
| Alert banner compacted on phone | ~40 px | It is already dismissible; this shortens it while shown. |

Expected result: **295 px → ~554 px, about 68 %**.

**Result, measured at 375 × 812:**

| Band | before | after |
| --- | ---: | ---: |
| Top bar | 160 px | **77 px** |
| Alert banner | 82 px | **51 px** |
| Toolbar | 205 px | **104 px** |
| Bottom bar | 51 px | **42 px** |
| **Matrix** | **295 px (36 %)** | **518 px (64 %)** |

With the restored-session notice dismissed it reaches ~70 %. At 768 px the matrix is already at 70 %.

The relocation is a **move, not a copy**: `sessionFields`, `enginePicker` and `viewToggles` are each
defined once and placed in either the top bar or the drawer. Verified in-browser that at phone width the
controls are absent from the top bar and present in the drawer, and that each still drives state — project
name, verified-by, engine change (the sidebar engine panel reacts), and a column toggle changing the table
header count. A test pins **exactly one instance** of each at both desktop and phone widths, because a
silently duplicated control is precisely risk V2.

Desktop re-measured against the pre-responsive baseline and unchanged (sidebar 0,56 288×844; main 288,56
992×844; topbar 56 px), with every relocated control back in the top bar. Tablet (768 px) keeps them inline
as intended — only phone width relocates.

**Deliberately not doing (yet): letting the chrome scroll away.** The native mobile pattern is to let the
whole page scroll so the header disappears and the list effectively gets the entire screen. It is the
better end state, but it changes the layout model — the matrix currently scrolls inside its own container
with a sticky header, which would need rethinking — and that is meaningful risk for a target the cheaper
approach already clears. Kept as a follow-up to consider once the compacted version has been used in
anger.

---

### R3 — shipped 2026-08-19, and done differently than planned

**The plan said bespoke card JSX. That was the wrong call, and the plan was revised before building.**

§3.2 assumed cards required a second rendering — a card component swapped in below 700 px. But that is
precisely risk **V2**, the divergence the whole phase list has been arranged to avoid: a fix landing on the
table row and not the card. The classic CSS responsive-table pattern gets the same result on the *existing*
markup, where a duplicate is structurally impossible.

| At 375 px | before | after |
| --- | ---: | ---: |
| Table intrinsic width | 817 px | **370 px — fits** |
| Sideways scrolling | **442 px** | **none** |
| Requirement field | 261 px wide, starting off-screen at x=131 | **321 px, starts at x=25, fully visible, 15 px** |
| Card/row height | 77 px (unreadable) | 311 px (readable) |

Before R3, reading a requirement and setting its status sat at *different horizontal scroll positions* —
the review loop itself was broken.

**The card is a flex row, not stacked blocks.** Stacking every cell full-width gave a 396 px card, barely
one per screen, because Category and Status each spent ~46 px on a label above a 28 px control. Flex pairs
them on one line, and `order` pulls the row-actions cell up onto the identity strip instead of leaving it
stranded on a line of its own. 396 → 351 → **311 px**.

**Two things the CSS route costs, both handled rather than accepted:**

1. `display:block` strips a table's *implicit* ARIA roles. Restored explicitly
   (`role="table"/"rowgroup"/"row"/"cell"`) and pinned by a test — those attributes look redundant on
   desktop and a later cleanup could plausibly delete them.
2. Drag-reorder is disabled at phone width: `display:block` breaks dnd-kit's transform measurement, and
   dragging a full-width card on touch is poor anyway. Disabling it while filtering/searching was already
   an established pattern (risk V3).

Status stays a native `<select>` rather than the segmented control §3.2 imagined. That was a design
*opinion* written into the plan, never measured; on touch a `<select>` opens a large OS-native picker.

**Verified:** typecheck exit 0, 133 tests, build green. At 375 px: no sideways scroll, requirement fully
visible, editing/status/remarks/insert/delete all still work, roles present, labels rendered from
`data-label`. At 1280 px the table is still a real table (`table-row`/`table-cell`, header
visible, 77 px rows, drag grip active) and the sidebar matches its pre-responsive baseline exactly.

---

### R4 + R5 — shipped 2026-08-19

**R4 — the real find was iOS input zoom, not padding.** iOS Safari zooms the whole page whenever a focused
field has a font-size below 16 px, and then leaves it zoomed. **Seven of this app's field types were
12–15 px**, including the requirement and remarks textareas tapped most in the review loop. That is a
genuine mobile bug, not polish. Now **zero fields would trigger it**.

Getting there took three cascade fixes, each found by measuring rather than assuming the edit had worked:

1. The rule was first written with element selectors (`input, textarea, select`, specificity 0,0,1) and
   lost to the existing class rules (0,1,0). Every affected class is now listed explicitly.
2. The requirement field was pinned at 15 px by my own R3 rule (`.table-area td.c-req .cell-in`, 0,3,1).
   Raised to 16 px — it reads the same.
3. The remarks textarea carried an **inline** `fontSize: 14` in the JSX, which no stylesheet rule can
   override. Moved into CSS (same value on desktop) so a media query can reach it — which then needed a
   matching 0,2,0 selector to beat the rule I had just added.

Also: `text-size-adjust: 100%` (stops iOS inflating text in landscape), transparent tap highlight,
safe-area insets on the top bar, bottom bar and drawer, 40 px row-action targets, 20 px row checkbox.

**R5 — Snip is disabled on a coarse pointer, with the reason visible.** Keyed on `(pointer: coarse)`,
not on width: the question is whether the device can drag precisely, which a narrow desktop window can and
a wide tablet cannot. The menu item carries a short visible note and a full explanation in its title,
rather than being silently absent or silently broken. On a fine pointer nothing changes — the title reverts
to the real reason it may be unavailable (no PDF loaded yet).

**Verified:** typecheck exit 0, 134 tests, build green. At 375 px zero fields would zoom, Snip states its
reason, other menu items unaffected. At 1280 px desktop font sizes are untouched (15/14/13 px exactly as
before), Snip is enabled again, rows are still `table-row` at 77 px, and the sidebar matches its
pre-responsive baseline.

> ⚠️ **Still emulation, not a real device.** Chrome gets layout right but not iOS Safari's dynamic viewport,
> its momentum scrolling, or the actual zoom behaviour. The 16 px threshold and the safe-area insets are
> precisely the things that want confirming on real hardware.

---

## 5. Risks

| ID | Risk | Mitigation |
| --- | --- | --- |
| **V1** | **Desktop regression.** This is the biggest UI change the project has had, and desktop is the primary surface. | Every phase is additive behind a media query; the ≥1120 px path must remain byte-identical in behaviour. Measure the desktop layout before/after each phase, as was done for the `<main>` landmark change. |
| **V2** | **Two row renderings drift apart** (R3). | Shared handlers, not duplicated logic. Add a card-mode smoke test alongside the existing table-mode ones. |
| **V3** | **dnd-kit drag-reorder on touch.** `PointerSensor` handles touch, and `.row-grip` already sets `touch-action: none`, but reordering inside a card list is a different interaction. | Decide explicitly: keep drag in card mode, or disable it below 700 px (it is already disabled while a filter or search is active, so a conditional is an established pattern). |
| **V4** | **Snip is mouse-only** and cannot work on touch. | R5 — hide it below the touch breakpoint with a stated reason. Do not ship a control that cannot work. |
| **V5** | **The preview pane cannot verify real PDF rendering** (`RISK_REVIEW.md` "Verification limits"), so the mobile extraction path stays unverified here. | Layout and interaction verified at emulated widths; the extraction path needs the engineer's real phone. Say so rather than implying coverage. |
| **V6** | **Emulated ≠ real.** Chrome's mobile emulation gets layout right but not iOS Safari's dynamic viewport, momentum scrolling, or input zoom. | R4 addresses the known iOS quirks explicitly; final confirmation needs a real device. |

---

## 6. Definition of done, per phase

1. `npm run typecheck` clean (exit code checked directly, not through a pipe) · full suite green ·
   `npm run build` green.
2. **Desktop layout measured before and after** and unchanged at ≥1120 px.
3. Layout measured at 375 / 414 / 768 / 1024 / 1280 with **zero horizontal page overflow** and **zero
   clipped controls** at every one.
4. The contrast guard (`src/lib/contrast.test.ts`) still passes — new mobile styles must not introduce new
   failing pairings.
5. Touch targets in any new mobile UI meet 24×24 (`DESIGN_TOKENS.md` §3.2); prefer 44×44 where space
   allows, since these are thumb targets rather than mouse targets.
6. Honesty note in the commit: what was verified at emulated sizes, and what still needs a real device.

---

## 7. Scope decision — **settled: (a) review-focused**

Decided by the engineer, 2026-08-18.

**Mobile targets the review workflow.** Upload, extract, review (set status + remarks), and export all
work on a phone. Snip and side-by-side column comparison remain stated desktop features.

The reasoning behind the recommendation, kept for whoever reads this later: the valuable phone task is
working through the matrix setting statuses — that is triage, it is the longest and most tedious part of
the job, and it suits a phone well. Cropping a figure on a phone is rare and awkward regardless of how
much work is put into it, and `Snip` is a mouse drag-crop already known to be mouse-only
(`A11Y_PLAN.md` P4). Shipping a control that cannot work on touch is worse than saying plainly that it
is a desktop feature.

Rejected alternatives:

- **(b) Full parity** — adds a phase for a touch-capable Snip, for a use case that stays awkward even
  when it works.
- **(c) Fix the clipping only** — ships R1 alone. The app would stop hiding controls, but the phone layout
  would remain a 23 %-wide column, i.e. still unusable for the task mobile is actually good at.

Everything in §4 is already written for (a), so the phase list stands as-is: **R1 → R2 → R3 → R4 → R5**.

## 8. Out of scope

- A native app, or a service worker / offline mode.
- Landscape-specific layouts — the breakpoints are width-driven, and landscape phones land in Compact.
- Redesigning the desktop layout. Desktop is the primary surface and is not the problem here.
- Print stylesheets. The deliverable is `.xlsx`, not a printed page.
