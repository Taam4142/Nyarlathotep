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
