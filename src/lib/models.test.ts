import { describe, it, expect } from "vitest";
import {
  CLAUDE_MODELS,
  GEMINI_MODELS,
  DEFAULT_CLAUDE_MODEL,
  DEFAULT_GEMINI_MODEL,
  claudeModelShort,
} from "./models";

describe("model registry (A1)", () => {
  it("defaults point at the first option in each list", () => {
    expect(DEFAULT_CLAUDE_MODEL).toBe(CLAUDE_MODELS[0].id);
    expect(DEFAULT_GEMINI_MODEL).toBe(GEMINI_MODELS[0].id);
  });

  it("uses current (non-legacy) model ids", () => {
    const ids = [...CLAUDE_MODELS, ...GEMINI_MODELS].map((m) => m.id);
    // The pre-migration literals that predated the current lineup must be gone.
    expect(ids).not.toContain("claude-sonnet-4-20250514");
    expect(ids).not.toContain("claude-opus-4-5");
    expect(ids).not.toContain("gemini-2.0-flash");
    expect(ids).not.toContain("gemini-2.5-pro-preview-06-05");
  });

  it("claudeModelShort resolves the short label, falling back to the id", () => {
    expect(claudeModelShort(CLAUDE_MODELS[0].id)).toBe(CLAUDE_MODELS[0].short);
    expect(claudeModelShort("unknown-model")).toBe("unknown-model");
  });
});
