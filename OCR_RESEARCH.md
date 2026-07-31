# OCR_RESEARCH.md — OCR options survey (for Yog-Sothoth)

> Reference survey of OCR tools for turning Thai/English TOR PDFs into text, kept for later research.
> **Compiled 2026-07-28.** All figures (models, prices, benchmarks, free-tier limits) are **point-in-time**
> — this space moves fast; re-verify before relying on any number.

## Why this doc / our constraints

Yog-Sothoth must stay **free** and read **Thai** well, and it deploys as a **static site + a tiny proxy
function** (no GPU, no always-on server). So an OCR option only *fits us* if it is:

1. **Free** (or has a usable free tier), 2. **Good at Thai**, 3. **No self-hosted GPU/backend required**.

Tools that need a GPU server can still be excellent — they just don't fit our free/no-backend model unless
we later decide to run a backend. They're catalogued below for that future.

## Decision (2026-07-28)

**Curated free-first lineup:** **Typhoon OCR** (default, best free Thai) · **Tesseract** (offline, no key),
while **keeping Claude & Gemini** (optional high-accuracy; they also do the text→JSON structuring step).
The **secondary free fallback is Google Cloud Vision** (1,000 pg/mo free, good Thai, via a Pages Function
proxy) — chosen over OCR.space, which external research rated weak on Thai.
**Google Document AI is dropped** (paid + heavy setup). Rationale at the bottom.

> Incorporates external Thai-RAG / OCR research provided by the engineer (dated 27 Jul 2026).

---

## 1. Free API, no backend  ✅ (fits us)

| Tool | Thai | Cost / free tier | License | Infra | Fit |
| ---- | ---- | ---------------- | ------- | ----- | --- |
| **Typhoon OCR** (SCB 10X) | **Best — Thai-tuned** | Free API tier (model page says **20 req/min**); exact credit/daily caps unclear — **verify on opentyphoon.ai** | Apache-2.0 (weights) | None (API) or self-host (Ollama/vLLM, GPU) | ★★★ **default** |
| **OCR.space** (a9t9) | ⚠️ **Weak** — Engine 2 does Thai, but external research rates it poor for serious Thai | Free API, **~25k req/mo**, no registration (demo key `helloworld`) | Proprietary SaaS | None | ★ rough fallback |
| **Google Cloud Vision** | **Very good** | **1,000 pages/mo free** (card required), then ~$1.50/1k | Proprietary API | Key + likely a proxy | ★★ strong free-tier |
| **Azure Document Intelligence** | Good (printed) | **500 pages/mo free** (F0 tier), then ~$1–1.5/1k | Proprietary API | Key + likely a proxy | ★ alt free-tier |
| **Gemini** (Google) | Good | Free tier (~1,500 req/day on Flash) | Proprietary API | None (direct browser) | ★★ keep |
| Mistral OCR | General (not Thai-tuned) | ~$1/1k; free only to *test* on Le Chat | Proprietary API | None | ✗ not a free API |

**Typhoon OCR details** — OpenAI-compatible. Base URL `https://api.opentyphoon.ai/v1`, endpoint
`/chat/completions`, model id **`typhoon-ocr-preview`**, `Authorization: Bearer <KEY>`. Image/PDF in,
**markdown** out, 128k context, weights in 2B/3B (and older 7B). **Typhoon OCR v1.5 (2B)** reportedly beats
**Gemini 2.5 Pro** and **GPT-5** on Thai (BLEU 0.644 · ROUGE-L 0.774 · Levenshtein 0.251). Free key from
opentyphoon.ai. Its model page advertises a free tier (20 req/min), but other sources describe it as
"initial free credit → pay-as-you-go" — **confirm the current free-tier limits before relying on it for
volume, and keep a fallback.** → Still our default (best Thai by a clear margin).

**OCR.space caveat** — Thai only on **Engine 2** (`OCREngine=2`). It's the one truly zero-setup free API
(~25k req/mo, public demo key), *but* external Thai-OCR research (27 Jul 2026) rates it **weak for Thai /
not recommended for serious Thai work**. Keep it only as a rough/last-resort path, not a primary Thai reader.

