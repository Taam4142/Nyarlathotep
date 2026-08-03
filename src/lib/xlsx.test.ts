import { describe, it, expect } from "vitest";
import { matrixToWorkbook, matrixFilename } from "./xlsx";
import { mkRow } from "./constants";

function headerRowNumber(ws: any): number {
  let n = 0;
  ws.eachRow((row: any, num: number) => {
    if (row.getCell(1).value === "Item No.") n = num;
  });
  return n;
}

describe("matrixToWorkbook", () => {
  const rows = [
    mkRow({ ref: "3.2", requirement: "ระบบต้องใช้ PLC", status: "comply", category: "Control/PLC" }),
    mkRow({ ref: "3.3", requirement: "HMI panel", status: "notcomply", category: "Electrical" }),
  ];

  it("writes a header row and data rows with the correct values", () => {
    const ws = matrixToWorkbook({ rows, project: "Site A", showTr: false, showCat: true }).worksheets[0];
    const h = headerRowNumber(ws);
    expect(h).toBeGreaterThan(0);
    const first = ws.getRow(h + 1);
    expect(first.getCell(1).value).toBe(1); // item no
    expect(first.getCell(2).value).toBe("3.2"); // ref
    expect(first.getCell(3).value).toBe("ระบบต้องใช้ PLC"); // verbatim requirement
    expect(first.getCell(4).value).toBe("Control/PLC"); // category (showCat)
    expect(first.getCell(5).value).toBe("Comply"); // status label
  });

  it("sets a Thai-capable font on data cells and colours the status cell", () => {
    const ws = matrixToWorkbook({ rows, project: "", showTr: false, showCat: false }).worksheets[0];
    const h = headerRowNumber(ws);
    const dataCell = ws.getRow(h + 1).getCell(3); // requirement
    expect(dataCell.font?.name).toBe("TH Sarabun New");
    // No category → status is column 4; it gets a coloured, bold font.
    const statusCell = ws.getRow(h + 2).getCell(4); // row 2 = notcomply
    expect(statusCell.value).toBe("Not Comply");
    expect(statusCell.font?.bold).toBe(true);
    expect(statusCell.font?.color?.argb).toMatch(/^FF[0-9A-F]{6}$/);
  });

  it("adds the translation column only when requested and present", () => {
    const withTr = [mkRow({ requirement: "x", translation: "y" })];
    const ws = matrixToWorkbook({ rows: withTr, project: "", showTr: true, showCat: false }).worksheets[0];
    const h = headerRowNumber(ws);
    expect(ws.getRow(h).getCell(4).value).toBe("English Translation");
    expect(ws.getRow(h + 1).getCell(4).value).toBe("y");
  });

  it("pre-fills the Verified By and Date columns", () => {
    const ws = matrixToWorkbook({
      rows,
      project: "",
      showTr: false,
      showCat: false,
      verifiedBy: "  J. Reviewer  ",
      date: "2026-08-03",
    }).worksheets[0];
    const h = headerRowNumber(ws);
    // With no translation/category: status=4, remarks=5, verified=6, date=7.
    expect(ws.getRow(h).getCell(6).value).toBe("Verified By");
    expect(ws.getRow(h).getCell(7).value).toBe("Date");
    const first = ws.getRow(h + 1);
    expect(first.getCell(6).value).toBe("J. Reviewer"); // trimmed
    expect(first.getCell(7).value).toBe("2026-08-03");
  });

  it("leaves Verified By blank when not provided, and Date defaults to today", () => {
    const ws = matrixToWorkbook({ rows, project: "", showTr: false, showCat: false }).worksheets[0];
    const h = headerRowNumber(ws);
    const first = ws.getRow(h + 1);
    expect(first.getCell(6).value === "" || first.getCell(6).value == null).toBe(true);
    expect(String(first.getCell(7).value)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("filename sanitizes the project and appends the date", () => {
    expect(matrixFilename("Pump / Station")).toMatch(/^Pump_Station_Compliance_Matrix_\d{4}-\d{2}-\d{2}\.xlsx$/);
    expect(matrixFilename("")).toMatch(/^TOR_Compliance_Matrix_/);
  });
});
