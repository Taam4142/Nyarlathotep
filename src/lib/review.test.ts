import { describe, it, expect } from "vitest";
import { matchesQuery, normalizeReq, findDuplicateIds } from "./review";
import { mkRow } from "./constants";

describe("matchesQuery", () => {
  const row = mkRow({
    ref: "3.11",
    requirement: "ระบบต้องรองรับ IP54",
    translation: "System shall support IP54",
    remarks: "vendor confirms",
  });

  it("empty query matches everything", () => {
    expect(matchesQuery(row, "")).toBe(true);
    expect(matchesQuery(row, "   ")).toBe(true);
  });

  it("matches ref, requirement, translation and remarks, case-insensitively", () => {
    expect(matchesQuery(row, "3.11")).toBe(true);
    expect(matchesQuery(row, "ip54")).toBe(true); // translation, lowercased
    expect(matchesQuery(row, "IP54")).toBe(true); // requirement
    expect(matchesQuery(row, "CONFIRMS")).toBe(true); // remarks
    expect(matchesQuery(row, "ระบบ")).toBe(true); // Thai requirement
  });

  it("returns false when nothing matches", () => {
    expect(matchesQuery(row, "9.99")).toBe(false);
    expect(matchesQuery(row, "nonsense")).toBe(false);
  });
});

describe("normalizeReq", () => {
  it("collapses whitespace and lowercases", () => {
    expect(normalizeReq("  The   System \n shall ")).toBe("the system shall");
  });
});

describe("findDuplicateIds", () => {
  it("flags rows with the same normalized requirement", () => {
    const a = mkRow({ requirement: "PLC shall be Siemens" });
    const b = mkRow({ requirement: "plc   shall be   siemens" }); // same after normalize
    const c = mkRow({ requirement: "Unique requirement" });
    const dup = findDuplicateIds([a, b, c]);
    expect(dup.has(a.id)).toBe(true);
    expect(dup.has(b.id)).toBe(true);
    expect(dup.has(c.id)).toBe(false);
    expect(dup.size).toBe(2);
  });

  it("flags all members of a group of three", () => {
    const rows = [
      mkRow({ requirement: "same" }),
      mkRow({ requirement: "same" }),
      mkRow({ requirement: "same" }),
    ];
    expect(findDuplicateIds(rows).size).toBe(3);
  });

  it("ignores blank requirements", () => {
    const rows = [mkRow({ requirement: "" }), mkRow({ requirement: "  " })];
    expect(findDuplicateIds(rows).size).toBe(0);
  });
});
