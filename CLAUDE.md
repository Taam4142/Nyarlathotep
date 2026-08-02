# CLAUDE.md — Prompt Engineering Reference

> Prompt designs, system prompts, and AI behavior rules for Nyarlathotep (the TOR Compliance Matrix tool).
> Last updated: 2026-07-27

---

## Core Constraint — Verbatim Thai Text

This is the single most important rule in the entire tool.

> **The "requirement" field must be copied character-for-character from the source TOR.**
> Claude must never paraphrase, translate, summarize, or reword.
> Thai characters must be reproduced exactly.

This constraint exists because the compliance matrix is a legal/contractual document.
If a requirement is reworded, the client can dispute the compliance claim.

**Enforce this with three layers:**

1. Explicit instruction in system prompt ("Copy VERBATIM")
2. Explicit prohibition ("Do NOT translate, paraphrase, summarize, or reword")
3. Example in prompt showing correct vs incorrect output

---

## System Prompt — Full Extraction

### Base (no translation)

```
You are an expert automation engineer reading a Thai Terms of Reference (TOR) document.
Your job is to extract every requirement, specification, clause, and condition.

CRITICAL RULE — VERBATIM COPY:
The "requirement" field must be copied CHARACTER FOR CHARACTER exactly as it appears
in the source document.
- Thai text → copy exactly in Thai
- English text → copy exactly in English
- Mixed Thai/English → copy exactly as mixed
- Do NOT translate Thai to English
- Do NOT paraphrase, summarize, or reword
- Do NOT clean up grammar or formatting
- Copy every word, number, and unit exactly

Return ONLY a valid JSON array. No markdown fences. No backticks. No explanation text.
If you add any text outside the JSON array, the parser will fail.

Each object in the array must have exactly these keys:
{
  "ref": "Clause number from the document, e.g. '2.1', '3.4.2', 'ข้อ 5'. If no number, use 'CL-001', 'CL-002', etc.",
  "requirement": "VERBATIM text copied exactly from the TOR document",
  "category": "Exactly one of: General | Mechanical | Electrical | Control/PLC | IIoT/SCADA | BMS | Network | Safety | Documentation | Testing | Other"
}

Correct example:
{"ref":"3.2","requirement":"ระบบควบคุมจะต้องใช้ PLC ยี่ห้อ Siemens รุ่น S7-1500 เท่านั้น","category":"Control/PLC"}

Incorrect example (do NOT do this):
{"ref":"3.2","requirement":"The control system must use Siemens S7-1500 PLC only","category":"Control/PLC"}
(Wrong — translated Thai to English instead of copying verbatim)

Extract every identifiable requirement. Include ALL of:
- Technical specifications
- Performance requirements
- Brand/model requirements
- Material or standard requirements
- Testing and commissioning requirements
- Documentation requirements
- Warranty and maintenance requirements
- Safety requirements
```

### With translation enabled (append to base)

```
Additionally, for each requirement, provide an English translation in the "translation" field.

IMPORTANT: The "requirement" field stays VERBATIM Thai/original language.
The "translation" field contains your English translation.
Both fields are required when translation mode is active.

Extended object format:
{
  "ref": "...",
  "requirement": "VERBATIM original text",
  "translation": "English translation of the requirement",
  "category": "..."
}
```

---

## Engine Options Overview

Since v0.2.0 the tool has these ways to turn a PDF into structured requirements:

| AI Engine   | Needs key?          | How it works                                                 | Best for                        |
| ----------- | ------------------- | ------------------------------------------------------------ | ------------------------------- |
| **Typhoon** *(default)* | Yes (free tier, via proxy) | Thai-specialized OCR via `/api/typhoon`; heuristic rows, or structured by Claude/Gemini as a feeder | **Best free Thai OCR** |
| Browser OCR | No                  | Tesseract.js OCR + heuristic row-splitting, 100% client-side | Zero-setup, offline, no billing |
| Claude      | Yes (via proxy)     | Claude reads PDF/images, structures to JSON                  | Highest verbatim fidelity       |
| Gemini      | Yes (direct)        | Gemini reads PDF/images, structures to JSON                  | Free-ish, no proxy needed       |

For scanned PDFs under Claude/Gemini, the OCR feeder has these choices: **Typhoon** (Thai), **Google Vision**
(free tier 1,000 pg/mo, good Thai), Browser Free (Tesseract), Claude Vision, Gemini Vision. **Google Doc AI
was removed in v0.2.0** (OCR.space was evaluated but dropped — weak Thai). Proxies run as Cloudflare Pages
Functions (`functions/api/*`).

### Browser OCR mode (aiEngine='browser') — no API at all

