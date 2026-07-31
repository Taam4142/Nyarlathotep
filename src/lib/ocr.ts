import { createWorker } from "tesseract.js";
import { pdfjsLib, rasterizePage } from "./pdf";
import type { OcrProgress } from "./types";

export const TYPHOON_MODEL = "typhoon-ocr-preview";
// Verbatim OCR prompt. Can be swapped for the typhoon-ocr package's exact prompt.
export const TYPHOON_OCR_PROMPT =
  "Below is an image of one page from a Thai/English document (a Terms of Reference). Read it and return the text exactly as it appears — verbatim, preserving Thai text, numbers, units, and the clause numbering/structure. Return clean Markdown. Do NOT translate, summarize, or add commentary.";

const PAGE_BREAK = "\n\n--- PAGE BREAK ---\n\n";

// Tesseract.js — fully client-side OCR, no API key, Thai+English.
let _tessWorker: Awaited<ReturnType<typeof createWorker>> | null = null;
async function getTessWorker(onLog?: (m: any) => void) {
  if (_tessWorker) return _tessWorker;
  _tessWorker = await createWorker(["tha", "eng"], 1, {
    logger: (m: any) => {
      onLog && onLog(m);
    },
  });
  return _tessWorker;
}

export async function ocrPDFTesseract(
  file: File,
  onProgress?: OcrProgress,
): Promise<string> {
  const ab = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
  const total = pdf.numPages;
  const worker = await getTessWorker((m) => {
    if (m.status === "recognizing text" && onProgress)
      onProgress(null, null, Math.round(m.progress * 100));
  });
  const texts: string[] = [];
  for (let p = 1; p <= total; p++) {
    onProgress && onProgress(p, total, 0);
    const b64 = await rasterizePage(pdf, p, 3); // higher scale = better Thai accuracy
    const {
      data: { text },
    } = await worker.recognize("data:image/png;base64," + b64);
    texts.push(text);
  }
  return texts.join(PAGE_BREAK);
}

// Typhoon OCR — Thai-specialized VLM via the /api/typhoon proxy (free tier).
export async function ocrPDFTyphoon(
  file: File,
  onProgress?: (page: number, total: number) => void,
): Promise<string> {
  const ab = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
  const numPages = pdf.numPages;
  const texts: string[] = [];
  for (let p = 1; p <= numPages; p++) {
    onProgress && onProgress(p, numPages);
    const b64 = await rasterizePage(pdf, p);
    const res = await fetch("/api/typhoon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: TYPHOON_MODEL,
        max_tokens: 16000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: "data:image/png;base64," + b64 },
              },
              { type: "text", text: TYPHOON_OCR_PROMPT },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e?.error?.message || `Typhoon OCR API ${res.status}`);
    }
    const data = await res.json();
    const txt = data.choices?.[0]?.message?.content || "";
    texts.push(txt);
  }
  return texts.join(PAGE_BREAK);
}

// Google Cloud Vision — free-tier OCR (1,000 pages/mo) with good Thai, via the
// /api/vision proxy (GOOGLE_VISION_API_KEY stays server-side). DOCUMENT_TEXT_DETECTION.
export async function ocrPDFVision(
  file: File,
  onProgress?: (page: number, total: number) => void,
): Promise<string> {
  const ab = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
  const numPages = pdf.numPages;
  const texts: string[] = [];
  for (let p = 1; p <= numPages; p++) {
    onProgress && onProgress(p, numPages);
    const b64 = await rasterizePage(pdf, p);
    const res = await fetch("/api/vision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: b64 },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
            imageContext: { languageHints: ["th", "en"] },
          },
        ],
      }),
    });
    const data = await res.json().catch(() => ({}));
    const perr = data.responses?.[0]?.error;
    if (!res.ok || data.error || perr) {
      const msg =
        data.error?.message || perr?.message || `Vision API ${res.status}`;
      throw new Error(msg);
    }
    const txt = data.responses?.[0]?.fullTextAnnotation?.text || "";
    texts.push(txt);
  }
  return texts.join(PAGE_BREAK);
}

export async function ocrPageWithGemini(
  pageB64: string,
  pageNum: number,
  geminiKey: string,
  geminiModel: string,
): Promise<string> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { inline_data: { mime_type: "image/png", data: pageB64 } },
            {
              text: `This is page ${pageNum} of a scanned Thai TOR document. Extract ALL text exactly as written — verbatim Thai and English. Preserve numbering and paragraph structure. Return only the extracted text.`,
            },
          ],
        },
      ],
      generationConfig: { temperature: 0, maxOutputTokens: 4096 },
    }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e?.error?.message || `Gemini Vision API ${res.status}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}
