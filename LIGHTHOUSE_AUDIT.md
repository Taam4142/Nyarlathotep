# LIGHTHOUSE_AUDIT.md — 2026-08-07 baseline, findings, and what was done

Source: Lighthouse 13.4.0, desktop, simulated throttling, run by the engineer from Edge against
**`https://nyarlathotep-a6o.pages.dev/`** on 2026-08-07. The raw JSON is not committed (704 KB); this file
is the distilled record. Re-run after any change here and update the table.

| Category | Score at audit | After Batch 1 (expected) |
| --- | --- | --- |
| Performance | **98** | 98 (unchanged — see §4) |
| Accessibility | **90** | ~93 |
| Best Practices | **100** | 100 |
| SEO | **82** | **100** |

Core metrics were healthy and are not the problem: FCP 0.8 s · LCP 0.8 s · TBT **0 ms** · TTI 0.8 s ·
CLS 0.053 · Speed Index 1.3 s.

---

## 0. Two corrections this audit forced

**The deploy URL moved.** The live site is `nyarlathotep-a6o.pages.dev`. The old `yog-sothoth.pages.dev`
is **gone** — `curl` returns HTTP 000 (no connection), not a redirect. Every doc that referenced it
(DEPLOY.md throughout, a user-facing error string in `App.tsx`) was stale and has been corrected. The
`-a6o` suffix is Cloudflare's collision suffix, so the Pages project was recreated at some point rather
than renamed.

**R6 is live in production — the docs understated it.** `ROADMAP.md` / `RISK_REVIEW.md` said the origin
allow-list still needed the engineer to set `ALLOWED_ORIGINS`. It is set, and correctly. Verified
non-destructively with a CORS preflight (an `OPTIONS` never reaches the paid upstream API):

| Request `Origin:` | Response |
| --- | --- |
| `https://nyarlathotep-a6o.pages.dev` | `Access-Control-Allow-Origin` reflected → **allowed** |
| `https://yog-sothoth.pages.dev` | no `Access-Control-Allow-Origin` → **blocked** |

An unset `ALLOWED_ORIGINS` would return `*` for both, so this is positive proof the allow-list is active
*and* pointed at the current domain.

---

## 1. Security headers — the highest-value finding

Lighthouse scores these at **0 weight** (they are "informative"), so Best Practices was already 100 while
four **High severity** items were open: no CSP, no HSTS, no COOP, no frame-control. Only
`x-content-type-options` and `referrer-policy` were present.

This matters more here than on a typical static site: **the user pastes a Gemini API key into this page.**
Without CSP there is no second line of defence against an injected script exfiltrating it.

