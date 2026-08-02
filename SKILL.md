# SKILL.md — Nyarlathotep (TOR Compliance Matrix)

> Reference document for building, extending, and debugging the Nyarlathotep (TOR Compliance Matrix) web app.
> Last updated: 2026-08-01. **Build note (v0.3.0):** the app is now a **Vite + React + TypeScript** build
> — logic lives in typed `src/lib/*` modules, UI in `src/App.tsx`, styles in `src/styles.css`. References
> below to a single in-browser-Babel `index.html` describe the pre-v0.3.0 structure. See CHANGELOG.md.

---

## What This Tool Does

Converts a Thai/English Terms of Reference (TOR) PDF into an editable compliance matrix,
then exports it as a signed-off `.xlsx` ready for bid submission.

Core flow:

```
TOR PDF → [Detect type] → [OCR if scanned] → [Claude extracts verbatim clauses]
       → [User edits status + remarks] → [Export .xlsx]
```

---

## PDF Detection — Digital vs Scanned

Detecting PDF type happens **in-browser before any API call**.

### How to detect

Use `PDF.js` (pdfjs-dist) to attempt text extraction from the first page.

- If extracted text length > 50 characters → **Digital PDF**
- If extracted text is empty or garbage (< 50 chars) → **Scanned PDF**

```js
import * as pdfjsLib from "pdfjs-dist";

async function detectPDFType(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const textContent = await page.getTextContent();
  const text = textContent.items.map((i) => i.str).join("");
  return text.trim().length > 50 ? "digital" : "scanned";
}
```

### Digital PDF path

- Convert PDF to base64
- Send directly to Claude API as `type: "document"` source
- Claude reads the PDF natively — no OCR needed
- Best quality, lowest cost, fastest

### Scanned PDF path

- Requires Google Document AI (user provides API key in-session)
- Rasterize each PDF page to canvas using PDF.js
- Send each page image to Google Document AI
- Receive structured text + layout back
- Pass that text to Claude for clause extraction
- See: `GOOGLE_DOCUMENT_AI` section below

---

## Google Document AI — Scanned PDF OCR

> ⚠️ **Removed in v0.2.0** — the Google Document AI path was dropped (paid + heavy setup). This section is
> kept for historical reference and no longer reflects the app. See `OCR_RESEARCH.md` and `README.md`.

### Why Google Document AI

- Purpose-built for document understanding
- Best available Thai OCR accuracy among cloud providers
- Preserves table structure, numbered lists, nested clauses
- Returns layout-aware JSON (bounding boxes + text)

### Key management (no backend)

- User pastes their Google Cloud API key into the app UI
- Stored only in React state — never in localStorage, never sent anywhere except Google's API
- App shows a key input field **only when a scanned PDF is detected**
- Key is cleared on page reload

### API call pattern

```js
// Endpoint
POST https://documentai.googleapis.com/v1/projects/{PROJECT_ID}/locations/{LOCATION}/processors/{PROCESSOR_ID}:process
Authorization: Bearer {USER_API_KEY}

// Request body
{
  "rawDocument": {
    "content": "{base64_page_image}",
    "mimeType": "image/png"
  }
}

// Response — extract text from
response.document.text
// or structured from
response.document.pages[].paragraphs[]
```

### Processor to use

`DOCUMENT_OCR` processor type — general-purpose OCR, supports Thai.
User needs to create this processor in their Google Cloud Console once.

### Page-by-page processing

Scanned PDFs are processed one page at a time.
Concatenate all page texts before sending to Claude.

```js
async function ocrAllPages(pdfFile, googleKey, projectId, processorId) {
  const pages = await rasterizePDF(pdfFile); // returns array of base64 PNG strings
  const texts = [];
  for (const pageBase64 of pages) {
    const text = await callDocumentAI(
      pageBase64,
      googleKey,
      projectId,
      processorId,
    );
    texts.push(text);
  }
  return texts.join("\n\n--- PAGE BREAK ---\n\n");
}
```

---

## Claude API — Requirement Extraction

> **Engine selection (current app, v0.2.0):** the top-bar dropdown chooses one of **four** engines —
> ✦ **Typhoon** (default; Thai, free tier, via the `/api/typhoon` proxy), 🆓 Browser OCR (Tesseract, no
> key), ⚡ Claude (via the `/api/claude` proxy), or ✦ Gemini (direct from browser). For a scanned PDF under
> Claude/Gemini a second selector picks the OCR feeder (Typhoon / Google Vision / Tesseract / Claude Vision /
> Gemini Vision). **Google Document AI was removed in v0.2.0.** Proxies run as Cloudflare Pages Functions.
> This section covers the Claude engine's models; see `README.md` for the user-facing overview.

