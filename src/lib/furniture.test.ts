import { describe, it, expect } from "vitest";
import { isPageFurniture, countPageFurniture } from "./furniture";

describe("isPageFurniture", () => {
  // Lines taken verbatim from a real scanned AMR TOR, OCR damage included.
  it("catches signature blocks", () => {
    expect(isPageFurniture("ลงชื่อ(22โช.กรรมการ                    PIE Ta")).toBe(true);
    expect(isPageFurniture("ลงชื่อ.......1 “๕๑.ประธานกรรมการ")).toBe(true);
    expect(isPageFurniture("VR Ea ๑๓...-ประธานกรรมการ")).toBe(true);
  });

  it("catches a role trailer even with OCR damage", () => {
    // "ปรัสสานกรรมาร" is what one scan produced for "ประธานกรรมการ".
    expect(isPageFurniture("AER, ไดแรตัตธีรยบ๓.ปรัสสานกรรมาร")).toBe(true);
  });

  it("catches centred page numbers", () => {
    expect(isPageFurniture("ta                              -๑๕-")).toBe(true);
    expect(isPageFurniture("-๑๕-")).toBe(true);
    expect(isPageFurniture("He            -@๓ญ่-")).toBe(true);
  });

  it("keeps real requirements, including short ones", () => {
    expect(isPageFurniture("- Power Input ๒๔ VDC")).toBe(false);
    expect(isPageFurniture("- มีอัตราส่วนภาพ ๑๖:๙")).toBe(false);
    expect(isPageFurniture("ตู้อุปกรณ์")).toBe(false);
    expect(isPageFurniture("๒. งานผิวทาง")).toBe(false);
    expect(isPageFurniture("๓.๑๑.๒.๑ เครื่องวัดระดับน้ำพร้อมอุปกรณ์ประกอบและติดตั้ง")).toBe(false);
  });

  it("does NOT drop a requirement that merely mentions a committee", () => {
    // The role trailer is anchored to the end for exactly this reason: a
    // requirement referring to a committee carries on past the word.
    expect(
      isPageFurniture("- ต้องได้รับอนุมัติจากคณะกรรมการตรวจรับพัสดุก่อนดำเนินการ"),
    ).toBe(false);
  });

  it("ignores blank lines", () => {
    expect(isPageFurniture("   ")).toBe(false);
  });
});

describe("countPageFurniture", () => {
  it("counts furniture lines and skips page breaks", () => {
    const raw = [
      "๓.๑๑.๒.๑ เครื่องวัดระดับน้ำพร้อมอุปกรณ์",
      "- Power Input ๒๔ VDC",
      "ลงชื่อ.......ประธานกรรมการ",
      "--- PAGE BREAK ---",
      "ta            -๑๕-",
      "",
    ].join("\n");
    expect(countPageFurniture(raw)).toBe(2);
  });
it('never drops a line that opens a clause ref or bullet, however short', () => {
    // Structure beats length. A page number written as '- 1 -' is
    // indistinguishable from a bullet, so it deliberately survives.
    expect(isPageFurniture("๓.๑ a")).toBe(false);
    expect(isPageFurniture("๒.๑) ผิวทาง")).toBe(false);
    expect(isPageFurniture("- 1 -")).toBe(false);
  });
});
