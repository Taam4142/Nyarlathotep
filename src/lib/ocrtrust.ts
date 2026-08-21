// How far the browser OCR engine's output can be trusted, and how to say so.
//
// MEASURED, 2026-08-20, against a real scanned Thai TOR (TESTING.md §3c).
// Tesseract reads Thai *prose* well enough to review, but corrupts Thai
// *numerals* — and reports the corrupted values as near-certain:
//
//   read as      should be     word confidence
//   IP ๒๕        IP ๖๘         96, 96
//   ๓๐๕          ๓๐๔           (stainless grade)
//   ๕๐ นิ้ว       ๔๐ นิ้ว
//   ๓.๑๑.๕       ๓.๑๑.๔        (clause ref; also produced a duplicate ref)
//   HOMI         HDMI          84
//   Ethemet      Ethernet      84  (the wrong "m" scored 99 at symbol level)
//
// Across 1,438 words on one page: median confidence 93, only 30 below 70, and
// `choices` was never populated with an alternative. So there is NO confidence
// signal that separates right from wrong here — thresholding it would flag 2%
// of words while missing every error above, which is worse than silence
// because it reads as reassurance.
//
// What IS reliable is the *shape* of the failure: it lands on numerals. So the
// warning is keyed to that, and counts the rows actually affected rather than
// issuing a vague "check the Thai". Raising the render scale does not fix it
// (scale 4 corrected HDMI but degraded the resolution figures further), so
// this is a limitation to disclose, not a knob to tune.

/** Thai numerals ๐–๙ (U+0E50–U+0E59). */
const THAI_NUMERAL = /[\u0E50-\u0E59]/;

/** Whether a string contains a Thai numeral. */
export const hasThaiNumeral = (text: string): boolean =>
  THAI_NUMERAL.test(text);

/**
 * How many rows carry a Thai numeral — i.e. how many hold a value that browser
 * OCR may have silently altered and that a reviewer should check against the
 * source page.
 */
export function countThaiNumeralRows(
  rows: readonly { requirement?: string }[],
): number {
  return rows.filter((r) => hasThaiNumeral(r.requirement ?? "")).length;
}

/**
 * The post-extraction warning for the no-AI browser-OCR path.
 *
 * Says which rows to check and why, rather than "review the Thai" — a reviewer
 * given a specific count and a named failure mode can act; one told to check
 * everything checks nothing.
 */
export function browserOcrWarning(
  rows: readonly { requirement?: string }[],
  furnitureRemoved = 0,
): string {
  const n = countThaiNumeralRows(rows);
  const parts = [
    "Browser OCR done with no AI. Rows were split heuristically — review the clause boundaries, then adjust.",
  ];
  if (furnitureRemoved > 0) {
    const l = furnitureRemoved === 1 ? "line" : "lines";
    parts.push(
      `Removed ${furnitureRemoved} page-furniture ${l} (signature blocks, ` +
        `page numbers) that are not requirements.`,
    );
  }
  if (n > 0) {
    const rowWord =
      n === 1 ? "row contains a Thai numeral" : "rows contain Thai numerals";
    parts.push(
      `⚠ ${n} ${rowWord}. This engine misreads Thai digits (๔ and ๕ especially) ` +
        `while still reporting high confidence, so numeric values — IP ratings, grades, ` +
        `sizes, clause numbers — must be checked against the source page. ` +
        `Typhoon is Thai-tuned and generally reads these more accurately.`,
    );
  }
  return parts.join(" ");
}
