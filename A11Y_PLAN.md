# A11Y_PLAN.md — accessibility plan for Nyarlathotep

> **Status: P0–P3b done · P4 skipped (revisit only on real need) · P5 optional/not started.**
> Written 2026-08-05 against the tagged baseline
> [`v0.4.0`](https://github.com/Taam4142/Nyarlathotep/releases/tag/v0.4.0) (`80e5ae9`).
> Prompted by a review of [`fecarrico/A11Y.md`](https://github.com/fecarrico/A11Y.md). See §4 for the
> per-phase implementation log (what shipped, what was verified, and one corrected claim) and §7 for the
> three open questions — all now answered.

---

## 0. Prime directive — zero behaviour change

The engineer's constraint is explicit: **this work must not affect the features or how the project
works.** Every phase below is designed against that. Concretely, "no behaviour change" means:

| Must not change | Must not change |
| --- | --- |
| What any control does when clicked | Extraction results (rows, refs, verbatim text) |
| Export output (`.xlsx` bytes, columns, figures) | Persistence format (`localStorage`, `.json`) |
| The visual design a sighted mouse user sees¹ | Existing keyboard behaviour (Ctrl+Z/Y, Escape, drag) |

¹ **Two sanctioned exceptions**, both called out for sign-off: the focus ring (§4 P2 — verified: **no**
change on a mouse-clicked button; a small, additive, on-brand change on a mouse-clicked **text field**,
corrected from the original "mouse users see nothing different" claim once real-click testing showed
browsers apply `:focus-visible` to text inputs on click too — this is standard cross-browser behaviour, not
something introduced by this rule) and the secondary-text contrast bump (§4 P3b, genuinely visible —
**still needs your approval, not yet done**).

**Everything is additive.** No refactors, no renames, no logic rewrites. Each phase is one commit,
independently revertible, diffable against `v0.4.0`.

---

## 1. Stance on the A11Y.md repo

**What it is:** a hybrid — a technically sound WCAG 2.2 AA rulebook wrapped in an organisational
*governance programme* (compliance tiers, severity model, an "AI Behaviour Contract", and three mandatory
audit artifacts: `REPORT.md`, `EXCEPTIONS.md`, `A11Y-DECISIONS.md`).

**Adopt** — its POUR checklist, the WAI-ARIA APG pointer, and three principles that are simply correct:
- *"No ARIA is better than bad ARIA"* — prefer native semantics; don't sprinkle roles.
- *Labels, never placeholder-only.*
- *Honesty over fabrication* — never claim screen-reader testing that wasn't performed. (Adopted as §6.)

**Decline** — the governance apparatus. Certification artifacts and decision-logs are built for teams
pursuing formal ADA/EAA/ISO conformance. This is an internal engineering tool; that overhead would cost
more than the accessibility it buys. Also noted: the doc contains **instructions addressed to AI agents**;
those are treated as *someone else's suggestions to consider*, not as commands — nothing in a fetched web
page gets to set this project's process.

**Also note:** its "House Rules" (44×44 px targets, 12 px min font, 2 px focus rings) are the author's
*stricter-than-WCAG opinions* presented beside the real standard. Reasonable defaults; not requirements.

---

## 2. Target

**A scoped subset of WCAG 2.2 Level AA** — the criteria that decide whether a colleague who works
keyboard-only or with a screen reader can actually do the job. **Not** certification, not AAA, not a
compliance programme.

Rationale: internal tool for engineers/bid teams; not a public accommodation, not (as far as is known)
under a legal mandate. But "internal" ≠ "nobody" — and several findings below are outright lockouts, while
most of the cheap fixes double as usability wins for everyone in a dense data-entry UI.

---

## 3. Audit findings (evidence-based, against `v0.4.0`)

Severity: **Blocker** = someone cannot complete the task · **High** = major barrier · **Medium** =
significant friction · **Low** = polish.

### A. Focus visibility — **Blocker** (WCAG 2.4.7)
Ten `outline: none` declarations in `src/styles.css` strip the focus ring, and the replacements are weak
or missing entirely:

| Control | Line | Focus indication today |
| --- | --- | --- |
| `.sts-sel` — **compliance-status dropdown** | 1135 | **none at all** |
| `.cat-sel` — category dropdown | 1122 | **none at all** |
| `.lib-add-sel` | 592 | **none at all** |
| `.cell-in` — **requirement / remarks editor** | 1085 | background tint only (`--sur2` #f0f2f6 vs `--sur1` #ffffff — near-imperceptible) |
| `.ref-in` — Ref field | 1105 | text-colour shift only (`--txt2`→`--txt`) — effectively invisible |
| `.search-in` / `.model-sel` / `.key-input` / `.lib-add-input` | 866 / 245 / 454 / 574 | 1 px border-colour change only |
| `.proj-input` | 218 | ✅ 3 px `box-shadow` ring — **the model to copy** |

`.sts-sel` and `.cell-in` are the two most-used controls in the entire review workflow. A keyboard user
tabbing the matrix cannot see where they are. **Buttons** keep the UA default ring (no `outline:none`), so
they're visible but unstyled — and low-contrast on `.btn-amber` (indigo ring on indigo fill) and in dark mode.

### B. Secondary-text contrast — **High** (WCAG 1.4.3)
`--txt3` fails AA for normal text, in both themes (ratios hand-computed — **confirm with a tool before
acting**):

| Theme | Colour | On | Ratio | AA needs |
| --- | --- | --- | --- | --- |
| Light | `#98a1b3` | `#ffffff` | **≈ 2.6 : 1** | 4.5 : 1 |
| Dark | `#6b7484` | `#171a21` | **≈ 3.7 : 1** | 4.5 : 1 |

Used widely: every placeholder, `.sb-label` section headings, `.stat-lbl`, `.search-count`, `.snip-pageno`,
`.no-txt` row numbers, `.bottom-hint`, `.help-note`, upload hints. **This is the one fix that visibly
changes the approved design → sign-off required (§0).**

### C. Live regions — **High** (WCAG 4.1.3)
**Zero `aria-live` in the codebase.** Silent to screen readers: the extraction progress overlay (message,
sub-message, %), all three alert banners (error / warning / info), the search match count, the "N selected"
bulk bar, and the session-restored notice. The error banner should be `role="alert"`; progress/info
`role="status"` (polite).

### D. Labels — **High** (WCAG 3.3.2, 4.1.2)
Placeholder-only labelling on: project name, "Verified by…", search, Gemini key, and every row's **Ref /
Requirement / Translation / Remarks**. A placeholder vanishes on input and is not a dependable accessible
name. Of the `<label>` elements present, only the two `.toggle-label` wrappers are genuinely associated
(implicit); `.lib-add-label` ("Label", "Response text", "Applies to status") and `.snip-attach-lbl`
("Attach to:") are unwired decorative text. The top-bar **engine `<select>` has no label at all**.

### E. Document language — **Medium, trivial fix** (WCAG 3.1.1 / 3.1.2)
`index.html` declares `lang="th"`, but the **entire UI is English** — Thai is *content* inside specific
fields. A screen reader will read English chrome with Thai pronunciation rules. Correct: `lang="en"` on
`<html>`, `lang="th"` on the Thai content fields (requirement, remarks, library text).

### F. Motion — **Medium** (WCAG 2.2.2 / 2.3.3)
No `prefers-reduced-motion` anywhere (the only media query is `prefers-color-scheme`, styles.css:89). Four
animations, **two infinite**: `.brand-pulse` (`pulse 2.4s infinite` — auto-starts, never stops, which is
what 2.2.2 is about) and `.progress-fill` (`prog 1.8s infinite`), plus `.spinner` and `help-fade`.

### G. Modal focus management — **Medium** (WCAG 2.4.3, 2.1.2)
`HelpModal` / `SnipModal` have `role="dialog"`, `aria-modal`, and Escape ✅ — but **no focus trap, no
initial focus, no focus restore on close**, so Tab walks into the page behind the overlay. The **figure
lightbox** has no dialog role, no Escape, and no focus management (click-only to close).

### H. Snip is mouse-only — **Blocker for the figure feature** (WCAG 2.1.1)
The crop rectangle is produced solely by `onMouseDown / onMouseMove / onMouseUp` on `.snip-canvas`
(App.tsx). There is **no keyboard path to crop**. A keyboard-only user cannot use the figure feature at all.
⚠️ Fixing this *adds interaction* — the one item in tension with §0. Treated as strictly additive
(mouse path untouched) and deferred to its own phase for separate review.

### I. Table semantics — **Low/Medium** (WCAG 1.3.1)
Ten `<th>` elements, none with `scope="col"`. Cheap, invisible fix.

### J. Tooling & test-coverage gap — **process risk, not a WCAG item**
- **There is no ESLint in this project at all** — no config, no `lint` script (`scripts`: dev, build,
  preview, typecheck, test). So "add `eslint-plugin-jsx-a11y`" actually means *introducing ESLint from
  scratch*. Larger than it sounds → optional, last.
- `App.tsx` carries `@ts-nocheck` — no type safety on the very file this work touches. *(Since resolved,
  2026-08-07 — see [`ROADMAP.md`](ROADMAP.md) #5. The project's `strict`/`noImplicitAny` are still off, so
  this catches structural mistakes, not every untyped handler — a partial net, better than none.)*
- **The 84 passing tests cover only `src/lib/*` pure logic. There are zero UI tests.** All accessibility
  work lands in `App.tsx` + `styles.css` — precisely the untested surface. **This is the single biggest
  process risk** and it shapes the whole plan (§4 P0, §5 R1).

### K-M. Found by an actual axe run *(2026-08-21, axe-core 4.10.2, live deploy)*

Findings A-J were reasoned from the source. These three came from **running axe against the
deployed site**, which the CSP permits because `script-src` already allows `cdn.jsdelivr.net`
(tesseract.js needs it). Four states were audited: empty/upload, populated matrix, drawer
open, help modal open.

**37-40 rules pass in every state** - the A-J work holds up. Three violations remain.

#### K. Scrollable region without keyboard access - **Serious** (WCAG 2.1.1)
`scrollable-region-focusable` on `.stats`, and on `.help-body` when the modal is open.

Measured rather than taken on axe's word: `.stats` computes `overflow: auto` with
`scrollWidth 395` against `clientWidth 347`, has `tabIndex -1`, and **contains no focusable
children** - so a keyboard-only user cannot scroll it and cannot reach the clipped statistics.

> `.table-area` also scrolls (`scrollHeight 1046` vs `clientHeight 85`) and axe **passes** it,
> because its children *are* focusable - the row inputs give keyboard users a way in. That is
> the distinction any fix must respect: the rule is about reachability, not about `overflow`.

**Open question before fixing:** this was measured at a **371 px** viewport. `.stats` needs
395 px of content, so at desktop widths it should not overflow at all, which would make this
**mobile-only**. Confirm at >= 768 px before deciding scope - the browser pane used for the
audit could not be resized.

#### L. No level-one heading - **Moderate** (WCAG 1.3.1 / 2.4.6)
`page-has-heading-one`. Measured `h1Count: 0`; the product name is a `<div class="brand">`.
A screen-reader user gets no document title in the heading outline.

#### M. Content outside any landmark - **Moderate** (WCAG 1.3.1)
`region` on `.brand`. The only landmark on the page is `MAIN`; the entire top bar is a
plain `<div>`, so the brand, undo/redo, export and overflow controls sit outside the landmark
structure and cannot be described by landmark navigation.

#### Status after the 2026-08-21 implementation pass

- **L — fixed.** `<span class="brand-name">` is now an `<h1>`. Verified by geometry
  fingerprint against the live deploy: `35|17|91|21|block|static` on both, and computed
  `14px / 700 / margin 0` on both. Zero visual change. The global `* { margin: 0 }` reset
  neutralises the `h1` UA margin, and `.brand-name` already pinned size and weight.
- **M — fixed, but NOT the way first attempted, and it was bigger than first recorded.**

  > **The `<aside>` attempt was wrong and axe caught it.** Making the sidebar an `<aside>`
  > passed at desktop and introduced an `aria-allowed-role` violation at compact widths,
  > where the same element already takes `role="dialog"` as the drawer — `<aside>` has an
  > implicit `complementary` role that ARIA forbids overriding with `dialog`. It is now a
  > `<div>` with the role applied conditionally: `dialog` when compact, `complementary`
  > otherwise. **A fix for one width broke another width**, which is the same lesson as
  > below, arriving from the opposite direction.
 `<div class="topbar">` became
  `<header>` *and* `<div id="app-sidebar">` became `<aside>`. The original audit ran at
  **371 px**, where the sidebar is collapsed behind the drawer toggle and therefore was not
  in the DOM being audited — so it reported one node (`.brand`). At **1280 px** the same
  rule fired on **19 nodes**, the whole sidebar. Landmarks are now `HEADER / ASIDE / MAIN`;
  the rule passes at both widths. *Lesson: audit at both widths, every time — half the
  findings are invisible at the other one. Now written into `TESTING.md` §3e.*
- **K — FIXED 2026-08-21 (approved), scoped to mobile.** `tabIndex={isPhone ? 0 : -1}` plus
  `role="group"` and an `aria-label`, so the strip is reachable exactly where it
  actually scrolls and adds no tab stop on desktop, where nothing is ever hidden. Verified:
  focus lands on it and announces *"Compliance status summary"*. Note `.filters` sits in the
  same media query and was never flagged — its chips are buttons, so keyboard users already
  had a way in. Original finding below.
- **K — was confirmed MOBILE-ONLY before fixing.** Measured at 1280 px: `.stats`
  computes `overflow: visible` with `scrollWidth === clientWidth === 395`. The
  `overflow: auto` comes from a mobile media query, so the violation exists only at narrow
  widths — which still includes a split-screen desktop window, not just phones. The fix
  should therefore be **scoped to the mobile breakpoint** rather than adding a tab stop for
  every user. Still gated on §0 sign-off (R13).

#### N. ~~A control that is visually inactive but not marked inactive~~ — **WITHDRAWN, not a defect**

> **Retracted 2026-08-21, same day it was raised.** The Export button *is* correctly
> `disabled`. Re-measured in a genuinely empty state (`localStorage` cleared, 0 rows):
> `disabled: true`, `opacity: 0.35` coming from `.btn-amber:disabled`. The original reading
> of `disabled: false` was taken in a session that still had rows restored from autosave, so
> the button was legitimately enabled and the dimming did not apply — I attributed one
> state's opacity to another state's `disabled` flag.
>
> WCAG 1.4.3 exempts inactive components from contrast, and axe flags disabled controls
> conservatively. **Nothing to fix.** Kept rather than deleted because the lesson is worth
> keeping: *clear the persisted state before auditing, or you audit a state the user never
> sees.* Now part of the §3e procedure.

<details><summary>Original (incorrect) writeup</summary>
Surfaced while checking an axe `color-contrast` failure on `.btn-amber` ("↓ Export .xlsx")
and refusing to take it at face value.

Axe reported `#686a6f` on `#303366` at **2.16:1**. Those are not the button's colours. Its
real computed values are `color: rgb(255,255,255)` on `background: rgb(95,98,231)` — fine
contrast — but with `opacity: 0.35`. Axe was measuring the *blended* result.

So the contrast number is a symptom. The actual defect is that the button is dimmed to 35 %
to say "unavailable" while `disabled` is `false` and no `aria-disabled` is set. Sighted
users are told it is inactive; assistive technology is told it is a normal, available
control. WCAG 1.4.3 exempts genuinely *inactive* components from contrast — but only if they
are actually marked inactive, which would also make axe stop flagging it.

**Fix:** set `disabled` (or `aria-disabled="true"` plus a no-op guard) whenever the dimmed
state applies. Check every control using the same dimming pattern, not just this one.

</details>

#### O. Real contrast failure on the empty-state call to action — **Serious** (WCAG 1.4.3)
`.upload-txt > strong`, the words **"Click or drag PDF"** — the primary action on the
first screen a user ever sees.

`#5f62e7` on `#22253e` = **3.12:1**, against a required **4.5:1**. At 12 px bold it does not
reach the 18.66 px large-text threshold, so the 4.5 requirement applies. Verified from
computed styles (`opacity: 1`, no blending involved) — unlike N, this one is exactly what
it looks like.

> **Why [`contrast.ts`](src/lib/contrast.ts) did not catch it.** That guard analyses declared
> **token pairings** in the stylesheet. This failure is a *rendered* combination — accent
> foreground over a surface the guard never pairs it with. The static guard and the browser
> run cover genuinely different ground; neither replaces the other. **This is the clearest
> evidence yet for P5b**, and it argues for extending `contrast.ts` to cover this pairing so
> the regression is caught in CI too.

**FIXED 2026-08-21** — and it needed no new colour after all. The codebase already has a
token for exactly this case, `--accent-text`, with the same fix applied at three other sites
and this comment beside one of them: *"--accent-text, not --amber: accent-coloured TEXT on a
tint. Was 3.69:1 in dark; now 8.26:1."* `.upload-txt strong` had simply missed it.

One-token change. Measured after, in both themes, by compositing the translucent
`.upload-zone` tint over the surfaces beneath rather than reading the top layer:

| Theme | Foreground | Effective background | Before | After |
| --- | --- | --- | ---: | ---: |
| Dark | `#a5b4fc` | `#22253e` | 3.14 | **7.54** |
| Light | `#4338ca` | `#f1f0fd` | — | **7.02** |

> **Follow-up DONE 2026-08-21 — and it found more.** `contrast.ts` gained
> `extractInheritedColorRules()`, which checks rules that set a colour but inherit their
> background. Measured first: the old guard checked **31** rules while **62** set a colour and
> inherited a background, so **two thirds of the stylesheet was invisible to it** — O was not a
> one-off gap but a representative sample.
>
> Static CSS cannot know which ancestor paints the background, so the check takes the reading
> P3b already applied to `--txt3`: text must be legible on **any** surface it could land on,
> and each rule is scored against its worst. `--sur4` is excluded by name — it is the
> scrollbar thumb and nothing else, and including it failed five sound tokens against a
> background no text sits on.
>
> **It immediately caught a second real failure of the same family:** `.btn-ghost:hover` and
> `.lib-add-btn:hover` set `color: var(--amber)`, which reaches only **2.96:1** on `--sur3` in
> dark. Both buttons rest at `--txt2`, which passes — so **hovering made the label harder to
> read than not hovering**. Fixed with `--accent-text`, the same token as O.
>
> Observed and deliberately not changed: the matching `border-color: var(--amber)` on those
> hover states is 2.96:1 against a 3:1 requirement for UI component boundaries (WCAG 1.4.11) —
> marginal, and changing it is a larger visual decision than the text fix. Flagged here rather
> than silently altered.

#### Not a violation, but flagged for a human
One `color-contrast` **incomplete** on `.help-sub`: *"background color could not be determined
because it partially overlaps other elements."* Axe declines to judge it rather than failing
it. [`contrast.ts`](src/lib/contrast.ts) checks the *tokens* statically and passes, so this is an
overlap-geometry question, not a palette question. Worth one manual look.

---

---

## 4. Phased process

Ordered by **ascending behaviour risk**, so the safest, highest-value work ships first and the one item
that adds interaction comes last. One phase = one commit = one revert.

### P0 — Safety net *(no product code)* ✅ Done
- `v0.4.0` tagged + released as the rollback point.
- (The separate `A11Y_CHECKLIST.md` file was skipped — the manual script ran directly from §6 of this
  doc instead, which served the same purpose without an extra file.)

### P1 — Invisible fixes *(zero visual change, zero interaction change)* ✅ Done, 2026-08-05
Findings **E (partial — see note), I, D, C, G(lightbox semantics)**. Nothing here alters a single pixel for
a sighted mouse user — confirmed (§6).
- `lang="en"` on `<html>`. **Scope change from the original finding:** the "tag Thai content fields
  `lang=\"th\"`" half was dropped after checking the actual data (`DEFAULT_LIB` in `constants.ts`) — those
  fields are genuinely mixed Thai/English by design (the placeholder literally says "Thai/English"), so a
  static per-field guess would mislabel English content about as often as it would help Thai. Not tagging
  is more honest than tagging wrong.
- `scope="col"` on all 9 `<th>` (the finding said 10; the live count is 9).
- `aria-label` (or `htmlFor`/`id` where a visible label already existed — Snip's "Attach to", the library
  add-form's three labels) on every previously-unlabelled control. Placeholders untouched.
- `role="status" aria-live="polite"` on the progress overlay and the info/warning banners; `role="alert"`
  on the error banner. **Scoped down from the finding:** the search match-count and the bulk-bar "N
  selected" were deliberately left as plain (non-live) text — both update on every keystroke/click, and
  making them live would spam a screen reader on every character typed (this is risk **R4** applied
  proactively, not deferred).
- Lightbox: `role="dialog"` + `aria-modal` + Escape, matching `HelpModal`/`SnipModal`.

**Verified:** typecheck/84 tests/build green; `lang`, all 9 `scope="col"`, and every `aria-label` confirmed
present via DOM query; the accessibility tree (`read_page`) independently shows "Project name", "Verified
by", "Reference", "Requirement text, verbatim", "Search rows" etc. as real control names; the info banner's
`role="status"`/`aria-live="polite"` confirmed live; lightbox `role`/`aria-modal` confirmed, Escape-close
confirmed via a real key event. Full regression pass (edit → undo → bulk-set → export) behaves identically
to `v0.4.0` — byte-identical `.xlsx` MIME/structure, no console errors. Committed `<see CHANGELOG>`.

### P2 — Focus visibility *(finding A)* ✅ Done, 2026-08-05
One rule, appended once — not ten edits — because `:focus-visible` and the existing `outline:none` class
selectors share specificity (0,1,0), so source order alone lets one later rule override all ten sites:
```css
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
```
`outline` is drawn outside layout flow, so it cannot shift or resize anything.

**Verified — and one claim corrected from what I proposed:** real clicks/keystrokes were sent (not
`.focus()`, which isn't a trusted event `:focus-visible` can rely on). **Buttons: exactly as promised** —
a real mouse click shows no ring (`matches(':focus-visible') === false`), identical to `v0.4.0`. **Text
inputs/selects/textareas: not quite what I originally said.** All modern browsers (this is cross-browser
spec behaviour, not something this rule introduces) apply `:focus-visible` to text-entry-like elements on
mouse click too, not just keyboard — confirmed empirically (clicking the project-name field: outline
`solid`, `matches(':focus-visible') === true`). Net effect: the nine previously-broken controls (which had
**no** click indicator either) now get one — a fix, not a regression; but `.proj-input`/`.verifier-input`,
which already had their own `:focus` box-shadow ring, now show that ring **plus** this new outline, layered,
on a plain mouse click — a small, additive visual change I did not predict. It reads as a (subtle,
on-brand) improvement rather than a defect, but it's a real delta from "zero change," stated here rather
than left implicit. Confirmed via real keyboard Tab: `.sts-sel` — the control the audit called out as
having *zero* focus indication — now shows `outline: solid 1.6px rgb(99, 102, 241)` (dark-mode `--accent`)
on real Tab-driven focus. Full regression pass re-run after this change: unaffected.

### P3a — Reduced motion *(finding F)* ✅ Done, 2026-08-05
```css
@media (prefers-reduced-motion: reduce) {
  .brand-pulse { animation: none; }
  .progress-fill { animation: none; }
  .spinner { animation-duration: 1.6s; }  /* slowed, not stopped — it's a genuine progress indicator */
  .help-overlay { animation: none; }
}
```
**Verified:** confirmed the default (no-preference) case is byte-identical to `v0.4.0` —
`matchMedia('(prefers-reduced-motion: reduce)').matches === false` in this environment, and
`.brand-pulse` still runs `pulse 2.4s` unchanged. **Not verified:** actually toggling the OS-level
reduced-motion preference — this sandboxed browser has no control to emulate that media feature, so the
`reduce` branch itself was verified by code review (correct selectors, confirmed against the real class
names in `styles.css`), not by observing the effect live. Worth a real look on your end if you have the OS
setting available.

### P3b — `--txt3` contrast bump *(finding B)* ✅ Done, 2026-08-05 — approved
Before touching code, built a live comparison — a published Artifact showing the real UI strings (section
labels, stat labels, help-note copy, page counters) at actual size, current vs. proposed, both themes, with
the WCAG contrast ratio computed **in the page itself** (not typed in by hand) — so the approval was made
by looking at the actual result, not hex codes in chat. **Caught a real bug before publishing it:** the
first version of the colour-derivation script had the darken/lighten direction inverted, which would have
proposed white-on-white (light theme) and black-on-black (dark theme). Found by independently re-running
the identical algorithm in Node and sanity-checking the output — not by the engineer noticing after the
fact. Fixed, re-verified, then published.

Applied at the token only (`--txt3` in both the light `:root` block and the dark `@media` block in
`styles.css`) — light `#98a1b3` (2.60:1, fails AA) → `#6a7790` (4.51:1, passes); dark `#6b7484` (3.70:1,
fails) → `#7a8393` (4.56:1, passes). Same hue, lightness-only adjustment, derived programmatically rather
than hand-picked. All ~27 usages of the token update automatically; no per-component changes.

**Verified:** typecheck/90 tests/build green; `getComputedStyle` confirmed the new hex in-browser; full
regression pass (export) unaffected; no console errors.

### P4 — Keyboard parity for Snip *(finding H)* — ⏭ **skipped for now, per the engineer's steer**
Additive alternative input; the mouse drag is untouched. Sketch: focus the page image → arrow keys move the
crop origin, Shift+arrows resize, Enter attaches, Escape cancels; on-screen hint text. Plus modal focus
trap + focus restore (finding G).

**Risk: highest (new interaction, and new key handlers can collide with Ctrl+Z/Y and dnd-kit — see R3).**
Not started; revisit only if someone actually needs keyboard-only figure capture. **Needs explicit
go-ahead** given §0 — this is the one phase that adds a feature rather than a label/style.

### P5 — Automated guardrails *(planned 2026-08-21, not started)*

A-J were fixed by hand and nothing stops a later edit undoing them. This phase is a
**regression net**, not a discovery exercise - with one exception (P5b), which already found
three real issues on its first run.

> **The honest justification, stated up front.** The finding that matters most (K, *serious*)
> is **layout-dependent**. jsdom has no layout engine, so `scrollWidth` always equals
> `clientWidth` there and a jsdom axe run **cannot** see it. Every accessibility bug this
> project has actually hit - contrast (B, P3b), focus visibility (A), the drawer focus bug,
> target size - falls in that same category. **P5a would not have caught a single one of
> them.** That is not an argument against P5a; it is an argument against overselling it, and
> it is the reason P5b exists.

#### P5a - axe inside Vitest *(cheap, automated, runs in CI)*

`jest-axe` is not an alternative to Vitest - it is an assertion helper that runs *inside*
it (`expect.extend(toHaveNoViolations)`). [`src/App.test.tsx`](src/App.test.tsx) already renders
the whole `<App />`, so this is one dependency and one test.

**Catches:** missing form labels, invalid or contradictory ARIA, duplicate IDs, controls with
no accessible name, heading order, bad roles. Precisely what a refactor of a 2,900-line
`App.tsx` could silently break, and precisely what the 6 behaviour smoke tests do not check.

**Rules that MUST be disabled, each with its reason recorded beside it** - an axe run that
silently skips rules while looking like full coverage is worse than no run at all:

| Rule | Why it cannot run here |
| --- | --- |
| `color-contrast` | No layout or paint in jsdom. Already covered, and better, by [`contrast.ts`](src/lib/contrast.ts) - static stylesheet analysis, 17 tests, token-level. |
| `scrollable-region-focusable` | Needs real `scrollWidth`/`clientWidth`; always equal in jsdom. **This is finding K - P5b covers it.** |
| `target-size` | Needs box geometry. |

**Two traps to expect.** RTL renders into a bare jsdom document, so `html-has-lang` and
`document-title` will fail against the *test harness* rather than the app - `index.html` is
never loaded. Set both in the test setup rather than disabling the rules, so the real page
stays covered by P5b. Second, run axe against the app's own container rather than
`document.body`, or leftover RTL wrappers get audited too.

**Scope:** one test asserting no violations in the default state. Resist growing it into a
per-state matrix - that is P5b's job, where the rules actually work.

*Estimate: ~1 h. One devDependency (`jest-axe`, plus its types).*

> **P5a shipped 2026-08-21** — [`src/App.a11y.test.tsx`](src/App.a11y.test.tsx), 2 tests, 179 total.
> It found a **critical** violation on its very first run, which was **a false positive** and
> worth recording: the hidden file input reported "form elements must have labels". Vitest
> applies **no CSS**, so jsdom computed no `display: none` and axe audited an element the
> browser correctly ignores. Resolved by giving the input a real `aria-label` rather than
> disabling the rule — harmless, and correct if it is ever exposed. **This is a third kind of
> jsdom blindness beyond "no layout": no styles at all, so hidden elements are audited as
> visible.** If such false positives accumulate, enabling `test.css` is the faithful fix.

#### P5b - axe in a real browser *(higher value, not CI-able)*

Everything P5a cannot do. Load `axe-core` from `cdn.jsdelivr.net` - **already permitted by
the CSP**, so no config change - and run it against the deployed site across states. This is
what produced K, L and M in an afternoon.

**Catches additionally:** contrast in situ, scrollable-region reachability, target size, focus
visibility, and anything else that depends on real CSS.

**Cost:** it is a *procedure*, not a test - it needs a browser and someone to run it. Record it
in [`TESTING.md`](TESTING.md) section 3 as a release-time step, not a per-commit one.

*Estimate: ~1 h to script and document; re-runnable in minutes thereafter.*

#### P5c - fix K, L and M

Ordered by impact. **All three are semantic or structural; none changes a pixel.**

1. **M - wrap the top bar in `<header>`** (or `role="banner"`). Pure markup; no style hook
   changes if the class stays on the same element.
2. **L - promote the brand to `<h1>`**, styled identically to the current `div`. Verify the
   *computed* font-size and weight are unchanged rather than trusting the CSS - this project
   has been bitten four times by cascade collisions (section 5, R2).
3. **K - give `.stats` `tabindex="0"`** plus an accessible name (`role="group"` and
   `aria-label`), *if* it is confirmed to overflow at desktop width. If it turns out to be
   mobile-only, scope the fix to the mobile breakpoint rather than adding a tab stop for
   everyone.

> **K breaches section 0.** Adding `tabindex="0"` adds a **tab stop**, which is an interaction
> change - forbidden by the prime directive without explicit sign-off. That is the entire
> point of the fix, so it needs the same gate P2 and P3b were given: proposed, approved, and
> committed alone. L and M are invisible and need no gate.

*Estimate: ~1 h total, one commit each.*

#### What P5 does **not** include
ESLint + `eslint-plugin-jsx-a11y` (section 3-J). Still "introduce ESLint from scratch", still
larger than it sounds, and now demonstrably *lower* value than P5b: a linter reads source, and
**none of K, L or M is visible in source**. Deferred, with the reason recorded.

---

## 5. Risk register

| ID | Risk | L | I | Mitigation |
| --- | --- | --- | --- | --- |
| **R1** | **Regression on an untested surface.** All work is in `App.tsx`/`styles.css`; the 84 tests cover only `src/lib/*`. A break ships silently. | ~~High~~ Med | High | Manual checklist after *every* phase; one phase per commit; diff against `v0.4.0`. **Mitigated (not eliminated) 2026-08-05:** `src/App.test.tsx` — 6 smoke tests via Testing Library (§7 Q1) now run in CI-equivalent `npm run test`. It's a smoke suite, not full coverage, so manual verification is still the primary check for anything it doesn't touch. |
| **R2** | Focus ring shifts layout or gets clipped (sticky `thead`, `overflow` containers, dense table). | Med | Med | `outline` + `outline-offset` only (out of flow); never border/padding. Verify in table, modals, sticky header, both themes. |
| **R3** | New key handlers collide with the **Ctrl+Z/Y undo** handler or **dnd-kit's KeyboardSensor** (drag-reorder). | Med | High | Scope every handler by `e.target`; re-verify undo/redo + drag after each phase (both are already-verified flows). |
| **R4** | `aria-live` spam — per-page OCR updates announce dozens of times; screen reader becomes unusable. | Med | Med | `polite` only; announce milestones (start / done / error), not every page tick. |
| **R5** | `--txt3` change ripples across the whole UI (used in ~10 components). | High | Low | It's a *design* change, not a bug fix → explicit sign-off gate; change the token, not components; ship alone so it's trivially revertible. |
| **R6** | `lang` change alters Thai font fallback/rendering. | Low | Med | *(Moot for what shipped — the per-field `lang="th"` tagging was dropped in P1 after checking the actual data; only the document default changed to `en`, which doesn't touch `--font-thai` at all.)* |
| **R7** | Focus trap breaks the existing Escape / backdrop-click / "Got it" close paths. | Med | Med | Additive only; re-run the three close paths already verified for `HelpModal`. |
| **R8** | **Scope creep:** P4 adds a feature, violating §0. | Med | High | P4 is fenced, separately approved, separately committed; mouse path byte-for-byte untouched. |
| **R9** | Claiming accessibility that wasn't verified (no real screen reader here). | Med | High | §6 honesty rule: state exactly what was and wasn't tested. Never assert NVDA/JAWS/VoiceOver results. |
| **R10** | Snip a11y can't be verified in the preview pane — pdf.js `render` needs `requestAnimationFrame`, which is paused while the pane is hidden (proven previously). | High | Low | P4 verification requires the engineer's real browser; plan for that, don't fake it. |
| **R11** | Drift into the certification programme (§1) — cost with no benefit here. | Low | Med | §8 out-of-scope list is binding. |
| **R12** | **False confidence from P5a.** A green jsdom axe run reads as "accessible" while the rules that actually matter sit disabled. | High | Med | The disabled-rules table lives *in the test file*, not only in this doc; the test name says `semantics only`; P5b is where contrast and geometry are judged. |
| **R13** | **P5c-K adds a tab stop**, breaching section 0's zero-interaction-change rule. | Med | Med | Explicit sign-off gate before it ships, as with P2/P3b; committed alone so `git revert` restores the previous tab order exactly. |
| **R14** | `jest-axe` is Jest-branded while this repo runs Vitest; a future reader assumes it is dead weight or swaps frameworks over it. | Low | Low | It is framework-agnostic (`expect.extend`); say so in the test file so nobody "cleans it up". |

---

## 6. Definition of done (per phase)

1. `npm run typecheck` clean · **84 tests still pass** · `npm run build` green.
2. **Manual regression checklist** passes: extract (Text-PDF path) → edit a row → search → bulk-set status
   → undo/redo → drag-reorder → snip attach → export `.xlsx` → reload (autosave restores) → Save/Load
   `.json`. *Nothing in this list may behave differently.*
3. Keyboard-only walkthrough of the changed surface (Tab / Shift+Tab / Enter / Escape).
4. Visual diff: **none**, except a phase's explicitly sanctioned change (§0).
5. **Honesty statement** in the commit: what was verified, and what could not be (e.g. "no screen reader
   available in this environment; semantics verified by DOM inspection only").

---

## 7. Improvements beyond compliance (the "everyone wins" part)

Accessibility work that is *also* plain usability for this tool:
- **Visible focus in a dense grid** — a "where am I?" aid for every user, not just keyboard users.
- **Skip link** to the matrix — skips the sidebar/toolbar on every page interaction.
- **Keyboard cell navigation** in the table (arrow-key movement) — was already a deferred F5 item; a11y
  work makes it natural. *Behaviour-adding → same gate as P4.*
- **Real labels** improve hover tooltips and make the UI self-describing for new users.
- **Reduced motion** also cuts needless repaint/CPU during long OCR runs.
- **A focus/contrast token** matures the design system — future components inherit correctness.

**Open questions for the engineer — all three now answered**
- **Q1 — answered yes, done 2026-08-05:** added `@testing-library/react` + `@testing-library/jest-dom` +
  `@testing-library/user-event` + `jsdom` (dev-only) and `src/App.test.tsx` — 6 smoke tests (renders;
  key controls have accessible names; add row; edit a cell; bulk status-set; undo; search). The pure
  `src/lib/*` tests keep their existing "node" environment untouched; the new file opts into jsdom
  per-file via a `@vitest-environment jsdom` comment. R1 (the "UI is untested" risk) is now meaningfully
  reduced, though this is a smoke suite, not full coverage — most future UI work still needs a manual
  browser pass too.
- **Q2 — answered yes, done 2026-08-05:** see P3b above.
- **Q3 — answered no (skip), 2026-08-05:** P4 (Snip keyboard parity) is skipped for now. Revisit if a real
  need surfaces.

**Every phase in this plan is now either done or deliberately skipped** (P0–P3b done, P4 skipped, P5 still
optional/not started). See §9 for how to roll any of it back.

**Post-plan addendum (2026-08-07) — engine-picker tooltips, not pursued:** the R7-adjacent tooltip feature
(top-bar extraction-engine `<select>` + the 5 OCR-feeder buttons, `title` attributes from
`EXTRACTION_ENGINES`/`OCR_FEEDERS` in `models.ts`) was checked against the real accessibility tree
(`read_page` + DOM inspection on the running dev server). Confirmed: the `<select>`'s accessible *name*
comes from its `aria-label="Extraction engine"`; each `<option>`'s name is its visible text, never its
`title`; the 5 buttons' names are their visible label text, never their `title`. In every case `title` is
at most a *description* — a secondary channel most screen readers don't announce by default, and for
`<option>` specifically, browsers don't expose `title` as anything read at all (native listbox rendering).
Considered adding `aria-describedby` (well-supported, unlike relying on `title`) to the select + 5 buttons
to close this gap, and decided **not to**: the one distinction that actually mattered (paid vs. free/keyed
engines) is already duplicated into visible label suffixes (`— Paid API` / `— Your key`), which *is*
reliably read; `aria-describedby` would only add supplementary color text, can't be applied to `<option>`
at all (so the fix would be partial/inconsistent), and there's no confirmed screen-reader user hitting this
on an internal tool. Revisit if that changes.

---

## 8. Explicitly out of scope

- `REPORT.md` / `EXCEPTIONS.md` / `A11Y-DECISIONS.md` governance artifacts; compliance tiers; severity
  programme (§1).
- Formal certification (ADA / EAA / ISO 9241-171) or any conformance *claim*.
- WCAG AAA; native-platform (iOS/Android) mapping.
- Rewriting working components to APG patterns for their own sake ("no ARIA is better than bad ARIA").
- Any change to extraction, export, persistence, or proxy behaviour.

## 9. Rollback

Every phase is one commit on top of `v0.4.0`. `git revert <sha>` restores exactly the released behaviour;
`git diff v0.4.0 -- src/` shows the complete accessibility delta at any time.