Fixed by [`public/_headers`](public/_headers) — `X-Frame-Options: DENY`, HSTS (1 year, no `preload`; that
is the domain owner's call), `Cross-Origin-Opener-Policy: same-origin`, `Permissions-Policy`, and an
**enforcing** CSP. That file documents why each CSP source is required; the short version is that
tesseract.js needs `blob:` (its worker), `wasm-unsafe-eval` (tesseract-core), and `cdn.jsdelivr.net`
(worker + core + Thai/English language data), while React inline styles force `style-src unsafe-inline`.

### How the CSP was verified before shipping (a wrong one silently breaks OCR)

The production bundle was served locally with this exact policy in **enforcing** mode, and each dependency
exercised individually:

| Directive under test | Result |
| --- | --- |
| app boot + render | mounts, 1 root child |
| `style-src` / `font-src` → Google Fonts | 62 font faces, `document.fonts.status === "loaded"` |
| `connect-src` → cdn.jsdelivr.net | HTTP 200 |
| `script-src blob:` / `worker-src blob:` | blob Worker spawned, round-tripped a message |
| `wasm-unsafe-eval` | `WebAssembly.instantiate` succeeded |
| `connect-src` → Gemini | reached Google (HTTP 400 from a dummy key = connection allowed, costs nothing) |
| `worker-src 'self'` → pdf.js worker | spawned, no CSP error |
| `img-src data:` → snip figures | data: image decoded |
| dynamic `import()` of the ExcelJS chunk | imported |

**Negative controls** — without these, "everything passed" could just mean the policy was never applied:
an inline `<script>` was **blocked**, a script from a non-allowlisted origin was **blocked**, and a
`fetch` to `example.com` was **blocked**. Final clean-tab console read: zero output.

> ⚠️ One measurement trap worth remembering: `new Function("")` *appeared* to succeed under the policy,
> which would have implied `unsafe-eval` was leaking in. It was an artifact of DevTools console evaluation
> bypassing `script-src`. The page-context test (injecting a real inline `<script>`) showed the directive
> is properly enforced. Do not trust console-evaluated code to measure `script-src`.

**Not verified in-sandbox:** actual PDF page *rendering* under the policy, because pdf.js needs
`requestAnimationFrame` and the preview pane is hidden (see RISK_REVIEW "Verification limits"). The policy
omits `unsafe-eval`, so pdf.js's own `isEvalSupported()` feature test returns false and it takes its
non-eval font path — a configuration pdf.js supports by design (the probe is wrapped in `try`/`catch`),
but the visual result is unconfirmed here. **If a real PDF ever renders oddly, `public/_headers` documents
the two-second rollback.**

---

## 2. Accessibility (90) — 4 failures

> **Superseded in scope by [`DESIGN_TOKENS.md`](DESIGN_TOKENS.md).** Checking the stylesheet directly
> (rather than only the DOM Lighthouse happened to render) found **14 failing contrast pairings in light
> and 5 undersized controls**, not the 13 + 12 nodes reported here — the extra ones sit behind the Help
> modal, alert banners, and active filter states. The Phase A guard then found **3 more in dark**. Read
> that file before acting on this section; `--txt3` and three of the target sizes are already fixed.

### 2.1 Contrast (13 nodes) — a genuine gap in the earlier P3b work → **Batch 2, needs sign-off**

P3b derived `--txt3: #6a7790` and recorded it as "4.51:1, passes". That was measured **against `--sur1`
(pure white) only**. The token is used on every surface, and fails on all the others:

| Light surface | Ratio with `#6a7790` | |
| --- | --- | --- |
| `--sur1` `#ffffff` | 4.51 | ✅ the one that was tested |
| `--sur0` `#f6f7f9` | 4.21 | ❌ |
| `--sur2` `#f0f2f6` | 4.03 | ❌ — the table headers live here |
| `--sur3` `#e6e9f0` | 3.71 | ❌ |
| key-panel `#f2fcf5` | 4.30 | ❌ |

Dark theme has the same shape: `#7a8393` passes on `--sur1` (4.56) and fails on `--sur2` (4.16).

Derived replacements that clear 4.5:1 on **every** surface (hue preserved, lightness only):
**light `#5d697f`** (worst case 4.56) · **dark `#818998`** (worst case 4.52).

Separately, `lib-item-label` colours its text from `STAT_COLORS` — green is **2.03:1**. Two traps here:

1. The obvious fix ("just use the `--comply` / `--partial` / … CSS tokens") **also fails**, at 4.48:1 —
   close enough to look right and still be wrong. Values that actually pass on all light surfaces:
   `#147839` · `#a94e08` · `#ca2323` · `#5b6a7e`.
2. **`STAT_COLORS` must not simply be edited** — `src/lib/xlsx.ts:103` uses it for the Excel status-cell
   font colour, so changing it silently changes exported workbooks.

Also latent (not a Lighthouse finding): `STAT_COLORS` is a single hard-coded palette, so `lib-item-label`
shows light-theme greens in dark mode. Switching that label to the theme-aware tokens fixes contrast and
dark mode together.

### 2.2 Touch-target size (12 nodes) — **Batch 2, visible change**

The per-row `+` (insert) and `×` (delete) buttons measure 19×20 px and 18.8×21.6 px; WCAG 2.2 AA (2.5.8)
requires 24×24. Enlarging them changes row density, which is a visible design change → sign-off.

### 2.3 `landmark-one-main` — ✅ fixed in Batch 1

No `<main>` existed. `div.content` is now `<main className="content">`. Verified layout is unchanged at
1280×900: sidebar 288 px + main 992 px = 1280, no horizontal overflow, flex behaviour identical.

### 2.4 `td-has-header` — ✅ fixed in Batch 1

The row-actions column header was `<th className="c-del" scope="col" />` — present but **empty**, so its
`<td>` cells counted as header-less. It now carries `<span class="sr-only">Row actions</span>`, with a new
`.sr-only` utility in `styles.css` (the project had none). Confirmed visually hidden via computed style.

---

## 3. SEO (82 → 100) — both fixed in Batch 1

- **`robots.txt` was invalid**: there was no such file, so the SPA fallback served `index.html` and
  Lighthouse parsed HTML as robots directives ("19 errors"). Confirmed live — the response was HTTP 200
  with `Content-Type: text/html`. Added [`public/robots.txt`](public/robots.txt).
- **No meta description**: added to `index.html`.

---

## 4. Performance (98) — one non-finding and two real, optional items

**`server-response-time` "Root document took 670 ms", score 0 — ignore this one.** Warm TTFB, measured
three times against the live site: **54 ms, 78 ms, 55 ms**. The 670 ms was a cold-start / cache-miss
artifact in that single run, not a standing problem. Recorded here so nobody re-opens it.

Genuinely open, both deferred as optional:

- **Render-blocking Google Fonts (~160 ms)** — and the same font load is the CLS culprit (0.053; the swap
  reflows the table). Self-hosting the three families as bundled woff2 would fix both at once, and would
  also let `style-src` / `font-src` drop `fonts.googleapis.com` / `fonts.gstatic.com` from the CSP.
- **Unused JavaScript: 144 KB of the 201 KB main chunk (71%)** — a code-splitting opportunity (pdf.js and
  tesseract are only needed once a document is loaded). ExcelJS is already split.

**Source maps** were flagged as missing; `vite.config.ts` now sets `build.sourcemap: true`. No secret is
exposed — the source is public on GitHub and all keys live server-side in Pages env vars.

---

## 5. Batch 1 — shipped

Security headers, `robots.txt`, meta description, `<main>` landmark, `td-has-header`, source maps, and the
stale-URL corrections. No visible design change — safe by construction. Live and verified on the deployed
site (headers responding, `/robots.txt` now `text/plain`, app boots with zero console output under the
enforcing CSP).

---

## 6. Batch 2 — the phase plan

**Review page** (live before/after, every ratio computed in-page against every surface the token actually
lands on, both themes): https://claude.ai/code/artifact/05f9500e-a28d-4281-9294-04941ac17f05

That page's formula was anchored against published WCAG reference pairs before publishing (`#767676` on
white = 4.54:1, `#777777` = 4.48:1, black-on-white = 21:1 — all exact), and the adjustment **direction**
was checked per theme. Direction is the specific way the P3b artifact nearly shipped wrong.

