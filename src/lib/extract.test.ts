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

describe("structureWithoutAI (one line = one row)", () => {
  it("makes each line its own row and reads ASCII clause refs", () => {
    const rows = structureWithoutAI(
      "1. First requirement\n2.1 Second requirement\nmore text",
    );
    expect(rows.length).toBe(3);
    expect(rows[0].ref).toBe("1");
    expect(rows[1].ref).toBe("2.1");
    expect(rows[2].ref).toBe("CL-003"); // no clause number → auto ref
    expect(rows[2].requirement).toBe("more text");
  });

  it("recognizes Thai-numeral clause refs (regression: the ๓.๑๑.๒.๒ merge)", () => {
    const rows = structureWithoutAI(
      "- มีระบบ Surge Protection เพื่อป้องกันฟ้าผ่า ไม่ต่ำกว่า ๑๐ kV\n" +
        "๓.๑๑.๒.๒ อุปกรณ์ตรวจวัดค่าสถานะการทำงานเครื่องสูบน้ำ",
    );
    expect(rows.length).toBe(2); // the two lines must NOT merge
    expect(rows[0].requirement).toContain("Surge Protection");
    expect(rows[1].ref).toBe("๓.๑๑.๒.๒");
    expect(rows[1].requirement).toContain("อุปกรณ์ตรวจวัด");
  });

  it("reads ข้อ, parenthesized, and Thai dotted refs", () => {
    const rows = structureWithoutAI("ข้อ ๕ blah\n(๑) item\n๒.๑) wrapped");
    expect(rows[0].ref).toBe("๕");
    expect(rows[1].ref).toBe("๑");
    expect(rows[2].ref).toBe("๒.๑");
  });

  it("skips page-break markers and blank lines", () => {
    const rows = structureWithoutAI("a line\n\n--- PAGE BREAK ---\nb line");
    expect(rows.length).toBe(2);
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
