# RESPONSIVE_PLAN.md — making Nyarlathotep work below 1500px

> Status: **plan only, nothing implemented.** Written 2026-08-18 after the engineer reported the app is
> "not functional at all" on mobile. Every number below is measured on the running app, not estimated.
>
> **Scope settled 2026-08-18: option (a), review-focused** — see §7.

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
| **R1** | Top-bar overflow menu | **low** | the live desktop bug (§1.3) *and* 11 unreachable phone controls |
| **R2** | Sidebar → drawer below 1120 px | med | returns 288 px to the matrix at every size below desktop |
| **R3** | Matrix → card list below 700 px | **high** | makes the phone genuinely usable |
| **R4** | Touch/mobile polish | low | 44 px targets, `-webkit-text-size-adjust`, safe-area insets, momentum scroll |
| **R5** | Honest degradation | low | Snip hidden on touch with an explanation rather than silently broken |

**R1 is worth doing on its own even if nothing else follows**, because it fixes a real bug that affects
people using the tool today on ordinary laptops.

**R3 is the expensive one.** It is a second rendering of the row, so the risk is divergence: a fix applied
to the table row and not the card. Mitigation is to extract the per-row logic (status set, remarks edit,
duplicate flag, selection) so both renderings call the same handlers, and to make the smoke tests run at
both widths.

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
