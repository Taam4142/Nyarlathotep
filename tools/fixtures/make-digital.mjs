import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs";
import zlib from "zlib";

const FONT_PATH = "C:/Windows/Fonts/THSarabunNew.ttf";
const FONT_BOLD_PATH = "C:/Windows/Fonts/THSarabunNew Bold.ttf";

const A4 = [595.28, 841.89];

async function main() {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fs.readFileSync(FONT_PATH), { subset: true });
  const fontBold = await doc.embedFont(fs.readFileSync(FONT_BOLD_PATH), { subset: true });

  const black = rgb(0.1, 0.1, 0.1);
  const gray = rgb(0.4, 0.4, 0.4);
  const navy = rgb(0.1, 0.15, 0.4);

  // ---------- PAGE 1: title + clause list (tests ref-style detection) ----------
  {
    const page = doc.addPage(A4);
    let y = 780;
    const left = 55;

    page.drawText("ตัวอย่างเอกสาร TOR — ระบบควบคุมอาคารอัตโนมัติ", {
      x: left, y, size: 18, font: fontBold, color: navy,
    });
    y -= 22;
    page.drawText("(Sample TOR — Building Automation Control System)", {
      x: left, y, size: 13, font, color: gray,
    });
    y -= 18;
    page.drawText(
      "สำหรับทดสอบเครื่องมือ Nyarlathotep เท่านั้น ไม่ใช่เอกสารของโครงการจริง",
      { x: left, y, size: 11, font, color: gray },
    );
    y -= 14;
    page.drawText(
      "(Synthetic test fixture for the Nyarlathotep tool only — not a real project document.)",
      { x: left, y, size: 11, font, color: gray },
    );
    y -= 40;

    page.drawText("3. ข้อกำหนดทางเทคนิค (Technical Requirements)", {
      x: left, y, size: 15, font: fontBold, color: black,
    });
    y -= 30;

    // Each clause tests a different ref-numbering style the row-splitter
    // regex has to recognize (Arabic, Thai numeral, "ข้อ N", "(N)", nested).
    const clauses = [
      "3.1 The control system shall use a PLC of a well-known brand with local support, and shall support Modbus TCP/IP communication.",
      "๓.๒ ระบบต้องได้รับการรับรองมาตรฐาน IP54 กันน้ำและฝุ่นสำหรับตู้ควบคุมที่ติดตั้งภายนอกอาคาร",
      "3.3 หน้าจอ HMI ต้องมีขนาดไม่น้อยกว่า 10 นิ้ว และรองรับการแสดงผลภาษาไทยและภาษาอังกฤษ",
      "ข้อ 4 อุปกรณ์ไฟฟ้าทั้งหมดต้องผ่านการรับรองมาตรฐาน มอก. หรือมาตรฐานสากลเทียบเท่า",
      "(5) The contractor shall provide complete as-built drawings within 30 days of project completion.",
      "๖. ระบบเครือข่ายต้องรองรับโปรโตคอล Modbus TCP/IP และ MQTT สำหรับการเชื่อมต่อ SCADA",
      "๖.๑๑.๒ จุดต่อสายดินของตู้ควบคุมทุกจุดต้องมีค่าความต้านทานไม่เกิน 5 โอห์ม",
    ];
    for (const c of clauses) {
      const lines = wrapText(c, font, 12, 480);
      for (const line of lines) {
        page.drawText(line, { x: left, y, size: 12, font, color: black });
        y -= 18;
      }
      y -= 8;
    }
  }

  // ---------- PAGE 2: multi-column equipment table ----------
  {
    const page = doc.addPage(A4);
    let y = 780;
    const left = 55;

    page.drawText("4. ตารางรายการอุปกรณ์ (Equipment Schedule)", {
      x: left, y, size: 15, font: fontBold, color: black,
    });
    y -= 34;

    // Fixed column x-positions, repeated identically per row — this is what
    // src/lib/tables.ts's detectColumnBoundaries needs to recognize a table
    // (a boundary must recur across >=2 aligned rows).
    const col1 = left;        // ลำดับ / Item No.
    const col2 = left + 60;   // รายละเอียด / Description
    const col3 = left + 290;  // มาตรฐาน/ยี่ห้อ / Standard-Brand

    const header = ["ลำดับ", "รายละเอียด", "มาตรฐาน/ยี่ห้อ"];
    page.drawText(header[0], { x: col1, y, size: 12, font: fontBold, color: black });
    page.drawText(header[1], { x: col2, y, size: 12, font: fontBold, color: black });
    page.drawText(header[2], { x: col3, y, size: 12, font: fontBold, color: black });
    y -= 6;
    page.drawLine({ start: { x: left, y }, end: { x: 540, y }, thickness: 1, color: gray });
    y -= 20;

    const rows = [
      ["1", "ตู้ควบคุม MDB ขนาด 400A", "Siemens หรือเทียบเท่า"],
      ["2", "PLC Controller 32 I/O", "Siemens S7-1200 series"],
      ["3", "HMI Touch Screen 10 นิ้ว", "Weintek หรือเทียบเท่า"],
      ["4", "Circuit Breaker 3P 100A", "Schneider Electric"],
      ["5", "สาย Cable Modbus RS485", "Belden 3106A หรือเทียบเท่า"],
    ];
    for (const [a, b, c] of rows) {
      page.drawText(a, { x: col1, y, size: 12, font, color: black });
      page.drawText(b, { x: col2, y, size: 12, font, color: black });
      page.drawText(c, { x: col3, y, size: 12, font, color: black });
      y -= 24;
    }

    y -= 20;
    page.drawText("5. เงื่อนไขการรับประกัน (Warranty Terms)", {
      x: left, y, size: 15, font: fontBold, color: black,
    });
    y -= 30;
    const warranty = wrapText(
      "5.1 ผู้รับเหมาต้องรับประกันอุปกรณ์และการติดตั้งเป็นระยะเวลาไม่น้อยกว่า 2 ปี นับจากวันส่งมอบงาน",
      font, 12, 480,
    );
    for (const line of warranty) {
      page.drawText(line, { x: left, y, size: 12, font, color: black });
      y -= 18;
    }
  }

  // ---------- PAGE 3: vector diagram + embedded image (for Snip testing) ----------
  {
    const page = doc.addPage(A4);
    let y = 780;
    const left = 55;

    page.drawText("6. แผนผังระบบ (System Diagram)", {
      x: left, y, size: 15, font: fontBold, color: black,
    });
    y -= 26;
    const intro = wrapText(
      "ผู้รับเหมาต้องติดตั้งระบบตามแผนผังเส้นเดี่ยว (single-line diagram) ด้านล่างนี้ และรูปถ่ายห้องไฟฟ้าเดิมประกอบการพิจารณา",
      font, 12, 480,
    );
    for (const line of intro) {
      page.drawText(line, { x: left, y, size: 12, font, color: black });
      y -= 18;
    }
    y -= 20;

    // Vector "single-line diagram": a main panel box, three breaker boxes,
    // and connecting lines. Pure vector drawing -- no embedded image object,
    // which is exactly the case the deterministic column-image extractors
    // would miss and Snip (crops the rendered page) is designed to catch.
    const diagTop = y;
    const mainX = 230, mainY = diagTop - 50, mainW = 140, mainH = 44;
    page.drawRectangle({
      x: mainX, y: mainY, width: mainW, height: mainH,
      borderColor: black, borderWidth: 1.5, color: rgb(0.93, 0.95, 1),
    });
    page.drawText("MAIN PANEL", {
      x: mainX + 18, y: mainY + 16, size: 11, font: fontBold, color: black,
    });

    const breakerY = mainY - 110;
    const breakerXs = [left + 20, left + 190, left + 360];
    const labels = ["MCB-1\n100A", "MCB-2\n63A", "MCB-3\n32A"];
    breakerXs.forEach((bx, i) => {
      page.drawRectangle({
        x: bx, y: breakerY, width: 110, height: 50,
        borderColor: black, borderWidth: 1.2, color: rgb(1, 1, 1),
      });
      const parts = labels[i].split("\n");
      page.drawText(parts[0], { x: bx + 14, y: breakerY + 30, size: 10, font: fontBold, color: black });
      page.drawText(parts[1], { x: bx + 14, y: breakerY + 14, size: 10, font, color: gray });
      // connecting line from main panel down to this breaker
      page.drawLine({
        start: { x: mainX + mainW / 2, y: mainY },
        end: { x: bx + 55, y: breakerY + 50 },
        thickness: 1.2, color: black,
      });
    });

    // A small embedded raster image (simulates a site photo) placed beside
    // the diagram -- tests Snip cropping an actual embedded image object too.
    const photoPng = makePhotoPlaceholderPng();
    const img = await doc.embedPng(photoPng);
    const imgY = breakerY - 150;
    page.drawImage(img, { x: left, y: imgY, width: 160, height: 120 });
    page.drawText("รูป: ห้องไฟฟ้าเดิม (existing electrical room)", {
      x: left, y: imgY - 16, size: 10, font, color: gray,
    });
  }

  const bytes = await doc.save();
  fs.writeFileSync("TOR-Sample-Digital.pdf", bytes);
  console.log("wrote TOR-Sample-Digital.pdf,", bytes.length, "bytes");
}

