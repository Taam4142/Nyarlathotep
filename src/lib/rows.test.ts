import { describe, it, expect } from "vitest";
import { insertAfterId, reorderByIds, moveByOffset, indexOfId } from "./rows";
import type { Row } from "./types";

const mk = (id: string): Row => ({
  id,
  ref: "",
  requirement: "",
  translation: "",
  category: "General",
  status: "comply",
  remarks: "",
  _warn: false,
});

describe("row ops", () => {
  const rows = [mk("a"), mk("b"), mk("c")];
  const ids = (rs: Row[]) => rs.map((r) => r.id);

  it("indexOfId finds by id", () => {
    expect(indexOfId(rows, "b")).toBe(1);
    expect(indexOfId(rows, "z")).toBe(-1);
  });

  it("insertAfterId inserts after the matching id", () => {
    expect(ids(insertAfterId(rows, "b", mk("x")))).toEqual(["a", "b", "x", "c"]);
    expect(ids(insertAfterId(rows, "a", mk("x")))).toEqual(["a", "x", "b", "c"]);
  });

  it("insertAfterId appends when the id is not found", () => {
    expect(ids(insertAfterId(rows, "z", mk("x")))).toEqual(["a", "b", "c", "x"]);
  });

  it("reorderByIds moves a row to another's position", () => {
    expect(ids(reorderByIds(rows, "a", "c"))).toEqual(["b", "c", "a"]);
    expect(ids(reorderByIds(rows, "c", "a"))).toEqual(["c", "a", "b"]);
  });

  it("reorderByIds is a no-op for equal or missing ids (same reference)", () => {
    expect(reorderByIds(rows, "a", "a")).toBe(rows);
    expect(reorderByIds(rows, "a", "z")).toBe(rows);
  });

  it("moveByOffset moves up/down and clamps at the edges", () => {
    expect(ids(moveByOffset(rows, "b", -1))).toEqual(["b", "a", "c"]);
    expect(ids(moveByOffset(rows, "b", 1))).toEqual(["a", "c", "b"]);
    expect(moveByOffset(rows, "a", -1)).toBe(rows); // already top
    expect(moveByOffset(rows, "c", 1)).toBe(rows); // already bottom
  });

  it("never mutates the input array", () => {
    const before = ids(rows);
    insertAfterId(rows, "b", mk("x"));
    reorderByIds(rows, "a", "c");
    moveByOffset(rows, "b", 1);
    expect(ids(rows)).toEqual(before);
  });
});
