# A11Y_PLAN.md — accessibility plan for Nyarlathotep

> **Status: PLAN ONLY — no code has been changed.** Written 2026-08-05, against the tagged baseline
> [`v0.4.0`](https://github.com/Taam4142/Nyarlathotep/releases/tag/v0.4.0) (`80e5ae9`).
> Prompted by a review of [`fecarrico/A11Y.md`](https://github.com/fecarrico/A11Y.md).

---

## 0. Prime directive — zero behaviour change

The engineer's constraint is explicit: **this work must not affect the features or how the project
works.** Every phase below is designed against that. Concretely, "no behaviour change" means:

| Must not change | Must not change |
| --- | --- |
| What any control does when clicked | Extraction results (rows, refs, verbatim text) |
| Export output (`.xlsx` bytes, columns, figures) | Persistence format (`localStorage`, `.json`) |
| The visual design a sighted mouse user sees¹ | Existing keyboard behaviour (Ctrl+Z/Y, Escape, drag) |

¹ With **two sanctioned exceptions**, both flagged for sign-off before they ship: the focus ring (visible
only while keyboard-focused, via `:focus-visible` — a mouse user never sees it) and the secondary-text
contrast bump (§3-B, genuinely visible — **needs your approval**).

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

### P0 — Safety net *(no product code)*
- ✅ **Done:** `v0.4.0` tagged + released as the rollback point.
- Write `A11Y_CHECKLIST.md`: the manual regression script (below) to run after **every** phase.
- Decide (open question, §7): add a minimal UI smoke test, or rely on the manual checklist?

### P1 — Invisible fixes *(zero visual change, zero interaction change)*
Findings **E, I, D, C, G(lightbox semantics)**. Nothing here alters a single pixel for a sighted mouse user.
- `lang="en"` + `lang="th"` on Thai content fields.
- `scope="col"` on the 10 `<th>`.
- Real labels: visually-hidden `<label htmlFor>` or `aria-label` on every unlabelled control; keep the
  placeholders exactly as they are (they stay as hints).
- `role="status"` / `aria-live="polite"` on progress + info/warning banners; `role="alert"` on errors.
- Lightbox: `role="dialog"` + `aria-modal` + Escape (matching the two existing modals).

**Risk: very low. Value: high** (this is most of what a screen-reader user needs).

### P2 — Focus visibility *(finding A)*
One shared focus token, applied via **`:focus-visible`** so it appears for keyboard users and **never for
mouse users** — the visual design is untouched in normal use. Implemented with `outline` + `outline-offset`
(out of flow ⇒ **cannot shift layout**), never border/padding changes.
- Replace the ten dead `outline: none` sites; unify with the good `.proj-input` pattern.
- Give buttons an explicit ring so it's consistent and passes 3:1 on `.btn-amber` and dark mode.

**Risk: low. Value: highest single item for keyboard users.**

### P3 — Motion & contrast *(findings F, B)*
- `@media (prefers-reduced-motion: reduce)`: stop the infinite pulse/progress animation, reduce the
  spinner, drop the modal fade. **Zero change for anyone who hasn't opted in at OS level.**
- **`--txt3` contrast bump — SIGN-OFF GATE.** Visible to everyone. Proposal: darken the token minimally to
  clear 4.5:1 in both themes, changed **at the token** (not per-component) so it stays one coherent design
  decision. Present before/after; ship only on approval. *Can be deferred indefinitely without blocking
  anything else.*

**Risk: low (motion) / design-visible (contrast).**

### P4 — Keyboard parity for Snip *(finding H)* — **separate review**
Additive alternative input; the mouse drag is untouched. Sketch: focus the page image → arrow keys move the
crop origin, Shift+arrows resize, Enter attaches, Escape cancels; on-screen hint text. Plus modal focus
trap + focus restore (finding G).

**Risk: highest (new interaction, and new key handlers can collide with Ctrl+Z/Y and dnd-kit — see R3).**
Held until P1–P3 are proven. **Needs explicit go-ahead** given §0.

### P5 — Tooling *(optional)*
ESLint + `eslint-plugin-jsx-a11y` + an axe pass. Ongoing guardrail so regressions get caught automatically.
Bigger than it sounds (§3-J) — propose only if the earlier phases prove worth defending.

---

## 5. Risk register

| ID | Risk | L | I | Mitigation |
| --- | --- | --- | --- | --- |
| **R1** | **Regression on an untested surface.** All work is in `App.tsx`/`styles.css`; the 84 tests cover only `src/lib/*`. A break ships silently. | High | High | Manual checklist after *every* phase; one phase per commit; diff against `v0.4.0`; consider a UI smoke test (§7 Q1). **The dominant risk.** |
| **R2** | Focus ring shifts layout or gets clipped (sticky `thead`, `overflow` containers, dense table). | Med | Med | `outline` + `outline-offset` only (out of flow); never border/padding. Verify in table, modals, sticky header, both themes. |
| **R3** | New key handlers collide with the **Ctrl+Z/Y undo** handler or **dnd-kit's KeyboardSensor** (drag-reorder). | Med | High | Scope every handler by `e.target`; re-verify undo/redo + drag after each phase (both are already-verified flows). |
| **R4** | `aria-live` spam — per-page OCR updates announce dozens of times; screen reader becomes unusable. | Med | Med | `polite` only; announce milestones (start / done / error), not every page tick. |
| **R5** | `--txt3` change ripples across the whole UI (used in ~10 components). | High | Low | It's a *design* change, not a bug fix → explicit sign-off gate; change the token, not components; ship alone so it's trivially revertible. |
| **R6** | `lang` change alters Thai font fallback/rendering. | Low | Med | `--font-thai` is set explicitly on those fields; visually verify Thai in both themes before/after. |
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

**Open questions for the engineer**
- **Q1:** Add a minimal UI smoke test (e.g. Testing Library: render, assert key controls, one interaction)?
  It's the only real answer to R1 — but it's new tooling. *My lean: yes, small, after P1.*
- **Q2:** Is the `--txt3` contrast bump (§3-B) acceptable as a visible design change?
- **Q3:** Is P4 (Snip keyboard parity) wanted at all, given §0? It's the only true lockout, but also the
  only phase that adds interaction.

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
