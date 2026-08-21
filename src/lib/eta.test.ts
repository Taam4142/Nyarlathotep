import { describe, it, expect } from "vitest";
import {
  formatDuration,
  estimateRemainingMs,
  createEtaTracker,
  TESSERACT_MS_PER_PAGE,
  ETA_SHOW_MS,
  ETA_HIDE_MS,
} from "./eta";

describe("formatDuration", () => {
  it("is coarse on purpose — the measurement spread does not justify seconds", () => {
    expect(formatDuration(65_000)).toBe("about a minute");
    expect(formatDuration(120_000)).toBe("about 2 min");
    expect(formatDuration(450_000)).toBe("about 8 min");
  });

  it("switches to hours when it has to", () => {
    expect(formatDuration(3_600_000)).toBe("about 1 hr");
    expect(formatDuration(3_900_000)).toBe("about 1 hr 5 min");
  });

  it("returns nothing for nonsense rather than 'about NaN min'", () => {
    expect(formatDuration(NaN)).toBe("");
    expect(formatDuration(-1)).toBe("");
  });
});

describe("estimateRemainingMs", () => {
  it("says nothing until a page other than the first has completed", () => {
    // One interval is only ever the first page, which carries startup cost.
    expect(estimateRemainingMs([9000], 1, 50)).toBeNull();
    expect(estimateRemainingMs([], 0, 50)).toBeNull();
  });

  it("extrapolates from observed pages", () => {
    // Intervals: first (dropped), then 2s, 2s. 47 pages left at 2s = 94s.
    expect(estimateRemainingMs([9000, 2000, 2000], 3, 50)).toBe(94_000);
  });

  it("DISCARDS the first interval, which carries worker startup", () => {
    // The 30s first page is the language-pack download, not a typical page.
    // Including it would put the estimate at ~11x the honest one.
    const withStartup = estimateRemainingMs([30_000, 2000, 2000], 3, 50);
    expect(withStartup).toBe(94_000);
  });

  it("returns 0, not a negative, once every page is done", () => {
    expect(estimateRemainingMs([5000, 2000], 50, 50)).toBe(0);
  });
});

describe("createEtaTracker", () => {
  it("shows nothing on the first page when the engine's speed is unmeasured", () => {
    // Typhoon, Vision and Gemini pass no fallback: inventing a number for an
    // engine nobody has timed is worse than staying quiet.
    const t = createEtaTracker();
    expect(t.tick(1, 100, 0)).toBe("");
  });

  it("uses the fallback to bridge the first pages, then the observed rate", () => {
    const t = createEtaTracker(TESSERACT_MS_PER_PAGE);
    // Page 1: no data yet — 100 pages x 4.5s ≈ 7.5 min.
    expect(t.tick(1, 100, 0)).toBe(" · about 8 min left");
    // Page 2: still only the startup interval, so still the fallback.
    expect(t.tick(2, 100, 30_000)).toContain("left");
    // Page 3+: this machine is running at 1s/page, far faster than the constant.
    // The estimate must follow the machine, not the constant.
    expect(t.tick(3, 100, 31_000)).toBe(" · about 2 min left");
  });

  it("stays silent for a wait too short to be worth mentioning", () => {
    const t = createEtaTracker(TESSERACT_MS_PER_PAGE);
    t.tick(1, 3, 0);
    t.tick(2, 3, 1000);
    // One page left at ~1s: nowhere near the threshold.
    expect(t.tick(3, 3, 2000)).toBe("");
    expect(ETA_SHOW_MS).toBe(60_000);
  });

  it("tracks a slowdown rather than clinging to an early guess", () => {
    const t = createEtaTracker();
    t.tick(1, 60, 0);
    t.tick(2, 60, 1000);
    t.tick(3, 60, 2000); // 1s/page so far
    const fast = t.tick(4, 60, 3000);
    // Pages now take 10s each.
    for (let p = 5; p <= 12; p++) t.tick(p, 60, 3000 + (p - 4) * 10_000);
    const slow = t.tick(13, 60, 93_000);
    const mins = (s: string) => Number(/(\d+)/.exec(s)?.[1] ?? 0);
    expect(mins(slow)).toBeGreaterThan(mins(fast));
  });
});

describe("createEtaTracker — hysteresis band", () => {
  it("holds its state inside the band instead of flickering", () => {
    // Observed live on a 31-page run: "…page 20 of 31", then "…page 21 of 31 ·
    // about a minute left", then silent again. With one threshold a wobble
    // toggles the line; with a band, only a decisive move does.
    //
    // Steady 1 s/page over 100 pages, so remaining at page p is (101-p) seconds.
    const t = createEtaTracker();
    const at = (p: number) => t.tick(p, 100, (p - 1) * 1000);
    for (let p = 1; p <= 40; p++) at(p);
    expect(at(41)).toContain("left"); // 60s — at ETA_SHOW_MS, starts speaking
    for (let p = 42; p <= 49; p++) at(p);
    expect(at(50)).toContain("left"); // 51s — inside the band, keeps speaking
    for (let p = 51; p <= 64; p++) at(p);
    expect(at(65)).toBe(""); // 36s — below ETA_HIDE_MS, finally stops
    expect(ETA_HIDE_MS).toBeLessThan(ETA_SHOW_MS);
  });
  it("speaks again if the run genuinely slows down — a latch would not", () => {
    // The reason this is a band and not a one-way latch. Remaining time does
    // NOT only trend toward zero: if pages get slower it grows, and a latched
    // tracker would sit silent through a wait that had become long again.
    const t = createEtaTracker();
    t.tick(1, 60, 0);
    t.tick(2, 60, 1000);
    t.tick(3, 60, 2000);
    const quiet = t.tick(4, 60, 3000); // ~1s/page, 56 left ≈ 56s — in band, silent
    expect(quiet).toBe("");
    for (let p = 5; p <= 12; p++) t.tick(p, 60, 3000 + (p - 4) * 10_000);
    // Now 10s/page with ~48 pages left — unmistakably long, so it speaks.
    expect(t.tick(13, 60, 93_000)).toContain("left");
  });

  it("does not treat missing data as a short wait", () => {
    const t = createEtaTracker();
    expect(t.tick(1, 100, 0)).toBe("");
    t.tick(2, 100, 10_000);
    expect(t.tick(3, 100, 20_000)).toContain("left");
  });
});
