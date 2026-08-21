# PROMPTS.md — prompt design for Nyarlathotep

> Why the prompts are shaped the way they are, and what has been tried.
>
> **The prompt text itself is not reproduced here.** It lives in the code — a second copy
> is what let this document drift for three weeks into naming a removed engine and two
> superseded models. Read the source instead:
>
> | Prompt | Source |
> | --- | --- |
> | Claude extraction system prompt | [`src/lib/extract.ts`](src/lib/extract.ts) → `buildSystemPrompt()` |
> | Gemini extraction prompt | [`src/lib/extract.ts`](src/lib/extract.ts) → `buildGeminiPrompt()` |
> | Typhoon OCR prompt | [`src/lib/ocr.ts`](src/lib/ocr.ts) → `TYPHOON_OCR_PROMPT` |
> | Model registry | [`src/lib/models.ts`](src/lib/models.ts) |
>
> Working context: [`CLAUDE.md`](CLAUDE.md). Engine evidence: [`TESTING.md`](TESTING.md) §3d.

---

## 1. The core constraint — verbatim Thai text

This is the single most important rule in the tool.

> **The `requirement` field must be copied character-for-character from the source TOR.**
> Never paraphrase, translate, summarise, or reword. Thai characters exactly as they appear.

The compliance matrix is a legal/contractual document. If a requirement is reworded, the
client can dispute the compliance claim.

**Enforced in three layers**, because one is not enough — the model will quietly "improve"
Thai text given any latitude:

1. An explicit instruction to copy verbatim.
2. An explicit prohibition — do not translate, paraphrase, summarise, or reword.
3. A worked example in the prompt showing correct versus incorrect output.

Layer 3 was added after layers 1–2 alone still produced paraphrasing on Thai (2026-05-29).

### It is not only a prompt rule

The same constraint shapes code that has nothing to do with AI:

- Extraction correctness is checked by comparing **character multisets** against everything
  pdf.js reports — not string equality, because the extractor deliberately reorders cells
  into visual reading order ([`TESTING.md`](TESTING.md) §3b).
- An uncertain value is **flagged**, never silently filled — [`src/lib/ocrtrust.ts`](src/lib/ocrtrust.ts).
- Merging two requirements into one row is treated as worse than leaving one split, so
  rejoining logic carries guards for clause refs, bullets and indentation.

---

## 2. OCR-aware prefixing

When the input is OCR text rather than a native PDF text layer, the prompt says so.

**Why:** without it, Claude "corrected" what it read as OCR artifacts — which is exactly the
paraphrasing the verbatim rule forbids, arriving through a side door. Telling the model the
text is OCR output and must still be copied as-is stops the over-correction.

**This does not fix bad OCR.** It stops the model *inventing* fixes. If the OCR itself
misread `IP ๖๘` as `IP ๒๕`, no prompt recovers it — that is an engine choice, not a prompt
problem, and it is why Typhoon is preferred for scanned Thai (§4).

---

## 3. Structuring without AI

The default path uses **no model at all**: `structureWithoutAI()` in
[`src/lib/extract.ts`](src/lib/extract.ts) splits text into rows and detects clause
references deterministically.

Worth stating because it is easy to forget: **most extraction here is not a prompting
problem.** The three real bugs found on real documents in 2026-08 — spaced clause numbers
(`๓ . ๑`), token splitting corrupting a budget figure, and over-split wrapped lines — were
all fixed in deterministic code, not in a prompt. AI is for *structuring fuzzy input*, never
for asserting a value.

---

## 4. Engine notes that affect prompting

Full measurements in [`TESTING.md`](TESTING.md) §3c–§3d.

- **Typhoon** returns `{"natural_text": "..."}` with escaped newlines, unwrapped by
  `extractTyphoonText()`. Left wrapped, the whole page becomes one row of literal `\n`.
- **Typhoon is layout-sensitive** — it needs whole pages. A four-line crop returned only the
  first line; the same crop padded onto a page-shaped canvas returned just `- 1 -`.
- **Browser OCR (Tesseract) misreads Thai numerals** and reports 92–99 % confidence doing it.
  No prompt is involved — it is not a model. Its output should be treated as
  review-grade prose with unreliable numbers.
- **Thai digital PDFs often have broken font/ToUnicode maps**, so the extracted text layer can
  be garbage where OCR would be better. `assessTextQuality()` catches gross failure only, and
  the UI always offers a one-click re-run with OCR.

---

## 5. Iteration log

| Date | Change | Reason |
| --- | --- | --- |
| 2026-05-29 | Initial prompt — verbatim rule | Core requirement from the engineer |
| 2026-05-29 | Added correct/incorrect example | Layers 1–2 alone still paraphrased Thai |
| 2026-05-29 | OCR-aware prefix for the scanned path | Claude was over-correcting OCR artifacts |
| 2026-08-21 | *(no prompt change)* — engine guidance rewritten | Real-document evidence made the engine choice, not the prompt, the deciding factor for scanned Thai |

---

## 6. Ideas not built

- **Requirement type tagging** — `mandatory | preferred | informational`.
- **Cross-reference detection** — flag requirements that point at other clauses.
- **Ambiguity flag** — mark requirements open to interpretation.
- **BOQ linkage** — match requirements to BOQ line items.
- **Table-aware prompt** — better handling of multi-column equipment tables. Gated on
  real-document evidence; see [`ROADMAP.md`](ROADMAP.md).

Each of these has the model *adding* something rather than copying. Weigh every one against
§1 before building it: a tag is an opinion, and an opinion attached to a contractual
requirement needs to be visibly a suggestion, confirmable by a human.

---

## 7. Removed

- **Google Document AI** — an OCR engine removed in **v0.2.0**. Earlier versions of this
  document costed it at ~$0.065/page and described its selection UI; none of that applies.
  Replaced by Typhoon, Google Vision and browser Tesseract.
- **Per-model token cost tables** — they named `claude-sonnet-4-20250514` and
  `claude-opus-4-5`, neither of which the app has offered since. Current models are in
  [`src/lib/models.ts`](src/lib/models.ts); for pricing, read Anthropic's page rather than a
  copy that goes stale here.