Four phases, ordered by **ascending visual risk** — the same discipline that kept P0–P3b safe. One phase =
one commit = one `git revert`.

| Phase | Change | Visual risk | Closes | Status |
| --- | --- | --- | --- | --- |
| **A** | Contrast regression guard (unit test over `styles.css`) | **none** | prevents recurrence | ✅ **Done** |
| **B** | `--txt3`, light + dark | low | 1 pairing, ~27 sites | ✅ **Done** |
| **C** | Status colour system + `lib-item-label` decoupling | **medium** | 13 light + 3 dark | ✅ **Done — 2026-08-18** |
| **D** | 5 interactive targets → 24×24 | **none** (measured) | 3 resized, 2 exempt | ✅ **Done** |

### Phase A — the regression guard, deliberately first

The P3b bug survived months not because it was subtle but because **nothing checked it**. A green
Lighthouse score cannot catch it either: Lighthouse audits the DOM that exists at audit time, so anything
behind a closed modal, an inactive filter, or an unshown banner is invisible to it (§4). A test that reads
the *stylesheet* catches what a browser audit structurally cannot.

Shape: a pure `src/lib/contrast.ts` (ratio math + token parsing + pairing extraction), plus
`contrast.test.ts` that (1) anchors the formula against published reference pairs, and (2) asserts every
real `color`/`background` pairing in `styles.css` clears 4.5:1 — with today's known failures listed in an
explicit allowlist that **shrinks to empty** as B and C land.

