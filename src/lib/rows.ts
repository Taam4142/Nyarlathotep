import type { Row } from "./types";

// Pure array operations for the matrix rows. The UI calls these by row `id`
// (never by on-screen index) so they stay correct even when the table shows a
// filtered subset. All return a new array and never mutate the input.

export function indexOfId(rows: Row[], id: Row["id"]): number {
  return rows.findIndex((r) => r.id === id);
}

/** Insert `newRow` immediately after the row with `afterId` (append if not found). */
export function insertAfterId(rows: Row[], afterId: Row["id"], newRow: Row): Row[] {
  const i = indexOfId(rows, afterId);
  if (i < 0) return [...rows, newRow];
  return [...rows.slice(0, i + 1), newRow, ...rows.slice(i + 1)];
}

/** Move row `fromId` to occupy the position of `toId`. No-op if either is missing or equal. */
export function reorderByIds(
  rows: Row[],
  fromId: Row["id"],
  toId: Row["id"],
): Row[] {
  const from = indexOfId(rows, fromId);
  const to = indexOfId(rows, toId);
  if (from < 0 || to < 0 || from === to) return rows;
  const next = [...rows];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Move a row one step up (-1) or down (+1). No-op at the edges. */
export function moveByOffset(rows: Row[], id: Row["id"], dir: -1 | 1): Row[] {
  const i = indexOfId(rows, id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= rows.length) return rows;
  const next = [...rows];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
