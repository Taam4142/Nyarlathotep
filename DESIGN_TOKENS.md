# DESIGN_TOKENS.md — the palette, the sizes, and the rules that govern them

Canonical reference for every colour token and interactive size in
[`src/styles.css`](src/styles.css). **This file exists because its absence caused a real bug:** the P3b
accessibility pass derived `--txt3` and verified it against pure white alone, because nothing recorded
which surfaces that token actually lands on. It shipped failing four of the five surfaces it is used on,
and stayed that way until Lighthouse caught it months later.

So the rule this file enforces is: **a text token is only "verified" when it has been checked against
every background it can actually land on — not against white, and not against a guess.**

> Numbers here are computed, not eyeballed. The generating scripts live in the session scratchpad; the
> formula is WCAG 2.x relative luminance, anchored against published reference pairs (`#767676` on white =
> 4.54:1, `#777777` = 4.48:1, black-on-white = 21:1) before any result was trusted.

Status legend: ✅ meets WCAG AA · ❌ fails · 🔶 proposed, not yet applied.

---

## 1. Colour tokens

### 1.1 Light theme

| Token | Value | Role |
| --- | --- | --- |
| `--sur0` | `#f6f7f9` | Page background |
| `--sur1` | `#ffffff` | Cards, panels, table body |
| `--sur2` | `#f0f2f6` | Inputs, table header, sidebar wells |
| `--sur3` | `#e6e9f0` | Recessed wells, hover states, help tags |
| `--sur4` | `#d6dbe4` | **Scrollbar thumb only — never carries text** |
| `--bdr` / `--bdr2` / `--bdr3` | `#e4e7ee` / `#edeff4` / `#d7dbe4` | Borders, weak → strong |
| `--txt` | `#1c2030` | Primary text |
| `--txt2` | `#5a6376` | Secondary text |
| `--txt3` | `#5d697f` ✅ | Tertiary: labels, placeholders, counters, help tags |
| `--accent` | `#4f46e5` | Indigo. Primary actions, focus ring, active |
| `--accent-strong` / `--accent-text` | `#4338ca` | Pressed / accent-coloured text |
| `--accent-fg` | `#ffffff` | Text on an accent fill |
| `--accent-soft` / `--accent-soft2` / `--accent-bdr` | `rgba(79,70,229, .08/.14/.32)` | Accent tints |
| `--focus` | `rgba(79,70,229,.35)` | Focus glow |
| `--comply` | `#15803d` ❌ | Status: comply |
| `--partial` | `#b45309` ❌ | Status: partial |
| `--notcomply` | `#dc2626` ❌ | Status: not comply |
| `--na` | `#64748b` ❌ | Status: N/A |
| `--warn` / `--info` / `--danger` | `#b45309` / `#4338ca` / `#dc2626` | Banner semantics |
| `--*-bg` / `--*-bdr` | `rgba(…, .08–.32)` | Matching tint + border per status |
| `--overlay` | `rgba(246,247,249,.82)` | Modal scrim |

Legacy aliases `--amber*` resolve to the accent tokens. **Do not reintroduce amber** — they exist only so
pre-redesign `var(--amber)` references keep working.

### 1.2 Dark theme (`prefers-color-scheme: dark`)

| Token | Value | Token | Value |
| --- | --- | --- | --- |
| `--sur0` | `#0f1117` | `--txt` | `#e7e9f0` |
| `--sur1` | `#171a21` | `--txt2` | `#a3adc0` |
| `--sur2` | `#1e222c` | `--txt3` | `#8a92a0` ✅ |
| `--sur3` | `#262b36` | `--accent` | `#6366f1` |
| `--sur4` | `#333a47` | `--accent-text` | `#a5b4fc` |
| `--comply` | `#4ade80` | `--partial` | `#fbbf24` |
| `--notcomply` | `#f87171` | `--na` | `#94a3b8` |

### 1.3 `STAT_COLORS` — a separate palette, and a trap

[`src/lib/constants.ts`](src/lib/constants.ts) holds a **second**, hard-coded status palette:

| | value | |
| --- | --- | --- |
| comply | `#22c55e` | |
| partial | `#f0a500` | |
| notcomply | `#ef4444` | |
| na | `#5c6480` | |

> ⚠️ **`STAT_COLORS` is shared with Excel export.** [`src/lib/xlsx.ts:103`](src/lib/xlsx.ts) uses it for
> status-cell font colour. **Editing it changes exported workbooks.** If an on-screen contrast problem
> traces back to `STAT_COLORS`, fix what the *component* reads from — do not edit the palette.

It is also **not theme-aware** (one palette, both themes), so anything drawing text from it shows
light-theme colours in dark mode. Current on-screen uses:

- `App.tsx` `lib-item-label` — **text**, `#22c55e` on `--sur2` = **2.03:1** ❌
- `App.tsx` `stat-dot` — a decorative swatch, not text. Fine.

---

## 2. The contrast matrix — real pairings only

Extracted from `styles.css` rule blocks that set both `color:` and `background:`, so these are
pairings that **actually occur**, not a cartesian product. Translucent backgrounds are alpha-composited
over the page. Produced by `src/lib/contrast.ts` and enforced by `src/lib/contrast.test.ts` — the
numbers below are generated, not maintained by hand.

