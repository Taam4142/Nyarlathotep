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
- `App.tsx` carries `@ts-nocheck` — no type safety on the very file this work touches.
- **The 84 passing tests cover only `src/lib/*` pure logic. There are zero UI tests.** All accessibility
  work lands in `App.tsx` + `styles.css` — precisely the untested surface. **This is the single biggest
  process risk** and it shapes the whole plan (§4 P0, §5 R1).

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

### P5 — Tooling *(optional, not started)*
ESLint + `eslint-plugin-jsx-a11y` + an axe pass. Ongoing guardrail so regressions get caught automatically.
Bigger than it sounds (§3-J) — propose only if the earlier phases prove worth defending.

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
