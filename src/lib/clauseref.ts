// Clause-reference recognition, shared by the text splitter and the geometric
// line assembler.
//
// It lives in its own leaf module because both need it and neither can import
// the other: extract.ts already depends on pdf.ts, and pdf.ts depends on
// tables.ts, so any clause-ref knowledge held in extract.ts is unreachable from
// the geometry side without a cycle.

/** ASCII (0-9) and Thai (๐-๙, U+0E50–U+0E59) numerals. */
const D = "[0-9๐-๙]";

/**
 * The separating dot, with optional whitespace either side.
 *
 * Real Thai TOR PDFs routinely write clause numbers as "๓ . ๑" rather than
 * "๓.๑" — that is how the text layer comes out of the word processors these
 * documents are authored in. Requiring the dot immediately after the digit made
 * every such sub-clause match only its first component, so ๓.๑ through ๓.๗ all
 * became ref "๓". Found 2026-08-20 against three published Thai government TORs.
 */
const DOT = "\\s*\\.\\s*";

/** A leading clause reference: "3", "3.2", "๓ . ๑๑ . ๒", "ข้อ ๕", "(๑)". */
export const CLAUSE_REF = new RegExp(
  `^(?:(${D}+(?:${DOT}${D}+)*)[.)]?|ข้อ\\s*(${D}+)|\\((${D}+)\\))(?=\\s|$)`,
);

/** Collapse "๓ . ๑" to "๓.๑" so the Ref column stays compact and comparable. */
export const normalizeRef = (ref: string): string => ref.replace(/\s*\.\s*/g, ".");

/**
 * The clause reference a line opens with, normalized — or null if it has none.
 * The line's own text is never modified; only the extracted ref is normalized.
 */
export function matchClauseRef(line: string): string | null {
  const m = line.match(CLAUSE_REF);
  const matched = m && (m[1] || m[2] || m[3]);
  return matched ? normalizeRef(matched) : null;
}

/** Whether a line opens a new numbered clause. */
export const startsWithClauseRef = (line: string): boolean =>
  matchClauseRef(line) !== null;

/**
 * Bullet markers that open a list item: hyphen, the dashes, and the usual
 * glyph bullets. A marker only counts when whitespace follows it, which is what
 * separates a bullet from a minus sign — real TORs write both, often on the
 * same line ("- มีอุณหภูมิในการใช้งาน -๔๐ ถึง ๘๐ องศาเซลเซียส").
 */
const BULLET = /^[-–—•·*▪‣+]\s/;

/**
 * Whether a line opens a new bullet item.
 *
 * Needed alongside startsWithClauseRef because a great many requirements carry
 * no clause number at all: they hang off the clause above as dash-bulleted
 * specification lines, each one a separate requirement to be complied with.
 * Found 2026-08-20 in a real AMR equipment TOR, whose house style is almost
 * entirely bulleted — the three published TORs tested before it were
 * paragraph-style and never exercised this.
 */
export const startsWithBullet = (line: string): boolean => BULLET.test(line);

/** Whether a line starts a new item rather than continuing the one above. */
export const opensNewItem = (line: string): boolean =>
  startsWithClauseRef(line) || startsWithBullet(line);