- `ocrPDFTesseract()` rasterizes every page (scale 3 for Thai accuracy) and runs `Tesseract.createWorker(['tha','eng'])`
- Worker is cached in module scope (`_tessWorker`) so the language pack downloads once
- `structureWithoutAI()` splits the raw text into rows using clause-number / bullet regex: `/^(\d+[\.\)]|\d+\.\d+|ข้อ\s*\d+|\(\d+\)|[-•·●])/`
- No verbatim-vs-translated warning (text is raw OCR, always "verbatim" by nature)
- Always emits a review warning because row boundaries are heuristic
- First load pulls ~15MB Thai traineddata from jsDelivr, cached in IndexedDB thereafter

### Tesseract as OCR-only feeder (ocrEngine='tesseract')

- When an AI engine is selected but the PDF is scanned, user can pick Tesseract for the OCR step
- Tesseract produces the text → AI engine structures it → clean rows without OCR cost

## Scanned PDF — Two OCR Engine Options

### Engine A: Claude Vision (default, recommended)

- No extra credentials — uses the same Claude API already in use
- Rasterizes each PDF page to PNG via PDF.js (scale=2 for quality)
- Sends each page image to Claude as `type: "image"` with a verbatim-extraction prompt
- Thai text read directly from the image — no intermediate OCR step
- Billed as normal Claude API tokens (image tokens)
- Best for: most TORs, quick setup, single API billing

```js
// Per-page prompt sent with each image
`This is page ${p} of a scanned Thai TOR document.
Extract ALL text from this page exactly as written — verbatim, including Thai text.
Preserve paragraph structure, numbering, and formatting.
Return only the extracted text, no commentary.`;
```

### Engine B: Google Document AI  _(removed in v0.2.0 — historical reference only)_

- Requires Google Cloud billing + DOCUMENT_OCR processor
- User pastes Bearer Token (from `gcloud auth print-access-token`), Project ID, Location, Processor ID
- Token expires ~1 hour — user must refresh manually
- Best for: heavily degraded scans, very low DPI, or crumpled/skewed pages
- Superior OCR accuracy on worst-case physical documents

### How engine selection works in UI

- Tab toggle appears only when scanned PDF is detected
- Claude Vision tab: shows green "no credentials needed" panel
- Google Doc AI tab: shows 4-field credential form
- Default: Claude Vision

When the input is OCR text (from Google Document AI) rather than a native PDF,
prefix the user message with context so Claude understands the source:

```
User message prefix:
---
The following text was extracted via OCR from a scanned Thai TOR document.
There may be minor OCR errors in the text (e.g. incorrect characters, broken words).
Use your understanding of Thai language and engineering context to identify
the intended meaning, but STILL copy the text verbatim as it appears —
including any apparent OCR artifacts. Do not silently correct OCR errors.
If a word looks like an OCR error, copy it as-is and the engineer will review it.
---

[OCR TEXT FOLLOWS]
{ocrText}
```

**Rationale:** Claude should not silently fix OCR errors because:

1. The engineer needs to see what was actually in the document
2. Silent "corrections" could introduce wrong requirements
3. Obvious OCR errors are easier to spot and fix in the editable table

---

## Model Selection Guide

> ⚠️ The Claude model IDs below (and the Gemini IDs used in code) predate the current model lineup and may
> be rejected by the APIs. Refreshing and centralizing them is tracked as **A1** in `ROADMAP.md` — verify
> exact current IDs before changing code.

### claude-sonnet-4-20250514 (default)

- Use for: Most TORs, daily workflow, time-sensitive bids
- Speed: Fast (~10–20 seconds for a 30-page TOR)
- Cost: Lower
- Thai accuracy: Excellent
- Verbatim fidelity: Very high

### claude-opus-4-5

- Use for: Complex TORs with ambiguous structure, critical bids, large documents
- Speed: Slower (~30–60 seconds)
- Cost: Higher
- Thai accuracy: Maximum
- Verbatim fidelity: Highest — better at resisting urge to paraphrase

**Recommendation:** Default to Sonnet. Switch to Opus only when:

- TOR has deeply nested clause numbering
- Mixed Thai/English/Japanese or Thai/English/metric specs
- Previous Sonnet extraction had paraphrasing issues
- Document is over 50 pages

---

## JSON Output — Validation Rules

After parsing Claude's response, validate each row:

```js
function validateRow(item) {
  const errors = [];

  if (!item.ref || typeof item.ref !== "string") {
    errors.push("Missing ref");
  }

  if (!item.requirement || item.requirement.trim().length === 0) {
    errors.push("Empty requirement");
  }

  // Detect potential paraphrasing (English in a Thai doc)
  // Flag for user review — don't auto-reject
  if (isLikelyThai(sourceDoc) && isAllEnglish(item.requirement)) {
    item._warning =
      "Requirement appears to be translated rather than verbatim Thai — please verify";
  }

  const validCategories = [
    "General",
    "Mechanical",
    "Electrical",
    "Control/PLC",
    "IIoT/SCADA",
    "BMS",
    "Network",
    "Safety",
    "Documentation",
    "Testing",
    "Other",
  ];
  if (!validCategories.includes(item.category)) {
    item.category = "Other"; // safe fallback
  }

  return { valid: errors.length === 0, errors };
}

function isAllEnglish(text) {
  // Thai Unicode range: \u0E00-\u0E7F
  return !/[\u0E00-\u0E7F]/.test(text);
}
```

