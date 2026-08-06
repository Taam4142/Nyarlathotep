import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { PDFDocument } from "pdf-lib";
import fs from "fs";

const FONT_PATH = "C:/Windows/Fonts/THSarabunNew.ttf";
const FONT_BOLD_PATH = "C:/Windows/Fonts/THSarabunNew Bold.ttf";

GlobalFonts.registerFromPath(FONT_PATH, "TH Sarabun New");
GlobalFonts.registerFromPath(FONT_BOLD_PATH, "TH Sarabun New Bold");

// Render one "page" of a TOR as a raster image (no text layer at all) --
// simulates a scanned document for testing the OCR path (Typhoon / Browser
// OCR) and the "scanned PDF detected" UI branch. This is a CLEAN synthetic
// render, not a real scan -- it proves the pipeline runs end-to-end, but
// (unlike a real scan) has none of the noise/skew/artifacts that make real
// OCR hard, so it doesn't validate OCR accuracy the way a genuine scanned
// TOR would.
const W = 1240, H = 1754; // ~150dpi A4
const canvas = createCanvas(W, H);
const ctx = canvas.getContext("2d");

ctx.fillStyle = "#ffffff";
ctx.fillRect(0, 0, W, H);
ctx.fillStyle = "#1a1a1a";

let y = 110;
const left = 100;

ctx.font = "bold 40px 'TH Sarabun New Bold'";
ctx.fillText("ตัวอย่างเอกสาร TOR (ฉบับสแกน) — งานระบบไฟฟ้า", left, y);
y += 40;
ctx.font = "26px 'TH Sarabun New'";
ctx.fillText("(Sample TOR, scanned-style — Electrical Works)", left, y);
y += 30;
ctx.fillText("สำหรับทดสอบเครื่องมือ Nyarlathotep เท่านั้น ไม่ใช่เอกสารของโครงการจริง", left, y);
y += 70;

ctx.font = "bold 30px 'TH Sarabun New Bold'";
ctx.fillText("2. ขอบเขตงาน (Scope of Work)", left, y);
y += 50;

const lines = [
  "2.1 ผู้รับเหมาต้องติดตั้งตู้ควบคุมไฟฟ้าตามแบบที่กำหนด พร้อมทดสอบระบบก่อนส่งมอบ",
  "2.2 The contractor shall supply and install all cabling per the approved drawings.",
  "๒.๓ อุปกรณ์ป้องกันไฟฟ้าลัดวงจรต้องเป็นไปตามมาตรฐาน IEC หรือเทียบเท่า",
  "ข้อ 3 งานทดสอบระบบต้องมีรายงานผลการทดสอบเป็นลายลักษณ์อักษร",
  "(4) All work shall be completed within 90 days of the notice to proceed.",
];
ctx.font = "28px 'TH Sarabun New'";
for (const line of lines) {
  ctx.fillText(line, left, y);
  y += 46;
}

const buf = await canvas.encode("png");
fs.writeFileSync("scanned-page-debug.png", buf);
console.log("rendered canvas PNG:", buf.length, "bytes");

// Wrap the raster image as a PDF page with NO text objects -- this is what
// makes detectPDFType() correctly classify it as "scanned" (pdf.js finds no
// extractable text layer), forcing the OCR path.
const doc = await PDFDocument.create();
const img = await doc.embedPng(buf);
const page = doc.addPage([595.28, 841.89]); // A4 in points
page.drawImage(img, { x: 0, y: 0, width: 595.28, height: 841.89 });

const pdfBytes = await doc.save();
fs.writeFileSync("TOR-Sample-Scanned.pdf", pdfBytes);
console.log("wrote TOR-Sample-Scanned.pdf,", pdfBytes.length, "bytes");
