// Carried over from the single-file app during the Vite + TypeScript migration.
// @ts-nocheck dropped 2026-08-07 (RISK_REVIEW / ROADMAP #5) — see CHANGELOG for the
// small set of real fixes that surfaced. Still loosely typed by design: tsconfig
// keeps `strict`/`noImplicitAny` off, so this checks structural mistakes (refs,
// state shape) rather than requiring every handler/prop to be annotated. Behavior
// is unchanged from the pre-migration app.
import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import type { CSSProperties } from "react";
import type { Status } from "./lib/types";
import {
  pdfjsLib,
  detectPDFType,
  rasterizePage,
  extractDigitalText,
} from "./lib/pdf";
import {
  ocrPDFTesseract,
  ocrPDFTyphoon,
  ocrPDFVision,
  ocrPageWithGemini,
} from "./lib/ocr";
import { browserOcrWarning } from "./lib/ocrtrust";
import {
  extractRequirements,
  extractWithGemini,
  structureWithoutAI,
  validateAndMap,
} from "./lib/extract";
import {
  CLAUDE_MODELS,
  GEMINI_MODELS,
  DEFAULT_CLAUDE_MODEL,
  DEFAULT_GEMINI_MODEL,
  TYPHOON_MODEL,
  claudeModelShort,
  EXTRACTION_ENGINES,
  OCR_FEEDERS,
} from "./lib/models";
import { fetchWithRetry } from "./lib/net";
import {
  MEDIA_COMPACT,
  MEDIA_PHONE,
  MEDIA_COARSE_POINTER,
} from "./lib/breakpoints";
import {
  DEFAULT_LIB,
  STATUS_OPTS,
  STATUS_LABELS,
  STAT_COLORS,
  VALID_CATS,
  mkRow,
} from "./lib/constants";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { insertAfterId, reorderByIds } from "./lib/rows";
import { assessTextQuality } from "./lib/textquality";
import { matchesQuery, findDuplicateIds } from "./lib/review";
import { displayRectToSource, normalizeDrag, cropToJpeg } from "./lib/snip";
import {
  emptyUndo,
  record as recordHistory,
  undo as undoHistory,
  redo as redoHistory,
  canUndo as histCanUndo,
  canRedo as histCanRedo,
} from "./lib/history";
import {
  readLocal,
  writeLocal,
  clearLocal,
  matrixToJson,
  matrixFromJson,
} from "./lib/storage";

/**
 * Subscribe to a CSS media query.
 *
 * The drawer needs this in JS as well as CSS because its *semantics* change
 * with width, not just its looks: below the compact breakpoint the sidebar is a
 * modal dialog (scrim, focus trap, Escape), and above it is just a column.
 * Applying dialog roles unconditionally would mislabel the desktop layout.
 * The query string comes from lib/breakpoints so it cannot drift from the CSS.
 */
function useMediaQuery(query) {
  // matchMedia is guarded rather than assumed: jsdom does not implement it, so
  // an unguarded call took down every App test at import time. Falling back to
  // false means "assume the desktop layout" — the safe default, since the
  // desktop path is the plain two-pane layout with no drawer semantics.
  const supported =
    typeof window !== "undefined" && typeof window.matchMedia === "function";
  const [matches, setMatches] = useState(
    () => (supported ? window.matchMedia(query).matches : false),
  );
  useEffect(() => {
    if (!supported) return;
    const mq = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    setMatches(mq.matches); // resync in case the width changed before we subscribed
    // addEventListener is the modern API; addListener is the deprecated one that
    // some older WebKit builds still only expose.
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener?.(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener?.(onChange);
    };
  }, [query, supported]);
  return matches;
}

// Full-screen "How to use" guide, opened from the top bar. Closes on the ✕, a
// backdrop click, or Escape. Pure content (no app state), so it lives at module
// level like SortableRow.
function HelpModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="help-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="How to use Nyarlathotep"
      onClick={onClose}
    >
      <div className="help-modal" onClick={(e) => e.stopPropagation()}>
        <div className="help-head">
          <div>
            <div className="help-title">How to use Nyarlathotep</div>
            <div className="help-sub">
              Turn a Thai / English TOR PDF into an editable compliance matrix,
              then export it as a signed-off Excel file.
            </div>
          </div>
          <button className="help-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="help-body">
          <div className="help-callout">
            <span className="help-callout-ico" aria-hidden="true">
              ⚖️
            </span>
            <div>
              <strong>The one rule.</strong> The tool copies requirement text{" "}
              <strong>verbatim</strong> — it never translates, paraphrases, or
              invents. You review every row and set its compliance status. Treat
              each extracted row as a draft to check against the original TOR.
            </div>
          </div>

          <div className="help-sec-title">The 5 steps</div>
          <ol className="help-steps">
            <li>
              <strong>Name your project</strong> in the top-left field — it becomes
              the Excel title and the file name.
            </li>
            <li>
              <strong>Pick an extraction engine</strong> from the top bar (guide
              below). <em>Typhoon</em> is the free, Thai-first default.
            </li>
            <li>
              <strong>Add your TOR PDF</strong> — drag it onto the box in the left
              sidebar (or click to browse), then press <em>Extract</em>.
            </li>
            <li>
              <strong>Review &amp; edit the matrix.</strong> Each row is one
              requirement. Check the text against the source, set the{" "}
              <em>Compliance Status</em>, and add <em>Remarks</em>.
            </li>
            <li>
              <strong>Export</strong> with <em>↓ Export .xlsx</em>. Thai is set to
              “TH Sarabun New” automatically — no font step needed.
            </li>
          </ol>

          <div className="help-sec-title">Extraction engines</div>
          <div className="help-engines">
            <div className="help-eng">
              <div className="help-eng-name">
                ✦ Typhoon
                <span className="help-tag help-tag-free">Free</span>
              </div>
              <div className="help-eng-desc">
                Thai-tuned OCR — the recommended default. No key needed from you
                (handled server-side). Rows are split automatically, so review the
                boundaries.
              </div>
            </div>
            <div className="help-eng">
              <div className="help-eng-name">
                🆓 Browser OCR
                <span className="help-tag help-tag-free">Free · Offline</span>
              </div>
              <div className="help-eng-desc">
                Runs in your browser — no key, works offline. Lower accuracy; a
                handy fallback.
              </div>
            </div>
            <div className="help-eng">
              <div className="help-eng-name">
                ✎ Text PDF
                <span className="help-tag">No AI · exact</span>
              </div>
              <div className="help-eng-desc">
                For <em>digital</em> PDFs (not scans): reads the embedded text
                layer directly — instant, lossless, column-aware. No OCR, no AI.
              </div>
            </div>
            <div className="help-eng">
              <div className="help-eng-name">
                ⚡ Claude
                <span className="help-tag help-tag-paid">Paid API</span>
              </div>
              <div className="help-eng-desc">
                Highest fidelity — Claude structures the clauses into rows. Best
                for messy or complex TORs.
              </div>
            </div>
            <div className="help-eng">
              <div className="help-eng-name">
                ✦ Gemini
                <span className="help-tag">Your key</span>
              </div>
              <div className="help-eng-desc">
                Good accuracy; you paste a Gemini key (kept in this tab only, never
                saved).
              </div>
            </div>
          </div>
          <div className="help-note">
            Digital PDF on Typhoon or Browser OCR? The tool automatically reads
            its exact text layer instead of running OCR (instant, lossless) — with
            a one-click “re-run with OCR” if the text looks off. Scanned PDF under
            Claude/Gemini? You'll also pick an OCR feeder (Typhoon, Google Vision,
            Tesseract…) to read the pages first.
          </div>

          <div className="help-sec-title">Editing the matrix</div>
          <ul className="help-list">
            <li>
              <strong>Status &amp; remarks</strong> — set each row's compliance
              status (Comply / Partial / Not Comply / N/A) and notes.
            </li>
            <li>
              <strong>Add · insert · reorder · delete</strong> — “+ Row” adds at
              the end; the “+” on a row inserts one below it; drag the grip in the
              number column to reorder; the trash icon deletes.
            </li>
            <li>
              <strong>Comply Library</strong> (left) — click a saved item to fill a
              standard response into the selected row (or every row of that
              status).
            </li>
            <li>
              <strong>Find · bulk-set · de-dupe</strong> — search rows by text,
              tick the checkboxes to set many rows' status at once, and watch for
              the “⧉ Duplicate” flag on repeated requirements.
            </li>
            <li>
              <strong>📷 Snip a figure</strong> — with a PDF loaded, click{" "}
              <em>Snip</em>, drag a box over any diagram / table / picture, and
              attach it to a row. The figure shows in the row and is embedded in
              the Excel export.
            </li>
            <li>
              <strong>↶ Undo / ↷ Redo</strong> — the buttons (top bar) or{" "}
              <em>Ctrl+Z</em> / <em>Ctrl+Y</em> reverse edits, bulk changes,
              deletes, reorders, snips, and even “New”. History lasts until you
              reload.
            </li>
            <li>
              <strong>Filters &amp; columns</strong> — filter rows by status, and
              toggle the Translation / Category columns on the toolbar.
            </li>
          </ul>

          <div className="help-sec-title">Saving your work</div>
          <ul className="help-list">
            <li>
              <strong>Autosave</strong> — your matrix is saved in this browser and
              restored when you reload.
            </li>
            <li>
              <strong>↓ Save .json / ↑ Load .json</strong> — keep a permanent copy,
              or move a matrix between computers.
            </li>
            <li>
              <strong>New</strong> — clear everything and start fresh (save first if
              you want to keep it).
            </li>
          </ul>
        </div>

        <div className="help-foot">
          <button className="btn btn-amber btn-sm" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

