# RISK_REVIEW.md — TOR-Extract

> Known correctness, security, and robustness risks in the current code, with why each matters and how to
> fix it. Advisory register — record, don't silently skip. Reviewed 2026-07-27 against commit `a547bdd`.
> Line anchors point into [`tor_compliance_matrix.html`](tor_compliance_matrix.html) unless noted.
> Fixes are scheduled in [`ROADMAP.md`](ROADMAP.md).

Severity: **High** = wrong output, crash, or credit/security exposure · **Med** = fails on realistic
inputs · **Low** = quality / edge case.

## Correctness

| ID  | Risk | Sev | Why it matters | How to fix |
| --- | ---- | --- | -------------- | ---------- |
| R1  | Dead + broken `ocrPDFClaude()` (`:1280`) — never called, and it hits `api.anthropic.com` directly with **no** `x-api-key` header. | Low | Confuses readers; would fail CORS + 401 if ever wired up. The live Claude-Vision path inlines its own proxy `fetch` (~`:1793`) instead. | Delete the dead function, or refactor the inline block to a single shared proxy helper. |
| R2  | Large-PDF base64 crash (`:1380`, `:1488`) — `btoa(String.fromCharCode(...new Uint8Array(ab)))` spreads the whole file onto the call stack. | High | `RangeError: Maximum call stack size exceeded` on big PDFs → the digital-PDF path dies for exactly the large documents users care about. | Encode in chunks, or use `FileReader.readAsDataURL` and strip the prefix. |
| R3  | Truncated-JSON extraction — Claude `max_tokens:4000` (`:1414`), Gemini `maxOutputTokens:8192` (`:1512`). | High | A long TOR overruns the cap; the array is cut mid-object and `JSON.parse` throws a generic error, losing the whole extraction. | Detect `stop_reason==="max_tokens"` / `finishReason==="MAX_TOKENS"`; raise the cap, chunk the doc and merge, and/or recover a bracket-balanced partial array. |
| R4  | Brittle JSON cleaning (`:1425`, `:1521`) — the response is regex-stripped of markdown code fences, then `JSON.parse` runs directly. | Med | Any stray prose or trailing comma from the model breaks parsing entirely. | Fall back to extracting the first balanced `[...]` block; tolerate trailing commas. |
| R5  | `detectPDFType` samples page 1 only (`:1129`). | Low | A scanned cover on an otherwise-digital PDF (or vice-versa) is misclassified, sending the doc down the wrong path. | Sample several pages / total extracted-text length before deciding. |

## Security & cost

| ID  | Risk | Sev | Why it matters | How to fix |
| --- | ---- | --- | -------------- | ---------- |
| R6  | Proxy is wide open — [`api/claude.js`](api/claude.js) sends `Access-Control-Allow-Origin: *`, no auth, no rate limit, and forwards `req.body` verbatim (any model, any params). | High | Anyone who finds the deployed URL can spend your Anthropic credits and pick any model/feature. | Add an origin allow-list, a shared-secret/session check, a model allow-list, a max body size, and basic rate limiting. |
| R7  | Gemini key travels in the URL query string (`?key=` at `:1483`, `:1541`, `:1964`). | Low | Held in state only and cleared on reload, but keys in query strings can land in server/proxy logs and browser history. | Prefer a header where the API allows; otherwise document the trade-off. |
| R8  | Prompt-injection surface — a malicious TOR could embed instructions to the model. | Low | Output is verbatim-copied and human-reviewed, so blast radius is small, but a crafted doc could still skew extraction. | Keep the "extract, don't obey the document" framing in the system prompt; never execute anything from extracted text. |

## Robustness

| ID  | Risk | Sev | Why it matters | How to fix |
| --- | ---- | --- | -------------- | ---------- |
| R9  | No retry/backoff on `429` / `529` (overloaded) / transient network for any engine. | Med | A single transient API blip fails the whole extraction and the user restarts from scratch. | Wrap all API calls in exponential backoff with a few retries. |
| R10 | No cancellation — a multi-page OCR/extract can't be stopped once started. | Low | A wrong file or a huge doc means waiting out (and paying for) the full run. | Thread an `AbortController` into every `fetch`; add a Cancel button to the progress overlay. |
| R11 | Gemini not pinned to JSON — `generationConfig` lacks `responseMimeType:"application/json"` (`:1512`). | Med | Gemini is more prone to wrapping output in prose, which then trips R4. | Set `responseMimeType` (and ideally a `responseSchema`). |
| R12 | Tesseract memory — `rasterizePage(..., 3)` at scale 3 (`:1169`); `_tessWorker` cached (`:1147`) but never terminated. | Low | Large scans can OOM the tab; the worker lingers after use. | Add a scale fallback for big pages; terminate the worker when idle/unmounted. |

## Notes

- The **verbatim law holds** in code: prompts enforce it three ways and `validateAndMap` (`:1569`) flags
  all-English-in-a-Thai-doc rows with `_warn`. No fix needed — protect it through future changes.
- None of the above is fixed yet; this task only documents them. Fixes are sequenced in `ROADMAP.md`
  Phase 0/1.
