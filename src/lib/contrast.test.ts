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
  stripComments,
  extractInheritedColorRules,
  inheritedKey,
  TEXT_SURFACES,
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

  it("ignores token-shaped text inside comments (regression)", () => {
    // This is not hypothetical. A comment added while fixing --amber read
    //     /* --accent-text, not --amber: ... Was 3.69:1 in dark; ... */
    // and the parser matched "--amber: ... ;" INSIDE it as a real definition,
    // so every dark accent ratio silently became unresolvable.
    const css = `
      :root { --real: #ffffff; }
      /* --fake: this sentence ends with a semicolon; and should be ignored */
      .x { color: var(--real); }
    `;
    const t = parseTokens(css, "light");
    expect(t["--real"]).toBe("#ffffff");
    expect(t["--fake"]).toBeUndefined();
  });

  it("reads the dark block only, not the rest of the file after it (regression)", () => {
    // Taking css.slice(darkStart) drags in every rule that follows the media
    // query, so an ordinary later declaration would masquerade as a dark override.
    const css = `
      :root { --tone: #111111; }
      @media (prefers-color-scheme: dark) {
        :root { --tone: #eeeeee; }
      }
      .later { --tone: #ff0000; }
    `;
    expect(parseTokens(css, "dark")["--tone"]).toBe("#eeeeee");
    expect(parseTokens(css, "light")["--tone"]).toBe("#111111");
  });

  it("stripComments removes comments without disturbing declarations", () => {
    expect(stripComments("a{/* x */color:red;}").trim()).toBe("a{color:red;}");
    expect(stripComments("/* multi\nline */b{}").trim()).toBe("b{}");
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
  // Empty — every pairing in styles.css now clears AA in both themes.
  //
  // It reached empty on 2026-08-18 when Phase C landed. Adding an entry here is
  // a deliberate act: it must name the phase or decision that will retire it,
  // and the stale-entry test below will fail once the pairing is fixed, forcing
  // the line to be removed rather than left to rot.
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

  it("library status labels clear AA on the card background they sit on", () => {
    // The extractor only sees rules that declare colour AND background together.
    // Here they are split: .lib-item sets background: var(--sur2), while
    // .lib-label-* set the colour. That pairing is real but invisible to the
    // guard, so it is asserted explicitly.
    for (const scope of ["light", "dark"] as const) {
      const t = parseTokens(CSS, scope);
      for (const status of ["comply", "partial", "notcomply", "na"]) {
        const fg = t["--" + status];
        const ratio = contrastRatio(fg, t["--sur2"]);
        expect(
          ratio,
          `${scope} .lib-label-${status}: ${fg} on --sur2 ${t["--sur2"]}`,
        ).toBeGreaterThanOrEqual(AA_NORMAL);
      }
    }
  });

  it("white text on the accent fill clears AA in both themes (.btn-amber)", () => {
    // Also split across rules: .btn-amber sets both, but via the --amber alias,
    // and this is the pairing that forced the dark accent to be darkened. Pinned
    // so a future accent tweak cannot quietly re-break the primary button.
    for (const scope of ["light", "dark"] as const) {
      const t = parseTokens(CSS, scope);
      const fill = resolveToken(t["--amber"], t, t["--sur0"]);
      const fg = resolveToken(t["--on-amber"], t, t["--sur0"]);
      expect(contrastRatio(fg!, fill!), `${scope}: ${fg} on ${fill}`).toBeGreaterThanOrEqual(AA_NORMAL);
    }
  });

  it("--sur4 carries no text (excluded from the matrix by design)", () => {
    // DESIGN_TOKENS.md invariant 3: --sur4 is the scrollbar thumb. If a rule ever
    // puts text on it, the exclusion stops being safe and this must be revisited.
    const onSur4 = extractPairings(CSS, "light").filter((p) => p.backgroundToken === "--sur4");
    expect(onSur4).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Inherited-background text (A11Y_PLAN finding O).
//
// extractPairings only sees rules declaring BOTH colour and background. That is
// 31 rules; another 62 set a colour and inherit their background, and were
// invisible. `.upload-txt strong` shipped at 3.14:1 through exactly that gap.
// ---------------------------------------------------------------------------
describe("extractInheritedColorRules", () => {
  it("finds a rule that sets only a colour", () => {
    const css = [
      ":root { --sur1: #ffffff; --txt: #000000; }",
      ".a { color: var(--txt); }",
    ].join("\n");
    const rules = extractInheritedColorRules(css, "light", "#ffffff", ["--sur1"]);
    expect(rules).toHaveLength(1);
    expect(rules[0].selector).toBe(".a");
    expect(rules[0].ratio).toBeCloseTo(21, 0);
  });

  it("ignores rules that paint their own background", () => {
    // Those are extractPairings' territory; checking them here would double-report
    // and, worse, check them against surfaces they never sit on.
    const css = [
      ":root { --sur1: #ffffff; --txt: #000000; --sur2: #eeeeee; }",
      ".a { color: var(--txt); background: var(--sur2); }",
      ".b { color: var(--txt); background-image: linear-gradient(red, blue); }",
    ].join("\n");
    expect(extractInheritedColorRules(css, "light", "#ffffff", ["--sur1"])).toHaveLength(0);
  });

  it("reports the WORST surface, since static CSS cannot know which one applies", () => {
    const css = [
      ":root { --sur1: #ffffff; --sur2: #767676; --txt: #949494; }",
      ".a { color: var(--txt); }",
    ].join("\n");
    const [r] = extractInheritedColorRules(css, "light", "#ffffff", ["--sur1", "--sur2"]);
    // #949494 is closer to #767676 than to white, so --sur2 is the worse ground.
    expect(r.surfaceToken).toBe("--sur2");
  });

  it("excludes --sur4 from the default surfaces", () => {
    // It is the scrollbar thumb colour and nothing else. Including it failed five
    // sound text tokens against a background no text is ever painted on.
    expect(TEXT_SURFACES).not.toContain("--sur4");
  });
});

describe("every inherited-background text rule meets AA, in both themes", () => {
  const CSS = fs.readFileSync(path.join(__dirname, "../styles.css"), "utf8");

  for (const scope of ["light", "dark"] as const) {
    it(`${scope}: no inherited-colour rule falls below AA on any surface it could land on`, () => {
      const failures = extractInheritedColorRules(CSS, scope)
        .filter((r) => r.ratio < AA_NORMAL)
        .map((r) => `${inheritedKey(r)} on ${r.surfaceToken} = ${r.ratio.toFixed(2)}`);

      expect(failures).toEqual([]);
    });
  }
});
