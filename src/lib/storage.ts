import type { Row, LibItem, Status } from "./types";
import { mkRow, VALID_CATS } from "./constants";

// Persistence (F1). Autosaves the working matrix to localStorage (survives a
// refresh) and supports explicit Save/Load as a JSON file. Loaded rows are
// normalized and given fresh UUID ids, so a saved session never collides with
// the current one and a hand-edited/corrupt file can't inject bad state.

export const STORAGE_KEY = "nyarlathotep:matrix:v1";
export const SCHEMA_VERSION = 1;

const VALID_STATUS: Status[] = ["comply", "partial", "notcomply", "na"];

export interface Snapshot {
  version: number;
  savedAt: string;
  project: string;
  verifiedBy: string;
  rows: Row[];
  lib: LibItem[];
  showTr: boolean;
  showCat: boolean;
}

/** Coerce an untrusted row-like object into a valid Row with a fresh id. */
export function normalizeRow(r: any): Row {
  const status: Status = VALID_STATUS.includes(r?.status) ? r.status : "comply";
  const category = VALID_CATS.includes(r?.category)
    ? r.category
    : r?.category
      ? "Other"
      : "General";
  return mkRow({
    ref: String(r?.ref ?? ""),
    requirement: String(r?.requirement ?? ""),
    translation: String(r?.translation ?? ""),
    category,
    status,
    remarks: String(r?.remarks ?? ""),
    _warn: !!r?._warn,
  });
}

export function normalizeRows(arr: any): Row[] {
  return Array.isArray(arr) ? arr.map(normalizeRow) : [];
}

function normalizeLib(arr: any): LibItem[] | null {
  if (!Array.isArray(arr)) return null;
  const out: LibItem[] = arr
    .filter((x) => x && typeof x.text === "string")
    .map((x) => ({
      id: typeof x.id === "string" ? x.id : crypto.randomUUID(),
      label: String(x.label ?? "Untitled"),
      status: VALID_STATUS.includes(x.status) ? x.status : "comply",
      text: String(x.text),
    }));
  return out.length ? out : null;
}

// ----- localStorage autosave -----

export function readLocal(): Partial<Snapshot> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || typeof o !== "object" || !Array.isArray(o.rows)) return null;
    return {
      project: typeof o.project === "string" ? o.project : "",
      verifiedBy: typeof o.verifiedBy === "string" ? o.verifiedBy : "",
      rows: normalizeRows(o.rows),
      lib: normalizeLib(o.lib) ?? undefined,
      showTr: !!o.showTr,
      showCat: o.showCat !== false, // default on
    };
  } catch {
    return null;
  }
}

export function writeLocal(
  s: Omit<Snapshot, "version" | "savedAt" | "verifiedBy"> & { verifiedBy?: string },
): void {
  try {
    const snap: Snapshot = {
      version: SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      verifiedBy: "",
      ...s,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
  } catch {
    /* quota exceeded / storage disabled → skip silently */
  }
}

export function clearLocal(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

// ----- explicit Save / Load as a JSON file -----

export function matrixToJson(
  project: string,
  rows: Row[],
  lib: LibItem[],
  verifiedBy = "",
): string {
  return JSON.stringify(
    { version: SCHEMA_VERSION, savedAt: new Date().toISOString(), project, verifiedBy, rows, lib },
    null,
    2,
  );
}

export function matrixFromJson(text: string): {
  project: string;
  verifiedBy: string;
  rows: Row[];
  lib: LibItem[] | null;
} {
  let o: any;
  try {
    o = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  if (!o || typeof o !== "object" || !Array.isArray(o.rows))
    throw new Error("This doesn't look like a saved matrix (no “rows” array).");
  return {
    project: typeof o.project === "string" ? o.project : "",
    verifiedBy: typeof o.verifiedBy === "string" ? o.verifiedBy : "",
    rows: normalizeRows(o.rows),
    lib: normalizeLib(o.lib),
  };
}
