import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  normalizeRow,
  normalizeRows,
  matrixToJson,
  matrixFromJson,
  readLocal,
  writeLocal,
  clearLocal,
  STORAGE_KEY,
} from "./storage";
import { mkRow } from "./constants";

describe("normalizeRow", () => {
  it("keeps valid fields and assigns a fresh string id", () => {
    const r = normalizeRow({
      ref: "3.2",
      requirement: "must comply",
      category: "Control/PLC",
      status: "partial",
      remarks: "note",
    });
    expect(r).toMatchObject({
      ref: "3.2",
      requirement: "must comply",
      category: "Control/PLC",
      status: "partial",
      remarks: "note",
    });
    expect(typeof r.id).toBe("string");
    expect(r.id.length).toBeGreaterThan(0);
  });

  it("coerces an invalid status/category and stringifies fields", () => {
    const r = normalizeRow({ ref: 5, requirement: null, category: "Nonsense", status: "bogus" });
    expect(r.status).toBe("comply");
    expect(r.category).toBe("Other");
    expect(r.ref).toBe("5");
    expect(r.requirement).toBe("");
  });

  it("gives fresh, unique ids to each imported row", () => {
    const rows = normalizeRows([{ requirement: "a" }, { requirement: "b" }]);
    expect(rows).toHaveLength(2);
    expect(rows[0].id).not.toBe(rows[1].id);
  });

  it("normalizeRows returns [] for non-arrays", () => {
    expect(normalizeRows(null)).toEqual([]);
    expect(normalizeRows("nope")).toEqual([]);
  });
});

describe("matrixToJson / matrixFromJson", () => {
  it("round-trips project and row content (ids are regenerated)", () => {
    const rows = [mkRow({ ref: "1", requirement: "x", status: "notcomply" })];
    const parsed = matrixFromJson(matrixToJson("Site A", rows, []));
    expect(parsed.project).toBe("Site A");
    expect(parsed.rows[0]).toMatchObject({ ref: "1", requirement: "x", status: "notcomply" });
  });

  it("throws on non-JSON and on a file without rows", () => {
    expect(() => matrixFromJson("not json")).toThrow();
    expect(() => matrixFromJson('{"project":"x"}')).toThrow();
  });
});

describe("localStorage autosave", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });

  it("writes and reads back the working state", () => {
    const rows = [mkRow({ ref: "1", requirement: "hi" })];
    writeLocal({ project: "P", rows, lib: [], showTr: true, showCat: false });
    const back = readLocal();
    expect(back?.project).toBe("P");
    expect(back?.rows?.[0]).toMatchObject({ ref: "1", requirement: "hi" });
    expect(back?.showTr).toBe(true);
    expect(back?.showCat).toBe(false);
  });

  it("returns null when nothing is stored, and clearLocal wipes it", () => {
    expect(readLocal()).toBeNull();
    writeLocal({ project: "P", rows: [mkRow({})], lib: [], showTr: false, showCat: true });
    expect(readLocal()).not.toBeNull();
    clearLocal();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
