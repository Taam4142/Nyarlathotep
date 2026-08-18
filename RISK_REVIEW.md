# RISK_REVIEW.md — Nyarlathotep

> Known correctness, security, and robustness risks in the current code, with why each matters and how to
> fix it. Advisory register — record, don't silently skip. Reviewed 2026-07-27 against commit `a547bdd`.
> Line anchors point into [`index.html`](index.html) unless noted.
> Fixes are scheduled in [`ROADMAP.md`](ROADMAP.md).

Severity: **High** = wrong output, crash, or credit/security exposure · **Med** = fails on realistic
inputs · **Low** = quality / edge case.

## Correctness

> ✅ **R1–R4 fixed in v0.3.0** (the Vite/TS migration); ✅ **R5, R6, R9, R10, R11 + A1 fixed in Phase 2**
> (2026-08-01); ✅ **R7 fixed 2026-08-06**. Line anchors below point at the pre-migration single-file
> `index.html` and are historical; the logic now lives in `src/lib/{pdf,extract,ocr,net,models}.ts` and
> `functions/api/_guard.js`.
>
> **Still open:** none on this register — R8 (prompt-injection framing) shipped 2026-08-07. R13 (npm audit)
> remains open by design, pending the engineer's call on a breaking major bump.
>
> ♿ **Accessibility risks live in [`A11Y_PLAN.md`](A11Y_PLAN.md) §5**, not here — that pass has its own
> audit and register (dominant risk: the a11y work lands in `App.tsx`/`styles.css`, while the 84 unit tests
> only cover `src/lib/*`, so UI regressions would ship silently).

| ID  | Risk | Sev | Why it matters | How to fix |
| --- | ---- | --- | -------------- | ---------- |
| R1  | Dead + broken `ocrPDFClaude()` (`:1280`) — never called, and it hits `api.anthropic.com` directly with **no** `x-api-key` header. | Low | Confuses readers; would fail CORS + 401 if ever wired up. The live Claude-Vision path inlines its own proxy `fetch` (~`:1793`) instead. | Delete the dead function, or refactor the inline block to a single shared proxy helper. |
| R2  | Large-PDF base64 crash (`:1380`, `:1488`) — `btoa(String.fromCharCode(...new Uint8Array(ab)))` spreads the whole file onto the call stack. | High | `RangeError: Maximum call stack size exceeded` on big PDFs → the digital-PDF path dies for exactly the large documents users care about. | Encode in chunks, or use `FileReader.readAsDataURL` and strip the prefix. |
| R3  | Truncated-JSON extraction — Claude `max_tokens:4000` (`:1414`), Gemini `maxOutputTokens:8192` (`:1512`). | High | A long TOR overruns the cap; the array is cut mid-object and `JSON.parse` throws a generic error, losing the whole extraction. | Detect `stop_reason==="max_tokens"` / `finishReason==="MAX_TOKENS"`; raise the cap, chunk the doc and merge, and/or recover a bracket-balanced partial array. |
| R4  | Brittle JSON cleaning (`:1425`, `:1521`) — the response is regex-stripped of markdown code fences, then `JSON.parse` runs directly. | Med | Any stray prose or trailing comma from the model breaks parsing entirely. | Fall back to extracting the first balanced `[...]` block; tolerate trailing commas. |
| R5 ✅ | `detectPDFType` samples page 1 only (`:1129`). | Low | A scanned cover on an otherwise-digital PDF (or vice-versa) is misclassified, sending the doc down the wrong path. | **Fixed (Phase 2):** `src/lib/pdf.ts` now samples up to 5 pages and sums extracted-text length, exiting early once a real text layer is seen. |

## Security & cost