The allowlist matters: it means the guard protects against *new* regressions from day one, while CI stays
green. Without it the test would be red until every phase lands, and a permanently-red test gets ignored.

**Known limitation, stated rather than glossed:** this guard covers contrast only. Target size depends on
rendered layout (padding + font metrics), and jsdom does no layout, so §3.2 cannot be unit-tested the same
way. Target sizes stay a manual/measured check.

### Phase B — `--txt3`

Two token values (light `#6a7790` → `#5d697f`, dark `#7a8393` → `#818998`). Token-only edit; roughly 27
call sites update automatically. Visible effect: tertiary text (column headers, section labels,
placeholders, counters) gets slightly darker in light mode and slightly lighter in dark.

### Phase C — the status colour system ✅ Done

The systemic one: **every status colour fails AA on its own tint** — one root cause, 14 symptoms
(`.sts-*`, `.f-*.on`, `.help-tag-*`, `.alert-err`, `.alert-warn`, `.row-del:hover`). Proposed values in
[`DESIGN_TOKENS.md`](DESIGN_TOKENS.md) §2.4.

This is held back because these are the app's most semantically loaded colours — darkening them changes how
the compliance matrix *feels*, which is a judgement call, not a measurement. Section 2b of the review page
shows the pills before/after; judge the swatches, not the numbers.

Also in this phase: `lib-item-label` stops reading from `STAT_COLORS`, which fixes its 2.03:1 contrast
**and** the latent bug where it shows light-theme greens in dark mode. `STAT_COLORS` itself must not be
edited — it drives Excel export via `xlsx.ts:103`.

### Phase D — target sizes

Five controls to 24×24: `.lib-remove` (7.6×15.2), `.row-check` (14×14), `.row-grip` (15.8×17),
`.row-del` (18.8×21.6), `.row-ins` (19.4×20).

**Two corrections, both from measuring rather than estimating.**

1. An early estimate said rows would grow ~4 px taller. Wrong: rows are **77 px** with **57 px of vertical
   headroom**, so the vertical growth is genuinely free. Confirmed after the change — row height still 77 px.
2. A later claim said the change costs *no* layout at all. Also not quite right. The actions column grew
   **64.1 px → 74 px**; the table total stays exactly 992 px with no overflow and no horizontal scroll, so
   the ~10 px is absorbed by the flexible Requirement/Remarks columns (about 1 % narrower each).

**Only three of the five were resized**, because the criterion was checked properly rather than applied
blindly. WCAG 2.5.8 exempts an undersized target whose 24 px circle does not intersect another target:

| Control | size | nearest target | verdict |
| --- | --- | ---: | --- |
| `.row-ins` / `.row-del` | 19.4×20 / 18.8×21.6 | **21.1 px** apart | exception NOT met → **resized to 24×24** |
| `.lib-remove` | 7.6×15.2 | 108.5 px | exempt, but **resized anyway** — under a third of the required area and hard for anyone to hit; usability, not conformance |
| `.row-check` | 14×14 | 42.9 px | **exempt — left alone**; enlarging a visible checkbox for no conformance gain |
| `.row-grip` | 15.8×17 | 42.9 px | **exempt — left alone** |

All three resized controls are background-less glyph buttons, so the larger box is invisible until hover.
Insert, delete and library-remove all re-verified working after the change.

### Definition of done, per phase

1. `npm run typecheck` clean · full test suite green · `npm run build` green.
2. The Phase A guard's allowlist shrinks by exactly the pairings that phase claims to fix — no more, no less.
3. Layout re-measured in-browser where the phase could move anything (B: none expected; D: none expected,
   but measured anyway because that is the claim being made).
4. Regression pass on the flows the change touches; no console errors.
5. Honesty note in the commit: what was verified, and what could not be.

### Rollback

Each phase is one commit. `git revert <sha>` restores the previous appearance exactly; the guard's
allowlist grows back with it, so the test stays green either way.

---

## 7. Status