**Google Cloud Vision ≠ Google Document AI** — different products. We removed **Document AI** (needs a GCP
project + DOCUMENT_OCR processor + ~1h bearer token). **Cloud Vision** is lighter (just an API key), has a
**1,000-pages/month free tier** and good Thai — a viable free option, though a card is required and browser
CORS usually means routing it through a proxy (a Pages Function).

---

## 2. Open-weights document VLMs — free software, **need a GPU/backend** ⚙️ (don't fit us now)

Excellent models, all open weights, but each needs a GPU to run at usable speed → a paid server for us.

| Model | Thai | License | Notes |
| ----- | ---- | ------- | ----- |
| **Baidu Unlimited-OCR** (3.3B) | Unproven (40+ langs; benchmarks CN/EN) | MIT | Released 2026-06-22. **One-pass long-document** parsing (flat KV cache); SOTA on OmniDocBench (~93% v1.5). Great for long EN/CN docs; Thai not demonstrated. |
| **PaddleOCR-VL** (~0.9–1.6B) | Yes (100+ langs) | Apache-2.0 | Compact multilingual doc parser; strong mixed-layout. Best *self-host* pick if we add a backend. |
| **DeepSeek-OCR** | General | Open | MoE; "optical context compression"; aimed at high-volume batch. |
| **dots.ocr** (1.7B) | Multilingual | MIT | Compact; structured docs/forms. |
| **GOT-OCR 2.0** | General | Open | Lightweight, low-VRAM deployments. |
| **olmOCR / RolmOCR** (Qwen2.5-VL-7B ft) | General | Open (AllenAI) | Faster/lighter drop-in; VLM-level recognition without 30B+ cost. |
| **Granite-Docling** (IBM) | General | Apache-2.0 | Tight with IBM Docling; structured JSON output. |
| **Qwen3-VL** (Alibaba) | Yes (32 langs incl. Thai) | Open | General VLM with strong OCR. |

---

## 3. Self-host traditional engines — free, CPU-capable, **need a backend/library** ⚙️

| Engine | Thai | License | Notes |
| ------ | ---- | ------- | ----- |
| **Tesseract** | Yes (weak) | Apache-2.0 | Runs in-browser via `tesseract.js` (what we use as the offline no-key path) or on CPU. 100+ langs. |
| **PaddleOCR** (PP-OCRv5 / v6) | v5 explicit Thai (~82.7%); v6 unified 50 langs | Apache-2.0 | Best classic self-host engine; CPU-capable. Needs a Python service. |
| **TurboOCR** (aiptimizer) | Via PaddleOCR PP-OCRv5 (~83%) | MIT | **GPU-only** (Linux + NVIDIA Turing+, CUDA/TensorRT). A C++/TensorRT *serving layer* over PaddleOCR (PP-OCRv6 + retained PP-OCRv5 recognizers) — OCR + layout + tables→HTML + formulas→LaTeX → Markdown, via HTTP/gRPC. Headline is **throughput** (200–559 img/s, ~20 pg/s). Not a new model: Thai = PaddleOCR (below Typhoon). **Batch/high-volume only** — no fit for our interactive, no-backend flow. |
| **Surya** | Yes (widest script coverage) | GPL / commercial | Strong multilingual; GPU-leaning. |
| **EasyOCR** | Yes (moderate) | Apache-2.0 | Simple Python API; CPU/GPU. |
| **docTR** | Limited (Latin-focused) | Apache-2.0 | Clean digital docs; weak on Thai. |

---

## 4. Paid / managed 💰 (don't fit "free")

| Service | Thai | Cost | Notes |
| ------- | ---- | ---- | ----- |
| **Google Document AI** | Strong on degraded scans | ~$0.065/page + GCP setup | **Currently in the app → being removed.** Needs a GCP project, DOCUMENT_OCR processor, bearer token that expires ~1h. |
| **Nanonets** | Custom-trainable | From ~$499/mo (free 500 pages w/ card) | Field-extraction platform; overkill + costly. |
| **Azure AI Vision / AWS Textract** | Varies (Textract Thai limited) | Paid per page | Cloud-managed; not free-aligned. |

