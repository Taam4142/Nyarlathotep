import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PdfType } from "./types";
import {
  groupIntoRows,
  detectColumnBoundaries,
  rowToLine,
  type RowCell,
} from "./tables";

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

/** Map pdf.js text items to positional cells (x, y, width, height, str). */
export function itemsToCells(items: any[]): RowCell[] {
  const cells: RowCell[] = [];
  for (const it of items) {
    if (typeof it?.str !== "string" || it.str === "") continue;
    const t = it.transform || [1, 0, 0, 1, 0, 0];
    cells.push({
      x: t[4],
      y: t[5],
      width: it.width ?? 0,
      height: it.height || Math.abs(t[3]) || 10,
      str: it.str,
    });
  }
  return cells;
}

/**
 * Extract the embedded text layer of a **digital** PDF, page by page — instant,
 * free, lossless, no AI and no OCR. Reconstructs visual lines and, when a page
 * has an aligned table, separates its columns with a delimiter (see tables.ts)
 * so multi-column rows stay readable. Scanned PDFs have no text layer, so callers
 * must gate on `detectPDFType` first.
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
    const rows = groupIntoRows(itemsToCells(tc.items));
    const boundaries = detectColumnBoundaries(rows);
    pages.push(rows.map((r) => rowToLine(r, boundaries)).join("\n"));
  }
  return pages.join(PAGE_BREAK);
}
