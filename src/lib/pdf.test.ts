import { describe, it, expect } from "vitest";
import { textItemsToLines } from "./pdf";

describe("textItemsToLines (digital text extraction)", () => {
  it("uses hasEOL markers to end lines and joins runs on the same line", () => {
    const items = [
      { str: "Hello " },
      { str: "world", hasEOL: true },
      { str: "second line", hasEOL: true },
    ];
    expect(textItemsToLines(items)).toEqual(["Hello world", "second line"]);
  });

  it("keeps a trailing run with no final EOL", () => {
    const items = [
      { str: "line one", hasEOL: true },
      { str: "no eol here" },
    ];
    expect(textItemsToLines(items)).toEqual(["line one", "no eol here"]);
  });

  it("falls back to baseline-y grouping when no hasEOL is present", () => {
    // Higher y = higher on the page; a drop of >3 starts a new line.
    const items = [
      { str: "row A", transform: [1, 0, 0, 1, 0, 700] },
      { str: " cont", transform: [1, 0, 0, 1, 40, 700] },
      { str: "row B", transform: [1, 0, 0, 1, 0, 680] },
    ];
    expect(textItemsToLines(items)).toEqual(["row A cont", "row B"]);
  });

  it("ignores non-string items", () => {
    const items = [{ str: "ok", hasEOL: true }, {} as any, { str: "x", hasEOL: true }];
    expect(textItemsToLines(items)).toEqual(["ok", "x"]);
  });
});