// "Snip from PDF": render the source PDF's pages and let the user drag a box
// over any figure (vector diagram, image-table, or photo) to crop it and attach
// it to a matrix row. Deterministic pixels — nothing invented. Module-level.
function SnipModal({ open, onClose, pdfFile, rows, selectedRow, onAttach }) {
  const [doc, setDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [pageImg, setPageImg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState(null);
  const [target, setTarget] = useState("new");
  const dragStart = useRef(null);
  const imgRef = useRef(null);

  // Load the PDF document when the modal opens.
  useEffect(() => {
    if (!open || !pdfFile) return;
    let cancelled = false;
    setDoc(null);
    setPageImg(null);
    setSel(null);
    setPageNum(1);
    setTarget(selectedRow || "new");
    (async () => {
      try {
        const buf = await pdfFile.arrayBuffer();
        const d = await pdfjsLib.getDocument({ data: buf }).promise;
        if (cancelled) return;
        setDoc(d);
        setNumPages(d.numPages);
      } catch {
        /* ignore — modal shows a load error state */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, pdfFile, selectedRow]);

  // Render the current page to an image whenever the page changes.
  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    setBusy(true);
    setSel(null);
    (async () => {
      try {
        const b64 = await rasterizePage(doc, pageNum, 2);
        if (!cancelled) setPageImg(`data:image/png;base64,${b64}`);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, pageNum]);

  // Escape to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const relPos = (e) => {
    const r = imgRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(r.width, e.clientX - r.left)),
      y: Math.max(0, Math.min(r.height, e.clientY - r.top)),
    };
  };
  const onDown = (e) => {
    if (!pageImg) return;
    e.preventDefault();
    const p = relPos(e);
    dragStart.current = p;
    setSel({ x: p.x, y: p.y, w: 0, h: 0 });
  };
  const onMove = (e) => {
    if (!dragStart.current) return;
    const p = relPos(e);
    const s = dragStart.current;
    setSel(normalizeDrag(s.x, s.y, p.x, p.y));
  };
  const onUp = () => {
    dragStart.current = null;
  };

  const canAttach = sel && sel.w > 4 && sel.h > 4 && !busy;
  const doAttach = async () => {
    if (!canAttach) return;
    const el = imgRef.current;
    const srcRect = displayRectToSource(
      sel,
      { w: el.clientWidth, h: el.clientHeight },
      { w: el.naturalWidth, h: el.naturalHeight },
    );
    const jpeg = await cropToJpeg(pageImg, srcRect, { maxDim: 1100, quality: 0.72 });
    onAttach(jpeg, target);
    onClose();
  };

  const rowLabel = (r, i) =>
    `${i + 1}. ${r.ref ? r.ref + " — " : ""}${(r.requirement || "").slice(0, 40) || "(blank)"}`;

  return (
    <div
      className="snip-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Snip a figure from the PDF"
    >
      <div className="snip-modal">
        <div className="snip-head">
          <div className="snip-title">📷 Snip a figure from the PDF</div>
          <div className="snip-hint">
            Drag a box over any diagram, table, or picture, then attach it to a
            row.
          </div>
          <button className="help-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="snip-stage">
          {busy && <div className="snip-loading">Rendering page…</div>}
          {pageImg && (
            <div
              className="snip-canvas"
              onMouseDown={onDown}
              onMouseMove={onMove}
              onMouseUp={onUp}
              onMouseLeave={onUp}
            >
              <img
                ref={imgRef}
                src={pageImg}
                className="snip-page"
                alt={`PDF page ${pageNum}`}
                draggable={false}
              />
              {sel && sel.w > 0 && (
                <div
                  className="snip-sel"
                  style={{
                    left: sel.x,
                    top: sel.y,
                    width: sel.w,
                    height: sel.h,
                  }}
                />
              )}
            </div>
          )}
        </div>

        <div className="snip-foot">
          <div className="snip-pager">
            <button
              className="btn btn-ghost btn-xs"
              onClick={() => setPageNum((n) => Math.max(1, n - 1))}
              disabled={pageNum <= 1 || busy}
            >
              ‹ Prev
            </button>
            <span className="snip-pageno">
              Page {pageNum} / {numPages || "…"}
            </span>
            <button
              className="btn btn-ghost btn-xs"
              onClick={() => setPageNum((n) => Math.min(numPages, n + 1))}
              disabled={pageNum >= numPages || busy}
            >
              Next ›
            </button>
          </div>
          <div className="snip-attach">
            <label className="snip-attach-lbl" htmlFor="snip-target-select">
              Attach to:
            </label>
            <select
              id="snip-target-select"
              className="model-sel"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              <option value="new">➕ New row</option>
              {rows.map((r, i) => (
                <option key={r.id} value={r.id}>
                  {rowLabel(r, i)}
                </option>
              ))}
            </select>
            <button
              className="btn btn-amber btn-sm"
              onClick={doAttach}
              disabled={!canAttach}
            >
              Attach figure
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// One matrix row, made sortable via @dnd-kit. The grip in the number cell is the
// only drag activator (so editing cell text still works); dragging is disabled
// when a status filter is active (reordering a subset can't map to hidden rows).
function SortableRow({
  row,
  index,
  showTr,
  showCat,
  selectedRow,
  setSelectedRow,
  upd,
  del,
  insertAfter,
  dragEnabled,
  selected,
  onToggleSelect,
  isDup,
  onZoomImage,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id, disabled: !dragEnabled });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: isDragging ? "relative" : undefined,
    zIndex: isDragging ? 2 : undefined,
  };
  return (
    <tr
      ref={setNodeRef}
      style={style}
      role="row"
      className={`${selectedRow === row.id ? "sel-row" : ""}${selected ? " bulk-row" : ""}`}
      onClick={() => setSelectedRow(selectedRow === row.id ? null : row.id)}
    >
      <td
        className="c-sel"
        role="cell"
        data-label="Select"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="td-p sel-cell">
          <input
            type="checkbox"
            className="row-check"
            checked={selected}
            onChange={() => onToggleSelect(row.id)}
            aria-label="Select row for bulk actions"
          />
        </div>
      </td>
      <td
        className="c-no"
        role="cell"
        data-label="#"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="td-p no-txt">
          {dragEnabled && (
            <button
              type="button"
              className="row-grip"
              ref={setActivatorNodeRef}
              {...attributes}
              {...listeners}
              onClick={(e) => e.stopPropagation()}
              title="Drag to reorder"
              aria-label="Drag to reorder"
            >
              ⠿
            </button>
          )}
          <span className="no-num">{index + 1}</span>
        </div>
      </td>
      <td
        className="c-ref"
        role="cell"
        data-label="Ref."
        onClick={(e) => e.stopPropagation()}
      >
        <div className="td-p">
          <input
            className="ref-in"
            value={row.ref}
            onChange={(e) => upd(row.id, "ref", e.target.value)}
            placeholder="CL-001"
            aria-label="Reference"
          />
        </div>
      </td>
      <td
        className="c-req"
        role="cell"
        data-label="Requirement"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="td-p">
          <textarea
            className="cell-in"
            value={row.requirement}
            onChange={(e) => upd(row.id, "requirement", e.target.value)}
            placeholder="Verbatim requirement text (Thai/English)…"
            rows={2}
            aria-label="Requirement text, verbatim"
          />
          {row._warn && (
            <div className="warn-flag">
              ⚠ May be translated — verify verbatim
            </div>
          )}
          {isDup && (
            <div className="dup-flag" title="Another row has identical requirement text">
              ⧉ Duplicate requirement
            </div>
          )}
          {row.image && (
            <div className="row-fig">
              <img
                src={row.image}
                className="row-fig-thumb"
                alt="Attached figure"
                title="Click to enlarge"
                onClick={(e) => {
                  e.stopPropagation();
                  onZoomImage(row.image);
                }}
              />
              <button
                className="row-fig-rm"
                onClick={(e) => {
                  e.stopPropagation();
                  upd(row.id, "image", undefined);
                }}
                title="Remove figure"
                aria-label="Remove figure"
              >
                × figure
              </button>
            </div>
          )}
        </div>
      </td>
      {showTr && (
        <td
        className="c-tr"
        role="cell"
        data-label="Translation"
        onClick={(e) => e.stopPropagation()}
      >
          <div className="td-p">
            <textarea
              className="cell-in"
              value={row.translation}
              onChange={(e) => upd(row.id, "translation", e.target.value)}
              placeholder="English translation…"
              rows={2}
              aria-label="English translation"
            />
          </div>
        </td>
      )}
      {showCat && (
        <td
        className="c-cat"
        role="cell"
        data-label="Category"
        onClick={(e) => e.stopPropagation()}
      >
          <div className="td-p">
            <select
              className="cat-sel"
              value={row.category}
              onChange={(e) => upd(row.id, "category", e.target.value)}
              aria-label="Category"
            >
              {VALID_CATS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </td>
      )}
      <td
        className="c-sts"
        role="cell"
        data-label="Status"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="td-p">
          <select
            className={`sts-sel sts-${row.status}`}
            value={row.status}
            onChange={(e) => upd(row.id, "status", e.target.value)}
            aria-label="Compliance status"
          >
            {STATUS_OPTS.map((o) => (
              <option key={o.v} value={o.v}>
                {o.l}
              </option>
            ))}
          </select>
        </div>
      </td>
      <td
        className="c-rem"
        role="cell"
        data-label="Remarks"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="td-p">
          <textarea
            className="cell-in"
            value={row.remarks}
            onChange={(e) => upd(row.id, "remarks", e.target.value)}
            placeholder="Standard response or notes…"
            rows={2}
            aria-label="Remarks"
          />
        </div>
      </td>
      <td
        className="c-del"
        role="cell"
        data-label="Actions"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="td-p row-actions">
          <button
            className="row-ins"
            onClick={() => insertAfter(row.id)}
            title="Insert row below"
            aria-label="Insert row below"
          >
            +
          </button>
          <button
            className="row-del"
            onClick={() => del(row.id)}
            title="Delete row"
            aria-label="Delete row"
          >
            ×
          </button>
        </div>
      </td>
    </tr>
  );
}

function App() {
        // Restore the last session from this browser (F1 persistence).
        const [persisted] = useState(() => readLocal());
        const [rows, setRows] = useState(() => persisted?.rows ?? []);
        const [lib, setLib] = useState(() => persisted?.lib ?? DEFAULT_LIB);
        const [loading, setLoading] = useState(false);
        const [loadMsg, setLoadMsg] = useState("");
        const [loadSub, setLoadSub] = useState("");
        const [loadPct, setLoadPct] = useState(null);
        const [error, setError] = useState(null);
        const [warning, setWarning] = useState(null);
        const [info, setInfo] = useState(null);
        const [pdfFile, setPdfFile] = useState(null);
        const [pdfType, setPdfType] = useState(null);
        const [model, setModel] = useState(DEFAULT_CLAUDE_MODEL);
        const [project, setProject] = useState(() => persisted?.project ?? "");
        const [verifiedBy, setVerifiedBy] = useState(
          () => persisted?.verifiedBy ?? "",
        );
        const [filter, setFilter] = useState("all");
        const [query, setQuery] = useState("");
        // Multi-row selection for bulk status-set (F5), by row id (filter-safe).
        const [selectedIds, setSelectedIds] = useState(() => new Set());
        const [hist, setHist] = useState(() => emptyUndo()); // undo/redo (F5)
        const [showTr, setShowTr] = useState(() => persisted?.showTr ?? false);
        const [showCat, setShowCat] = useState(() => persisted?.showCat ?? true);
        const [selectedRow, setSelectedRow] = useState(null);
        const [dragging, setDragging] = useState(false);
        const [showHelp, setShowHelp] = useState(false);
        const [showSnip, setShowSnip] = useState(false);
        const [lightbox, setLightbox] = useState(null); // data URL to enlarge
        // When the digital-PDF fast path used the text layer, holds the OCR
        // engine label to offer as a one-click "re-run with OCR" fallback.
        const [ocrFallback, setOcrFallback] = useState(null);
        const [showLibAdd, setShowLibAdd] = useState(false);
        const [newLib, setNewLib] = useState<{
          label: string;
          text: string;
          status: Status;
        }>({
          label: "",
          text: "",
          status: "comply",
        });
        const [ocrEngine, setOcrEngine] = useState("typhoon");
        const [aiEngine, setAiEngine] = useState("typhoon");
        const [geminiKey, setGeminiKey] = useState("");
        const [geminiModel, setGeminiModel] = useState(DEFAULT_GEMINI_MODEL);
        const fileRef = useRef<HTMLInputElement>(null);
        const tableRef = useRef<HTMLDivElement>(null);
        const abortRef = useRef(null);

        // ── Undo/redo (F5) ─────────────────────────────────────────────────
        // Snapshot = { rows, project, verifiedBy }. Discrete actions snapshot
        // their pre-state via commit(); text edits coalesce per (row, field) so
        // one edit is one undo. undoRef keeps the latest state for the keyboard
        // handler + the undo/redo actions without re-subscribing on every change.
        // Initialized from the real (already-typed) state values, not `{}`, so
        // `.hist`/`.rows`/`.project`/`.verifiedBy` are known properties below.
        const undoRef = useRef({ hist, rows, project, verifiedBy });
        undoRef.current = { hist, rows, project, verifiedBy };
        const lastEditKey = useRef(null);
        const snapNow = () => ({ rows, project, verifiedBy });
        const pushUndo = () => setHist((h) => recordHistory(h, snapNow()));
        const commit = () => {
          pushUndo();
          lastEditKey.current = null;
        };
        const applySnap = (s) => {
          setRows(s.rows);
          setProject(s.project);
          setVerifiedBy(s.verifiedBy);
          setSelectedIds(new Set());
          setSelectedRow(null);
          lastEditKey.current = null;
        };
        const doUndo = () => {
          const cur = undoRef.current;
          const r = undoHistory(cur.hist, {
            rows: cur.rows,
            project: cur.project,
            verifiedBy: cur.verifiedBy,
          });
          if (!r) return;
          setHist(r.next);
          applySnap(r.restore);
        };
        const doRedo = () => {
          const cur = undoRef.current;
          const r = redoHistory(cur.hist, {
            rows: cur.rows,
            project: cur.project,
            verifiedBy: cur.verifiedBy,
          });
          if (!r) return;
          setHist(r.next);
          applySnap(r.restore);
        };

        const upd = (id, f, v) => {
          // Coalesce a run of edits to the same cell into one undo entry.
          const key = `${id}:${f}`;
          if (lastEditKey.current !== key) {
            pushUndo();
            lastEditKey.current = key;
          }
          setRows((r) =>
            r.map((row) => (row.id === id ? { ...row, [f]: v } : row)),
          );
        };
        const del = (id) => {
          commit();
          setRows((r) => r.filter((row) => row.id !== id));
        };
        const addRow = () => {
          commit();
          const r = mkRow({
            ref: `CL-${String(rows.length + 1).padStart(3, "0")}`,
          });
          setRows((p) => [...p, r]);
          setTimeout(() => {
            const ta = tableRef.current?.querySelectorAll("textarea");
            if (ta && ta.length) ta[ta.length - 2]?.focus();
          }, 60);
        };
        // Attach a snipped figure to a row (or a new one). From SnipModal.
        const attachImage = (dataUrl, targetRowId) => {
          commit();
          if (targetRowId === "new") {
            setRows((p) => [
              ...p,
              mkRow({ ref: `FIG-${p.length + 1}`, image: dataUrl }),
            ]);
            setInfo(
              "Figure attached to a new row. It's kept in Save .json and the Excel export.",
            );
          } else {
            setRows((p) =>
              p.map((row) =>
                row.id === targetRowId ? { ...row, image: dataUrl } : row,
              ),
            );
            setInfo(
              "Figure attached. It shows in the row and in the Excel export.",
            );
          }
        };
        // Insert a blank row directly below `id`; it inherits the neighbor's
        // status so it stays visible even when a status filter is active.
        const insertAfter = (id) => {
          commit();
          setRows((p) => {
            const i = p.findIndex((row) => row.id === id);
            const nr = mkRow({ status: i >= 0 ? p[i].status : "comply" });
            return insertAfterId(p, id, nr);
          });
        };
        const sensors = useSensors(
          useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
          useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
          }),
        );
        const onDragEnd = (e) => {
          const { active, over } = e;
          if (over && active.id !== over.id) {
            commit();
            setRows((p) => reorderByIds(p, active.id, over.id));
          }
        };

        // Autosave the working matrix to this browser (debounced). F1 persistence.
        useEffect(() => {
          const t = setTimeout(
            () => writeLocal({ project, verifiedBy, rows, lib, showTr, showCat }),
            400,
          );
          return () => clearTimeout(t);
        }, [project, verifiedBy, rows, lib, showTr, showCat]);

        // Keyboard undo/redo. Skipped while a text field is focused so the
        // field's own native undo keeps working during typing.
        useEffect(() => {
          const onKey = (e) => {
            if (!(e.ctrlKey || e.metaKey)) return;
            const tag = (e.target?.tagName || "").toLowerCase();
            if (tag === "input" || tag === "textarea" || tag === "select") return;
            const k = (e.key || "").toLowerCase();
            if (k === "z" && !e.shiftKey) {
              e.preventDefault();
              doUndo();
            } else if (k === "y" || (k === "z" && e.shiftKey)) {
              e.preventDefault();
              doRedo();
            }
          };
          window.addEventListener("keydown", onKey);
          return () => window.removeEventListener("keydown", onKey);
          // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);

        // Escape closes the figure lightbox (matches HelpModal/SnipModal).
        useEffect(() => {
          if (!lightbox) return;
          const onKey = (e) => e.key === "Escape" && setLightbox(null);
          window.addEventListener("keydown", onKey);
          return () => window.removeEventListener("keydown", onKey);
        }, [lightbox]);

        // Tell the user once when a previous session was restored from this browser.
        useEffect(() => {
          if (persisted?.rows?.length)
            setInfo(
              `Restored your last session (${persisted.rows.length} row${persisted.rows.length === 1 ? "" : "s"}) — autosaved in this browser. Use “New” to start fresh.`,
            );
          // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);

        const jsonRef = useRef<HTMLInputElement>(null);
        const saveJson = () => {
          const blob = new Blob([matrixToJson(project, rows, lib, verifiedBy)], {
            type: "application/json",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          const name = (project || "matrix").replace(/[^\w.\-ก-๙]+/g, "_");
          a.download = `${name}-${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          URL.revokeObjectURL(url);
        };
        const loadJson = async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            const parsed = matrixFromJson(await file.text());
            commit();
            setRows(parsed.rows);
            setProject(parsed.project);
            setVerifiedBy(parsed.verifiedBy);
            if (parsed.lib) setLib(parsed.lib);
            setSelectedRow(null);
            setSelectedIds(new Set());
            setQuery("");
            setError(null);
            setInfo(
              `Loaded ${parsed.rows.length} row${parsed.rows.length === 1 ? "" : "s"} from ${file.name}.`,
            );
          } catch (err) {
            setError(err.message || "Could not load that file.");
          }
        };
        const clearAll = () => {
          if (
            rows.length &&
            !window.confirm(
              "Clear the current matrix? You can undo this (Ctrl+Z) until you reload — use “Save .json” to keep a permanent copy.",
            )
          )
            return;
          commit();
          setRows([]);
          setProject("");
          setVerifiedBy("");
          setSelectedRow(null);
          setSelectedIds(new Set());
          setQuery("");
          clearLocal();
        };

        const handleFile = useCallback(async (file) => {
          if (!file || file.type !== "application/pdf") {
            setError("Please select a PDF file.");
            return;
          }
          setPdfFile(file);
          setRows([]);
          setError(null);
          setWarning(null);
          setInfo(null);
          setOcrFallback(null);
          setSelectedIds(new Set());
          setQuery("");
          setPdfType(null);
          setLoading(true);
          setLoadMsg("Detecting PDF type...");
          setLoadSub("");
          setLoadPct(null);
          try {
            const type = await detectPDFType(file);
            setPdfType(type);
            if (type === "scanned") {
              setInfo(
                "Scanned PDF detected. Choose an OCR engine below, fill in credentials if needed, then click Extract.",
              );
            } else {
              setInfo("Digital PDF detected — ready for extraction.");
            }
          } catch (e) {
            setError(
              "Could not read PDF. Try re-saving as PDF/A or printing to PDF.",
            );
          } finally {
            setLoading(false);
          }
        }, []);

        const onDrop = useCallback(
          (e) => {
            e.preventDefault();
            setDragging(false);
            handleFile(e.dataTransfer.files[0]);
          },
          [handleFile],
        );

        const doExtract = async ({ forceOcr = false } = {}) => {
          if (!pdfFile) return;
          setLoading(true);
          setError(null);
          setWarning(null);
          setInfo(null);
          setOcrFallback(null);
          setSelectedIds(new Set());
          const ctrl = new AbortController();
          abortRef.current = ctrl;
          const signal = ctrl.signal;

          // Digital-PDF fast path: prefer the PDF's exact embedded text layer
          // over OCR when it's digital and looks trustworthy (guarded). Returns
          // true if it produced the matrix (caller should stop); false to fall
          // through to the OCR the user picked. Cancellation propagates.
          const tryDigitalFast = async (ocrLabel) => {
            setLoadMsg("Reading embedded text…");
            setLoadSub("Digital PDF — trying its exact text layer first");
            setLoadPct(2);
            let dText;
            try {
              dText = await extractDigitalText(
                pdfFile,
                (page, total) => {
                  setLoadSub(`Reading page ${page} of ${total}`);
                  setLoadPct(Math.round(((page - 1) / total) * 60) + 5);
                },
                signal,
              );
            } catch (e) {
              if (e?.name === "AbortError" || signal.aborted) throw e;
              return false; // text layer unreadable → let OCR run
            }
            const q = assessTextQuality(dText);
            const parsed = q.usable ? structureWithoutAI(dText) : [];
            if (!q.usable || parsed.length === 0) {
              setInfo(
                `Digital PDF, but its text layer looked unreliable (${q.reason || "no rows"}) — using ${ocrLabel} OCR instead.`,
              );
              return false;
            }
            setRows(
              parsed.map((it) =>
                mkRow({
                  ref: it.ref,
                  requirement: it.requirement,
                  category: it.category || "General",
                  status: "comply",
                }),
              ),
            );
            setLoadPct(100);
            setInfo(
              "Digital PDF — read its exact text layer instantly, skipping OCR (lossless, free). If the Thai looks garbled, re-run with OCR.",
            );
            setOcrFallback(ocrLabel);
            setTimeout(() => {
              setLoading(false);
              setLoadPct(null);
            }, 400);
            return true;
          };

          try {
            // ===== BROWSER-ONLY MODE: Tesseract.js OCR + heuristic structuring, ZERO API =====
            if (aiEngine === "browser") {
              if (pdfType === "digital" && !forceOcr) {
                if (await tryDigitalFast("Browser")) return;
              }
              setLoadMsg("Browser OCR (Tesseract.js)...");
              setLoadSub(
                "First run downloads the Thai language pack (~15MB, cached after)",
              );
              setLoadPct(2);
              const ocrText = await ocrPDFTesseract(
                pdfFile,
                (page, total, pct) => {
                  if (page && total) {
                    setLoadSub(`OCR page ${page} of ${total}`);
                    setLoadPct(Math.round(((page - 1) / total) * 85) + 5);
                  } else if (pct != null) {
                    setLoadSub(`Recognizing text — ${pct}%`);
                  }
                },
                signal,
              );
              setLoadMsg("Structuring text...");
              setLoadSub("Splitting into requirement rows");
              setLoadPct(92);
              const parsedRows = structureWithoutAI(ocrText);
              if (parsedRows.length === 0)
                throw new Error(
                  "No text could be extracted. The scan may be too low quality — try Typhoon or another engine.",
                );
              const mapped = parsedRows.map((it) =>
                mkRow({
                  ref: it.ref,
                  requirement: it.requirement,
                  category: it.category || "General",
                  status: "comply",
                }),
              );
              setRows(mapped);
              setLoadPct(100);
              // Names the rows actually at risk and why. Tesseract corrupts Thai
              // numerals while reporting high confidence, so "review the Thai"
              // was too vague to act on — see lib/ocrtrust.ts for the measurements.
              setWarning(browserOcrWarning(mapped));
              setTimeout(() => {
                setLoading(false);
                setLoadPct(null);
              }, 400);
              return;
            }

            // ===== TYPHOON MODE: Typhoon OCR (Thai) + heuristic structuring, free tier =====
            if (aiEngine === "typhoon") {
              if (pdfType === "digital" && !forceOcr) {
                if (await tryDigitalFast("Typhoon")) return;
              }
              setLoadMsg("Typhoon OCR (Thai)...");
              setLoadSub("Reading pages with Typhoon — via proxy");
              setLoadPct(2);
              const tOcr = await ocrPDFTyphoon(
                pdfFile,
                (page, total) => {
                  setLoadSub(`Typhoon OCR — page ${page} of ${total}`);
                  setLoadPct(Math.round(((page - 1) / total) * 85) + 5);
                },
                signal,
              );
              setLoadMsg("Structuring text...");
              setLoadSub("Splitting into requirement rows");
              setLoadPct(92);
              const parsedRows = structureWithoutAI(tOcr);
              if (parsedRows.length === 0)
                throw new Error(
                  "No text could be extracted. Try another engine or check the PDF quality.",
                );
              const mapped = parsedRows.map((it) =>
                mkRow({
                  ref: it.ref,
                  requirement: it.requirement,
                  category: it.category || "General",
                  status: "comply",
                }),
              );
              setRows(mapped);
              setLoadPct(100);
              setWarning(
                "Typhoon OCR done. Rows were split heuristically — review the clause boundaries, then adjust. For AI-structured rows, use Typhoon as the OCR feeder with the Claude or Gemini engine.",
              );
              setTimeout(() => {
                setLoading(false);
                setLoadPct(null);
              }, 400);
              return;
            }

            // ===== DIGITAL TEXT MODE: read the PDF's embedded text layer, no AI, no OCR =====
            if (aiEngine === "digitaltext") {
              if (pdfType === "scanned") {
                setError(
                  "This mode reads text already embedded in a digital PDF, but this file looks scanned (no text layer). Use Typhoon, Browser OCR, or an AI engine instead.",
                );
                setLoading(false);
                return;
              }
              setLoadMsg("Reading embedded text…");
              setLoadSub("No AI, no OCR — exact text from the PDF");
              setLoadPct(2);
              const dText = await extractDigitalText(
                pdfFile,
                (page, total) => {
                  setLoadSub(`Reading page ${page} of ${total}`);
                  setLoadPct(Math.round(((page - 1) / total) * 85) + 5);
                },
                signal,
              );
              setLoadMsg("Structuring text…");
              setLoadSub("Splitting into rows");
              setLoadPct(92);
              const parsedRows = structureWithoutAI(dText);
              if (parsedRows.length === 0)
                throw new Error(
                  "No text found in this PDF's text layer — it may be scanned. Try an OCR or AI engine.",
                );
              const mapped = parsedRows.map((it) =>
                mkRow({
                  ref: it.ref,
                  requirement: it.requirement,
                  category: it.category || "General",
                  status: "comply",
                }),
              );
              setRows(mapped);
              setLoadPct(100);
              setWarning(
                "Extracted the PDF's embedded text exactly (no AI). Each line is a row — review the boundaries and adjust. For AI-structured requirement rows, switch to Claude or Gemini.",
              );
              setTimeout(() => {
                setLoading(false);
                setLoadPct(null);
              }, 400);
              return;
            }

            let ocrText = null;

            if (pdfType === "scanned") {
              if (ocrEngine === "tesseract") {
                setLoadMsg("Browser OCR (Tesseract.js)...");
                setLoadSub(
                  "First run downloads Thai language pack (~15MB, cached)",
                );
                ocrText = await ocrPDFTesseract(
                  pdfFile,
                  (page, total, pct) => {
                    if (page && total) {
                      setLoadSub(`OCR page ${page} of ${total}`);
                      setLoadPct(Math.round(((page - 1) / total) * 55) + 5);
                    } else if (pct != null) {
                      setLoadSub(`Recognizing — ${pct}%`);
                    }
                  },
                  signal,
                );
              } else if (ocrEngine === "gemini") {
                if (!geminiKey) {
                  setError("Gemini API key is required for Gemini OCR.");
                  setLoading(false);
                  return;
                }
                setLoadMsg("OCR via Gemini Vision...");
                const ab = await pdfFile.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
                const total = pdf.numPages;
                const texts = [];
                for (let p = 1; p <= total; p++) {
                  if (signal.aborted)
                    throw new DOMException("Aborted", "AbortError");
                  setLoadPct(Math.round((p / total) * 60));
                  setLoadSub(`Gemini Vision — page ${p} of ${total}`);
                  const b64 = await rasterizePage(pdf, p);
                  const txt = await ocrPageWithGemini(
                    b64,
                    p,
                    geminiKey,
                    geminiModel,
                    signal,
                  );
                  texts.push(txt);
                }
                ocrText = texts.join("\n\n--- PAGE BREAK ---\n\n");
              } else if (ocrEngine === "claude") {
                setLoadMsg("OCR via Claude Vision...");
                setLoadSub("Reading pages with Claude — routed via proxy");
                const ab = await pdfFile.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
                const total = pdf.numPages;
                const texts = [];
                for (let p = 1; p <= total; p++) {
                  if (signal.aborted)
                    throw new DOMException("Aborted", "AbortError");
                  setLoadPct(Math.round((p / total) * 60));
                  setLoadSub(`Claude Vision — page ${p} of ${total}`);
                  const b64 = await rasterizePage(pdf, p);
                  const res = await fetchWithRetry("/api/claude", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    signal,
                    body: JSON.stringify({
                      model,
                      max_tokens: 2000,
                      messages: [
                        {
                          role: "user",
                          content: [
                            {
                              type: "image",
                              source: {
                                type: "base64",
                                media_type: "image/png",
                                data: b64,
                              },
                            },
                            {
                              type: "text",
                              text:
                                "This is page " +
                                p +
                                " of a scanned Thai TOR document. Extract ALL text verbatim including Thai. Preserve numbering and structure. Return only extracted text.",
                            },
                          ],
                        },
                      ],
                    }),
                  });
                  if (!res.ok) {
                    const e = await res.json().catch(() => ({}));
                    throw new Error(
                      e?.error?.message || `Claude Vision ${res.status}`,
                    );
                  }
                  const data = await res.json();
                  texts.push(
                    data.content?.find((b) => b.type === "text")?.text || "",
                  );
                }
                ocrText = texts.join("\n\n--- PAGE BREAK ---\n\n");
              } else if (ocrEngine === "typhoon") {
                setLoadMsg("OCR via Typhoon (Thai)...");
                setLoadSub("Reading pages with Typhoon — via proxy");
                ocrText = await ocrPDFTyphoon(
                  pdfFile,
                  (page, total) => {
                    setLoadPct(Math.round((page / total) * 60));
                    setLoadSub(`Typhoon OCR — page ${page} of ${total}`);
                  },
                  signal,
                );
              } else if (ocrEngine === "vision") {
                setLoadMsg("OCR via Google Vision...");
                setLoadSub("Reading pages with Google Cloud Vision — via proxy");
                ocrText = await ocrPDFVision(
                  pdfFile,
                  (page, total) => {
                    setLoadPct(Math.round((page / total) * 60));
                    setLoadSub(`Google Vision — page ${page} of ${total}`);
                  },
                  signal,
                );
              }
              setLoadPct(65);
            }

            setLoadMsg("Extracting requirements...");
            setLoadPct(pdfType === "digital" ? 20 : 75);

            let parsed;
            if (aiEngine === "gemini") {
              if (!geminiKey) {
                setError("Gemini API key is required.");
                setLoading(false);
                return;
              }
              setLoadSub(`Using ${geminiModel}`);
              parsed = await extractWithGemini(
                pdfFile,
                geminiKey,
                geminiModel,
                showTr,
                pdfType,
                ocrText,
                signal,
              );
            } else {
              setLoadSub(`Using ${claudeModelShort(model)} via proxy`);
              parsed = await extractRequirements(
                pdfFile,
                model,
                showTr,
                pdfType,
                ocrText,
                signal,
              );
            }

            setLoadPct(95);
            setLoadMsg("Validating...");
            setLoadSub("");
            const mapped = validateAndMap(parsed, showTr);
            setRows(mapped);
            setLoadPct(100);
            const warned = mapped.filter((r) => r._warn).length;
            if (warned > 0) {
              setWarning(
                `${warned} requirement${warned > 1 ? "s" : ""} appear to be translated rather than verbatim Thai — highlighted rows need review.`,
              );
            }
            setTimeout(() => {
              setLoading(false);
              setLoadPct(null);
            }, 400);
          } catch (e) {
            if (e?.name === "AbortError") {
              setInfo("Extraction cancelled.");
            } else {
              setError(e.message || "Extraction failed.");
            }
            setLoading(false);
            setLoadPct(null);
          } finally {
            abortRef.current = null;
          }
        };

        const applyLib = (item) => {
          // The drawer covers the matrix on compact widths, so leaving it open
          // would hide the very change this click just made. No-op on desktop.
          setDrawerOpen(false);
          if (selectedRow !== null) {
            upd(selectedRow, "remarks", item.text);
            setSelectedRow(null);
          } else {
            setRows((r) =>
              r.map((row) =>
                row.status === item.status
                  ? { ...row, remarks: item.text }
                  : row,
              ),
            );
          }
        };

        const addLibItem = () => {
          if (!newLib.label.trim() || !newLib.text.trim()) return;
          setLib((l) => [
            ...l,
            {
              id: "u" + Date.now(),
              label: newLib.label.trim(),
              text: newLib.text.trim(),
              status: newLib.status,
            },
          ]);
          setNewLib({ label: "", text: "", status: "comply" });
          setShowLibAdd(false);
        };

        // Sidebar-as-drawer (RESPONSIVE_PLAN R2). Below 1120px the sidebar's
        // 288px is 26% of a 1024px screen and 77% of a phone, so it stops being
        // a column and becomes an off-canvas drawer.
        const isCompact = useMediaQuery(MEDIA_COMPACT);
        // Phone width gets a stricter treatment than tablet: at 375px the top
        // bar wrapped to four rows (160px, 20% of the screen) purely because
        // the session fields and the engine picker were still inline. R2.5
        // relocates them into the drawer — moved, not duplicated.
        const isPhone = useMediaQuery(MEDIA_PHONE);
        // Snip is a mouse drag-crop. On a coarse pointer it cannot work, so it
        // is shown as unavailable WITH A REASON rather than silently broken or
        // silently missing (RESPONSIVE_PLAN R5, scope decision (a)).
        const isCoarsePointer = useMediaQuery(MEDIA_COARSE_POINTER);
        const [drawerOpen, setDrawerOpen] = useState(false);
        const drawerToggleRef = useRef<HTMLButtonElement>(null);
        const sidebarRef = useRef<HTMLDivElement>(null);

        // Top-bar overflow menu (RESPONSIVE_PLAN R1). The secondary actions live
        // here permanently rather than behind a media query: a single rendering
        // cannot drift from a duplicate, and the inline row did not fit even at
        // 1440px — it needed 1505px, so below that the last buttons were being
        // clipped away with no way to reach them.
        const [menuOpen, setMenuOpen] = useState(false);
        const menuRef = useRef<HTMLDivElement>(null);

        const [testStatus, setTestStatus] = useState(null); // null | 'testing' | 'ok' | 'fail'
        const [testMsg, setTestMsg] = useState("");

        // Leaving compact width must not strand the drawer open — above the
        // breakpoint the sidebar is a normal column again and `open` is
        // meaningless, but a stale `true` would leave the scrim mounted.
        useEffect(() => {
          if (!isCompact && drawerOpen) setDrawerOpen(false);
        }, [isCompact, drawerOpen]);

        // Drawer is a modal dialog while compact: Escape closes it, focus moves
        // into it on open and returns to the toggle on close. Matches the
        // HelpModal / SnipModal / lightbox pattern already in this file.
        useEffect(() => {
          if (!drawerOpen || !isCompact) return;
          const onKey = (e) => {
            if (e.key === "Escape") setDrawerOpen(false);
          };
          document.addEventListener("keydown", onKey);
          // Must skip HIDDEN focusables. The sidebar's first match is the
          // display:none <input type=file> behind the upload zone, and focusing
          // that silently does nothing — the drawer opened with focus still on
          // the toggle, outside the dialog. offsetParent is null for anything
          // display:none'd, which is exactly the case to reject here.
          const focusables = [
            ...(sidebarRef.current?.querySelectorAll(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
            ) ?? []),
          ].filter((el) => {
            if (el.disabled) return false;
            // Computed display/visibility rather than offsetParent. offsetParent
            // is also null for position:fixed elements (a false negative), and
            // it is null for EVERYTHING under jsdom, which does no layout — so
            // the check would have been untestable as well as subtly wrong.
            const cs = window.getComputedStyle(el);
            return cs.display !== "none" && cs.visibility !== "hidden";
          });
          focusables[0]?.focus?.();
          return () => {
            document.removeEventListener("keydown", onKey);
            drawerToggleRef.current?.focus?.();
          };
        }, [drawerOpen, isCompact]);

        // Close the overflow menu on Escape or an outside click. Escape is
        // checked before the outside-click handler so a keyboard user always has
        // a way out, matching HelpModal/SnipModal/the lightbox.
        useEffect(() => {
          if (!menuOpen) return;
          const onKey = (e) => {
            if (e.key === "Escape") setMenuOpen(false);
          };
          const onDown = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
          };
          document.addEventListener("keydown", onKey);
          document.addEventListener("mousedown", onDown);
          return () => {
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("mousedown", onDown);
          };
        }, [menuOpen]);

        const testConnection = async () => {
          setTestStatus("testing");
          setTestMsg("");
          try {
            if (aiEngine === "gemini") {
              if (!geminiKey) {
                setTestStatus("fail");
                setTestMsg("No API key entered.");
                return;
              }
              // Key goes in the x-goog-api-key header, not the URL — RISK_REVIEW R7.
              const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`;
              const res = await fetch(endpoint, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-goog-api-key": geminiKey,
                },
                body: JSON.stringify({
                  contents: [
                    { parts: [{ text: "Reply with the single word: OK" }] },
                  ],
                  generationConfig: { maxOutputTokens: 5 },
                }),
              });
              const data = await res.json();
              if (!res.ok) {
                const msg = data?.error?.message || `HTTP ${res.status}`;
                // Parse common errors into plain language
                if (msg.includes("quota") || msg.includes("limit: 0")) {
                  setTestStatus("fail");
                  setTestMsg(
                    "Quota exceeded. Your free tier is used up — enable billing at aistudio.google.com or try a different Google account.",
                  );
                } else if (
                  msg.includes("API_KEY_INVALID") ||
                  msg.includes("invalid")
                ) {
                  setTestStatus("fail");
                  setTestMsg(
                    "Invalid API key. Re-copy it from aistudio.google.com → API Keys.",
                  );
                } else if (
                  msg.includes("not found") ||
                  msg.includes("not supported")
                ) {
                  setTestStatus("fail");
                  setTestMsg(
                    `Model "${geminiModel}" not available on your account. Try switching to Flash.`,
                  );
                } else {
                  setTestStatus("fail");
                  setTestMsg(msg);
                }
              } else {
                const reply =
                  data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
                setTestStatus("ok");
                setTestMsg(
                  `Connected ✓ — ${geminiModel} responded: "${reply.trim()}"`,
                );
              }
            } else if (aiEngine === "typhoon") {
              const res = await fetch("/api/typhoon", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  model: TYPHOON_MODEL,
                  max_tokens: 5,
                  messages: [
                    { role: "user", content: "Reply with the single word: OK" },
                  ],
                }),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                const msg = data?.error?.message || `HTTP ${res.status}`;
                const lower = msg.toLowerCase();
                setTestStatus("fail");
                if (res.status === 404) {
                  setTestMsg(
                    "Proxy /api/typhoon not found. Make sure functions/api/typhoon.js is deployed on Cloudflare Pages.",
                  );
                } else if (lower.includes("origin")) {
                  setTestMsg(
                    "Blocked by the proxy origin allow-list. In Cloudflare Pages → Settings → Variables, set ALLOWED_ORIGINS to this site's origin (include https://, e.g. https://nyarlathotep-a6o.pages.dev) and redeploy.",
                  );
                } else if (res.status === 429 || lower.includes("rate limit")) {
                  setTestMsg(
                    "Rate limited by the proxy. Wait a moment and try again.",
                  );
                } else if (
                  res.status === 401 ||
                  lower.includes("api key") ||
                  lower.includes("unauthor")
                ) {
                  setTestMsg(
                    "Invalid or missing TYPHOON_API_KEY in Cloudflare Pages env vars. Get a free key at opentyphoon.ai.",
                  );
                } else {
                  setTestMsg(msg);
                }
              } else {
                const reply = data?.choices?.[0]?.message?.content || "";
                setTestStatus("ok");
                setTestMsg(
                  `Connected ✓ — Typhoon reachable${reply ? ` — responded: "${reply.trim()}"` : ""}`,
                );
              }
            } else {
              // Claude — test via proxy
              const res = await fetch("/api/claude", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  model,
                  max_tokens: 5,
                  messages: [
                    { role: "user", content: "Reply with the single word: OK" },
                  ],
                }),
              });
              const data = await res.json();
              if (!res.ok) {
                const msg = data?.error?.message || `HTTP ${res.status}`;
                const lower = msg.toLowerCase();
                setTestStatus("fail");
                if (msg.includes("credit") || msg.includes("balance")) {
                  setTestMsg(
                    "No API credits. Top up at console.anthropic.com → Billing. (Your claude.ai subscription is separate from API billing.)",
                  );
                } else if (lower.includes("origin")) {
                  setTestMsg(
                    "Blocked by the proxy origin allow-list. In Cloudflare Pages → Settings → Variables, set ALLOWED_ORIGINS to this site's origin (include https://) and redeploy.",
                  );
                } else if (res.status === 429 || lower.includes("rate limit")) {
                  setTestMsg(
                    "Rate limited by the proxy. Wait a moment and try again.",
                  );
                } else if (
                  msg.includes("401") ||
                  msg.includes("invalid x-api-key")
                ) {
                  setTestMsg(
                    "Invalid API key in your Cloudflare Pages env vars. Check ANTHROPIC_API_KEY in the Pages project → Settings → Environment variables.",
                  );
                } else if (res.status === 404) {
                  setTestMsg(
                    "Proxy /api/claude not found. Make sure functions/api/claude.js is deployed on Cloudflare Pages.",
                  );
                } else {
                  setTestMsg(msg);
                }
              } else {
                const reply = data?.content?.[0]?.text || "";
                setTestStatus("ok");
                setTestMsg(`Connected ✓ — Claude responded: "${reply.trim()}"`);
              }
            }
          } catch (e) {
            if (e.message === "Failed to fetch") {
              if (aiEngine === "claude" || aiEngine === "typhoon") {
                setTestStatus("fail");
                setTestMsg(
                  `Proxy /api/${aiEngine} not reachable. It only works on the deployed Cloudflare Pages site, not when opening the file locally.`,
                );
              } else {
                setTestStatus("fail");
                setTestMsg(
                  "Network error reaching Gemini. Check your internet connection or API key.",
                );
              }
            } else {
              setTestStatus("fail");
              setTestMsg(e.message || "Unknown error.");
            }
          }
        };

        const exportXLSX = async () => {
          if (!rows.length) return;
          try {
            // Dynamic import keeps ExcelJS out of the initial bundle.
            const { downloadMatrix } = await import("./lib/xlsx");
            await downloadMatrix({ rows, project, showTr, showCat, verifiedBy });
            setInfo(
              verifiedBy.trim()
                ? `Exported .xlsx — “Verified By” pre-filled with “${verifiedBy.trim()}” and today's date. Thai is set to “TH Sarabun New”.`
                : "Exported .xlsx — tip: set “Verified by” in the top bar to pre-fill the sign-off columns. Thai is set to “TH Sarabun New”.",
            );
          } catch (e) {
            setError(e?.message || "Export failed.");
          }
        };

        const stats = useMemo(
          () => ({
            total: rows.length,
            comply: rows.filter((r) => r.status === "comply").length,
            partial: rows.filter((r) => r.status === "partial").length,
            notcomply: rows.filter((r) => r.status === "notcomply").length,
            na: rows.filter((r) => r.status === "na").length,
          }),
          [rows],
        );

        const filtered = useMemo(() => {
          let out =
            filter === "all" ? rows : rows.filter((r) => r.status === filter);
          if (query.trim()) out = out.filter((r) => matchesQuery(r, query));
          return out;
        }, [rows, filter, query]);

        // Near-duplicate requirement rows (by normalized text), for flagging.
        const dupIds = useMemo(() => findDuplicateIds(rows), [rows]);

        // Bulk selection derived values + actions (F5).
        // Drag-reorder is disabled on phones: the card layout sets display:block
        // on the table elements, which breaks dnd-kit's transform-based
        // measurement, and dragging a full-width card on touch is a poor
        // interaction regardless. Disabling it while filtering/searching is an
        // established pattern here (RESPONSIVE_PLAN risk V3).
        const dragEnabled = filter === "all" && !query.trim() && !isPhone;
        const selectedCount = useMemo(
          () => rows.reduce((n, r) => n + (selectedIds.has(r.id) ? 1 : 0), 0),
          [rows, selectedIds],
        );
        const allFilteredSelected =
          filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id));
        const toggleSelect = (id) =>
          setSelectedIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
          });
        const toggleSelectAllFiltered = () =>
          setSelectedIds((prev) => {
            const next = new Set(prev);
            if (allFilteredSelected) filtered.forEach((r) => next.delete(r.id));
            else filtered.forEach((r) => next.add(r.id));
            return next;
          });
        const clearSelection = () => setSelectedIds(new Set());
        const bulkSetStatus = (status) => {
          commit();
          setRows((prev) =>
            prev.map((r) => (selectedIds.has(r.id) ? { ...r, status } : r)),
          );
          clearSelection();
        };

        // Defined once and PLACED conditionally — never rendered twice. A
        // duplicate rendering of the same inputs is exactly the divergence risk
        // RESPONSIVE_PLAN calls V2, so these move between the top bar and the
        // drawer rather than existing in both.
        const sessionFields = (
          <>
            <input
              className="proj-input"
              placeholder="Project name…"
              value={project}
              onChange={(e) => setProject(e.target.value)}
              aria-label="Project name"
            />
            <input
              className="proj-input verifier-input"
              placeholder="Verified by…"
              title="Reviewer name — pre-filled into the “Verified By” column of the Excel export (with today's date)"
              value={verifiedBy}
              onChange={(e) => setVerifiedBy(e.target.value)}
              aria-label="Verified by"
            />
          </>
        );

        // View settings, not per-moment actions — on a phone they belong with
        // the other settings in the drawer rather than costing a toolbar row.
        const viewToggles = (
          <div className="toggles">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={showTr}
                onChange={(e) => setShowTr(e.target.checked)}
              />
              Translation col
            </label>
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={showCat}
                onChange={(e) => setShowCat(e.target.checked)}
              />
              Category col
            </label>
          </div>
        );

        const enginePicker = (
          <>
            <select
              className="model-sel"
              value={aiEngine}
              onChange={(e) => {
                setAiEngine(e.target.value);
                setTestStatus(null);
                setTestMsg("");
              }}
              aria-label="Extraction engine"
              title={
                EXTRACTION_ENGINES.find((e) => e.id === aiEngine)?.tooltip
              }
            >
              {EXTRACTION_ENGINES.map((e) => (
                <option key={e.id} value={e.id} title={e.tooltip}>
                  {e.label}
                </option>
              ))}
            </select>
            {aiEngine === "claude" && (
              <select
                className="model-sel"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                aria-label="Claude model"
              >
                {CLAUDE_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            )}
            {aiEngine === "gemini" && (
              <select
                className="model-sel"
                value={geminiModel}
                onChange={(e) => setGeminiModel(e.target.value)}
                aria-label="Gemini model"
              >
                {GEMINI_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            )}
          </>
        );

        return (
          <div className="app">
            <HelpModal open={showHelp} onClose={() => setShowHelp(false)} />
            <SnipModal
              open={showSnip}
              onClose={() => setShowSnip(false)}
              pdfFile={pdfFile}
              rows={rows}
              selectedRow={selectedRow}
              onAttach={attachImage}
            />
            {lightbox && (
              <div
                className="lightbox"
                role="dialog"
                aria-modal="true"
                aria-label="Enlarged figure"
                onClick={() => setLightbox(null)}
              >
                <img className="lightbox-img" src={lightbox} alt="Figure" />
                <button
                  className="help-close lightbox-close"
                  onClick={() => setLightbox(null)}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            )}
            {/* TOPBAR */}
            <div className="topbar">
              <button
                ref={drawerToggleRef}
                className="btn btn-ghost btn-sm drawer-toggle"
                onClick={() => setDrawerOpen((o) => !o)}
                aria-label={drawerOpen ? "Close setup panel" : "Open setup panel"}
                aria-expanded={drawerOpen}
                aria-controls="app-sidebar"
                title="Document, engine and response library"
              >
                ☰
              </button>
              <div className="brand">
                <div className="brand-pulse" />
                <span className="brand-name">Nyarlathotep</span>
              </div>
              <button
                className="btn btn-ghost btn-sm help-btn"
                onClick={() => setShowHelp(true)}
                title="How to use this tool"
              >
                <span className="help-q" aria-hidden="true">
                  ?
                </span>
                How to use
              </button>
              <div className="brand-sep" />
              {!isPhone && sessionFields}
              <div className="topbar-right">
                <button
                  className="btn btn-ghost btn-sm undo-btn"
                  onClick={doUndo}
                  disabled={!histCanUndo(hist)}
                  title="Undo (Ctrl+Z)"
                  aria-label="Undo"
                >
                  ↶
                </button>
                <button
                  className="btn btn-ghost btn-sm undo-btn"
                  onClick={doRedo}
                  disabled={!histCanRedo(hist)}
                  title="Redo (Ctrl+Y)"
                  aria-label="Redo"
                >
                  ↷
                </button>
                {!isPhone && enginePicker}
                {/* Export stays inline — it is the primary output action. The
                    rest move into the overflow menu so the bar always fits. */}
                <button
                  className="btn btn-amber btn-sm"
                  onClick={exportXLSX}
                  disabled={!rows.length}
                >
                  ↓ Export .xlsx
                </button>
                <input
                  ref={jsonRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={loadJson}
                  style={{ display: "none" }}
                />
                <div className="tb-menu-wrap" ref={menuRef}>
                  <button
                    className="btn btn-ghost btn-sm tb-menu-btn"
                    onClick={() => setMenuOpen((o) => !o)}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    aria-label="More actions"
                    title="More actions"
                  >
                    ⋯
                  </button>
                  {menuOpen && (
                    <div className="tb-menu" role="menu" aria-label="More actions">
                      <button
                        role="menuitem"
                        className="tb-menu-item"
                        onClick={() => {
                          setMenuOpen(false);
                          addRow();
                        }}
                        disabled={loading}
                      >
                        + Row
                      </button>
                      <button
                        role="menuitem"
                        className="tb-menu-item"
                        onClick={() => {
                          setMenuOpen(false);
                          setShowSnip(true);
                        }}
                        disabled={loading || !pdfFile || isCoarsePointer}
                        title={
                          isCoarsePointer
                            ? "Snip needs a mouse — it works by dragging a crop box over the page. Open this tool on a desktop to capture figures."
                            : pdfFile
                              ? "Crop a figure from the PDF and attach it to a row"
                              : "Load a PDF first to snip figures from it"
                        }
                      >
                        📷 Snip a figure
                        {isCoarsePointer && (
                          <span className="tb-menu-note">needs a mouse</span>
                        )}
                      </button>
                      <div className="tb-menu-sep" role="separator" />
                      <button
                        role="menuitem"
                        className="tb-menu-item"
                        onClick={() => {
                          setMenuOpen(false);
                          saveJson();
                        }}
                        disabled={!rows.length}
                        title="Download this matrix as a JSON file you can reopen later"
                      >
                        ↓ Save .json
                      </button>
                      <button
                        role="menuitem"
                        className="tb-menu-item"
                        onClick={() => {
                          setMenuOpen(false);
                          jsonRef.current?.click();
                        }}
                        title="Load a matrix from a JSON file"
                      >
                        ↑ Load .json
                      </button>
                      <div className="tb-menu-sep" role="separator" />
                      <button
                        role="menuitem"
                        className="tb-menu-item tb-menu-danger"
                        onClick={() => {
                          setMenuOpen(false);
                          clearAll();
                        }}
                        disabled={!rows.length && !project}
                        title="Clear the matrix and start a new one"
                      >
                        New / clear matrix
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="body">
              {/* SIDEBAR */}
              {isCompact && drawerOpen && (
                <div
                  className="drawer-scrim"
                  onClick={() => setDrawerOpen(false)}
                  aria-hidden="true"
                />
              )}
              <div
                id="app-sidebar"
                ref={sidebarRef}
                className={`sidebar${drawerOpen ? " open" : ""}`}
                {...(isCompact
                  ? { role: "dialog", "aria-modal": true, "aria-label": "Setup panel" }
                  : {})}
              >
                {isPhone && (
                  <div className="sb-sec sb-phone-only">
                    <div className="sb-label">Project</div>
                    <div className="sb-phone-fields">{sessionFields}</div>
                    <div className="sb-label" style={{ marginTop: 12 }}>
                      Extraction engine
                    </div>
                    <div className="sb-phone-fields">{enginePicker}</div>
                    <div className="sb-label" style={{ marginTop: 12 }}>
                      Columns
                    </div>
                    {viewToggles}
                  </div>
                )}
                {/* PDF section */}
                <div className="sb-sec">
                  <div className="sb-label">TOR Document</div>
                  {!pdfFile ? (
                    <div
                      className={`upload-zone${dragging ? " drag" : ""}`}
                      onClick={() => fileRef.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragging(true);
                      }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={onDrop}
                    >
                      <div className="upload-ico">📄</div>
                      <div className="upload-txt">
                        <strong>Click or drag PDF</strong>
                        <br />
                        Thai / English TOR document
                      </div>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="application/pdf"
                        className="file-input"
                        onChange={(e) => handleFile(e.target.files[0])}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="file-badge">
                        <span className="file-ico">📄</span>
                        <span className="file-name">{pdfFile.name}</span>
                        <button
                          className="file-clear"
                          onClick={() => {
                            setPdfFile(null);
                            setPdfType(null);
                            setRows([]);
                            setError(null);
                            setWarning(null);
                            setInfo(null);
                          }}
                        >
                          ×
                        </button>
                      </div>
                      {pdfType && (
                        <div
                          style={{
                            fontSize: 10,
                            marginTop: 5,
                            color:
                              pdfType === "digital"
                                ? "var(--comply)"
                                : "var(--warn)",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          {pdfType === "digital"
                            ? "✓ Digital PDF"
                            : "⚠ Scanned PDF"}
                        </div>
                      )}
                      <button
                        className="btn btn-amber extract-btn"
                        onClick={() => doExtract()}
                        disabled={loading || !pdfType}
                      >
                        {loading ? "Processing…" : "⚡ Extract Requirements"}
                      </button>
                    </>
                  )}
                </div>

                {/* Typhoon — Thai, free tier via proxy */}
                {aiEngine === "typhoon" && (
                  <div className="sb-sec">
                    <div className="sb-label">Typhoon OCR — Thai · Free</div>
                    <div
                      className="key-panel"
                      style={{
                        background: "rgba(34,197,94,0.06)",
                        borderColor: "rgba(34,197,94,0.25)",
                      }}
                    >
                      <div
                        className="key-panel-title"
                        style={{ color: "var(--comply)" }}
                      >
                        ✦ Thai-specialized · via /api/typhoon proxy
                      </div>
                      <button
                        className="btn btn-ghost btn-xs"
                        style={{
                          width: "100%",
                          justifyContent: "center",
                          marginBottom: 6,
                        }}
                        onClick={testConnection}
                        disabled={testStatus === "testing"}
                      >
                        {testStatus === "testing"
                          ? "Testing…"
                          : "⚡ Test Connection"}
                      </button>
                      {testStatus && testStatus !== "testing" && (
                        <div
                          style={{
                            fontSize: 10,
                            padding: "6px 8px",
                            borderRadius: 3,
                            lineHeight: 1.55,
                            marginBottom: 5,
                            background:
                              testStatus === "ok"
                                ? "rgba(34,197,94,0.1)"
                                : "rgba(239,68,68,0.1)",
                            border: `1px solid ${testStatus === "ok" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                            color:
                              testStatus === "ok" ? "var(--comply)" : "var(--notcomply)",
                          }}
                        >
                          {testMsg}
                        </div>
                      )}
                      <div
                        style={{
                          fontSize: 9,
                          color: "var(--txt3)",
                          lineHeight: 1.6,
                        }}
                      >
                        Best free Thai OCR. Needs{" "}
                        <strong style={{ color: "var(--comply)" }}>
                          TYPHOON_API_KEY
                        </strong>{" "}
                        in Cloudflare Pages env vars — free key at{" "}
                        <strong style={{ color: "var(--comply)" }}>
                          opentyphoon.ai
                        </strong>{" "}
                        (free tier: 20 req/min). Rows are split heuristically —
                        review boundaries, or use Typhoon as the OCR feeder under
                        Claude/Gemini for AI-structured rows.
                      </div>
                    </div>
                  </div>
                )}

                {/* Browser OCR mode — no key needed */}
                {aiEngine === "browser" && (
                  <div className="sb-sec">
                    <div className="sb-label">Browser OCR — 100% Free</div>
                    <div
                      className="key-panel"
                      style={{
                        background: "rgba(34,197,94,0.06)",
                        borderColor: "rgba(34,197,94,0.25)",
                      }}
                    >
                      <div
                        className="key-panel-title"
                        style={{ color: "var(--comply)" }}
                      >
                        🆓 No API key · No billing · No login
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "var(--txt3)",
                          lineHeight: 1.65,
                        }}
                      >
                        Runs{" "}
                        <strong style={{ color: "var(--comply)" }}>
                          Tesseract.js
                        </strong>{" "}
                        entirely in your browser — Thai + English. Works for
                        both digital and scanned PDFs. Just press Extract.
                        <br />
                        <br />
                        <strong style={{ color: "var(--warn)" }}>
                          Trade-off:
                        </strong>{" "}
                        OCR accuracy is lower than AI engines, and rows are
                        split by a simple rule (clause numbers / bullets), so
                        you'll review boundaries. First run downloads a ~15MB
                        Thai pack, then it's cached offline.
                      </div>
                    </div>
                  </div>
                )}

                {aiEngine === "digitaltext" && (
                  <div className="sb-sec">
                    <div className="sb-label">Text PDF — No AI, exact</div>
                    <div
                      className="key-panel"
                      style={{
                        background: "rgba(34,197,94,0.06)",
                        borderColor: "rgba(34,197,94,0.25)",
                      }}
                    >
                      <div
                        className="key-panel-title"
                        style={{ color: "var(--comply)" }}
                      >
                        ✎ No key · No AI · No OCR
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "var(--txt3)",
                          lineHeight: 1.65,
                        }}
                      >
                        Reads the{" "}
                        <strong style={{ color: "var(--comply)" }}>
                          embedded text layer
                        </strong>{" "}
                        of a digital PDF directly — instant, free, and exact
                        (character-for-character). Every line becomes a row.
                        <br />
                        <br />
                        <strong style={{ color: "var(--warn)" }}>
                          Digital PDFs only:
                        </strong>{" "}
                        scanned PDFs have no text layer — for those use Typhoon,
                        Browser OCR, or an AI engine. Rows are split by a simple
                        rule (clause numbers / lines), so review the boundaries.
                      </div>
                    </div>
                  </div>
                )}

                {/* Gemini API key — always visible when Gemini is selected as AI engine */}
                {aiEngine === "gemini" && (
                  <div className="sb-sec">
                    <div className="sb-label">Gemini API Key</div>
                    <div
                      className="key-panel"
                      style={{
                        background: "var(--accent-soft)",
                        borderColor: "var(--accent-bdr)",
                      }}
                    >
                      <div
                        className="key-panel-title"
                        style={{ color: "var(--info)" }}
                      >
                        ✦ Google AI Studio Key
                      </div>
                      <input
                        className="key-input"
                        type="password"
                        placeholder="AIza... (from aistudio.google.com)"
                        value={geminiKey}
                        onChange={(e) => {
                          setGeminiKey(e.target.value);
                          setTestStatus(null);
                          setTestMsg("");
                        }}
                        aria-label="Gemini API key"
                      />
                      <button
                        className="btn btn-ghost btn-xs"
                        style={{
                          width: "100%",
                          justifyContent: "center",
                          marginBottom: 6,
                        }}
                        onClick={testConnection}
                        disabled={testStatus === "testing" || !geminiKey}
                      >
                        {testStatus === "testing"
                          ? "Testing…"
                          : "⚡ Test Connection"}
                      </button>
                      {testStatus && testStatus !== "testing" && (
                        <div
                          style={{
                            fontSize: 10,
                            padding: "6px 8px",
                            borderRadius: 3,
                            lineHeight: 1.55,
                            marginBottom: 5,
                            background:
                              testStatus === "ok"
                                ? "rgba(34,197,94,0.1)"
                                : "rgba(239,68,68,0.1)",
                            border: `1px solid ${testStatus === "ok" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                            color:
                              testStatus === "ok" ? "var(--comply)" : "var(--notcomply)",
                          }}
                        >
                          {testMsg}
                        </div>
                      )}
                      <div
                        style={{
                          fontSize: 9,
                          color: "var(--txt3)",
                          lineHeight: 1.6,
                        }}
                      >
                        Get free key at{" "}
                        <strong style={{ color: "var(--info)" }}>
                          aistudio.google.com
                        </strong>{" "}
                        → API Keys. Free tier: 1,500 req/day on Flash. No
                        billing required. Cleared on reload.
                      </div>
                    </div>
                  </div>
                )}

                {/* Claude connection test — visible when Claude engine selected */}
                {aiEngine === "claude" && (
                  <div className="sb-sec">
                    <div className="sb-label">Claude Connection</div>
                    <div
                      className="key-panel"
                      style={{
                        background: "var(--accent-soft)",
                        borderColor: "var(--accent-bdr)",
                      }}
                    >
                      <div
                        className="key-panel-title"
                        style={{ color: "var(--amber)" }}
                      >
                        ⚡ Via /api/claude proxy
                      </div>
                      <button
                        className="btn btn-ghost btn-xs"
                        style={{
                          width: "100%",
                          justifyContent: "center",
                          marginBottom: 6,
                        }}
                        onClick={testConnection}
                        disabled={testStatus === "testing"}
                      >
                        {testStatus === "testing"
                          ? "Testing…"
                          : "⚡ Test Connection"}
                      </button>
                      {testStatus && testStatus !== "testing" && (
                        <div
                          style={{
                            fontSize: 10,
                            padding: "6px 8px",
                            borderRadius: 3,
                            lineHeight: 1.55,
                            background:
                              testStatus === "ok"
                                ? "rgba(34,197,94,0.1)"
                                : "rgba(239,68,68,0.1)",
                            border: `1px solid ${testStatus === "ok" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                            color:
                              testStatus === "ok" ? "var(--comply)" : "var(--notcomply)",
                          }}
                        >
                          {testMsg}
                        </div>
                      )}
                      <div
                        style={{
                          fontSize: 9,
                          color: "var(--txt3)",
                          lineHeight: 1.6,
                          marginTop: 6,
                        }}
                      >
                        Requires{" "}
                        <strong style={{ color: "var(--amber)" }}>
                          ANTHROPIC_API_KEY
                        </strong>{" "}
                        in Vercel env vars and API credits at{" "}
                        <strong style={{ color: "var(--amber)" }}>
                          console.anthropic.com
                        </strong>
                        . Claude.ai subscription ≠ API credits.
                      </div>
                    </div>
                  </div>
                )}

                {/* OCR Engine selector — only when scanned AND using an AI engine */}
                {pdfType === "scanned" &&
                  (aiEngine === "claude" || aiEngine === "gemini") && (
                  <div className="sb-sec">
                    <div className="sb-label">OCR Engine (Scanned PDF)</div>
                    <div
                      style={{
                        display: "flex",
                        gap: 4,
                        marginBottom: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      {OCR_FEEDERS.map(({ id: v, label: l, tooltip }) => (
                        <button
                          key={v}
                          onClick={() => setOcrEngine(v)}
                          title={tooltip}
                          style={{
                            flex: "1 1 45%",
                            fontFamily: "inherit",
                            fontSize: 9,
                            fontWeight: 600,
                            letterSpacing: ".03em",
                            padding: "5px 4px",
                            borderRadius: 4,
                            cursor: "pointer",
                            border: "1px solid",
                            textTransform: "uppercase",
                            transition: "all .15s",
                            background:
                              ocrEngine === v ? "var(--amber)" : "transparent",
                            color: ocrEngine === v ? "#0c0e14" : "var(--txt3)",
                            borderColor:
                              ocrEngine === v ? "var(--amber)" : "var(--bdr2)",
                          }}
                        >
                          {l}
                        </button>
                      ))}
                    </div>

                    {ocrEngine === "typhoon" && (
                      <div
                        className="key-panel"
                        style={{
                          background: "rgba(34,197,94,0.06)",
                          borderColor: "rgba(34,197,94,0.25)",
                        }}
                      >
                        <div
                          className="key-panel-title"
                          style={{ color: "var(--comply)" }}
                        >
                          ✦ Typhoon Vision — Thai · free tier
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "var(--txt3)",
                            lineHeight: 1.6,
                          }}
                        >
                          Reads each page with Typhoon (Thai-specialized) via the
                          /api/typhoon proxy, then your AI engine structures the
                          text. Needs TYPHOON_API_KEY in Cloudflare env (free key
                          at opentyphoon.ai).
                        </div>
                      </div>
                    )}
                    {ocrEngine === "vision" && (
                      <div
                        className="key-panel"
                        style={{
                          background: "rgba(34,197,94,0.06)",
                          borderColor: "rgba(34,197,94,0.25)",
                        }}
                      >
                        <div
                          className="key-panel-title"
                          style={{ color: "var(--comply)" }}
                        >
                          🆓 Google Cloud Vision — free tier, good Thai
                        </div>
                        <div
                          style={{
                            fontSize: 9,
                            color: "var(--txt3)",
                            lineHeight: 1.6,
                          }}
                        >
                          Reads each page via the{" "}
                          <code style={{ color: "var(--comply)" }}>
                            /api/vision
                          </code>{" "}
                          proxy. Needs{" "}
                          <strong style={{ color: "var(--comply)" }}>
                            GOOGLE_VISION_API_KEY
                          </strong>{" "}
                          in Cloudflare env. Free tier:{" "}
                          <strong>1,000 pages/month</strong> (Google Cloud
                          account + card required). Good Thai; a solid backup to
                          Typhoon.
                        </div>
                      </div>
                    )}
                    {ocrEngine === "tesseract" && (
                      <div
                        className="key-panel"
                        style={{
                          background: "rgba(34,197,94,0.06)",
                          borderColor: "rgba(34,197,94,0.25)",
                        }}
                      >
                        <div
                          className="key-panel-title"
                          style={{ color: "var(--comply)" }}
                        >
                          🆓 Free browser OCR + AI structuring
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "var(--txt3)",
                            lineHeight: 1.6,
                          }}
                        >
                          Tesseract.js reads the pages free in-browser, then
                          your selected AI engine structures the text into clean
                          requirements. Best of both — no OCR cost.
                        </div>
                      </div>
                    )}
                    {ocrEngine === "claude" && (
                      <div
                        className="key-panel"
                        style={{
                          background: "rgba(34,197,94,0.06)",
                          borderColor: "rgba(34,197,94,0.25)",
                        }}
                      >
                        <div
                          className="key-panel-title"
                          style={{ color: "var(--comply)" }}
                        >
                          ✓ Uses Claude proxy — no extra key
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "var(--txt3)",
                            lineHeight: 1.6,
                          }}
                        >
                          Reads each page image via Claude Vision through your
                          /api/claude proxy. Billed to your Anthropic API.
                        </div>
                      </div>
                    )}
                    {ocrEngine === "gemini" && (
                      <div
                        className="key-panel"
                        style={{
                          background: "var(--accent-soft)",
                          borderColor: "var(--accent-bdr)",
                        }}
                      >
                        <div
                          className="key-panel-title"
                          style={{ color: "var(--info)" }}
                        >
                          ✦ Uses Gemini Vision — needs key above
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "var(--txt3)",
                            lineHeight: 1.6,
                          }}
                        >
                          Calls Gemini directly from browser (no proxy needed).
                          Free tier covers most TOR workloads. Add your Gemini
                          key in the section above.
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Library */}
                <div
                  className="sb-sec"
                  style={{ paddingBottom: 6, flexShrink: 0 }}
                >
                  <div className="sb-label">Comply Library</div>
                  <div className="sb-hint">
                    {selectedRow !== null
                      ? "Row selected — click item to apply to that row only."
                      : "Click item to fill all matching-status rows. Or select a row first."}
                  </div>
                </div>
                <div className="lib-scroll">
                  {lib.map((item) => (
                    <div
                      key={item.id}
                      className="lib-item"
                      onClick={() => applyLib(item)}
                    >
                      <div className="lib-item-top">
                        <div>
                          <div
                            className={`lib-item-label lib-label-${item.status}`}
                          >
                            {item.label}
                          </div>
                          <div className="lib-item-text">{item.text}</div>
                        </div>
                        <button
                          className="lib-remove"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLib((l) => l.filter((x) => x.id !== item.id));
                          }}
                          title="Remove"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                  {!showLibAdd ? (
                    <button
                      className="lib-add-btn"
                      onClick={() => setShowLibAdd(true)}
                    >
                      ＋ Add custom response
                    </button>
                  ) : (
                    <div className="lib-add-form">
                      <label className="lib-add-label" htmlFor="lib-add-label-input">
                        Label
                      </label>
                      <input
                        id="lib-add-label-input"
                        className="lib-add-input"
                        placeholder="e.g. Comply — IIoT Gateway"
                        value={newLib.label}
                        onChange={(e) =>
                          setNewLib((p) => ({ ...p, label: e.target.value }))
                        }
                      />
                      <label className="lib-add-label" htmlFor="lib-add-text-input">
                        Response text
                      </label>
                      <textarea
                        id="lib-add-text-input"
                        className="lib-add-input"
                        placeholder="Standard compliance response…"
                        value={newLib.text}
                        onChange={(e) =>
                          setNewLib((p) => ({ ...p, text: e.target.value }))
                        }
                        rows={3}
                        style={{
                          resize: "none",
                          display: "block",
                          fontFamily: "'Sarabun',sans-serif",
                        }}
                      />
                      <label className="lib-add-label" htmlFor="lib-add-status-select">
                        Applies to status
                      </label>
                      <select
                        id="lib-add-status-select"
                        className="lib-add-sel"
                        value={newLib.status}
                        onChange={(e) =>
                          setNewLib((p) => ({
                            ...p,
                            status: e.target.value as Status,
                          }))
                        }
                      >
                        <option value="comply">Comply</option>
                        <option value="partial">Partial</option>
                        <option value="notcomply">Not Comply</option>
                        <option value="na">N/A</option>
                      </select>
                      <div className="lib-add-btns">
                        <button
                          className="btn btn-amber btn-xs"
                          style={{ flex: 1, justifyContent: "center" }}
                          onClick={addLibItem}
                        >
                          Save
                        </button>
                        <button
                          className="btn btn-ghost btn-xs"
                          style={{ flex: 1, justifyContent: "center" }}
                          onClick={() => setShowLibAdd(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* CONTENT */}
              <main className="content">
                {loading && (
                  <div className="progress">
                    <div className="progress-fill" />
                  </div>
                )}

                {/* alerts */}
                {error && (
                  <div className="alert alert-err" role="alert">
                    <span className="alert-icon">⚠</span>
                    <div className="alert-body">{error}</div>
                    <button
                      className="alert-dismiss"
                      onClick={() => setError(null)}
                    >
                      ×
                    </button>
                  </div>
                )}
                {warning && (
                  <div className="alert alert-warn" role="status" aria-live="polite">
                    <span className="alert-icon">⚠</span>
                    <div className="alert-body">{warning}</div>
                    <button
                      className="alert-dismiss"
                      onClick={() => setWarning(null)}
                    >
                      ×
                    </button>
                  </div>
                )}
                {info && (
                  <div className="alert alert-info" role="status" aria-live="polite">
                    <span className="alert-icon">ℹ</span>
                    <div className="alert-body">{info}</div>
                    {ocrFallback && !loading && (
                      <button
                        className="alert-action"
                        onClick={() => doExtract({ forceOcr: true })}
                        title="Ignore the text layer and OCR the pages instead"
                      >
                        Re-run with {ocrFallback} OCR
                      </button>
                    )}
                    <button
                      className="alert-dismiss"
                      onClick={() => {
                        setInfo(null);
                        setOcrFallback(null);
                      }}
                    >
                      ×
                    </button>
                  </div>
                )}

                {/* toolbar */}
                {rows.length > 0 && (
                  <div className="toolbar">
                    <div className="stats">
                      <div className="stat">
                        <div
                          className="stat-dot"
                          style={{ background: "var(--txt3)" }}
                        />
                        <span className="stat-lbl">Total</span>&nbsp;
                        <span className="stat-val">{stats.total}</span>
                      </div>
                      {[
                        ["comply", "Comply"],
                        ["partial", "Partial"],
                        ["notcomply", "Not Comply"],
                        ["na", "N/A"],
                      ].map(([s, l]) => (
                        <div key={s} className="stat">
                          <div
                            className="stat-dot"
                            style={{ background: STAT_COLORS[s] }}
                          />
                          <span className="stat-lbl">{l}</span>&nbsp;
                          <span className="stat-val">{stats[s]}</span>
                        </div>
                      ))}
                      {dupIds.size > 0 && (
                        <div
                          className="stat dup-stat"
                          title="Rows with identical requirement text"
                        >
                          <span className="dup-ico" aria-hidden="true">
                            ⧉
                          </span>
                          <span className="stat-val">{dupIds.size}</span>
                          <span className="stat-lbl">dup</span>
                        </div>
                      )}
                    </div>
                    <div className="toolbar-sep" />
                    <div className="filters">
                      {[
                        ["all", "All", "f-all"],
                        ["comply", "Comply", "f-comply"],
                        ["partial", "Partial", "f-partial"],
                        ["notcomply", "Not Comply", "f-notcomply"],
                        ["na", "N/A", "f-na"],
                      ].map(([v, l, cls]) => (
                        <button
                          key={v}
                          className={`f-btn ${cls}${filter === v ? " on" : ""}`}
                          onClick={() => setFilter(v)}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                    <div className="tb-search">
                      <span className="search-ico" aria-hidden="true">
                        ⌕
                      </span>
                      <input
                        className="search-in"
                        placeholder="Search rows…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        aria-label="Search rows"
                      />
                      {query && (
                        <button
                          className="search-clear"
                          onClick={() => setQuery("")}
                          aria-label="Clear search"
                          title="Clear search"
                        >
                          ×
                        </button>
                      )}
                      {query.trim() && (
                        <span className="search-count">
                          {filtered.length} match
                          {filtered.length === 1 ? "" : "es"}
                        </span>
                      )}
                    </div>
{!isPhone && viewToggles}
                  </div>
                )}

                {/* bulk-action bar (F5) — appears when rows are selected */}
                {selectedCount > 0 && (
                  <div className="bulk-bar">
                    <span className="bulk-count">
                      {selectedCount} selected
                    </span>
                    <span className="bulk-sep" />
                    <span className="bulk-lbl">Set status:</span>
                    {STATUS_OPTS.map((o) => (
                      <button
                        key={o.v}
                        className={`f-btn f-${o.v} on`}
                        onClick={() => bulkSetStatus(o.v)}
                        title={`Set ${selectedCount} selected row${selectedCount === 1 ? "" : "s"} to ${o.l}`}
                      >
                        {o.l}
                      </button>
                    ))}
                    <button
                      className="btn btn-ghost btn-xs bulk-clear"
                      onClick={clearSelection}
                    >
                      Clear
                    </button>
                  </div>
                )}

                {/* table */}
                <div className="table-area" ref={tableRef}>
                  {loading && (
                    <div className="overlay" role="status" aria-live="polite">
                      <div className="spinner" />
                      <div className="ov-msg">{loadMsg}</div>
                      {loadSub && <div className="ov-sub">{loadSub}</div>}
                      {loadPct !== null && (
                        <div className="ov-prog-wrap">
                          <div
                            className="ov-prog-fill"
                            style={{ width: `${loadPct}%` }}
                          />
                        </div>
                      )}
                      <button
                        className="btn btn-ghost btn-sm ov-cancel"
                        onClick={() => abortRef.current?.abort()}
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {rows.length === 0 && !loading ? (
                    <div className="empty">
                      <div className="empty-ico">⬡</div>
                      <div className="empty-title">No requirements loaded</div>
                      <div className="empty-sub">
                        Upload a TOR PDF and click{" "}
                        <strong>Extract Requirements</strong>
                        <br />
                        or click <strong>+ Row</strong> to enter manually.
                      </div>
                    </div>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={onDragEnd}
                    >
                      <SortableContext
                        items={filtered.map((r) => r.id)}
                        strategy={verticalListSortingStrategy}
                      >
                    <table role="table">
                      <thead role="rowgroup">
                        <tr>
                          <th className="c-sel" scope="col">
                            <input
                              type="checkbox"
                              className="row-check"
                              checked={allFilteredSelected}
                              onChange={toggleSelectAllFiltered}
                              title="Select all shown rows"
                              aria-label="Select all shown rows"
                            />
                          </th>
                          <th className="c-no" scope="col">#</th>
                          <th className="c-ref" scope="col">Ref.</th>
                          <th className="c-req" scope="col">
                            Requirement / Specification
                            <span
                              style={{
                                color: "var(--txt3)",
                                fontWeight: 400,
                                marginLeft: 4,
                              }}
                            >
                              (verbatim)
                            </span>
                          </th>
                          {showTr && (
                            <th className="c-tr" scope="col">English Translation</th>
                          )}
                          {showCat && <th className="c-cat" scope="col">Category</th>}
                          <th className="c-sts" scope="col">Status</th>
                          <th className="c-rem" scope="col">Remarks</th>
                          <th className="c-del" scope="col"><span className="sr-only">Row actions</span></th>
                        </tr>
                      </thead>
                      <tbody role="rowgroup">
                        {filtered.map((row, i) => (
                          <SortableRow
                            key={row.id}
                            row={row}
                            index={i}
                            showTr={showTr}
                            showCat={showCat}
                            selectedRow={selectedRow}
                            setSelectedRow={setSelectedRow}
                            upd={upd}
                            del={del}
                            insertAfter={insertAfter}
                            dragEnabled={dragEnabled}
                            selected={selectedIds.has(row.id)}
                            onToggleSelect={toggleSelect}
                            isDup={dupIds.has(row.id)}
                            onZoomImage={setLightbox}
                          />
                        ))}
                      </tbody>
                    </table>
                      </SortableContext>
                    </DndContext>
                  )}
                </div>

                <div className="bottom-bar">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={addRow}
                    disabled={loading}
                  >
                    + Add Row
                  </button>
                  {selectedRow !== null && (
                    <span className="bottom-hint">
                      Row selected — click a library item to apply its text to
                      Remarks, or click row again to deselect.
                    </span>
                  )}
                  {selectedRow === null && rows.length > 0 && (
                    <span className="bottom-hint">
                      Click any row to select it for targeted library
                      application.
                    </span>
                  )}
                </div>
              </main>
            </div>
          </div>
        );
      }

export default App;
