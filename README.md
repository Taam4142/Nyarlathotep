# Yog-Sothoth

> A **TOR Compliance Matrix** tool (formerly *TOR-Extract*).

Turn a Thai/English **Terms of Reference (TOR)** PDF into an editable **compliance matrix**, then export
it as a signed-off `.xlsx` ready for bid submission.

> **Core law:** the AI copies requirement text **verbatim** — it never translates, paraphrases, or
> invents. A human reviews every row and sets the compliance status. See [`CLAUDE.md`](CLAUDE.md).

## Pipeline

```
TOR PDF → detect digital vs scanned → [OCR if scanned] → AI extracts verbatim clauses to JSON
        → user edits Status + Remarks → export .xlsx
```

## Extraction engines

Pick an engine from the top-bar dropdown. **Typhoon is the default** — the free, Thai-first path. For a
**scanned** PDF under Claude/Gemini, you also pick an OCR feeder (Typhoon, Google Vision, Tesseract, Claude
Vision, or Gemini Vision).

| Engine | Free? | Thai | How it works |
| ------ | ----- | ---- | ------------ |
| **✦ Typhoon** *(default)* | ✅ free tier (20 req/min) | **Best — Thai-tuned** | Reads each page via the `/api/typhoon` proxy; rows split heuristically (or structured by Claude/Gemini when used as a feeder). |
| **🆓 Browser OCR** | ✅ 100% free, offline | Weak | Tesseract.js in the browser + heuristic row-splitting. No key, works offline. |
| **⚡ Claude** | ❌ paid API | Good | Claude reads the PDF / page images and structures to JSON via the `/api/claude` proxy. Highest verbatim fidelity. |
| **✦ Gemini** | ~ free tier | Good | Gemini reads the PDF / page images directly from the browser (key held in-session). |

**OCR feeders** (scanned PDF under Claude/Gemini): **Typhoon** (Thai, via proxy) · **Google Vision** (free
tier 1,000 pages/mo, good Thai, via proxy) · **Tesseract** (offline) · **Claude Vision** · **Gemini
Vision**.

> Google Document AI was removed in v0.2.0 (paid + heavy setup). See [`OCR_RESEARCH.md`](OCR_RESEARCH.md)
> for the full survey of OCR options and why this lineup was chosen.

## Tech stack

- **One file:** [`index.html`](index.html) is the entire app — React 18
  compiled **in the browser** by Babel-standalone. No build step, no `package.json`.
- **CDN libraries:** PDF.js (read + rasterize), SheetJS (`xlsx` export), Tesseract.js (browser OCR),
  React/ReactDOM, Babel, Google Fonts (Sarabun for Thai).
- **Serverless proxies (Cloudflare Pages Functions):** [`functions/api/claude.js`](functions/api/claude.js),
  [`functions/api/typhoon.js`](functions/api/typhoon.js), and [`functions/api/vision.js`](functions/api/vision.js)
  forward to the Anthropic / Typhoon / Google Vision APIs and inject the keys server-side, so those keys
  never reach the browser.
- **Hosting:** Cloudflare Pages (static). The app is `index.html` (Pages serves it at `/` natively);
  `/api/*` is handled by the Functions. No build step, no client-side routing (so no `_redirects` needed).

## Setup & deploy (Cloudflare Pages)

1. Create a free **Cloudflare** account.
2. Dashboard → **Workers & Pages → Create**. Choose the **Pages** tab (⚠️ **not** Workers) →
   **Connect to Git** → select `Taam4142/Yog-Sothoth`. This must be a **Pages** project — a Workers
   project runs `wrangler deploy` and cannot serve the `functions/` dir or the static file (see
   Troubleshooting).
3. Build settings: **Framework preset = None**, **Build command = `exit 0`** (Cloudflare recommends this
   over blank so Pages Functions stay enabled), **Build output directory = `/`**.
4. **Settings → Environment variables** (add to Production *and* Preview):
   - `ANTHROPIC_API_KEY` — from `console.anthropic.com` (a claude.ai subscription is **not** API credits).
   - `TYPHOON_API_KEY` — a free key from `opentyphoon.ai` (verify current free-tier limits there).
   - `GOOGLE_VISION_API_KEY` *(optional — only for the Google Vision feeder)* — a Cloud Vision API key
     (Google Cloud account + card; free tier 1,000 pages/month).
5. **Deploy.** Note the `*.pages.dev` URL. Functions under `functions/` are picked up automatically.
6. Optional local dev of the Functions: `npx wrangler pages dev .`.

### Troubleshooting

**Build log shows `npx wrangler deploy` and `Could not detect a directory containing static files`.**
The project was created as a **Workers** project, not **Pages**. `wrangler deploy` is the Workers command;
it ignores the `functions/` file-based routing and the static file. Fix: delete that project and create a
**Pages** project (step 2). Do not set a custom "deploy command" — a Pages project just uploads the output
directory and runs `functions/` automatically; there is no `wrangler deploy` step.

The Gemini key is entered in the UI at runtime (held in React state only, cleared on reload). Typhoon and
Google Vision keys stay server-side in the Cloudflare env vars above.

## Running locally

Serve the folder statically (e.g. `py -m http.server 8080`) and open
`http://localhost:8080/` (served as `index.html`). Caveats:

- The **Typhoon** and **Claude** engines and the **Google Vision** feeder call `/api/*`, which only exist
  on the deployed Cloudflare site (or via `npx wrangler pages dev .`). Locally they fail with a network error.
- **Browser OCR** and **Gemini** work fully locally.

## Known limitations

- **No persistence** — all state lives in React memory; refreshing the page clears the matrix.
- **Large PDFs** — very long TORs (~100+ pages) can exceed model document limits.
- **Browser OCR / heuristic rows** — Tesseract and the Typhoon standalone path split rows heuristically
  (review clause boundaries); for clean rows, use Typhoon as a feeder under Claude/Gemini.
- **Excel Thai font** — SheetJS (free) can't set fonts; after export, set column C to *TH Sarabun New* or
  *Cordia New* for correct Thai rendering.

See [`RISK_REVIEW.md`](RISK_REVIEW.md) for known bugs/security items and [`ROADMAP.md`](ROADMAP.md) for
what's planned.

## Repository layout

| Path                         | Purpose                                                        |
| ---------------------------- | -------------------------------------------------------------- |
| `index.html`                 | The entire single-file app (UI + all logic).                   |
| `functions/api/claude.js`    | Cloudflare Pages Function — proxy to the Anthropic API.         |
| `functions/api/typhoon.js`   | Cloudflare Pages Function — proxy to the Typhoon OCR API.       |
| `functions/api/vision.js`    | Cloudflare Pages Function — proxy to the Google Vision API.     |
| `SKILL.md`                   | What the tool is and how it's wired (reference).               |
| `CLAUDE.md`                  | Prompt engineering + AI behaviour rules.                       |
| `OCR_RESEARCH.md`            | Survey of OCR options + the lineup decision.                   |
| `ROADMAP.md`                 | Phased development plan + deferred items.                      |
| `RISK_REVIEW.md`             | Known bugs, security, and robustness risks (with fixes).       |
| `CHANGELOG.md`               | Version history.                                               |
