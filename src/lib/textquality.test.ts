import { describe, it, expect } from "vitest";
import { assessTextQuality } from "./textquality";

describe("assessTextQuality", () => {
  it("accepts normal Thai text", () => {
    const q = assessTextQuality(
      "๓.๑ ระบบควบคุมต้องใช้ PLC ยี่ห้อ Siemens รุ่น S7-1500 พร้อมจอ HMI",
    );
    expect(q.usable).toBe(true);
  });

  it("accepts normal English text", () => {
    expect(
      assessTextQuality("3.1 The control system shall use a Siemens S7-1500 PLC.")
        .usable,
    ).toBe(true);
  });

  it("rejects empty or near-empty text", () => {
    expect(assessTextQuality("").usable).toBe(false);
    expect(assessTextQuality("   \n\t ").usable).toBe(false);
    expect(assessTextQuality("hi").usable).toBe(false); // < 8 chars
  });

  it("rejects replacement-character-heavy text (broken encoding)", () => {
    const q = assessTextQuality("���� ก���� ���ม���� ����");
    expect(q.usable).toBe(false);
    expect(q.reason).toMatch(/unreadable/);
  });

  it("rejects symbol/gibberish text with almost no letters", () => {
    const q = assessTextQuality("◊◊◊ |¶§ ™•—– …▯▯▯ ‡‡ ¤¤¤ ‰‰");
    expect(q.usable).toBe(false);
    expect(q.reason).toMatch(/garbled/);
  });

  it("tolerates a little punctuation/whitespace noise", () => {
    expect(
      assessTextQuality("ข้อ ๕.๒  —  อุปกรณ์ต้องได้มาตรฐาน IP54 (กันน้ำ/ฝุ่น)").usable,
    ).toBe(true);
  });
});
