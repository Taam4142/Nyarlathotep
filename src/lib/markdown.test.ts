import { describe, it, expect } from "vitest";
import { looksLikeMarkdown, stripMarkdown, cleanModelMarkdown } from "./markdown";
import { matchClauseRef } from "./clauseref";

describe("looksLikeMarkdown", () => {
  it("recognises headings and bold as proof of Markdown mode", () => {
    expect(looksLikeMarkdown("#### ๓.๑.๓ แผนผัง")).toBe(true);
    expect(looksLikeMarkdown("* **ระบบไฟฟ้า** ๓๘๐/๒๒๐ โวลท์")).toBe(true);
  });

  it("does NOT treat a lone asterisk or dash as proof", () => {
    // This is the whole point: a leading `*` alone is not evidence of Markdown,
    // because it might simply be what the document says.
    expect(looksLikeMarkdown("* หมายเหตุ: ตรวจสอบก่อนติดตั้ง")).toBe(false);
    expect(looksLikeMarkdown("- จอแสดงภาพขนาดไม่น้อยกว่า ๔๐ นิ้ว")).toBe(false);
  });
});

describe("stripMarkdown", () => {
  it("removes heading markers", () => {
    expect(stripMarkdown("#### ๓.๑.๓ แผนผังการวาง", false)).toBe("๓.๑.๓ แผนผังการวาง");
    expect(stripMarkdown("## ๓. ข้อกำหนดเฉพาะงาน", false)).toBe("๓. ข้อกำหนดเฉพาะงาน");
  });

  it("unwraps bold but keeps the words", () => {
    expect(stripMarkdown("**ระบบไฟฟ้า** ๓๘๐/๒๒๐ โวลท์", false)).toBe("ระบบไฟฟ้า ๓๘๐/๒๒๐ โวลท์");
    expect(stripMarkdown("**a** and **b**", false)).toBe("a and b");
  });

  it("leaves a dash bullet completely alone", () => {
    // Real TORs write bullets with a dash; 145 rows of the measured document did.
    const line = "- จอแสดงภาพขนาดไม่น้อยกว่า ๔๐ นิ้ว";
    expect(stripMarkdown(line, true)).toBe(line);
  });

  it("does NOT rewrite an asterisk bullet unless allowed", () => {
    // The safety property: with no document-level evidence, the line is untouched.
    const line = "* หมายเหตุ: ตรวจสอบก่อนติดตั้ง";
    expect(stripMarkdown(line, false)).toBe(line);
  });

  it("rewrites an asterisk bullet to a dash when allowed", () => {
    expect(stripMarkdown("* ส่วนประกอบแต่ละชิ้น", true)).toBe("- ส่วนประกอบแต่ละชิ้น");
  });

  it("leaves a stray or mid-line asterisk alone", () => {
    // Only a marker at the START of a line is a bullet. An asterisk inside the
    // text is content — a footnote pointer, a units note — and must survive.
    expect(stripMarkdown("ขนาด ๒ * ๓ เมตร", true)).toBe("ขนาด ๒ * ๓ เมตร");
    expect(stripMarkdown("ดูหมายเหตุ *", true)).toBe("ดูหมายเหตุ *");
    // A single unpaired ** is not a bold span.
    expect(stripMarkdown("ราคา ** บาท", true)).toBe("ราคา ** บาท");
  });

  it("does not mistake a hash without a space for a heading", () => {
    expect(stripMarkdown("#1 ตำแหน่ง", false)).toBe("#1 ตำแหน่ง");
  });
});

describe("cleanModelMarkdown", () => {
  it("recovers clause refs that heading markers had hidden", () => {
    // The actual defect: 24 rows of a real 24-page TOR lost their reference
    // because `matchClauseRef` needs the line to START with the number.
    const raw = "#### ๓.๑.๓ แผนผังการวางรูปแบบแปลนของบ่อสูบน้ำ";
    expect(matchClauseRef(raw)).toBeNull();
    expect(matchClauseRef(cleanModelMarkdown(raw))).toBe("๓.๑.๓");
  });

  it("preserves line count exactly", () => {
    // The row splitter downstream is line-based; losing or adding a line here
    // would silently change the matrix.
    const raw = ["## ๓. งาน", "", "* หนึ่ง", "- สอง", "**สาม**"].join("\n");
    expect(cleanModelMarkdown(raw).split("\n")).toHaveLength(5);
  });

  it("applies the bullet rewrite across a document that proves Markdown mode", () => {
    // One heading anywhere is enough to explain every asterisk in the response.
    const raw = ["#### ๓.๖.๒ ตู้ไฟฟ้า", "* สายไฟฟ้า เฟส A: ใช้สีดำ"].join("\n");
    expect(cleanModelMarkdown(raw)).toBe(["๓.๖.๒ ตู้ไฟฟ้า", "- สายไฟฟ้า เฟส A: ใช้สีดำ"].join("\n"));
  });

  it("leaves asterisks alone in a document with no other Markdown", () => {
    // Same input minus the heading: nothing proves Markdown mode, so the
    // asterisk is treated as something the source actually says.
    const raw = ["๓.๖.๒ ตู้ไฟฟ้า", "* สายไฟฟ้า เฟส A: ใช้สีดำ"].join("\n");
    expect(cleanModelMarkdown(raw)).toBe(raw);
  });
});