---

## Comply Library — Pre-loaded Entries

Standard responses pre-loaded in the sidebar. Mix of Thai and English
since Thai TORs sometimes require Thai remarks too.

```js
const DEFAULT_LIBRARY = [
  // --- COMPLY ---
  {
    id: "lib-001",
    label: "Comply — Standard",
    status: "comply",
    text: "Comply. Refer to system design documentation and technical proposal.",
  },
  {
    id: "lib-002",
    label: "Comply — PLC/TIA Portal",
    status: "comply",
    text: "Comply. Implemented via Siemens TIA Portal programming. Refer to PLC logic documentation.",
  },
  {
    id: "lib-003",
    label: "Comply — GX Works2",
    status: "comply",
    text: "Comply. Implemented via Mitsubishi GX Works2. Refer to ladder diagram documentation.",
  },
  {
    id: "lib-004",
    label: "Comply — MQTT",
    status: "comply",
    text: "Comply. Real-time data pipeline configured via MQTT protocol to central SCADA/cloud server.",
  },
  {
    id: "lib-005",
    label: "Comply — Modbus",
    status: "comply",
    text: "Comply. Hardware communication implemented via Modbus RTU/TCP protocol.",
  },
  {
    id: "lib-006",
    label: "Comply — BMS",
    status: "comply",
    text: "Comply. Integrated into Building Management System architecture per client specification.",
  },
  {
    id: "lib-007",
    label: "Comply — SCADA",
    status: "comply",
    text: "Comply. Data acquisition and monitoring interface configured in SCADA system.",
  },
  {
    id: "lib-008",
    label: "Comply — Thai (มาตรฐาน)",
    status: "comply",
    text: "ปฏิบัติตามข้อกำหนด ดูรายละเอียดในเอกสารการออกแบบระบบและข้อเสนอทางเทคนิค",
  },
  // --- PARTIAL ---
  {
    id: "lib-009",
    label: "Partial — Pending Detail",
    status: "partial",
    text: "Partially comply. Final implementation subject to detailed engineering review and client confirmation.",
  },
  {
    id: "lib-010",
    label: "Partial — Alternative Proposed",
    status: "partial",
    text: "Partially comply. Alternative solution proposed — equivalent performance, different make/model. Pending client approval.",
  },
  // --- NOT COMPLY ---
  {
    id: "lib-011",
    label: "Not Comply — Out of Scope",
    status: "notcomply",
    text: "Not in scope of this contract. To be confirmed with client during detailed design phase.",
  },
  // --- N/A ---
  {
    id: "lib-012",
    label: "N/A — Not Applicable",
    status: "na",
    text: "Not applicable to this project scope.",
  },
];
```

---

## Token Cost Estimates

For budget awareness when using Opus on large TORs:

| Document   | Pages | Approx tokens in | Approx tokens out | Sonnet cost | Opus cost |
| ---------- | ----- | ---------------- | ----------------- | ----------- | --------- |
| Small TOR  | 10    | ~8,000           | ~2,000            | ~$0.03      | ~$0.18    |
| Medium TOR | 30    | ~24,000          | ~5,000            | ~$0.08      | ~$0.54    |
| Large TOR  | 80    | ~64,000          | ~12,000           | ~$0.22      | ~$1.44    |

Prices approximate based on Claude API pricing as of May 2026.
Scanned PDFs add Google Document AI cost: ~$0.065/page.

---

## Prompt Iteration Log

Use this section to track prompt changes and why they were made.

| Date       | Change                                           | Reason                                   |
| ---------- | ------------------------------------------------ | ---------------------------------------- |
| 2026-05-29 | Initial prompt — verbatim rule added             | Core requirement from engineer           |
| 2026-05-29 | Added correct/incorrect example to system prompt | Reduce paraphrasing on Thai text         |
| 2026-05-29 | Added OCR-aware prefix for scanned path          | Claude was over-correcting OCR artifacts |

---

## Future Prompt Ideas

- **Requirement type tagging** — add "type" field: `mandatory | preferred | informational`
- **Cross-reference detection** — Claude flags requirements that reference other clauses
- **Ambiguity flag** — Claude marks requirements that are vague or open to interpretation
- **BOQ linkage** — match extracted requirements to BOQ line items automatically
