import { describe, it, expect } from "vitest";
import {
  groupIntoRows,
  detectColumnBoundaries,
  columnOf,
  rowToLine,
  type RowCell,
  joinWrappedRows,
} from "./tables";

const cell = (x: number, y: number, str: string, width = 40, height = 12): RowCell => ({
  x,
  y,
  width,
  height,
  str,
});

// A clean 3-column table: [ref | item | spec] over two rows.
const tableCells: RowCell[] = [
  cell(20, 160, "3.2", 18),
  cell(80, 160, "PLC controller", 70),
  cell(200, 160, "Siemens S7-1500", 80),
  cell(20, 135, "3.3", 18),
  cell(80, 135, "HMI panel", 55),
  cell(200, 135, "10 inch touchscreen", 90),
];

describe("groupIntoRows", () => {
  it("groups cells into visual rows by baseline y, sorted left-to-right", () => {
    const rows = groupIntoRows(tableCells);
    expect(rows).toHaveLength(2);
    expect(rows[0].map((c) => c.str)).toEqual(["3.2", "PLC controller", "Siemens S7-1500"]);
    expect(rows[1].map((c) => c.str)).toEqual(["3.3", "HMI panel", "10 inch touchscreen"]);
  });
});

describe("detectColumnBoundaries", () => {
  it("finds boundaries that recur across rows", () => {
    const rows = groupIntoRows(tableCells);
    const b = detectColumnBoundaries(rows);
    expect(b).toHaveLength(2);
    expect(b[0]).toBeCloseTo(80, 0);
    expect(b[1]).toBeCloseTo(200, 0);
  });

  it("returns [] for prose (a single wide gap that does not recur)", () => {
    const prose: RowCell[] = [
      cell(20, 100, "one wide", 60),
      cell(200, 100, "gap here", 60), // one lone gap
      cell(20, 84, "next line flows normally", 150),
    ];
    expect(detectColumnBoundaries(groupIntoRows(prose))).toEqual([]);
  });
});

describe("columnOf", () => {
  it("maps x to the correct column index", () => {
    const b = [80, 200];
    expect(columnOf(20, b)).toBe(0);
    expect(columnOf(80, b)).toBe(1);
    expect(columnOf(210, b)).toBe(2);
  });
});

describe("rowToLine", () => {
  it("separates columns with the delimiter, space-joins within a column", () => {
    const rows = groupIntoRows(tableCells);
    const b = detectColumnBoundaries(rows);
    expect(rowToLine(rows[0], b)).toBe("3.2 — PLC controller — Siemens S7-1500");
  });

  it("space-joins words that are separated by a real gap (prose)", () => {
    // Widths chosen so the cells genuinely do not touch, which is what a space
    // between words looks like geometrically. The previous version of this test
    // used the default width of 40 at x = 20/60/80, which made the cells OVERLAP
    // (60 + 40 = 100 > 80) — impossible for real text, and it only passed because
    // rowToLine used to insert a space between every pair regardless of position.
    const row = [
      cell(20, 100, "just", 30), // 20..50
      cell(58, 100, "a", 8), //     58..66   (8pt gap before it)
      cell(74, 100, "line", 30), //  74..104 (8pt gap before it)
    ];
    expect(rowToLine(row, [])).toBe("just a line");
  });

  it("does NOT insert a space between items that abut (regression: a mangled currency figure)", () => {
    // pdf.js splits a run of text wherever the PDF's own operators split it,
    // which in real Thai documents happens INSIDE a token: "2,000,000.-" arrives
    // as several abutting items. Rejoining every pair with a space turned a
    // budget of two million baht into "2,000, 000. -" — corruption of the very
    // field the verbatim law protects.
    //
    // Observed 2026-08-20 on a published Thai government TOR (page 2 of the
    // RMUTSV CCTV tender).
    const row = [
      cell(100, 200, "2,000,", 24), // 100..124
      cell(124, 200, "000.", 16), //   124..140, touching
      cell(140, 200, "-", 4), //       140..144, touching
      cell(152, 200, "บาท", 20), //    152..172, a real gap before it
    ];
    expect(rowToLine(row, [])).toBe("2,000,000.- บาท");
  });
});

