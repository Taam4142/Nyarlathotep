import { describe, it, expect } from "vitest";
import { insertAfterId, reorderByIds, moveByOffset, indexOfId } from "./rows";
import type { Row } from "./types";

const mk = (id: number): Row => ({
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
  const rows = [mk(1), mk(2), mk(3)];
  const ids = (rs: Row[]) => rs.map((r) => r.id);

  it("indexOfId finds by id", () => {
    expect(indexOfId(rows, 2)).toBe(1);
    expect(indexOfId(rows, 99)).toBe(-1);
  });

  it("insertAfterId inserts after the matching id", () => {
    expect(ids(insertAfterId(rows, 2, mk(99)))).toEqual([1, 2, 99, 3]);
    expect(ids(insertAfterId(rows, 1, mk(99)))).toEqual([1, 99, 2, 3]);
  });

  it("insertAfterId appends when the id is not found", () => {
    expect(ids(insertAfterId(rows, 42, mk(99)))).toEqual([1, 2, 3, 99]);
  });

  it("reorderByIds moves a row to another's position", () => {
    expect(ids(reorderByIds(rows, 1, 3))).toEqual([2, 3, 1]);
    expect(ids(reorderByIds(rows, 3, 1))).toEqual([3, 1, 2]);
  });

  it("reorderByIds is a no-op for equal or missing ids (same reference)", () => {
    expect(reorderByIds(rows, 1, 1)).toBe(rows);
    expect(reorderByIds(rows, 1, 99)).toBe(rows);
  });

  it("moveByOffset moves up/down and clamps at the edges", () => {
    expect(ids(moveByOffset(rows, 2, -1))).toEqual([2, 1, 3]);
    expect(ids(moveByOffset(rows, 2, 1))).toEqual([1, 3, 2]);
    expect(moveByOffset(rows, 1, -1)).toBe(rows); // already top
    expect(moveByOffset(rows, 3, 1)).toBe(rows); // already bottom
  });

  it("never mutates the input array", () => {
    const before = ids(rows);
    insertAfterId(rows, 2, mk(99));
    reorderByIds(rows, 1, 3);
    moveByOffset(rows, 2, 1);
    expect(ids(rows)).toEqual(before);
  });
});
