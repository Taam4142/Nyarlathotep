import { describe, it, expect } from "vitest";
import { itemsToCells, scaleFallbackLadder } from "./pdf";

describe("itemsToCells (pdf.js item → positional cell)", () => {
  it("pulls x/y/width/height/str and skips empty items", () => {
    const items = [
      { str: "hi", width: 12, height: 10, transform: [1, 0, 0, 10, 20, 700] },
      { str: "", width: 0, height: 10, transform: [1, 0, 0, 10, 40, 700] },
      { str: "yo", width: 14, transform: [1, 0, 0, 12, 60, 680] },
    ];
    const cells = itemsToCells(items);
    expect(cells).toHaveLength(2);
    expect(cells[0]).toMatchObject({ x: 20, y: 700, width: 12, height: 10, str: "hi" });
    // height falls back to |transform[3]| when the item has no height
    expect(cells[1]).toMatchObject({ x: 60, y: 680, str: "yo", height: 12 });
  });

  it("tolerates missing transform", () => {
    const cells = itemsToCells([{ str: "x" }]);
    expect(cells[0]).toMatchObject({ x: 0, y: 0, str: "x" });
  });
});

describe("scaleFallbackLadder (rasterizePage's retry sequence — RISK_REVIEW R12)", () => {
  it("starts with the requested scale, then steps down through the canonical rungs", () => {
    expect(scaleFallbackLadder(3)).toEqual([3, 2, 1.5, 1]);
  });

  it("never offers a rung above the requested scale", () => {
    expect(scaleFallbackLadder(2)).toEqual([2, 1.5, 1]);
  });

  it("stops at the floor (1) — no fallback below it", () => {
    expect(scaleFallbackLadder(1)).toEqual([1]);
  });

  it("respects an explicit scale below the floor without adding higher rungs", () => {
    expect(scaleFallbackLadder(0.5)).toEqual([0.5]);
  });

  it("handles a non-canonical starting scale by inserting it first", () => {
    expect(scaleFallbackLadder(2.5)).toEqual([2.5, 2, 1.5, 1]);
  });
});
