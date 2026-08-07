// Centralized model registry — the single place to refresh provider model IDs.
// When a provider ships a new version, change the `id` here only; keep `label`
// and `short` stable so the dropdowns and progress messages don't shift.
// (RISK_REVIEW A1: IDs were previously scattered across App.tsx as literals.)

export interface ModelOption {
  id: string;
  /** Full label shown in the model dropdown. */
  label: string;
  /** Short name used in progress / status messages. */
  short: string;
}

/** Claude models, called through the /api/claude proxy (Anthropic Messages API). */
export const CLAUDE_MODELS: ModelOption[] = [
  { id: "claude-sonnet-5", label: "Sonnet — Fast", short: "Sonnet" },
  { id: "claude-opus-5", label: "Opus — Max Accuracy", short: "Opus" },
];
export const DEFAULT_CLAUDE_MODEL = CLAUDE_MODELS[0].id;

/** Gemini models, called directly from the browser. */
export const GEMINI_MODELS: ModelOption[] = [
  { id: "gemini-3.6-flash", label: "Flash — Fast", short: "Flash" },
  { id: "gemini-3.1-pro", label: "Pro — Max Accuracy", short: "Pro" },
];
export const DEFAULT_GEMINI_MODEL = GEMINI_MODELS[0].id;

/** Typhoon OCR — Thai-specialized VLM, via the /api/typhoon proxy.
 * "typhoon-ocr" is Typhoon OCR 1.5, the current model. (The old
 * "typhoon-ocr-preview" / v1 was deprecated 2025-12-31.) */
export const TYPHOON_MODEL = "typhoon-ocr";

/** Short display name for a Claude model id (used in progress messages). */
export function claudeModelShort(id: string): string {
  return CLAUDE_MODELS.find((m) => m.id === id)?.short ?? id;
}

export interface EngineOption {
  id: string;
  /** Shown as the option/button text — must work with no hover (mobile, keyboard). */
  label: string;
  /** Fuller sentence shown as a `title` hover tooltip. Bonus layer only — never
   * the only place essential info lives (tooltips are unreliable: hover-only,
   * inconsistent across browsers/screen readers). */
  tooltip: string;
}

/** Top-bar extraction-engine picker (the `aiEngine` state in App.tsx).
 * Tooltip wording is a deliberate paraphrase of the sidebar panel / Help
 * modal copy for each engine — kept consistent with those, not a new set of
 * claims. */
export const EXTRACTION_ENGINES: EngineOption[] = [
  {
    id: "typhoon",
    label: "✦ Typhoon — Thai · Free",
    tooltip: "Best free Thai OCR — no key needed from you, handled server-side.",
  },
  {
    id: "browser",
    label: "🆓 Browser OCR — No Key",
    tooltip: "Runs entirely in your browser — free, offline. Lower accuracy than the AI engines.",
  },
  {
    id: "digitaltext",
    label: "✎ Text PDF — No AI · exact",
    tooltip: "Digital PDFs only. Reads the embedded text instantly — no AI, no OCR, exact.",
  },
  {
    id: "claude",
    label: "⚡ Claude — Paid API",
    tooltip: "Highest-fidelity structuring for messy or complex TORs. Paid API, billed to your Anthropic account.",
  },
  {
    id: "gemini",
    label: "✦ Gemini — Your key",
    tooltip: "Good accuracy. Paste your own key — kept in this tab only, never saved.",
  },
];

/** Scanned-PDF OCR feeder picker under Claude/Gemini (the `ocrEngine` state).
 * Note: ids intentionally differ from EXTRACTION_ENGINES' ("tesseract" here
 * vs "browser" there) — matches the existing `ocrEngine` state values, not
 * renamed as part of this change. */
export const OCR_FEEDERS: EngineOption[] = [
  {
    id: "typhoon",
    label: "Typhoon (Thai)",
    tooltip: "Best Thai OCR. Free tier via the server-side proxy.",
  },
  {
    id: "vision",
    label: "Google Vision",
    tooltip: "Good Thai. Free tier 1,000 pages/month — needs a Google Cloud key in Cloudflare env.",
  },
  {
    id: "tesseract",
    label: "Browser Free",
    tooltip: "Free, runs in your browser. No OCR cost, but lower accuracy.",
  },
  {
    id: "claude",
    label: "Claude Vision",
    tooltip: "Reads page images via Claude Vision through your proxy. Billed to your Anthropic API.",
  },
  {
    id: "gemini",
    label: "Gemini Vision",
    tooltip: "Reads page images directly via Gemini. Needs your key above; free tier covers most workloads.",
  },
];
