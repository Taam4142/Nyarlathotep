import { describe, it, expect } from "vitest";
import {
  parseJsonArray,
  structureWithoutAI,
  validateAndMap,
  isLikelyTranslated,
} from "./extract";

describe("parseJsonArray (R3/R4)", () => {
  it("parses a plain JSON array", () => {
    const out = parseJsonArray('[{"ref":"1","requirement":"a"}]');
    expect(out).toHaveLength(1);
    expect(out[0].ref).toBe("1");
  });

  it("strips ```json fences", () => {
    const out = parseJsonArray('```json\n[{"ref":"2.1"}]\n```');
    expect(out[0].ref).toBe("2.1");
  });

  it("recovers an array wrapped in prose", () => {
    const out = parseJsonArray('Here you go:\n[{"ref":"3"}]\nHope that helps!');
    expect(out).toHaveLength(1);
  });

  it("tolerates trailing commas", () => {
    const out = parseJsonArray('[{"ref":"a"},{"ref":"b"},]');
    expect(out).toHaveLength(2);
  });

  it("salvages complete objects from a truncated response", () => {
    // Second object is cut off mid-string; first should survive.
    const truncated = '[{"ref":"1","requirement":"ok"},{"ref":"2","requi';
    const out = parseJsonArray(truncated);
    expect(out).toHaveLength(1);
    expect(out[0].ref).toBe("1");
  });

  it("throws a clear error on non-JSON prose", () => {
    expect(() => parseJsonArray("I could not read the document.")).toThrow();
  });
});

describe("structureWithoutAI", () => {
  it("splits clause-numbered lines into rows with refs", () => {
    const rows = structureWithoutAI(
      "1. First requirement\n2.1 Second requirement continued\nmore text",
    );
    expect(rows.length).toBe(2);
    expect(rows[0].ref).toBe("1");
    expect(rows[1].requirement).toContain("more text");
  });

  it("merges lines with no clause markers into a single row", () => {
    const rows = structureWithoutAI(
      "this line is long enough\nmore context here\nanother sufficiently long line",
    );
    expect(rows.length).toBe(1);
    expect(rows[0].requirement).toContain("this line is long enough");
    expect(rows[0].requirement).toContain("another sufficiently long line");
  });
});

describe("validateAndMap", () => {
  it("coerces unknown categories to Other and flags English-in-Thai-doc rows", () => {
    const rows = validateAndMap(
      [
        { ref: "1", requirement: "ระบบต้องใช้ PLC", category: "Control/PLC" },
        { ref: "2", requirement: "The system must comply", category: "Bogus" },
      ],
      false,
    );
    expect(rows[0].category).toBe("Control/PLC");
    expect(rows[0]._warn).toBe(false); // Thai → not flagged
    expect(rows[1].category).toBe("Other"); // invalid → Other
    expect(rows[1]._warn).toBe(true); // all-English → flagged as maybe translated
  });

  it("only keeps translations when translation mode is on", () => {
    const items = [{ ref: "1", requirement: "x", translation: "y" }];
    expect(validateAndMap(items, false)[0].translation).toBe("");
    expect(validateAndMap(items, true)[0].translation).toBe("y");
  });
});

describe("isLikelyTranslated", () => {
  it("is true for all-English text and false for Thai", () => {
    expect(isLikelyTranslated("The control system")).toBe(true);
    expect(isLikelyTranslated("ระบบควบคุม")).toBe(false);
    expect(isLikelyTranslated("")).toBe(false);
  });
});
