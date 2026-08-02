import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PdfType } from "./types";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export { pdfjsLib };

export async function detectPDFType(file: File): Promise<PdfType> {
  const ab = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
  // Sample several pages, not just page 1 — a scanned cover on an otherwise
  // digital PDF (or a text-only TOC on a scanned one) must not misclassify the
  // whole document (RISK_REVIEW R5).
  const sample = Math.min(pdf.numPages, 5);
  let total = 0;
  for (let n = 1; n <= sample; n++) {
    const page = await pdf.getPage(n);
    const tc = await page.getTextContent();
    total += tc.items
      .map((i: any) => ("str" in i ? i.str : ""))
      .join("")
      .trim().length;
    // Once we've clearly seen a real text layer, it's digital — stop early.
    if (total > 100) return "digital";
  }
  return total > 50 ? "digital" : "scanned";
}

/** Rasterize one PDF page to a base64 PNG (no data: prefix). */
export async function rasterizePage(
  pdf: any,
  pageNum: number,
  scale = 2,
): Promise<string> {
  const page = await pdf.getPage(pageNum);
  const vp = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = vp.width;
  canvas.height = vp.height;
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  return canvas.toDataURL("image/png").split(",")[1];
}

/**
 * Base64-encode a whole file in 32 KB chunks.
 * Replaces `btoa(String.fromCharCode(...new Uint8Array(ab)))`, which overflows the
 * call stack on large PDFs (RISK_REVIEW R2).
 */
export async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

const PAGE_BREAK = "\n\n--- PAGE BREAK ---\n\n";

/** The subset of a pdf.js text item we rely on for line reconstruction. */
export interface PdfTextItem {
  str: string;
  hasEOL?: boolean;
  transform?: number[];
}

/**
 * Reconstruct visual lines from one page's pdf.js text items. Uses pdf.js's own
 * end-of-line markers (`hasEOL`) when the page provides them; otherwise falls
 * back to grouping by baseline-y. Pure + unit-tested (no pdf.js dependency).
 */
export function textItemsToLines(items: PdfTextItem[]): string[] {
  const its = items.filter((it) => typeof it.str === "string");
  const lines: string[] = [];
  let line = "";
  if (its.some((it) => it.hasEOL)) {
    for (const it of its) {
      line += it.str;
      if (it.hasEOL) {
        lines.push(line);
        line = "";
      }
    }
    if (line) lines.push(line);
  } else {
    // No EOL markers → break when the baseline y jumps between items.
    let lastY: number | null = null;
    for (const it of its) {
      const y = it.transform ? it.transform[5] : null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 3 && line) {
        lines.push(line);
        line = "";
      }
      line += it.str;
      lastY = y;
    }
    if (line) lines.push(line);
  }
  return lines;
}

/**
 * Extract the embedded text layer of a **digital** PDF, page by page, preserving
 * line breaks — instant, free, lossless, no AI and no OCR. Scanned PDFs have no
 * text layer, so callers must gate on `detectPDFType` first. Pages are joined
 * with the same PAGE_BREAK marker the row structurer skips.
 */
export async function extractDigitalText(
  file: File,
  onProgress?: (page: number, total: number) => void,
  signal?: AbortSignal,
): Promise<string> {
  const ab = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
  const total = pdf.numPages;
  const pages: string[] = [];
  for (let p = 1; p <= total; p++) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    onProgress && onProgress(p, total);
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    pages.push(textItemsToLines(tc.items as PdfTextItem[]).join("\n"));
  }
  return pages.join(PAGE_BREAK);
}
