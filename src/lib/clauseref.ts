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
