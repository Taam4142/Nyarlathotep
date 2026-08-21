// Removing Markdown that a vision model added to OCR output.
//
// WHY THIS EXISTS: TYPHOON_OCR_PROMPT used to end "Return clean Markdown", and
// the result is treated as verbatim source text. So the model's formatting
// landed in the `requirement` field and from there in the Excel export — a
// contractual document with `####` in it.
//
// The damage was not cosmetic. `matchClauseRef` requires a line to START with
// its number, so `#### ๓.๑.๓ …` produced no ref at all. Measured on a real
// 24-page AMR TOR (2026-08-21): 503 rows, of which 24 had a real clause
// reference destroyed by a heading marker, including the document's top-level
// sections `## ๓.` and `### ๓.๑`.
//
// IS REMOVING IT A VERBATIM VIOLATION? No — the reverse. The markers are not in
// the source; the model added them because we asked. Removing them restores the
// text. That was verified rather than assumed: the source page was rendered and
// read, and the line begins `๓.๑.` with no `#` anywhere in the document.
//
// The prompt no longer asks for Markdown. This exists because a prompt is a
// request, not a guarantee — vision models emit Markdown out of habit — and
// because it repairs text extracted before the prompt was fixed.

/** Markdown a Thai TOR cannot plausibly contain: ATX headings and bold spans. */
const UNAMBIGUOUS = /^#{1,6}\s+|\*\*[^*\n]+\*\*/;

/**
 * Whether this text shows a model was formatting as Markdown.
 *
 * Used to decide the one ambiguous case (below). Judged over the WHOLE document
 * rather than per line: one `####` proves the model was in Markdown mode, which
 * then explains every `*` in the same response.
 */
export const looksLikeMarkdown = (text: string): boolean =>
  text.split("\n").some((l) => UNAMBIGUOUS.test(l.trim()));

/**
 * Strip Markdown a model added, leaving everything else byte-for-byte.
 *
 * Three rules, in descending order of certainty:
 *
 *  1. `^#{1,6} ` — removed. A Thai TOR does not use ATX headings, and removing
 *     the marker is what lets the clause reference underneath be found again.
 *  2. `**bold**` — unwrapped, text kept. Paired double asterisks are Markdown;
 *     Thai typography has no equivalent.
 *  3. `^* ` — a bullet. **This one is genuinely ambiguous**, which is why it is
 *     gated on `allowBulletRewrite`. A leading asterisk could be a real footnote
 *     or emphasis marker in the source, and rewriting one that IS real would
 *     corrupt a contractual requirement. It is only rewritten when the same
 *     document proves the model was emitting Markdown, and then to `- `, which
 *     is how these documents write bullets natively — so the line stays a list
 *     item and the wrapped-line guards keep recognising it.
 *
 * A leading `- ` is NEVER touched: real TORs use dash bullets, and 145 rows of
 * the measured document did.
 */
export function stripMarkdown(line: string, allowBulletRewrite: boolean): string {
  let out = line;

  // 1. Heading markers — only at the start, only when followed by space.
  out = out.replace(/^(\s*)#{1,6}[ \t]+/, "$1");

  // 2. Bold spans. Runs until no pair is left, so `**a** and **b**` both go.
  //    Requires non-empty, single-line content so a stray `**` is left alone.
  let prev: string;
  do {
    prev = out;
    out = out.replace(/\*\*([^*\n]+)\*\*/g, "$1");
  } while (out !== prev);

  // 3. Bullet marker — the ambiguous one, gated on document-level evidence.
  if (allowBulletRewrite) out = out.replace(/^(\s*)\*[ \t]+/, "$1- ");

  return out;
}

/**
 * Clean a whole OCR response.
 *
 * Line count is preserved exactly — the row splitter downstream is line-based,
 * and dropping or adding a line here would silently change the matrix.
 */
export function cleanModelMarkdown(text: string): string {
  const allowBulletRewrite = looksLikeMarkdown(text);
  return text
    .split("\n")
    .map((l) => stripMarkdown(l, allowBulletRewrite))
    .join("\n");
}