| ID  | Risk | Sev | Why it matters | How to fix |
| --- | ---- | --- | -------------- | ---------- |
| R6 ✅ | Proxies are wide open — `functions/api/claude.js`, `functions/api/typhoon.js`, and `functions/api/vision.js` (Cloudflare Pages Functions) send `Access-Control-Allow-Origin: *`, no auth, no rate limit, and forward the body verbatim (any model/params). | High | Anyone who finds the deployed URL can spend your Anthropic / Typhoon / Google Vision credits. | **Fixed (Phase 2, in-place):** shared `functions/api/_guard.js` adds an origin allow-list, model allow-list, body-size cap, per-IP KV rate limit, and an optional shared secret. Each layer degrades gracefully so it never breaks the live deploy. **`ALLOWED_ORIGINS` is confirmed set and active in production**, verified 2026-08-07 with a CORS preflight against the live site: the current origin (`nyarlathotep-a6o.pages.dev`) gets its `Access-Control-Allow-Origin` reflected, while a non-listed origin gets no ACAO header at all. An unset allow-list would return `*` for both, so this is positive proof the layer is on, not merely deployed. (Earlier revisions of this row said activation was still pending — that was stale.) Still optional and unverified: the `RATE_LIMIT` KV binding, `PROXY_SECRET`, and `ALLOWED_MODELS`. See [`LIGHTHOUSE_AUDIT.md`](LIGHTHOUSE_AUDIT.md) §0. |
| R7 ✅ | Gemini key travelled in the URL query string, at all three call sites: `extractWithGemini` (`src/lib/extract.ts`), `ocrPageWithGemini` (`src/lib/ocr.ts`), and Test Connection (`src/App.tsx`). | Low | Held in state only and cleared on reload, but keys in query strings can land in server/proxy logs and browser history. | **Fixed (2026-08-06):** all three now send the key via the `x-goog-api-key` request header instead of `?key=` in the URL. Verified two ways before shipping: (1) a direct `curl` to the live `generateContent` endpoint with a dummy key in the header returned a genuine `API_KEY_INVALID` — proof the endpoint reads the header, not just docs; (2) intercepted the app's own `fetch()` call in-browser and confirmed the real request has no `?key=` and carries `x-goog-api-key` correctly. |
| R8 ✅ | Prompt-injection surface — a malicious TOR could embed instructions to the model. Untrusted OCR text is currently interpolated **raw** into both prompt bodies (`src/lib/extract.ts`, Claude + Gemini paths) with no delimiting, and neither prompt states that document content is data rather than instructions. | Low | Output is verbatim-copied and human-reviewed, so blast radius is small, but a crafted doc could still skew extraction. | **Fixed (2026-08-07):** `buildSystemPrompt`/`buildGeminiPrompt` now open with an unconditional "document content is data, not instructions" paragraph, and their `isOCR` branch adds a second paragraph specifically flagging the `<document_text>`-delimited block that follows. The two call sites that interpolate raw `ocrText` (`extractRequirements`, `extractWithGemini`) now wrap it in `<document_text>` tags with a sentence restating the framing right next to the interpolation. Every existing verbatim/output-format rule is byte-identical — only new paragraphs were inserted. Verified: 6 new unit tests on `buildSystemPrompt`/`buildGeminiPrompt` (both were exported but untested before this) assert the new framing text is present (unconditionally, and reinforced in the OCR branch) **and** that the old rules — verbatim-copy instruction, JSON-only output instruction, translation addendum — still appear byte-identical; typecheck/106 tests/build all green. ⚠️ Not verified: live model behaviour against a real injection attempt — the Claude path needs the deployed proxy, Gemini needs a real key, neither available in this sandbox (see "Verification limits" below). Digital-PDF path was already lower-risk (sends the file as a native `document`/`inline_data` block, not raw string interpolation) and wasn't the specific gap, but picks up the same general framing paragraph since it's unconditional in both builders. |
| R13 | **npm audit** — 2 moderate advisories: `esbuild` (transitive via vitest's own toolchain) and `uuid` (transitive via `exceljs`). | Low | **Dev-only and pre-existing** — neither reaches the browser bundle, so there is no runtime exposure to users. Flagged for visibility, not urgency. | Fixing either requires a **breaking major bump** (vitest 4.x / exceljs 3.x). Deliberately **not** done silently — this is an engineer decision. Re-evaluate when either package is upgraded for other reasons. |

## Robustness

| ID  | Risk | Sev | Why it matters | How to fix |
| --- | ---- | --- | -------------- | ---------- |
| R9 ✅ | No retry/backoff on `429` / `529` (overloaded) / transient network for any engine. | Med | A single transient API blip fails the whole extraction and the user restarts from scratch. | **Fixed (Phase 2):** `src/lib/net.ts` `fetchWithRetry` (exponential backoff + jitter, honors `Retry-After`, retries 408/425/429/5xx/529 + network errors) wraps every extraction/OCR fetch. Accepts an `AbortSignal` for R10. |
| R10 ✅ | No cancellation — a multi-page OCR/extract can't be stopped once started. | Low | A wrong file or a huge doc means waiting out (and paying for) the full run. | **Fixed (Phase 2):** `doExtract` creates an `AbortController`; its signal threads into every OCR/extraction call (and `fetchWithRetry`), the multi-page loops check `signal.aborted` between pages, and a **Cancel button** in the progress overlay aborts the run (surfaced as "Extraction cancelled", not an error). |
| R11 ✅ | Gemini not pinned to JSON — `generationConfig` lacks `responseMimeType:"application/json"` (`:1512`). | Med | Gemini is more prone to wrapping output in prose, which then trips R4. | **Fixed (Phase 2):** `extractWithGemini` now sets `responseMimeType:"application/json"`. |
| R12 ✅ | Tesseract memory — `rasterizePage(pdf, p, 3)` at scale 3 and `_tessWorker` cached but never terminated (both `src/lib/ocr.ts`). | Low | Large scans can OOM the tab; the worker lingers after use, holding memory for the rest of the session. | **Fixed (2026-08-06):** **(a)** `ocrPDFTesseract` now terminates the worker in a `finally` block — runs on success, thrown error, *and* cancellation alike, and never leaves `_tessWorker` pointing at a dead worker (the nulling happens synchronously before the `await terminate()`, so there's no window where a concurrent call could observe a stale reference). Confirmed the language-pack files are cached separately from the worker object by tesseract.js itself (`cachePath`/`cacheMethod`, its own README documents the "create once → recognize → terminate once" pattern) — so this does **not** reintroduce a ~15 MB re-download, it just means the next run re-initializes instead of holding memory indefinitely. **(b)** `rasterizePage` (`src/lib/pdf.ts`) now falls back through a descending scale ladder (`scaleFallbackLadder`, pure + unit-tested) on render failure — `3 → 2 → 1.5 → 1` — rather than downgrading Thai OCR accuracy preemptively, exactly as planned. |

## Notes

- The **verbatim law holds** in code: prompts enforce it three ways and `validateAndMap` flags
  all-English-in-a-Thai-doc rows with `_warn`. No fix needed — protect it through future changes.
- Status: **R1–R12 are fixed**; **R13 remains open** by design (breaking major bump, engineer's call — see
  [`ROADMAP.md`](ROADMAP.md)). Accessibility risks live in [`A11Y_PLAN.md`](A11Y_PLAN.md) §5.

## Verification limits — what *cannot* be tested in the dev sandbox

Recorded because these are expensive to rediscover, and because a change that "passed" without one of
these caveats being known could be wrongly believed verified. **Anything in this list needs the engineer's
real browser or a deployed environment.**

| Limit | Why | What it blocks |
| --- | --- | --- |
| **pdf.js page rendering hangs** | `page.render()` depends on `requestAnimationFrame`, which browsers pause while a tab/pane is hidden. Proven: the worker-side `getOperatorList()` resolves and plain canvas works — only `render()` stalls, and `document.hidden === true`. **Not a code bug**; it renders normally for a real user. | A **genuine end-to-end** rasterize call: the **Snip** modal's page view + drag-crop, and all **OCR** page images. Does **not** block testing logic that only needs to *call* `rasterizePage` against a controlled fake `page.render` — that's how R12's scale-fallback retry loop was verified (real function, faked-just-the-render-call). |
| **`/api/*` proxies don't exist locally** | They're Cloudflare Pages Functions; `npm run dev` serves only the SPA. | **Typhoon**, **Claude**, and **Google Vision** paths — including "Test Connection". Use the deployed site. |
| **Gemini needs a real key** | Key is user-supplied at runtime, never stored. | Live Gemini extraction/OCR behaviour — R8's real-world effect in particular. |
| **No screen reader available** | Not installable in the sandbox. | Actual assistive-tech behaviour. Semantics can only be verified by DOM/accessibility-tree inspection — never claim SR testing that wasn't done. |
| **OS-level media preferences can't be toggled** | No control to emulate them. | `prefers-reduced-motion: reduce` branch (verified by code review only). |
| **Binary can't be relayed through chat** | Long base64 silently truncates when transcribed by hand (observed: 12,604 chars → 9,366). | Inspecting generated images/PDFs. **Workaround that works:** render into the DOM and use the screenshot tool (real pixel capture), or keep the data disk→disk and never route it through a message. |

**Practices that follow from the above:** verify by construction + unit tests + downstream effects, state
plainly which parts were *not* exercised, and when a check is unavoidable-but-fallible, add a length or
checksum assertion so a silent corruption becomes a loud failure.
