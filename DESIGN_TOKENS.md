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
| `--comply` | `#127136` ✅ | Status: comply |
| `--partial` | `#9e4908` ✅ | Status: partial |
| `--notcomply` | `#bb2020` ✅ | Status: not comply |
| `--na` | `#546175` ✅ | Status: N/A |
| `--warn` / `--info` / `--danger` | `#9e4908` / `#4338ca` / `#bb2020` ✅ | Banner semantics |
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
| `--sur3` | `#262b36` | `--accent` | `#5f62e7` ✅ |
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

- ~~`App.tsx` `lib-item-label`~~ — **no longer reads from STAT_COLORS** (Phase C). It now uses
  `.lib-item-label.lib-label-*` classes bound to the theme tokens: 2.03:1 → **5.45:1** measured on the
  real card background, and it finally follows the dark theme instead of showing light-theme greens.
- `App.tsx` `stat-dot` — the one remaining on-screen use. A decorative swatch, not text, so it
  carries no contrast obligation; left on `STAT_COLORS` so it stays consistent with the Excel export.

---

## 2. The contrast matrix — real pairings only

Extracted from `styles.css` rule blocks that set both `color:` and `background:`, so these are
pairings that **actually occur**, not a cartesian product. Translucent backgrounds are alpha-composited
over the page. Produced by `src/lib/contrast.ts` and enforced by `src/lib/contrast.test.ts` — the
numbers below are generated, not maintained by hand.

**Current: 28 pairings per theme · 0 failing in light · 0 failing in dark.** The guard's allowlist is
**empty** as of 2026-08-18 (Phase C). Every `color`/`background` pairing in the stylesheet clears
WCAG AA in both themes.

### 2.1 What Phase C fixed

**Light — the systemic one.** Every status colour was used as text on its own matching tint and every one
failed (3.47–3.74:1 worst case). One root cause, 13 symptoms across `.sts-*`, `.f-*.on`,
`.help-tag-*`, `.alert-err` and `.alert-warn`. Fixed by darkening the six tokens; measured
in-browser against the real composited pill backgrounds afterwards:

| Pill | before | after |
| --- | ---: | ---: |
| comply `#127136` on `#e0efe8` | 4.22 ❌ | **5.12** ✅ |
| partial `#9e4908` on `#f3e8dc` | 4.16 ❌ | **5.08** ✅ |
| not comply `#bb2020` on `#f4e4e6` | 3.93 ❌ | **5.12** ✅ |
| N/A `#546175` on `#e7eaee` | 3.94 ❌ | **5.20** ✅ |

Dark status colours needed no change — they already ran 5.68–9.01.

**Dark — an accent conflict that had no chromatic solution.** Three failures pulled in opposite
directions: `.row-ins:hover` (3.17) and `.f-all.on` (3.69) used `--accent` as *text* on a dark
surface and needed it **lighter**, while `.btn-amber` put white on `--accent` as a *fill* (4.47) and
needed it **darker**. No single value satisfies both.

The fix was semantic, not chromatic: the two text usages were pointed at `--accent-text`, the token that
already existed for exactly that role (→ 7.11 and 8.26), leaving `--accent` free to darken slightly for
the fill (→ **4.79**, measured live). `--accent` in dark is now used only as fill/border, never as text.

> `#5f62e7` was chosen over the minimum passing nudge `#6265ef` (4.54). Landing 0.04 above a
> threshold is gaming it; 4.79 leaves room for future tweaks, and the fill still sits at 3.94:1 against
> `--sur0` so the button reads as a distinct shape.

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
| `--comply` | `#15803d` | `#127136` ✅ **applied** | 4.55 |
| `--partial` / `--warn` | `#b45309` | `#9e4908` ✅ **applied** | 4.51 |
| `--notcomply` / `--danger` | `#dc2626` | `#bb2020` ✅ **applied** | 4.52 |
| `--na` | `#64748b` | `#546175` ✅ **applied** | 4.62 |

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

**All of §2.4 is applied.** The contrast guard's allowlist is empty: 28 pairings per theme, zero failing,
both themes. Phases A (guard), B (`--txt3`), C (status + accent) and D (target sizes) have all landed.

`src/lib/contrast.test.ts` enforces §2 automatically on every push, and covers two pairings the
extractor structurally cannot see — the library label and the primary button — because their colour and
background are declared on separate rules.