// Simple word-wrap using the font's actual measured width (mixed Thai/Latin
// safe enough for this fixture -- Thai has no spaces, so long unbroken Thai
// runs are wrapped at the nearest space anyway; good enough for a test PDF).
function wrapText(text, font, size, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? cur + " " + w : w;
    if (font.widthOfTextAtSize(trial, size) > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = trial;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// A tiny, deterministic "photo" PNG built from raw pixel bytes + zlib, so no
// browser/canvas dependency is needed to embed a plausible placeholder image.
function makePhotoPlaceholderPng() {
  const w = 160, h = 120;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  let p = 0;
  for (let yy = 0; yy < h; yy++) {
    raw[p++] = 0; // filter byte
    for (let xx = 0; xx < w; xx++) {
      // simple gradient + a darker "panel" rectangle to look photo-ish
      const inPanel = xx > 30 && xx < 130 && yy > 30 && yy < 90;
      const base = 150 + Math.floor((xx / w) * 60);
      raw[p++] = inPanel ? 60 : base;
      raw[p++] = inPanel ? 65 : base + 10;
      raw[p++] = inPanel ? 70 : base + 30;
    }
  }
  const idat = zlib.deflateSync(raw);
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeData = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeData), 0);
    return Buffer.concat([len, typeData, crc]);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

let CRC_TABLE;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

main().catch((e) => { console.error(e); process.exit(1); });
