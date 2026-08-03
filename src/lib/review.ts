import type { Row } from "./types";

// Pure helpers for the review-speed tools (F5): text search across a row, and
// near-duplicate detection by normalized requirement text. Kept UI-free and
// unit-tested, per the "pure, testable core" rule.

/** Case-insensitive substring match over a row's ref / requirement / translation / remarks. */
export function matchesQuery(row: Row, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    (row.ref || "").toLowerCase().includes(q) ||
    (row.requirement || "").toLowerCase().includes(q) ||
    (row.translation || "").toLowerCase().includes(q) ||
    (row.remarks || "").toLowerCase().includes(q)
  );
}

/** Normalize requirement text for duplicate grouping (collapse whitespace, lowercase). */
export function normalizeReq(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Ids of rows whose requirement text is identical (after normalization) to at
 * least one other row's. Blank requirements are ignored (a batch of empty rows
 * isn't a "duplicate" worth flagging).
 */
export function findDuplicateIds(rows: Row[]): Set<string> {
  const groups = new Map<string, string[]>();
  for (const r of rows) {
    const key = normalizeReq(r.requirement);
    if (!key) continue;
    const arr = groups.get(key);
    if (arr) arr.push(r.id);
    else groups.set(key, [r.id]);
  }
  const dup = new Set<string>();
  for (const ids of groups.values()) {
    if (ids.length > 1) ids.forEach((id) => dup.add(id));
  }
  return dup;
}