---

## Decision rationale

- **Free + Thai-capable options that fit** (no self-hosted GPU): **Typhoon** (best), **Google Cloud Vision**
  (free tier, good Thai), **Gemini**, **Tesseract**, and OCR.space (weak Thai). Everything more powerful
  (Unlimited-OCR, PaddleOCR-VL, Surya, DeepSeek-OCR…) needs a paid GPU server, breaking "everything free".
- **Typhoon = default** — purpose-built for Thai and beats the frontier proprietary models on Thai docs,
  with a free API tier and no infra.
- **Google Cloud Vision = free-tier fallback (chosen)** — 1,000 pages/month free with genuinely good Thai,
  via a Pages Function proxy. Preferred over **OCR.space**, which external research rated weak for Thai.
- **Tesseract = offline fallback** — the only truly-in-browser option; kept for no-key/offline use.
- **Claude + Gemini kept** — they also perform the text→JSON structuring, and Gemini's free tier is handy.
- **Dropped:** **Google Document AI** (paid + heaviest setup) and **OCR.space** (weak Thai).

### Revisit triggers
- **If we ever add a GPU backend:** evaluate **PaddleOCR-VL** and **self-hosted Typhoon** first.
- **Watch Baidu Unlimited-OCR** — if credible Thai benchmarks appear, reconsider for long-document TORs.
- **Re-check Typhoon Pro pricing** when it launches (free tier may change).
- **Batch/bulk OCR:** for a large one-off pile of scans, run local Typhoon OCR (or PaddleOCR) on a free GPU
  notebook (Kaggle ~30 h/week, Colab T4) and import the Markdown — free, and avoids API rate limits. If
  raw **throughput** ever matters at scale, **TurboOCR** (MIT; GPU-only PaddleOCR-on-TensorRT; 200–559
  img/s; layout + tables→HTML + formulas→LaTeX) is the fast-serving option — evaluated 2026-08-01, but its
  Thai is still just PaddleOCR (below Typhoon), so it's speed-only, not an accuracy upgrade.
- **OCR.space** remains a documented zero-setup, no-card option (weak Thai) if a keyless fallback is ever
  wanted again — but **Google Cloud Vision is the wired fallback** as of v0.2.0.

## Sources
- Typhoon OCR: [GitHub](https://github.com/scb-10x/typhoon-ocr) · [HF](https://huggingface.co/scb10x/typhoon-ocr-7b) · [v1.5 release](https://opentyphoon.ai/blog/en/typhoon-ocr-release) · [arXiv 2601.14722](https://arxiv.org/abs/2601.14722) · [docs](https://docs.opentyphoon.ai/)
- OCR.space: [Thai OCR](https://ocr.space/thai) · [Free OCR API](https://ocr.space/ocrapi)
- Baidu Unlimited-OCR: [GitHub](https://github.com/baidu/Unlimited-OCR) · [MarkTechPost](https://www.marktechpost.com/2026/06/24/baidu-releases-unlimited-ocr-a-3b-model-that-keeps-the-kv-cache-flat-for-long-document-parsing/)
- PaddleOCR: [GitHub](https://github.com/PaddlePaddle/PaddleOCR) · [PaddleOCR-VL](https://paddleocrvl.online/)
- TurboOCR: [GitHub](https://github.com/aiptimizer/TurboOCR) · [docs](https://turboocr.com/docs/)
- Landscape: [Open-source OCR VLMs to self-host (Spheron)](https://www.spheron.network/blog/best-open-source-ocr-vlm-self-host-gpu-cloud-2026/) · [Best open-source OCR (Unstract)](https://unstract.com/blog/best-opensource-ocr-tools/) · [Free OCR tools/APIs (Eden AI)](https://www.edenai.co/post/top-free-ocr-tools-apis-and-open-source-models)
