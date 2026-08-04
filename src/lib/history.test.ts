import { describe, it, expect } from "vitest";
import { emptyUndo, record, undo, redo, canUndo, canRedo } from "./history";

describe("history (undo/redo core)", () => {
  it("records snapshots and reports availability", () => {
    let s = emptyUndo<number>();
    expect(canUndo(s)).toBe(false);
    s = record(s, 1);
    s = record(s, 2);
    expect(canUndo(s)).toBe(true);
    expect(s.undo).toEqual([1, 2]);
    expect(s.redo).toEqual([]);
  });

  it("undo restores the last snapshot and moves current to redo", () => {
    // present = 3, undo stack holds [1,2]
    let s: ReturnType<typeof emptyUndo<number>> = { undo: [1, 2], redo: [] };
    const r = undo(s, 3)!;
    expect(r.restore).toBe(2);
    expect(r.next.undo).toEqual([1]);
    expect(r.next.redo).toEqual([3]);
  });

  it("redo re-applies and moves current back to undo", () => {
    let s = { undo: [1], redo: [3] };
    const r = redo(s, 2)!;
    expect(r.restore).toBe(3);
    expect(r.next.undo).toEqual([1, 2]);
    expect(r.next.redo).toEqual([]);
  });

  it("returns null when there is nothing to undo/redo", () => {
    expect(undo(emptyUndo<number>(), 5)).toBeNull();
    expect(redo(emptyUndo<number>(), 5)).toBeNull();
    expect(canRedo(emptyUndo())).toBe(false);
  });

  it("recording a new snapshot clears the redo stack", () => {
    const s = { undo: [1], redo: [3, 4] };
    expect(record(s, 2).redo).toEqual([]);
  });

  it("caps the undo stack at the limit (drops oldest)", () => {
    let s = emptyUndo<number>();
    for (let i = 1; i <= 5; i++) s = record(s, i, 3);
    expect(s.undo).toEqual([3, 4, 5]); // last 3 only
  });

  it("round-trips a full sequence", () => {
    // start present=A, edit to B, edit to C
    let s = emptyUndo<string>();
    s = record(s, "A"); // before →B
    s = record(s, "B"); // before →C   (present now C)
    let u = undo(s, "C")!; // → B
    expect(u.restore).toBe("B");
    u = undo(u.next, "B")!; // → A
    expect(u.restore).toBe("A");
    const re = redo(u.next, "A")!; // → B
    expect(re.restore).toBe("B");
  });
});
