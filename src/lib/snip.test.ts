import { describe, it, expect } from "vitest";
import { displayRectToSource, normalizeDrag } from "./snip";

describe("displayRectToSource", () => {
  it("scales a display rect up to source pixels", () => {
    // page shown at 600×800, actual raster 1200×1600 (2× scale)
    const r = displayRectToSource(
      { x: 100, y: 50, w: 200, h: 100 },
      { w: 600, h: 800 },
      { w: 1200, h: 1600 },
    );
    expect(r).toEqual({ x: 200, y: 100, w: 400, h: 200 });
  });

  it("clamps a selection that runs past the image edge", () => {
    const r = displayRectToSource(
      { x: 550, y: 0, w: 200, h: 100 },
      { w: 600, h: 800 },
      { w: 600, h: 800 }, // 1:1
    );
    expect(r.x).toBe(550);
    expect(r.w).toBe(50); // clamped to the right edge, not 200
  });

  it("is 1:1 when display equals natural", () => {
    const r = displayRectToSource(
      { x: 10, y: 20, w: 30, h: 40 },
      { w: 500, h: 500 },
      { w: 500, h: 500 },
    );
    expect(r).toEqual({ x: 10, y: 20, w: 30, h: 40 });
  });
});

describe("normalizeDrag", () => {
  it("handles a top-left → bottom-right drag", () => {
    expect(normalizeDrag(10, 10, 40, 60)).toEqual({ x: 10, y: 10, w: 30, h: 50 });
  });

  it("handles a bottom-right → top-left drag (negative direction)", () => {
    expect(normalizeDrag(40, 60, 10, 10)).toEqual({ x: 10, y: 10, w: 30, h: 50 });
  });
});
