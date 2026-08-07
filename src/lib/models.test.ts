import { describe, it, expect } from "vitest";
import {
  CLAUDE_MODELS,
  GEMINI_MODELS,
  DEFAULT_CLAUDE_MODEL,
  DEFAULT_GEMINI_MODEL,
  TYPHOON_MODEL,
  claudeModelShort,
  EXTRACTION_ENGINES,
  OCR_FEEDERS,
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

  it("uses Typhoon OCR 1.5, not the deprecated v1 preview", () => {
    // typhoon-ocr-preview was deprecated 2025-12-31.
    expect(TYPHOON_MODEL).toBe("typhoon-ocr");
  });

  it("claudeModelShort resolves the short label, falling back to the id", () => {
    expect(claudeModelShort(CLAUDE_MODELS[0].id)).toBe(CLAUDE_MODELS[0].short);
    expect(claudeModelShort("unknown-model")).toBe("unknown-model");
  });
});

describe("engine option registries (tooltips + labels for the pickers)", () => {
  for (const [name, list] of [
    ["EXTRACTION_ENGINES", EXTRACTION_ENGINES],
    ["OCR_FEEDERS", OCR_FEEDERS],
  ] as const) {
    it(`${name}: every entry has a non-empty label and tooltip, and ids are unique`, () => {
      expect(list.length).toBeGreaterThan(0);
      for (const e of list) {
        expect(e.label.trim().length).toBeGreaterThan(0);
        expect(e.tooltip.trim().length).toBeGreaterThan(0);
      }
      expect(new Set(list.map((e) => e.id)).size).toBe(list.length);
    });
  }

  it("EXTRACTION_ENGINES covers exactly the five aiEngine values the UI branches on", () => {
    expect(EXTRACTION_ENGINES.map((e) => e.id).sort()).toEqual(
      ["browser", "claude", "digitaltext", "gemini", "typhoon"].sort(),
    );
  });

  it("OCR_FEEDERS covers exactly the five ocrEngine values the UI branches on", () => {
    expect(OCR_FEEDERS.map((e) => e.id).sort()).toEqual(
      ["claude", "gemini", "tesseract", "typhoon", "vision"].sort(),
    );
  });
});
