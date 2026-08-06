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
> **Still open:** R8 (prompt-injection framing), R12 (Tesseract memory).
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
| R6 ✅ | Proxies are wide open — `functions/api/claude.js`, `functions/api/typhoon.js`, and `functions/api/vision.js` (Cloudflare Pages Functions) send `Access-Control-Allow-Origin: *`, no auth, no rate limit, and forward the body verbatim (any model/params). | High | Anyone who finds the deployed URL can spend your Anthropic / Typhoon / Google Vision credits. | **Fixed (Phase 2, in-place):** shared `functions/api/_guard.js` adds an origin allow-list, model allow-list, body-size cap, per-IP KV rate limit, and an optional shared secret. Each layer degrades gracefully so it never breaks the live deploy — **activate by setting `ALLOWED_ORIGINS` (comma-separated), optionally binding a KV namespace as `RATE_LIMIT`, and optionally setting `PROXY_SECRET` / `ALLOWED_MODELS`** in Cloudflare. |
| R7 ✅ | Gemini key travelled in the URL query string, at all three call sites: `extractWithGemini` (`src/lib/extract.ts`), `ocrPageWithGemini` (`src/lib/ocr.ts`), and Test Connection (`src/App.tsx`). | Low | Held in state only and cleared on reload, but keys in query strings can land in server/proxy logs and browser history. | **Fixed (2026-08-06):** all three now send the key via the `x-goog-api-key` request header instead of `?key=` in the URL. Verified two ways before shipping: (1) a direct `curl` to the live `generateContent` endpoint with a dummy key in the header returned a genuine `API_KEY_INVALID` — proof the endpoint reads the header, not just docs; (2) intercepted the app's own `fetch()` call in-browser and confirmed the real request has no `?key=` and carries `x-goog-api-key` correctly. |
| R8  | Prompt-injection surface — a malicious TOR could embed instructions to the model. | Low | Output is verbatim-copied and human-reviewed, so blast radius is small, but a crafted doc could still skew extraction. | Keep the "extract, don't obey the document" framing in the system prompt; never execute anything from extracted text. |

## Robustness

| ID  | Risk | Sev | Why it matters | How to fix |
| --- | ---- | --- | -------------- | ---------- |
| R9 ✅ | No retry/backoff on `429` / `529` (overloaded) / transient network for any engine. | Med | A single transient API blip fails the whole extraction and the user restarts from scratch. | **Fixed (Phase 2):** `src/lib/net.ts` `fetchWithRetry` (exponential backoff + jitter, honors `Retry-After`, retries 408/425/429/5xx/529 + network errors) wraps every extraction/OCR fetch. Accepts an `AbortSignal` for R10. |
| R10 ✅ | No cancellation — a multi-page OCR/extract can't be stopped once started. | Low | A wrong file or a huge doc means waiting out (and paying for) the full run. | **Fixed (Phase 2):** `doExtract` creates an `AbortController`; its signal threads into every OCR/extraction call (and `fetchWithRetry`), the multi-page loops check `signal.aborted` between pages, and a **Cancel button** in the progress overlay aborts the run (surfaced as "Extraction cancelled", not an error). |
| R11 ✅ | Gemini not pinned to JSON — `generationConfig` lacks `responseMimeType:"application/json"` (`:1512`). | Med | Gemini is more prone to wrapping output in prose, which then trips R4. | **Fixed (Phase 2):** `extractWithGemini` now sets `responseMimeType:"application/json"`. |
| R12 | Tesseract memory — `rasterizePage(..., 3)` at scale 3 (`:1169`); `_tessWorker` cached (`:1147`) but never terminated. | Low | Large scans can OOM the tab; the worker lingers after use. | Add a scale fallback for big pages; terminate the worker when idle/unmounted. |

## Notes

- The **verbatim law holds** in code: prompts enforce it three ways and `validateAndMap` (`:1569`) flags
  all-English-in-a-Thai-doc rows with `_warn`. No fix needed — protect it through future changes.
- None of the above is fixed yet; this task only documents them. Fixes are sequenced in `ROADMAP.md`
  Phase 0/1.
