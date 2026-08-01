import { describe, it, expect } from "vitest";
import { extractTyphoonText } from "./typhoon";
import { structureWithoutAI } from "./extract";

describe("extractTyphoonText", () => {
  it("unwraps natural_text and restores real newlines", () => {
    const envelope = JSON.stringify({ natural_text: "line one\nline two\nline three" });
    const out = extractTyphoonText(envelope);
    expect(out).toBe("line one\nline two\nline three");
    expect(out).toContain("\n");
    expect(out).not.toContain("\\n"); // no literal backslash-n survives
  });

  it("handles an envelope wrapped in ```json fences", () => {
    const fenced = '```json\n{"natural_text": "a\\nb"}\n```';
    expect(extractTyphoonText(fenced)).toBe("a\nb");
  });

  it("returns plain text unchanged when there is no envelope", () => {
    expect(extractTyphoonText("- just some OCR text\n- second line")).toBe(
      "- just some OCR text\n- second line",
    );
  });

  it("salvages natural_text from a truncated / prose-wrapped response", () => {
    const messy = 'Sure! {"natural_text": "salvaged\\nvalue" and then it cut off';
    expect(extractTyphoonText(messy)).toBe("salvaged\nvalue");
  });
});

describe("Typhoon envelope → structureWithoutAI (the reported bug)", () => {
  // A representative slice of the real typhoon-ocr response the user pasted.
  const raw =
    '{"natural_text": "-๑๗-\\n\\n- จอแสดงภาพขนาดไม่น้อยกว่า ๔๐ นิ้ว\\n- มีช่องต่อสัญญาณภาพแบบ HDMI อย่างน้อย ๑ ช่อง และ DisplayPort อย่างน้อย ๑ ช่อง\\n- มีความละเอียด ๔,๐๙๖ x ๒,๑๖๐ พิกเซล เป็นอย่างน้อย\\n- มีอัตราส่วนภาพ ๑๖:๙\\n\\n๓.๑๑.๒.๑ เครื่องวัดระดับน้ำพร้อมอุปกรณ์\\n- เครื่องวัดระดับอัตโนมัติ เป็นแบบหลักการ Radar ย่าน ๘๐ GHZ Technology\\n- สามารถวัดระดับน้ำได้ ๐-๑๕ เมตร หรือดีกว่า\\n- Power Input ๒๔ VDC"}';

  it("splits into many rows instead of one blob", () => {
    const text = extractTyphoonText(raw);
    const rows = structureWithoutAI(text);
    // Before the fix this produced a single row containing the raw JSON with
    // literal \n symbols. Now each bullet becomes its own row.
    expect(rows.length).toBeGreaterThanOrEqual(6);
  });

  it("produces rows free of the JSON envelope and literal newlines", () => {
    const text = extractTyphoonText(raw);
    const rows = structureWithoutAI(text);
    const joined = rows.map((r) => r.requirement).join(" ");
    expect(joined).not.toContain("natural_text");
    expect(joined).not.toContain("\\n");
    expect(joined).toContain("จอแสดงภาพขนาดไม่น้อยกว่า");
  });
});