**Current: 28 pairings per theme · 13 failing in light · 3 failing in dark** (9 distinct token pairs, all
Phase C). `--txt3` is no longer among them — Phase B fixed it in both themes.

### 2.1 Still failing — light theme

| Selector | text | on | ratio |
| --- | --- | --- | ---: |
| `.f-comply.on` · `.sts-comply` · `.help-tag-free` | `--comply` | `--comply-bg` | 4.22 ❌ |
| `.f-partial.on` · `.sts-partial` · `.help-tag-paid` | `--partial` | `--partial-bg` | 4.16 ❌ |
| `.alert-warn` | `--warn` | `--warn-bg` | 4.16 ❌ |
| `.alert-err` | `--notcomply` | `--danger-bg` | 3.99 ❌ |
| `.f-na.on` · `.sts-na` | `--na` | `--na-bg` | 3.94 ❌ |
| `.f-notcomply.on` · `.sts-notcomply` · `.row-del:hover` | `--notcomply` | `--notcomply-bg` | 3.93 ❌ |

**The systemic finding: every status colour fails on its own tint.** One root cause, 13 symptoms — not 13
separate bugs.

### 2.2 Still failing — dark theme only

Found by the Phase A guard on its first run. Neither the Lighthouse audit (which ran in light mode) nor the
manual stylesheet review had caught these. All three pass comfortably in light and fail only in dark,
because the dark accent `#6366f1` is lighter than the light accent `#4f46e5`.

| Selector | text | on | dark | light |
| --- | --- | --- | ---: | ---: |
| `.btn-amber` — the primary action button | `--on-amber` | `--amber` | 4.47 ❌ | 6.29 ✅ |
| `.f-all.on` — active "All" filter | `--amber` | `--amber-bg` | 3.69 ❌ | 5.23 ✅ |
| `.row-ins:hover` — insert-row glyph | `--accent` | `--sur3` | 3.17 ❌ | 5.17 ✅ |

Font sizes were checked before recording these — 13px/600, 11px/600 and a 16px glyph — so all three are
normal text owing the full 4.5:1. The large-text 3:1 allowance does not apply.

### 2.3 `--txt3` against every surface it lands on

| Surface | old `#6a7790` | **applied** `#5d697f` ✅ |
| --- | ---: | ---: |
| `--sur1` `#ffffff` | 4.51 ✅ *(the only one P3b tested)* | 5.54 ✅ |
| `--sur0` `#f6f7f9` | 4.21 ❌ | 5.17 ✅ |
| `--sur2` `#f0f2f6` | 4.03 ❌ | 4.94 ✅ |
| `--sur3` `#e6e9f0` | 3.71 ❌ | 4.56 ✅ |
| key-panel `#f2fcf5` | 4.30 ❌ | 5.28 ✅ |

Dark: `#7a8393` → **applied** `#8a92a0` — worst real surface is `--sur3` (`.help-tag`) at 4.52 ✅.

> A first attempt at `#818998` was derived against `--sur1`/`--sur2` only and still failed
> `--sur3` at 4.03:1 — the *same* omission as P3b, in the dark theme. The Phase A guard caught it
> within seconds, before it shipped. Invariant 1 is not a hypothetical.

`--sur4` is excluded deliberately — it is the scrollbar thumb and carries no text. Including it would
over-report and force an unnecessarily dark token.

### 2.4 Derived replacements

| Token | current | proposed | worst-case after |
| --- | --- | --- | ---: |
| `--txt3` light | `#6a7790` | `#5d697f` ✅ **applied** | 4.56 |
| `--txt3` dark | `#7a8393` | `#8a92a0` ✅ **applied** | 4.52 |
| `--comply` | `#15803d` | `#127136` | 4.55 |
| `--partial` / `--warn` | `#b45309` | `#9e4908` | 4.51 |
| `--notcomply` / `--danger` | `#dc2626` | `#bb2020` | 4.52 |
| `--na` | `#64748b` | `#546175` | 4.62 |

Library-label colours, if that component switches off `STAT_COLORS` (worst across all five light
surfaces): comply `#147839` · partial `#a94e08` · notcomply `#ca2323` · na `#5b6a7e`.

> Two traps found while deriving these, both of which would have shipped a "fix" that still failed:
> 1. Swapping `lib-item-label` to the existing `--comply`/`--partial` tokens lands at **4.48:1** — just
>    under, and visually indistinguishable from passing.
> 2. The current N/A colour (`#5c6480`, 5.22:1) already **passes**; the token (`#64748b`, 4.25:1) would
>    have been a *regression*. Never bulk-swap a palette without per-value checks.

---

## 3. Sizing

### 3.1 Type scale (occurrences in `styles.css`)

`9px` ×1 · `10px` ×3 · **`11px` ×12** · **`12px` ×21** · **`13px` ×18** · `14px` ×5 · `15px` ×6 · `16px` ×4
· `18px` ×1 · `22px` ×1 · `40px` ×1

