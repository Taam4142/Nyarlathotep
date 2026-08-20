import { describe, it, expect } from "vitest";
import {
  hasThaiNumeral,
  countThaiNumeralRows,
  browserOcrWarning,
} from "./ocrtrust";

describe("hasThaiNumeral", () => {
  it("finds Thai numerals", () => {
    expect(hasThaiNumeral("อุปกรณ์อิเล็กทรอนิกส์ที่ระดับ IP ๖๘")).toBe(true);
    expect(hasThaiNumeral("๓.๑๑.๒.๑")).toBe(true);
  });

  it("does not fire on Arabic digits or Thai letters alone", () => {
    // Arabic digits are not the failure mode being warned about, and Thai
    // consonants sit in the same block as the numerals — U+0E50 is the floor.
    expect(hasThaiNumeral("Power Input 24 VDC")).toBe(false);
    expect(hasThaiNumeral("ผู้รับจ้างต้องจัดหา")).toBe(false);
    expect(hasThaiNumeral("")).toBe(false);
  });
});

describe("countThaiNumeralRows", () => {
  it("counts only the rows holding a Thai numeral", () => {
    const rows = [
      { requirement: "- จอแสดงภาพขนาดไม่น้อยกว่า ๔๐ นิ้ว" },
      { requirement: "- สามารถต่อสายอากาศภายนอกได้" },
      { requirement: "- มีอัตราส่วนภาพ ๑๖:๙" },
    ];
    expect(countThaiNumeralRows(rows)).toBe(2);
  });

  it("tolerates rows with no requirement text", () => {
    expect(countThaiNumeralRows([{}, { requirement: undefined }])).toBe(0);
  });
});

describe("browserOcrWarning", () => {
  it("names the count and the failure mode when numerals are present", () => {
    const w = browserOcrWarning([{ requirement: "IP ๖๘" }, { requirement: "x" }]);
    expect(w).toContain("1 row contains a Thai numeral");
    expect(w).toContain("๔ and ๕");
    expect(w).toContain("Typhoon");
  });

  it("pluralizes", () => {
    const w = browserOcrWarning([{ requirement: "๖๘" }, { requirement: "๓๐๔" }]);
    expect(w).toContain("2 rows contain Thai numerals");
  });

  it("omits the value warning entirely when no numerals were read", () => {
    // No numerals means nothing for this warning to point at; the structural
    // caveat still applies.
    const w = browserOcrWarning([{ requirement: "no digits here" }]);
    expect(w).not.toContain("⚠");
    expect(w).toContain("split heuristically");
  });
});
