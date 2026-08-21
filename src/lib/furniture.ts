// Page furniture: the lines every page of a Thai government TOR carries that
// are not requirements — the committee signature block and the centred page
// number.
//
// MEASURED, 2026-08-20 (TESTING.md §3c). On a real 2-page AMR TOR these were
// ~7 % of extracted rows, and the share scales with PAGE COUNT rather than
// requirement count: a 100-page TOR carries 100 signature blocks. Every one is
// a row the engineer deletes by hand before the matrix is usable.
//
//   ลงชื่อ(22โช.กรรมการ                              PIE Ta
//   VR Ea ๑๓...-ประธานกรรมการ
//   ta                                                          -๑๕-
//
// DELIBERATELY CONSERVATIVE. Dropping a real requirement is far worse than
// leaving a junk row, so each rule below needs a positive signal; noise that
// merely looks unhelpful ("od (Fran   I") is kept. The count of what was
// removed is always reported to the user, so nothing vanishes silently — the
// project's rule is flag rather than silently coerce, and a removal the user is
// told about is not silent.

import { opensNewItem } from "./clauseref";

/** Thai letters and marks (excludes ๐-๙, which are U+0E50–U+0E59). */
const THAI_LETTER = /[\u0E01-\u0E4F]/g;
const LATIN_LETTER = /[A-Za-z]/g;

const count = (s: string, re: RegExp) => (s.match(re) || []).length;

/**
 * "ลงชื่อ" — signed. In a TOR body this word appears only in a signature block,
 * which makes it the single most reliable marker of one.
 */
const SIGNED = /ลงชื่อ/;

/**
 * A line ENDING in a committee role: "…ประธานกรรมการ", "…กรรมการ". Requirements
 * mentioning a committee keep going ("ต้องได้รับอนุมัติจากคณะกรรมการก่อน…"), so
 * anchoring to the end is what separates the two. The fuzzy middle absorbs OCR
 * damage — a real scan produced "ปรัสสานกรรมาร" for "ประธานกรรมการ".
 */
const ROLE_TRAILER = /กรรม[\u0E01-\u0E4F]{0,3}ร[\s.·:;'"]*$/;

/**
 * A centred page number: too few letters to be a requirement, and carrying a
 * digit. Both halves are needed. The letter count alone once matched a short
 * English line ("a line") in an existing fixture — requiring a digit as well
 * keeps the rule pointed at page numbers, which always have one, and away from
 * genuinely short requirements, which usually do not.
 *
 * Six letters is low enough that the shortest real sub-heading seen in a TOR
 * ("ตู้อุปกรณ์", 9 letters) stays well clear.
 */
const MIN_LETTERS = 6;
const HAS_DIGIT = /[0-9๐-๙]/;

/** Whether a line is page furniture rather than a requirement. */
export function isPageFurniture(line: string): boolean {
  const text = line.trim();
  if (!text) return false;
  // A line opening a clause reference or a bullet is structurally a
  // requirement however short it is, so it is never furniture. This guard
  // comes first deliberately: length is weak evidence, an opener is strong.
  // The cost is that a page number written as "- 1 -" reads as a bullet and
  // survives; keeping a junk row beats deleting a real requirement.
  if (opensNewItem(text)) return false;
  if (SIGNED.test(text)) return true;
  if (ROLE_TRAILER.test(text)) return true;
  const letters = count(text, THAI_LETTER) + count(text, LATIN_LETTER);
  return letters < MIN_LETTERS && HAS_DIGIT.test(text);
}
/** How many lines of a raw extracted text are page furniture. */
export function countPageFurniture(rawText: string): number {
  return rawText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && l !== "--- PAGE BREAK ---")
    .filter(isPageFurniture).length;
}
