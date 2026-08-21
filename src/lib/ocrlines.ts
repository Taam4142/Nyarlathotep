// Rejoining OCR lines that a requirement wrapped across.
//
// The digital path already does this from pdf.js cell geometry (tables.ts
// joinWrappedRows). The OCR path could not, because the code took only
// `data.text` from Tesseract — a flat string with no coordinates — so it stayed
// strictly one-line-one-row. Measured on a real scanned AMR TOR, 28 % of the
// resulting rows were sentence fragments meaningless on their own, each one
// still to be reviewed and exported (TESTING.md §3c).
//
// Tesseract does report per-line bounding boxes; they are simply discarded
// unless the caller asks for `blocks`. Asking for them makes the same geometric
// signal available here, so this module adapts Tesseract's line boxes into the
// RowCell shape and reuses joinWrappedRows rather than growing a second,
// separately-wrong implementation of the same rule.

import { joinWrappedRows, type RowCell } from "./tables";

/** The part of a tesseract.js line this module needs. */
export interface OcrLine {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

/**
 * Walk whatever nesting the tesseract.js build uses down to lines.
 *
 * v6 returns blocks → paragraphs → lines, but the shape has moved between
 * versions and `blocks` is absent entirely unless requested. Rather than pin to
 * one shape, descend through any of the known container keys and collect every
 * `lines` array found.
 */
export function collectOcrLines(blocks: unknown): OcrLine[] {
  const out: OcrLine[] = [];
  const walk = (node: any): void => {
    if (!node) return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (Array.isArray(node.lines)) {
      for (const l of node.lines) {
        if (l && typeof l.text === "string" && l.bbox) {
          out.push({ text: l.text, bbox: l.bbox });
        }
      }
    }
    for (const key of ["blocks", "paragraphs"]) {
      if (node[key]) walk(node[key]);
    }
  };
  walk(blocks);
  return out;
}

/** A Tesseract line box as the single cell of a one-cell row. */
const toRow = (l: OcrLine): RowCell[] => [
  {
    x: l.bbox.x0,
    y: l.bbox.y0,
    width: Math.max(0, l.bbox.x1 - l.bbox.x0),
    height: Math.max(1, l.bbox.y1 - l.bbox.y0),
    str: l.text,
  },
];

/**
 * One page of OCR lines, with wrapped lines rejoined.
 *
 * Trailing whitespace is stripped per line first: Tesseract ends each line with
 * a newline, and a trailing "\n" would otherwise sit in the middle of a joined
 * requirement.
 */
export function joinOcrLines(lines: OcrLine[]): string[] {
  const trimmed = lines
    .map((l) => ({ ...l, text: l.text.replace(/\s+$/, "") }))
    .filter((l) => l.text.trim() !== "");
  if (trimmed.length === 0) return [];
  return joinWrappedRows(
    trimmed.map(toRow),
    trimmed.map((l) => l.text),
  );
}

/**
 * Page text from a tesseract.js result, rejoining wrapped lines when the line
 * geometry is available and falling back to the flat text when it is not.
 *
 * The fallback matters: `blocks` is null unless requested, and a future version
 * could change the shape again. Losing the rejoining is a regression in
 * tidiness; losing the text would be a regression in correctness.
 */
export function pageTextFromOcr(data: {
  text?: string;
  blocks?: unknown;
}): string {
  const lines = collectOcrLines(data?.blocks);
  if (lines.length === 0) return data?.text ?? "";
  return joinOcrLines(lines).join("\n");
}
