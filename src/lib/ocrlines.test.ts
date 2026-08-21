import { describe, it, expect } from "vitest";
import { collectOcrLines, joinOcrLines, pageTextFromOcr } from "./ocrlines";

const line = (text: string, x0: number, y0: number, x1: number) => ({
  text,
  bbox: { x0, y0, x1, y1: y0 + 20 },
});

describe("collectOcrLines", () => {
  it("descends blocks → paragraphs → lines", () => {
    const blocks = [
      { paragraphs: [{ lines: [line("a", 0, 0, 10), line("b", 0, 20, 10)] }] },
      { paragraphs: [{ lines: [line("c", 0, 40, 10)] }] },
    ];
    expect(collectOcrLines(blocks).map((l) => l.text)).toEqual(["a", "b", "c"]);
  });

  it("returns nothing for absent or shapeless input", () => {
    // `blocks` is null unless the caller asks for it — the common case.
    expect(collectOcrLines(null)).toEqual([]);
    expect(collectOcrLines(undefined)).toEqual([]);
    expect(collectOcrLines([{ paragraphs: [{ lines: [{ text: "no bbox" }] }] }])).toEqual([]);
  });
});

describe("joinOcrLines", () => {
  it("rejoins a line that ran to the right margin", () => {
    const lines = [
      line("- ต้องมีคุณสมบัติตามมาตรฐานที่ใช้วัดความสามารถในการปกป้องสิ่งที่อยู่ภายในของ", 60, 100, 940),
      line("อุปกรณ์อิเล็กทรอนิกส์ที่ระดับ IP ๖๘", 60, 120, 300),
    ];
    expect(joinOcrLines(lines)).toEqual([
      "- ต้องมีคุณสมบัติตามมาตรฐานที่ใช้วัดความสามารถในการปกป้องสิ่งที่อยู่ภายในของ อุปกรณ์อิเล็กทรอนิกส์ที่ระดับ IP ๖๘",
    ]);
  });

  it("keeps consecutive bullets apart", () => {
    // The guard that the real AMR document forced; bullets are separate
    // requirements however full the line above them is.
    const lines = [
      line("- มีช่องต่อสัญญาณภาพแบบ HDMI อย่างน้อย ๑ ช่อง และ DisplayPort อย่างน้อย ๑ ช่อง", 60, 100, 940),
      line("- มีความละเอียด ๔,๐๙๖ x ๒,๑๖๐ พิกเซล เป็นอย่างน้อย", 60, 120, 500),
    ];
    expect(joinOcrLines(lines)).toHaveLength(2);
  });

  it("strips the trailing newline tesseract puts on each line", () => {
    const lines = [line("alpha beta\n", 60, 100, 940), line("gamma\n", 60, 120, 200)];
    expect(joinOcrLines(lines)).toEqual(["alpha beta gamma"]);
  });

  it("drops blank lines", () => {
    expect(joinOcrLines([line("   \n", 0, 0, 10)])).toEqual([]);
  });
});

describe("pageTextFromOcr", () => {
  it("falls back to flat text when no line geometry is present", () => {
    // Losing the rejoining is untidy; losing the text would be a correctness bug.
    expect(pageTextFromOcr({ text: "raw text", blocks: null })).toBe("raw text");
    expect(pageTextFromOcr({ text: "raw text" })).toBe("raw text");
  });

  it("uses the geometry when it is present", () => {
    const blocks = [
      {
        paragraphs: [
          { lines: [line("wrapped line running to margin", 60, 100, 940), line("continues", 60, 120, 200)] },
        ],
      },
    ];
    expect(pageTextFromOcr({ text: "ignored", blocks })).toBe(
      "wrapped line running to margin continues",
    );
  });
});
