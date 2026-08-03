// Heuristic guard for the digital-PDF fast path (auto-use the embedded text
// layer instead of OCR). Thai PDFs with broken font / ToUnicode maps often
// extract as gibberish or replacement characters even though the page looks
// fine, so before trusting a text layer we sanity-check it. We only reject
// GROSS failures — empty, replacement-char-heavy, or almost no real letters;
// subtle corruption (plausible-looking but wrong Thai) can't be caught
// heuristically and is left to the manual "re-run with OCR" fallback.

export interface TextQuality {
  usable: boolean;
  /** Short, human-readable reason when not usable. */
  reason?: string;
}

const LETTER = /[A-Za-z0-9฀-๿]/; // Latin, digits, or Thai

export function assessTextQuality(text: string): TextQuality {
  const compact = (text || "").replace(/\s+/g, " ").trim();
  if (compact.length < 8) return { usable: false, reason: "almost no text" };

  const nonSpace = [...compact].filter((c) => c !== " ");
  const total = nonSpace.length;
  if (total === 0) return { usable: false, reason: "almost no text" };

  let replacement = 0;
  let letters = 0;
  for (const c of nonSpace) {
    if (c === "�") replacement++;
    if (LETTER.test(c)) letters++;
  }

  if (replacement / total > 0.02)
    return { usable: false, reason: "many unreadable characters" };
  if (letters / total < 0.5)
    return { usable: false, reason: "text looks garbled" };
  return { usable: true };
}
