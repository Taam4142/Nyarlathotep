# TOR Compliance Matrix (TOR-Extract)

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

Pick an engine from the top-bar dropdown. Scanned PDFs additionally pick an OCR feeder.

| Engine          | Needs a key?          | How it works                                                       | Best for                          |
| --------------- | --------------------- | ------------------------------------------------------------------ | --------------------------------- |
| 🆓 Browser OCR  | No                    | Tesseract.js OCR (Thai+English) + heuristic row-splitting, 100% client-side | Zero-setup, offline, no billing   |
| ⚡ Claude       | Yes (server-side, via proxy) | Claude reads the PDF / page images and structures to JSON   | Highest verbatim fidelity         |
| ✦ Gemini        | Yes (in-browser, session-only) | Gemini reads the PDF / page images and structures to JSON  | Free-ish, no proxy needed         |

For a **scanned** PDF under Claude/Gemini, the OCR step itself offers four choices: Browser (Tesseract),
Claude Vision, Gemini Vision, or **Google Document AI** (best for badly degraded scans; needs a Google
Cloud processor + bearer token).

## Tech stack

- **One file:** [`tor_compliance_matrix.html`](tor_compliance_matrix.html) is the entire app — React 18
  compiled **in the browser** by Babel-standalone. No build step, no `package.json`.
- **CDN libraries:** PDF.js (read + rasterize), SheetJS (`xlsx` export), Tesseract.js (browser OCR),
  React/ReactDOM, Babel, Google Fonts (Sarabun for Thai).
- **Serverless proxy:** [`api/claude.js`](api/claude.js) forwards requests to the Anthropic API and
  injects `ANTHROPIC_API_KEY` server-side so the Claude key never reaches the browser.
- **Hosting:** Vercel static serve; [`vercel.json`](vercel.json) routes `/api/claude` to the function
  and everything else to the HTML. The build is deliberately bypassed.

## Setup & deploy (Vercel)

1. Import the repo into Vercel.
2. Add an environment variable **`ANTHROPIC_API_KEY`** (your key from `console.anthropic.com` — note that
   a claude.ai subscription is **not** the same as API credits).
3. Deploy. `vercel.json` handles routing; no build command is needed.
4. Gemini and Google Doc AI keys are entered in the UI at runtime, held in React state only, and cleared
   on reload — they are never stored or sent anywhere except the respective Google APIs.

## Running locally

Open `tor_compliance_matrix.html` in a browser (or any static server) and it loads. Caveats:

- The **Claude** engine calls `/api/claude`, which only exists when deployed on Vercel — locally it will
  fail with a CORS/404 error. Use the deployed URL to test Claude.
- The **Browser OCR** and **Gemini** engines work fully locally (Gemini is called directly from the page).

## Known limitations

- **No persistence** — all state lives in React memory; refreshing the page clears the matrix.
- **Large PDFs** — very long TORs (~100+ pages) can exceed model document limits.
- **Browser OCR** is lower-accuracy and splits rows heuristically (review clause boundaries).
- **Excel Thai font** — SheetJS (free) can't set fonts; after export, set column C to *TH Sarabun New* or
  *Cordia New* for correct Thai rendering.

See [`RISK_REVIEW.md`](RISK_REVIEW.md) for known bugs/security items and [`ROADMAP.md`](ROADMAP.md) for
what's planned to address them.

## Repository layout

| Path                         | Purpose                                                        |
| ---------------------------- | -------------------------------------------------------------- |
| `tor_compliance_matrix.html` | The entire single-file app (UI + all logic).                   |
| `api/claude.js`              | Vercel serverless proxy to the Anthropic API.                  |
| `vercel.json`                | Routing / deploy config.                                       |
| `SKILL.md`                   | What the tool is and how it's wired (reference).               |
| `CLAUDE.md`                  | Prompt engineering + AI behaviour rules.                       |
| `ROADMAP.md`                 | Phased development plan + deferred items.                      |
| `RISK_REVIEW.md`             | Known bugs, security, and robustness risks (with fixes).       |
| `CHANGELOG.md`               | Version history.                                               |
