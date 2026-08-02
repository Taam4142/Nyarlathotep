import { describe, it, expect } from "vitest";
import { itemsToCells } from "./pdf";

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