### Model selector (Claude engine)

Two Claude model options in the UI:

| Option              | Model string               | Use when                                       |
| ------------------- | -------------------------- | ---------------------------------------------- |
| Sonnet (Fast)       | `claude-sonnet-4-20250514` | Most TORs, daily use                           |
| Opus (Max accuracy) | `claude-opus-4-5`          | Complex TOR, ambiguous structure, critical bid |

> ⚠️ **Model IDs are stale** — these predate the current model lineup and may be rejected. Refreshing and
> centralizing them is tracked as **A1** in `ROADMAP.md`; verify exact current IDs before changing code.

### Digital PDF input

```js
{
  model: selectedModel,
  max_tokens: 4000,
  system: EXTRACTION_SYSTEM_PROMPT,
  messages: [{
    role: "user",
    content: [
      {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: base64PDF }
      },
      { type: "text", text: "Extract all requirements as JSON array. Return only JSON." }
    ]
  }]
}
```

### Scanned PDF input (post-OCR text)

```js
{
  model: selectedModel,
  max_tokens: 4000,
  system: EXTRACTION_SYSTEM_PROMPT,
  messages: [{
    role: "user",
    content: `The following is OCR-extracted text from a Thai TOR document.\n\n${ocrText}\n\nExtract all requirements as JSON array. Return only JSON.`
  }]
}
```

### EXTRACTION_SYSTEM_PROMPT — critical

```
You are an expert automation engineer reading a Thai Terms of Reference (TOR) document.

CRITICAL RULE: Copy requirement text VERBATIM — character for character, exactly as written
in the source document. Thai text must be copied exactly. Do NOT translate, paraphrase,
summarize, or reword any requirement. The text in the "requirement" field must be a direct
quote from the TOR.

Extract every requirement, specification, clause, and condition.

Return ONLY a JSON array. No markdown. No backticks. No explanation.

Each item:
{
  "ref": "clause number or CL-001 if none",
  "requirement": "VERBATIM text from document — Thai or English exactly as written",
  "category": "one of: General | Mechanical | Electrical | Control/PLC | IIoT/SCADA | BMS | Network | Safety | Documentation | Testing | Other"
}

If translation is requested, add:
  "translation": "English translation of the requirement"
```

### Translation toggle

When user enables translation toggle, append to system prompt:

```
Also provide an English translation of each requirement in the "translation" field.
Keep the "requirement" field verbatim Thai — translation goes only in "translation".
```

### Response parsing

````js
const raw = data.content.find((b) => b.type === "text")?.text || "[]";
const clean = raw.replace(/```json|```/g, "").trim();
const parsed = JSON.parse(clean);
````

---

## Compliance Matrix Table

### Columns

| Column      | Editable       | Source            | Notes                                 |
| ----------- | -------------- | ----------------- | ------------------------------------- |
| #           | No             | Auto              | Row number                            |
| Ref.        | Yes            | Claude / user     | Clause number from TOR                |
| Requirement | Yes            | Claude (verbatim) | Thai text — must not be changed by AI |
| Translation | Yes (optional) | Claude            | Hidden unless toggle enabled          |
| Category    | Yes            | Claude            | Discipline tag                        |
| Status      | Yes            | User              | Comply / Partial / Not Comply / N/A   |
| Remarks     | Yes            | User / Library    | Standard response or custom note      |

### Status values

```
comply     → green  → "Comply"
partial    → amber  → "Partially Comply"
notcomply  → red    → "Not Comply"
na         → gray   → "N/A"
```

### Thai font requirement

Load `Sarabun` from Google Fonts — supports full Thai Unicode range.
Apply to the Requirement column and Translation column specifically.

```css
@import url("https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500&display=swap");
.thai-text {
  font-family: "Sarabun", sans-serif;
  line-height: 1.8;
}
```

---

## Comply Library

Pre-loaded standard responses for common automation/BMS/IIoT compliance statements.
User can add custom entries and remove defaults.

### Data structure

```js
{
  id: string,         // uuid
  label: string,      // short name shown in sidebar
  text: string,       // the response text (Thai or English)
  status: string,     // which status it targets: comply | partial | notcomply | na
}
```

