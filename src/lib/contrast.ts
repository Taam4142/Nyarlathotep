// WCAG contrast math + stylesheet token/pairing extraction.
//
// Why this exists: the P3b accessibility pass derived `--txt3` and verified it
// against pure white alone, because nothing recorded which surfaces the token
// actually lands on. It shipped failing four of the five surfaces it is used
// on and stayed that way for months. A Lighthouse run cannot reliably catch
// that either — it audits the DOM present at audit time, so anything behind a
// closed modal, an inactive filter, or an unshown banner is invisible to it.
//
// Reading the stylesheet catches what a browser audit structurally cannot.
// See DESIGN_TOKENS.md for the reference tables this file enforces.

/** WCAG AA minimum for normal-size text. */
export const AA_NORMAL = 4.5;
/** WCAG AA minimum for large text (>=18.66px bold or >=24px) and UI components. */
export const AA_LARGE = 3;

export type Rgb = [number, number, number];

/** Parse `#rgb` or `#rrggbb` into channel values. Throws on anything else. */
export function parseHex(hex: string): Rgb {
  const h = hex.trim().replace(/^#/, "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`not a hex colour: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as Rgb;
}

const toHex = (c: Rgb): string =>
  "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");

/** WCAG 2.x relative luminance. */
export function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two opaque colours. Order-independent. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(parseHex(a));
  const lb = luminance(parseHex(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Composite an `rgba(...)` colour over an opaque background, returning hex. */
export function compositeOver(rgba: string, background: string): string | null {
  const m = rgba.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/);
  if (!m) return null;
  const alpha = m[4] === undefined ? 1 : parseFloat(m[4]);
  const bg = parseHex(background);
  return toHex([
    +m[1] * alpha + bg[0] * (1 - alpha),
    +m[2] * alpha + bg[1] * (1 - alpha),
    +m[3] * alpha + bg[2] * (1 - alpha),
  ]);
}

/**
 * Collect custom-property definitions from a CSS source.
 *
 * `scope` picks which block to read: "light" takes the first (bare `:root`)
 * definition of each token, "dark" prefers a definition appearing inside a
 * `prefers-color-scheme: dark` block and falls back to the light value.
 */
export function parseTokens(css: string, scope: "light" | "dark" = "light"): Record<string, string> {
  const darkStart = css.search(/@media[^{]*prefers-color-scheme:\s*dark/);
  const region =
    scope === "dark" && darkStart !== -1 ? css.slice(darkStart) : css.slice(0, darkStart === -1 ? undefined : darkStart);

  const out: Record<string, string> = {};
  for (const m of region.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)) {
    const name = m[1];
    const value = m[2].trim();
    if (!(name in out)) out[name] = value;
  }
  // Dark blocks only redefine some tokens; inherit the rest from light.
  if (scope === "dark" && darkStart !== -1) {
    const light = parseTokens(css, "light");
    for (const [k, v] of Object.entries(light)) if (!(k in out)) out[k] = v;
  }
  return out;
}

/** Resolve a token value to an opaque hex, following `var(--x)` aliases. */
export function resolveToken(
  value: string,
  tokens: Record<string, string>,
  compositeBase: string,
  depth = 0,
): string | null {
  if (depth > 8) return null;
  const v = value.trim();
  const alias = v.match(/^var\(\s*(--[\w-]+)\s*\)$/);
  if (alias) {
    const next = tokens[alias[1]];
    return next === undefined ? null : resolveToken(next, tokens, compositeBase, depth + 1);
  }
  if (/^#[0-9a-fA-F]{3,8}$/.test(v)) {
    // Ignore 4/8-digit hex with alpha — not used in this stylesheet.
    return v.length === 4 || v.length === 7 ? v : null;
  }
  if (/^rgba?\(/.test(v)) return compositeOver(v, compositeBase);
  return null;
}

export interface Pairing {
  /** Last line of the selector, enough to identify the rule. */
  selector: string;
  colorToken: string;
  backgroundToken: string;
  color: string;
  background: string;
  ratio: number;
}

/**
 * Find every rule block that sets BOTH `color:` and `background:` from tokens,
 * and score its contrast.
 *
 * Deliberately reports only pairings that actually occur. A cartesian product of
 * every text token against every surface over-reports: it counts combinations the
 * app never renders, which would force needlessly extreme values (e.g. `--sur4`
 * is the scrollbar thumb and never carries text).
 */
export function extractPairings(
  css: string,
  scope: "light" | "dark" = "light",
  compositeBase?: string,
): Pairing[] {
  const tokens = parseTokens(css, scope);
  const base = compositeBase ?? tokens["--sur0"] ?? "#ffffff";
  const out: Pairing[] = [];

  for (const block of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = block[1].trim().split("\n").pop()!.trim();
    const body = block[2];
    const cm = body.match(/(?:^|[\s;])color:\s*var\((--[\w-]+)\)/);
    const bm = body.match(/background(?:-color)?:\s*var\((--[\w-]+)\)/);
    if (!cm || !bm) continue;

    const colorToken = cm[1];
    const backgroundToken = bm[1];
    if (!(colorToken in tokens) || !(backgroundToken in tokens)) continue;

    const color = resolveToken(tokens[colorToken], tokens, base);
    const background = resolveToken(tokens[backgroundToken], tokens, base);
    if (!color || !background) continue;

    out.push({
      selector,
      colorToken,
      backgroundToken,
      color,
      background,
      ratio: contrastRatio(color, background),
    });
  }
  return out;
}

/** Stable key for allowlisting a known-failing pairing. */
export const pairingKey = (p: Pairing): string => `${p.colorToken} on ${p.backgroundToken}`;
