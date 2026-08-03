// @ts-nocheck
// Carried over from the single-file app during the Vite + TypeScript migration.
// This UI component is pending gradual typing; the extracted logic in src/lib/* is
// fully typed and unit-tested. Behavior is unchanged from the pre-migration app.
import { useState, useRef, useCallback, useMemo, useEffect } from "react";
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
} from "./lib/models";
import { fetchWithRetry } from "./lib/net";
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
import {
  readLocal,
  writeLocal,
  clearLocal,
  matrixToJson,
  matrixFromJson,
} from "./lib/storage";

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
  const style = {
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
      className={selectedRow === row.id ? "sel-row" : ""}
      onClick={() => setSelectedRow(selectedRow === row.id ? null : row.id)}
    >
      <td className="c-no" onClick={(e) => e.stopPropagation()}>
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
      <td className="c-ref" onClick={(e) => e.stopPropagation()}>
        <div className="td-p">
          <input
            className="ref-in"
            value={row.ref}
            onChange={(e) => upd(row.id, "ref", e.target.value)}
            placeholder="CL-001"
          />
        </div>
      </td>
      <td className="c-req" onClick={(e) => e.stopPropagation()}>
        <div className="td-p">
          <textarea
            className="cell-in"
            value={row.requirement}
            onChange={(e) => upd(row.id, "requirement", e.target.value)}
            placeholder="Verbatim requirement text (Thai/English)…"
            rows={2}
          />
          {row._warn && (
            <div className="warn-flag">
              ⚠ May be translated — verify verbatim
            </div>
          )}
        </div>
      </td>
      {showTr && (
        <td className="c-tr" onClick={(e) => e.stopPropagation()}>
          <div className="td-p">
            <textarea
              className="cell-in"
              value={row.translation}
              onChange={(e) => upd(row.id, "translation", e.target.value)}
              placeholder="English translation…"
              rows={2}
            />
          </div>
        </td>
      )}
      {showCat && (
        <td className="c-cat" onClick={(e) => e.stopPropagation()}>
          <div className="td-p">
            <select
              className="cat-sel"
              value={row.category}
              onChange={(e) => upd(row.id, "category", e.target.value)}
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
      <td className="c-sts" onClick={(e) => e.stopPropagation()}>
        <div className="td-p">
          <select
            className={`sts-sel sts-${row.status}`}
            value={row.status}
            onChange={(e) => upd(row.id, "status", e.target.value)}
          >
            {STATUS_OPTS.map((o) => (
              <option key={o.v} value={o.v}>
                {o.l}
              </option>
            ))}
          </select>
        </div>
      </td>
      <td className="c-rem" onClick={(e) => e.stopPropagation()}>
        <div className="td-p">
          <textarea
            className="cell-in"
            style={{ fontFamily: "var(--font-thai)", fontSize: 14 }}
            value={row.remarks}
            onChange={(e) => upd(row.id, "remarks", e.target.value)}
            placeholder="Standard response or notes…"
            rows={2}
          />
        </div>
      </td>
      <td className="c-del" onClick={(e) => e.stopPropagation()}>
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
        const [filter, setFilter] = useState("all");
        const [showTr, setShowTr] = useState(() => persisted?.showTr ?? false);
        const [showCat, setShowCat] = useState(() => persisted?.showCat ?? true);
        const [selectedRow, setSelectedRow] = useState(null);
        const [dragging, setDragging] = useState(false);
        const [showLibAdd, setShowLibAdd] = useState(false);
        const [newLib, setNewLib] = useState({
          label: "",
          text: "",
          status: "comply",
        });
        const [ocrEngine, setOcrEngine] = useState("typhoon");
        const [aiEngine, setAiEngine] = useState("typhoon");
        const [geminiKey, setGeminiKey] = useState("");
        const [geminiModel, setGeminiModel] = useState(DEFAULT_GEMINI_MODEL);
        const fileRef = useRef();
        const tableRef = useRef();
        const abortRef = useRef(null);

        const upd = (id, f, v) =>
          setRows((r) =>
            r.map((row) => (row.id === id ? { ...row, [f]: v } : row)),
          );
        const del = (id) => setRows((r) => r.filter((row) => row.id !== id));
        const addRow = () => {
          const r = mkRow({
            ref: `CL-${String(rows.length + 1).padStart(3, "0")}`,
          });
          setRows((p) => [...p, r]);
          setTimeout(() => {
            const ta = tableRef.current?.querySelectorAll("textarea");
            if (ta && ta.length) ta[ta.length - 2]?.focus();
          }, 60);
        };
        // Insert a blank row directly below `id`; it inherits the neighbor's
        // status so it stays visible even when a status filter is active.
        const insertAfter = (id) =>
          setRows((p) => {
            const i = p.findIndex((row) => row.id === id);
            const nr = mkRow({ status: i >= 0 ? p[i].status : "comply" });
            return insertAfterId(p, id, nr);
          });
        const sensors = useSensors(
          useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
          useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
          }),
        );
        const onDragEnd = (e) => {
          const { active, over } = e;
          if (over && active.id !== over.id)
            setRows((p) => reorderByIds(p, active.id, over.id));
        };

        // Autosave the working matrix to this browser (debounced). F1 persistence.
        useEffect(() => {
          const t = setTimeout(
            () => writeLocal({ project, rows, lib, showTr, showCat }),
            400,
          );
          return () => clearTimeout(t);
        }, [project, rows, lib, showTr, showCat]);

        // Tell the user once when a previous session was restored from this browser.
        useEffect(() => {
          if (persisted?.rows?.length)
            setInfo(
              `Restored your last session (${persisted.rows.length} row${persisted.rows.length === 1 ? "" : "s"}) — autosaved in this browser. Use “New” to start fresh.`,
            );
          // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);

        const jsonRef = useRef();
        const saveJson = () => {
          const blob = new Blob([matrixToJson(project, rows, lib)], {
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
            setRows(parsed.rows);
            setProject(parsed.project);
            if (parsed.lib) setLib(parsed.lib);
            setSelectedRow(null);
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
              "Clear the current matrix? This can't be undone — use “Save .json” first if you want to keep it.",
            )
          )
            return;
          setRows([]);
          setProject("");
          setSelectedRow(null);
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

        const doExtract = async () => {
          if (!pdfFile) return;
          setLoading(true);
          setError(null);
          setWarning(null);
          setInfo(null);
          const ctrl = new AbortController();
          abortRef.current = ctrl;
          const signal = ctrl.signal;

          try {
            // ===== BROWSER-ONLY MODE: Tesseract.js OCR + heuristic structuring, ZERO API =====
            if (aiEngine === "browser") {
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
              setWarning(
                "Browser OCR done with no AI. Rows were split heuristically — review the clause boundaries and Thai accuracy, then adjust. For cleaner structuring, switch to an AI engine.",
              );
              setTimeout(() => {
                setLoading(false);
                setLoadPct(null);
              }, 400);
              return;
            }

            // ===== TYPHOON MODE: Typhoon OCR (Thai) + heuristic structuring, free tier =====
            if (aiEngine === "typhoon") {
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

        const [testStatus, setTestStatus] = useState(null); // null | 'testing' | 'ok' | 'fail'
        const [testMsg, setTestMsg] = useState("");

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
              const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`;
              const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
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
                    "Blocked by the proxy origin allow-list. In Cloudflare Pages → Settings → Variables, set ALLOWED_ORIGINS to this site's origin (include https://, e.g. https://yog-sothoth.pages.dev) and redeploy.",
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
            await downloadMatrix({ rows, project, showTr, showCat });
            setInfo(
              "Exported .xlsx — Thai text is set to “TH Sarabun New”. If a reviewer's PC doesn't have that font, Excel substitutes a similar one.",
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

        const filtered = useMemo(
          () =>
            filter === "all" ? rows : rows.filter((r) => r.status === filter),
          [rows, filter],
        );

        return (
          <div className="app">
            {/* TOPBAR */}
            <div className="topbar">
              <div className="brand">
                <div className="brand-pulse" />
                <span className="brand-name">Nyarlathotep</span>
              </div>
              <div className="brand-sep" />
              <input
                className="proj-input"
                placeholder="Project name…"
                value={project}
                onChange={(e) => setProject(e.target.value)}
              />
              <div className="topbar-right">
                <select
                  className="model-sel"
                  value={aiEngine}
                  onChange={(e) => {
                    setAiEngine(e.target.value);
                    setTestStatus(null);
                    setTestMsg("");
                  }}
                >
                  <option value="typhoon">✦ Typhoon — Thai · Free</option>
                  <option value="browser">🆓 Browser OCR — No Key</option>
                  <option value="digitaltext">✎ Text PDF — No AI · exact</option>
                  <option value="claude">⚡ Claude</option>
                  <option value="gemini">✦ Gemini</option>
                </select>
                {aiEngine === "claude" && (
                  <select
                    className="model-sel"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
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
                  >
                    {GEMINI_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={addRow}
                  disabled={loading}
                >
                  + Row
                </button>
                <button
                  className="btn btn-amber btn-sm"
                  onClick={exportXLSX}
                  disabled={!rows.length}
                >
                  ↓ Export .xlsx
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={saveJson}
                  disabled={!rows.length}
                  title="Download this matrix as a JSON file you can reopen later"
                >
                  ↓ Save .json
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => jsonRef.current?.click()}
                  title="Load a matrix from a JSON file"
                >
                  ↑ Load .json
                </button>
                <input
                  ref={jsonRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={loadJson}
                  style={{ display: "none" }}
                />
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={clearAll}
                  disabled={!rows.length && !project}
                  title="Clear the matrix and start a new one"
                >
                  New
                </button>
              </div>
            </div>

            <div className="body">
              {/* SIDEBAR */}
              <div className="sidebar">
                {/* PDF section */}
                <div className="sb-sec">
                  <div className="sb-label">TOR Document</div>
                  {!pdfFile ? (
                    <div
                      className={`upload-zone${dragging ? " drag" : ""}`}
                      onClick={() => fileRef.current.click()}
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
                        onClick={doExtract}
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
                      {[
                        ["typhoon", "Typhoon (Thai)"],
                        ["vision", "Google Vision"],
                        ["tesseract", "Browser Free"],
                        ["claude", "Claude Vision"],
                        ["gemini", "Gemini Vision"],
                      ].map(([v, l]) => (
                        <button
                          key={v}
                          onClick={() => setOcrEngine(v)}
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
                            className="lib-item-label"
                            style={{ color: STAT_COLORS[item.status] }}
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
                      <label className="lib-add-label">Label</label>
                      <input
                        className="lib-add-input"
                        placeholder="e.g. Comply — IIoT Gateway"
                        value={newLib.label}
                        onChange={(e) =>
                          setNewLib((p) => ({ ...p, label: e.target.value }))
                        }
                      />
                      <label className="lib-add-label">Response text</label>
                      <textarea
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
                      <label className="lib-add-label">Applies to status</label>
                      <select
                        className="lib-add-sel"
                        value={newLib.status}
                        onChange={(e) =>
                          setNewLib((p) => ({ ...p, status: e.target.value }))
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
              <div className="content">
                {loading && (
                  <div className="progress">
                    <div className="progress-fill" />
                  </div>
                )}

                {/* alerts */}
                {error && (
                  <div className="alert alert-err">
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
                  <div className="alert alert-warn">
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
                  <div className="alert alert-info">
                    <span className="alert-icon">ℹ</span>
                    <div className="alert-body">{info}</div>
                    <button
                      className="alert-dismiss"
                      onClick={() => setInfo(null)}
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
                  </div>
                )}

                {/* table */}
                <div className="table-area" ref={tableRef}>
                  {loading && (
                    <div className="overlay">
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
                    <table>
                      <thead>
                        <tr>
                          <th className="c-no">#</th>
                          <th className="c-ref">Ref.</th>
                          <th className="c-req">
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
                            <th className="c-tr">English Translation</th>
                          )}
                          {showCat && <th className="c-cat">Category</th>}
                          <th className="c-sts">Status</th>
                          <th className="c-rem">Remarks</th>
                          <th className="c-del" />
                        </tr>
                      </thead>
                      <tbody>
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
                            dragEnabled={filter === "all"}
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
              </div>
            </div>
          </div>
        );
      }

export default App;
