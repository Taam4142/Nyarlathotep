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
