import { describe, it, expect } from "vitest";
import {
  groupIntoRows,
  detectColumnBoundaries,
  columnOf,
  rowToLine,
  type RowCell,
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

  it("is a plain space-join when there are no boundaries (prose)", () => {
    const row = [cell(20, 100, "just"), cell(60, 100, "a"), cell(80, 100, "line")];
    expect(rowToLine(row, [])).toBe("just a line");
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
