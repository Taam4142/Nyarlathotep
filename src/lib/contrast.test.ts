import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  AA_NORMAL,
  contrastRatio,
  luminance,
  parseHex,
  compositeOver,
  parseTokens,
  resolveToken,
  extractPairings,
  pairingKey,
} from "./contrast";

const CSS = fs.readFileSync(path.resolve(__dirname, "../styles.css"), "utf8");

describe("contrast math, anchored against published WCAG values", () => {
  // These are the canonical reference pairs. If any of these drift, every other
  // assertion in this file is meaningless — so they are checked first.
  it("matches known reference ratios exactly", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 2);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 2);
    // #767676 is the canonical "just passes AA on white" grey; #777777 just fails.
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
  });

  it("is order-independent", () => {
    expect(contrastRatio("#123456", "#abcdef")).toBeCloseTo(contrastRatio("#abcdef", "#123456"), 6);
  });

  it("parses 3- and 6-digit hex, and rejects nonsense", () => {
    expect(parseHex("#fff")).toEqual([255, 255, 255]);
    expect(parseHex("0f1117")).toEqual([15, 17, 23]);
    expect(() => parseHex("#12345")).toThrow();
    expect(() => parseHex("rebeccapurple")).toThrow();
  });

  it("computes luminance at the known endpoints", () => {
    expect(luminance([0, 0, 0])).toBeCloseTo(0, 6);
    expect(luminance([255, 255, 255])).toBeCloseTo(1, 6);
  });

  it("composites rgba over an opaque background", () => {
    expect(compositeOver("rgba(0,0,0,1)", "#ffffff")).toBe("#000000");
    expect(compositeOver("rgba(0,0,0,0)", "#ffffff")).toBe("#ffffff");
    expect(compositeOver("rgba(255,255,255,0.5)", "#000000")).toBe("#808080");
    expect(compositeOver("not-a-colour", "#ffffff")).toBeNull();
  });
});

describe("stylesheet token parsing", () => {
  it("reads the light palette from the bare :root block", () => {
    const t = parseTokens(CSS, "light");
    expect(t["--sur1"]).toBe("#ffffff");
    expect(t["--sur2"]).toBe("#f0f2f6");
    expect(t["--txt"]).toBe("#1c2030");
  });

  it("reads the dark palette, inheriting tokens the dark block does not redefine", () => {
    const t = parseTokens(CSS, "dark");
    expect(t["--sur1"]).toBe("#171a21"); // redefined in the dark block
    expect(t["--r-md"]).toBe("8px"); // not redefined -> inherited from light
  });

  it("follows var() aliases (the legacy --amber* -> accent indirection)", () => {
    const t = parseTokens(CSS, "light");
    expect(resolveToken(t["--amber"], t, "#ffffff")).toBe(t["--accent"]);
  });
});

/**
 * The guard.
 *
 * Every `color:` + `background:` pairing in styles.css must clear AA. Pairings
 * that fail today are listed explicitly below and shrink to empty as the phases
 * in LIGHTHOUSE_AUDIT.md §6 land. The allowlist exists so this test protects
 * against NEW regressions from day one instead of sitting red (a permanently
 * red test gets ignored, which is how the original bug survived).
 *
 * To retire an entry: fix the token in styles.css, then delete its line here.
 * Never add an entry to make a failure go away without recording why.
 */
const KNOWN_FAILURES: Record<string, string> = {
  // Light + dark
  "--txt3 on --sur3": "Phase B — help tags; 3.71:1 light",
  "--comply on --comply-bg": "Phase C — status pill; 4.22:1 light",
  "--partial on --partial-bg": "Phase C — status pill; 4.16:1 light",
  "--notcomply on --notcomply-bg": "Phase C — status pill; 3.93:1 light",
  "--na on --na-bg": "Phase C — status pill; 3.94:1 light",
  "--warn on --warn-bg": "Phase C — warning banner; 4.16:1 light",
  "--notcomply on --danger-bg": "Phase C — error banner; 3.99:1 light",

  // Dark-theme only. Found by this guard on its first run — neither the
  // Lighthouse audit (which ran in light mode) nor the manual review caught
  // them. All three pass comfortably in light and fail only in dark, because
  // the dark accent (#6366f1) is lighter than the light one (#4f46e5).
  "--on-amber on --amber": "Phase C — primary button, white on dark accent; 4.47:1 dark (light 6.29)",
  "--amber on --amber-bg": "Phase C — active 'All' filter; 3.69:1 dark (light 5.23)",
  "--accent on --sur3": "Phase C — insert-row hover glyph; 3.17:1 dark (light 5.17)",
};

describe("styles.css contrast guard (DESIGN_TOKENS.md §2)", () => {
  for (const scope of ["light", "dark"] as const) {
    it(`${scope}: no pairing fails AA except the recorded allowlist`, () => {
      const pairings = extractPairings(CSS, scope);
      expect(pairings.length).toBeGreaterThan(10); // extraction actually found rules

      const unexpected = pairings
        .filter((p) => p.ratio < AA_NORMAL && !(pairingKey(p) in KNOWN_FAILURES))
        .map((p) => `${p.selector}: ${pairingKey(p)} = ${p.ratio.toFixed(2)}:1`);

      expect(unexpected).toEqual([]);
    });
  }

  it("the allowlist contains no stale entries (fixed pairings must be removed)", () => {
    // Guards the guard: once a phase lands, its allowlist line has to go, or the
    // protection silently weakens for that token pair.
    const failingNow = new Set(
      (["light", "dark"] as const).flatMap((scope) =>
        extractPairings(CSS, scope)
          .filter((p) => p.ratio < AA_NORMAL)
          .map(pairingKey),
      ),
    );
    const stale = Object.keys(KNOWN_FAILURES).filter((k) => !failingNow.has(k));
    expect(stale).toEqual([]);
  });

  it("--sur4 carries no text (excluded from the matrix by design)", () => {
    // DESIGN_TOKENS.md invariant 3: --sur4 is the scrollbar thumb. If a rule ever
    // puts text on it, the exclusion stops being safe and this must be revisited.
    const onSur4 = extractPairings(CSS, "light").filter((p) => p.backgroundToken === "--sur4");
    expect(onSur4).toEqual([]);
  });
});
