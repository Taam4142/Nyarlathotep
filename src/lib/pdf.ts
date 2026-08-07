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

// Descending canonical scales rasterizePage falls back through on render
// failure — a very large page (e.g. an embedded architectural/engineering
// drawing) can exceed canvas memory limits at high scale, crashing the whole
// extraction (RISK_REVIEW R12). 1 is the floor: lower starts hurting OCR
// accuracy enough that surfacing the error is more useful than a blurrier page.
const SCALE_LADDER = [3, 2, 1.5, 1];

/**
 * The sequence of scales rasterizePage will attempt for a given starting
 * scale — the scale itself first, then canonical rungs below it, never above
 * (fallback only ever reduces memory pressure, never increases it). Pure and
 * exported so the ladder logic is unit-tested without needing a canvas/DOM.
 */
export function scaleFallbackLadder(scale: number): number[] {
  return [scale, ...SCALE_LADDER.filter((s) => s < scale)];
}

/**
 * Rasterize one PDF page to a base64 PNG (no data: prefix). Retries at
 * progressively lower scale if rendering fails (R12) — every attempt gets a
 * fresh canvas, so there's no state leakage between rungs. Broad catch is
 * deliberate: pdf.js/canvas don't document a stable error shape for OOM, so
 * narrowing by error type would risk silently skipping the fallback on the
 * exact failure it exists for. If the failure isn't scale-related, every rung
 * fails too and the original error still propagates — nothing is masked.
 */
export async function rasterizePage(
  pdf: any,
  pageNum: number,
  scale = 2,
): Promise<string> {
  const page = await pdf.getPage(pageNum);
  let lastErr: unknown;
  for (const s of scaleFallbackLadder(scale)) {
    try {
      const vp = page.getViewport({ scale: s });
      const canvas = document.createElement("canvas");
      canvas.width = vp.width;
      canvas.height = vp.height;
      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      return canvas.toDataURL("image/png").split(",")[1];
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
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