### Apply behavior

- No row selected → apply to all rows matching the library item's `status`
- Row selected (highlighted) → apply only to that row's remarks field

---

## Excel Export (.xlsx)

Uses SheetJS (`xlsx` package, CDN from jsdelivr).

### Column map

```
A  → Item No.
B  → Reference (Ref.)
C  → Requirement / Specification  [Thai verbatim]
D  → Translation                  [optional, only if toggle on]
E  → Category
F  → Compliance Status
G  → Remarks
H  → Verified By
I  → Date
```

### Thai font in Excel

SheetJS doesn't set fonts natively in the free version.
Add a note in the export or in onboarding: "After opening, select column C and set font to TH Sarabun New or Cordia New for correct Thai rendering."

### Filename convention

```
{ProjectName}_Compliance_Matrix_{YYYY-MM-DD}.xlsx
```

---

## UI Layout

```
┌─────────────────────────────────────────────────────┐
│ TOPBAR: Brand | Project Name | Model Select | Export │
├──────────────┬──────────────────────────────────────┤
│              │ TOOLBAR: Stats | Filters | Toggles    │
│   SIDEBAR    ├──────────────────────────────────────┤
│              │                                       │
│  PDF Upload  │         COMPLIANCE TABLE              │
│  OCR Key     │         (scrollable)                  │
│  (if scan)   │                                       │
│  ─────────   │                                       │
│  Comply      │                                       │
│  Library     │                                       │
│              │                                       │
│              ├──────────────────────────────────────┤
│              │ ADD ROW BAR                           │
└──────────────┴──────────────────────────────────────┘
```

### Sidebar sections

1. **TOR Document** — upload zone, file badge, extract button
2. **Google Key** — appears only when scanned PDF detected (collapsed otherwise)
3. **Comply Library** — scrollable list of standard responses

### Toolbar toggles

- Translation column on/off (checkbox)
- Category column on/off (checkbox)
- Filter by status (All / Comply / Partial / Not Comply / N/A)

---

## Error Handling

| Error                           | User-facing message                                                           |
| ------------------------------- | ----------------------------------------------------------------------------- |
| PDF not readable                | "Could not read PDF. Try re-saving as PDF/A or printing to PDF."              |
| Scanned detected, no Google key | "This PDF appears to be scanned. Add your Google Document AI key to proceed." |
| Google OCR fails                | "OCR failed: {error}. Check your key, project ID, and processor ID."          |
| Claude returns no JSON          | "Extraction returned no requirements. Try Opus model or check the PDF."       |
| Claude API error                | "Claude API error {status}: {message}"                                        |
| Empty requirements              | "No requirements found. PDF may be image-only with no text layer."            |

---

## CDN Dependencies (all from allowed origins)

> Gemini and Google Document AI are called directly with `fetch` (no SDK). Claude goes through the
> `/api/claude` proxy. The scripts below are what the HTML `<head>` actually loads.

```html
<!-- PDF.js — PDF reading and rasterization -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>

<!-- SheetJS — Excel export -->
<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>

<!-- Tesseract.js — client-side OCR (Browser OCR engine, Thai+English) -->
<script src="https://cdn.jsdelivr.net/npm/tesseract.js@6/dist/tesseract.min.js"></script>

<!-- React -->
<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>

<!-- Babel (for JSX) -->
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>

<!-- Google Fonts — Thai support -->
<link
  href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500&display=swap"
  rel="stylesheet"
/>
```

---

## Known Limitations

1. **Tesseract.js is now the free fallback** — runs fully client-side (Thai+English), no API key, no billing. Lower accuracy than AI/cloud OCR and produces heuristically-split rows, so it's the "just works offline" option. AI engines (Claude/Gemini) or Google Doc AI remain the high-accuracy paths.
2. **No persistent storage** — all data lives in React state. Refreshing the page clears the matrix. Future: add localStorage auto-save or Google Drive export.
3. **Large PDFs** — Claude has a document size limit. TORs over ~100 pages may need to be split. Future: add page range selector.
4. **Scanned PDF OCR** — Google Document AI requires the user to have a Google Cloud project with Document AI API enabled and a processor created. This is a one-time setup.
5. **SheetJS Thai font** — Excel column C needs manual font change to TH Sarabun New after export for correct Thai rendering in older Excel versions.
