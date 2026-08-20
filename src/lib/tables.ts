// Column-aware reconstruction of a digital PDF's text layer. Pure + unit-tested
// (no pdf.js dependency). The goal: keep one-row-per-line for prose, but when a
// page has an aligned table, separate its columns with a delimiter so a row like
// [3.2 | PLC controller | Siemens S7-1500] reads as
// "3.2 — PLC controller — Siemens S7-1500" instead of the columns mashing
// together. Column boundaries must recur across ≥2 rows to count, so a lone wide
// gap in ordinary prose is never treated as a column.

export interface RowCell {
  x: number;
  y: number;
  width: number;
  height: number;
  str: string;
}

/** Group a page's cells into visual rows (top-to-bottom), each sorted left-to-right. */
export function groupIntoRows(cells: RowCell[]): RowCell[][] {
  const cs = cells
    .filter((c) => c.str !== "")
    .slice()
    .sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: RowCell[][] = [];
  let cur: RowCell[] = [];
  let rowY: number | null = null;
  for (const c of cs) {
    const tol = (c.height || 10) * 0.6;
    if (rowY === null || Math.abs(c.y - rowY) <= tol) {
      cur.push(c);
      if (rowY === null) rowY = c.y;
    } else {
      rows.push(cur.sort((a, b) => a.x - b.x));
      cur = [c];
      rowY = c.y;
    }
  }
  if (cur.length) rows.push(cur.sort((a, b) => a.x - b.x));
  return rows;
}

/**
 * Detect confirmed column boundaries (x positions). A boundary is a large gap
 * between adjacent cells that recurs at a similar x across at least two rows —
 * so a table's columns register, but an isolated wide gap in prose does not.
 * Returns [] when the page isn't tabular.
 */
export function detectColumnBoundaries(rows: RowCell[][]): number[] {
  const candidates: number[] = [];
  for (const row of rows) {
    for (let i = 1; i < row.length; i++) {
      const prev = row[i - 1];
      const cur = row[i];
      if (cur.str.trim() === "") continue; // a boundary sits at the start of a real column
      const fs = cur.height || 10;
      // pdf.js fills column gaps with a wide whitespace item; a large real gap
      // (no filler) also counts. Either marks the start of the next column.
      const gap = cur.x - (prev.x + prev.width);
      const prevWideSpace = prev.str.trim() === "" && prev.width > fs * 1.5;
      if (prevWideSpace || gap > fs * 1.5) candidates.push(cur.x);
    }
  }
  if (candidates.length < 2) return [];
  candidates.sort((a, b) => a - b);
  const clusters: number[][] = [];
  for (const x of candidates) {
    const last = clusters[clusters.length - 1];
    if (last && x - last[last.length - 1] <= 10) last.push(x);
    else clusters.push([x]);
  }
  return clusters
    .filter((c) => c.length >= 2)
    .map((c) => c.reduce((s, v) => s + v, 0) / c.length);
}

/** Which column index an x falls into, given ascending boundaries. */
export function columnOf(x: number, boundaries: number[]): number {
  let col = 0;
  for (const b of boundaries) {
    if (x >= b - 1) col++;
    else break;
  }
  return col;
}

/**
 * Render one row as a single line. Words inside a column are space-joined; a
 * `sep` is inserted only when moving into a later column. With no boundaries
 * this is a plain space-join, so prose is unchanged.
 */
/**
 * Are two cells touching, i.e. was there no space between them in the document?
 *
 * pdf.js splits a run of text into items wherever the PDF's own text-showing
 * operators split it, which for Thai documents routinely happens INSIDE a token:
 * "2,000,000.-" arrives as several items. The whitespace items that represent
 * real spaces are filtered out before this point, so rejoining every pair with a
 * space turned that figure into "2,000, 000. -" — a budget of two million baht,
 * corrupted in the requirement field the verbatim law exists to protect.
 *
 * Geometry answers it exactly: consecutive items of one token abut, while a real
 * space leaves a gap of roughly a quarter em or more. The threshold is a fraction
 * of the glyph height rather than an absolute, so it holds at any font size.
 *
 * Found 2026-08-20 against three published Thai government TORs.
 */
function adjacent(a: RowCell, b: RowCell): boolean {
  if (!a) return false;
  const gap = b.x - (a.x + a.width);
  const em = a.height || b.height || 10;
  return gap < em * 0.18;
}

export function rowToLine(
  row: RowCell[],
  boundaries: number[],
  sep = " — ",
): string {
  // Drop pdf.js's whitespace filler items; column crossings do the separating.
  const cells = row
    .filter((c) => c.str.trim() !== "")
    .sort((a, b) => a.x - b.x);
  let line = "";
  let prevCol = -1;
  let prev: RowCell | null = null;
  for (const c of cells) {
    const col = boundaries.length ? columnOf(c.x, boundaries) : 0;
    if (prevCol === -1) line = c.str;
    // Adjacency outranks the column boundary. Boundaries are inferred from the
    // x-positions of OTHER rows on the page, so one can land in the middle of a
    // token that happens to straddle it — which is how "2,000,000.-" became
    // "2,000, — 000.-". If two items physically touch they are one token, and
    // nothing belongs between them.
    else if (adjacent(prev!, c)) line += c.str;
    else if (col > prevCol) line += sep + c.str;
    else line += " " + c.str;
    prevCol = col;
    prev = c;
  }
  // Collapse runs of spaces without touching the sep's spacing.
  return line.replace(/ {2,}/g, " ").trim();
}
