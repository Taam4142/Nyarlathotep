import ExcelJS from "exceljs";
import type { Row } from "./types";
import { STATUS_LABELS, STAT_COLORS } from "./constants";

// F2: export the compliance matrix with ExcelJS so we can set a Thai-capable
// font per cell. The free SheetJS build can't write cell styles, which is why
// Thai showed as boxes until the user manually changed the column font. Here we
// set "TH Sarabun New" on every cell up front, so Thai renders on open.
// (A font can't be *embedded* in .xlsx — Excel substitutes if it isn't
// installed — but this removes the manual step for the common case.)

const THAI_FONT = "TH Sarabun New";
const today = () => new Date().toISOString().slice(0, 10);

function argb(hex: string): string {
  return "FF" + hex.replace("#", "").toUpperCase();
}

const THIN = { style: "thin" as const, color: { argb: "FFD5D9E0" } };
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };

export interface ExportOpts {
  rows: Row[];
  project: string;
  showTr: boolean;
  showCat: boolean;
  /** Reviewer name pre-filled into the "Verified By" column (editable in Excel). */
  verifiedBy?: string;
  /** Date pre-filled into the "Date" column; defaults to today (YYYY-MM-DD). */
  date?: string;
}

export function matrixFilename(project: string): string {
  const name = (project || "TOR").replace(/[^\w.\-ก-๙]+/g, "_");
  return `${name}_Compliance_Matrix_${today()}.xlsx`;
}

/** Build the compliance-matrix workbook (Thai-capable fonts set per cell). */
export function matrixToWorkbook(opts: ExportOpts): ExcelJS.Workbook {
  const { rows, project } = opts;
  const showTr = opts.showTr && rows.some((r) => r.translation);
  const showCat = opts.showCat;
  const verifiedBy = opts.verifiedBy?.trim() || "";
  const date = opts.date || today();

  const wb = new ExcelJS.Workbook();
  wb.creator = "Nyarlathotep";
  wb.created = new Date();
  const ws = wb.addWorksheet((project || "TOR").slice(0, 30));

  // Column widths, in order.
  const widths = [8, 12, 65];
  if (showTr) widths.push(55);
  if (showCat) widths.push(14);
  widths.push(18, 55, 16, 12);
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  const ncol = widths.length;
  const statusCol = 3 + (showTr ? 1 : 0) + (showCat ? 1 : 0) + 1;

  // Title block.
  const title = ws.addRow([project || "TOR Compliance Matrix"]);
  title.getCell(1).font = { name: THAI_FONT, size: 16, bold: true };
  ws.mergeCells(title.number, 1, title.number, ncol);
  const sub = ws.addRow([`Compliance Matrix — generated ${today()}`]);
  sub.getCell(1).font = { name: THAI_FONT, size: 11, color: { argb: "FF8A8A8A" } };
  ws.mergeCells(sub.number, 1, sub.number, ncol);
  ws.addRow([]); // spacer

  // Header row.
  const headerLabels = ["Item No.", "Reference", "Requirement / Specification"];
  if (showTr) headerLabels.push("English Translation");
  if (showCat) headerLabels.push("Category");
  headerLabels.push("Compliance Status", "Remarks", "Verified By", "Date");
  const header = ws.addRow(headerLabels);
  header.height = 22;
  header.eachCell((c) => {
    c.font = { name: THAI_FONT, size: 13, bold: true };
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF1F6" } };
    c.border = BORDER;
  });
  ws.views = [{ state: "frozen", ySplit: header.number }];

  // Data rows.
  rows.forEach((row, i) => {
    const arr: (string | number)[] = [i + 1, row.ref, row.requirement];
    if (showTr) arr.push(row.translation);
    if (showCat) arr.push(row.category);
    arr.push(STATUS_LABELS[row.status] || row.status, row.remarks, verifiedBy, date);
    const r = ws.addRow(arr);
    r.font = { name: THAI_FONT, size: 14 };
    r.alignment = { vertical: "top", wrapText: true };
    r.eachCell({ includeEmpty: true }, (c) => (c.border = BORDER));
    // Colour-code the status cell text (comply green / partial amber / …).
    const sc = r.getCell(statusCol);
    sc.font = {
      name: THAI_FONT,
      size: 14,
      bold: true,
      color: { argb: argb(STAT_COLORS[row.status] || "#5c6480") },
    };
    sc.alignment = { vertical: "top", horizontal: "center" };
    r.getCell(1).alignment = { vertical: "top", horizontal: "center" };
  });

  return wb;
}

/** Build the workbook and trigger a browser download. */
export async function downloadMatrix(opts: ExportOpts): Promise<void> {
  const wb = matrixToWorkbook(opts);
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = matrixFilename(opts.project);
  a.click();
  URL.revokeObjectURL(url);
}