// pdf.js fills column gaps with wide whitespace items instead of leaving a raw
// gap — reproduce that exact shape (from a real parse) end-to-end.
describe("column detection with pdf.js-style whitespace fillers", () => {
  const spacedCells: RowCell[] = [
    cell(20, 160, "3.2", 16.68),
    cell(36.68, 160, " ", 43.32),
    cell(80, 160, "PLC controller", 76.02),
    cell(156.02, 160, " ", 43.98),
    cell(200, 160, "Siemens S7-1500", 95.38),
    cell(20, 135, "3.3", 16.68),
    cell(36.68, 135, " ", 43.32),
    cell(80, 135, "HMI panel", 54.68),
    cell(134.68, 135, " ", 65.32),
    cell(200, 135, "10 inch touchscreen", 107.39),
  ];

  it("detects the columns from the filler items and delimits them", () => {
    const rows = groupIntoRows(spacedCells);
    const b = detectColumnBoundaries(rows);
    expect(b).toHaveLength(2);
    expect(rowToLine(rows[0], b)).toBe("3.2 — PLC controller — Siemens S7-1500");
    expect(rowToLine(rows[1], b)).toBe("3.3 — HMI panel — 10 inch touchscreen");
  });
});

// A requirement that wraps across several PDF lines was becoming several rows.
// On three real Thai government TORs that produced ~30 rows per page, most of
// them sentence fragments that still had to be reviewed and exported.
//
// The signal is geometric: a line reaching the text block's right margin has
// wrapped; one stopping short of it ends a paragraph.
describe("joinWrappedRows", () => {
  // Margin is derived from the widest right edge present, so these fixtures set
  // it implicitly by including one full-width line.
  const at = (x: number, y: number, w: number, str: string): RowCell[] => [
    { x, y, width: w, height: 10, str },
  ];

  it("joins a line that follows one running to the right margin", () => {
    const rows = [at(20, 100, 380, "the contractor shall supply and install"), at(20, 88, 90, "the equipment")];
    const lines = ["the contractor shall supply and install", "the equipment"];
    expect(joinWrappedRows(rows, lines)).toEqual([
      "the contractor shall supply and install the equipment",
    ]);
  });

  it("does NOT join after a line that stops short of the margin", () => {
    // First line ends a paragraph; the long second line sets the margin.
    const rows = [at(20, 100, 80, "a short line."), at(20, 88, 380, "a new paragraph starts here and runs on")];
    const lines = ["a short line.", "a new paragraph starts here and runs on"];
    expect(joinWrappedRows(rows, lines)).toHaveLength(2);
  });

  it("never absorbs a line that opens a new clause reference", () => {
    // Guard: the previous line reaches the margin, but the next begins "๓ . ๒",
    // so it is a new requirement rather than a continuation. Welding two
    // requirements together would be far worse than leaving one split.
    const rows = [at(20, 100, 380, "๓ . ๑ ผู้ประสงค์จะเสนอราคาต้องเป็นผู้มีอาชีพ"), at(20, 88, 200, "๓ . ๒ ผู้ประสงค์จะเสนอราคาต้องไม่เป็น")];
    const lines = ["๓ . ๑ ผู้ประสงค์จะเสนอราคาต้องเป็นผู้มีอาชีพ", "๓ . ๒ ผู้ประสงค์จะเสนอราคาต้องไม่เป็น"];
    expect(joinWrappedRows(rows, lines)).toHaveLength(2);
  });

  it("never absorbs a line indented past the one above", () => {
    // Sub-list items sit further right; they start something new.
    const rows = [at(20, 100, 380, "the system shall provide the following"), at(60, 88, 100, "an indented sub-item")];
    const lines = ["the system shall provide the following", "an indented sub-item"];
    expect(joinWrappedRows(rows, lines)).toHaveLength(2);
  });

  it("keeps every character, inserting one space for the line break", () => {
    const rows = [at(20, 100, 380, "alpha beta"), at(20, 88, 60, "gamma")];
    const joined = joinWrappedRows(rows, ["alpha beta", "gamma"]);
    expect(joined.join("").replace(/\s/g, "")).toBe("alphabetagamma");
    expect(joined[0]).toBe("alpha beta gamma");
  });

  it("is a no-op when it cannot tell (mismatched input, or too few rows)", () => {
    expect(joinWrappedRows([], ["a", "b"])).toEqual(["a", "b"]);
    expect(joinWrappedRows([at(0, 0, 10, "only")], ["only"])).toEqual(["only"]);
  });
});