12–13px carries the interface; 11px is for labels and column headers; 9–10px is used sparingly. Anything
at 9–11px is normal text for WCAG purposes (the 3:1 large-text allowance needs ≥18.66px bold or ≥24px), so
**every small label owes the full 4.5:1.**

### 3.2 Interactive target sizes — measured live on the deployed site

WCAG 2.2 AA criterion **2.5.8** requires ≥ 24×24 px.

| Control | measured | |
| --- | --- | --- |
| `.lib-remove` library remove | 7.6 × 15.2 → **24 × 24** | ✅ resized (usability; was exempt) |
| `.row-check` row select | 14 × 14 | ✅ exempt — 42.9 px clear of any target |
| `.row-grip` drag handle | 15.8 × 17 | ✅ exempt — 42.9 px clear |
| `.row-del` delete row | 18.8 × 21.6 → **24 × 24** | ✅ resized (21.1 px apart — not exempt) |
| `.row-ins` insert row | 19.4 × 20 → **24 × 24** | ✅ resized (21.1 px apart — not exempt) |
| `.btn-xs` | 221.6 × 25.6 | ✅ |
| `.btn-sm` | 111.3 × 28.8 | ✅ |
| `.sts-sel` status dropdown | 46.2 × 31.2 | ✅ |
| `.f-btn` filter button | 44.7 × 37.2 | ✅ |

**Lighthouse reported only `.row-ins` and `.row-del`** (12 nodes). It never measured `.lib-remove`,
`.row-check` or `.row-grip` — see §4.

WCAG 2.5.8 exempts an undersized target whose 24 px circle does not intersect another target, so the
spacing was **measured** before resizing anything rather than applying 24×24 blindly. Cost of the three
resizes: row height unchanged (77 px), table width unchanged (992 px, no overflow); the actions column
grew 64.1 → 74 px, absorbed by the flexible Requirement/Remarks columns (~1 % narrower each).

### 3.3 Layout constants

`--sb: 288px` sidebar · radii `--r-sm: 6px` / `--r-md: 8px` / `--r-lg: 10px`.

### 3.4 Type roles

`--font-ui` Inter (chrome) · `--font-thai` Sarabun (Thai requirement/remarks content) ·
`--font-mono` JetBrains Mono (ref codes, row numbers). Loaded from Google Fonts, which is render-blocking
and the CLS culprit — see [`LIGHTHOUSE_AUDIT.md`](LIGHTHOUSE_AUDIT.md) §4.

---

## 4. Why Lighthouse under-counts, and what that means

Lighthouse audits **the DOM that exists at audit time**. When the 2026-08-07 run happened, the Help modal
was closed, no alert banner was showing, no status filter was active, and the library list was in its
default state. So it reported 13 contrast nodes and 12 target-size nodes.

Checking the stylesheet directly found **14 failing contrast pairings in light alone**, plus **5
undersized controls** — including `.help-tag*`, `.alert-err`, `.alert-warn`, the active filter
buttons, and a 7.6×15.2 px button.

Then the automated guard found **3 more in the dark theme** that neither Lighthouse nor that manual pass
had spotted (§2.2), because Lighthouse ran in light mode and the manual review followed it there. Two
independent methods, two different blind spots — which is the argument for having the automated one at all.

**Rule: treat a green Lighthouse accessibility score as necessary, not sufficient.** Anything behind a
modal, a hover, an active state, or an error condition needs checking against this file instead.

---

## 5. Invariants — the rules that keep this file true

1. **Verify a text token against every background it can land on.** Not white. Not one sample. This is the
   rule P3b broke.
2. **`STAT_COLORS` is shared with Excel export** (`xlsx.ts:103`). Never edit it to fix an on-screen
   problem — change what the component reads instead.
3. **`--sur4` carries no text** (scrollbar thumb). Excluding it is deliberate; do not "fix" contrast
   against it.
4. **Never bulk-swap a palette.** Two of the four "obvious" status swaps were wrong — one still failed,
   one was a regression.
5. **Derive, don't hand-pick.** Adjust lightness only, preserve hue, and compute the result. Anchor the
   formula against a known reference pair before trusting any output.
6. **Changing a value here is a visible design change** and needs sign-off per
   [`A11Y_PLAN.md`](A11Y_PLAN.md) §0. Nothing in §2.4 has been applied.
7. **Re-run the pairing extraction after touching `styles.css`** — new `color:`/`background:` combinations
   create new pairings that no existing check covers.

---

## 6. Current state

**Applied:** `--txt3` in both themes (Phase B) and three target sizes (Phase D).
**Still proposed:** the status-colour system in §2.4 — Phase C, held for sign-off because those are the
app's most semantically loaded colours. Live values are as listed in §1.

The Phase A guard (`src/lib/contrast.test.ts`) now enforces §2 automatically, with the remaining
Phase C failures in an explicit allowlist that shrinks to empty when C lands. The accessibility score
on the deployed site is ~93 after the Batch 1 fixes (landmark, table header, plus the SEO and security work
in [`LIGHTHOUSE_AUDIT.md`](LIGHTHOUSE_AUDIT.md)); closing §2 and §3.2 is what remains.
