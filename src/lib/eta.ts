// Wait-time estimates for page-by-page extraction.
//
// WHY: OCR is slow enough to look broken. Measured 2026-08-21 (TESTING.md §3f),
// browser Tesseract runs ~4.5 s/page, so a 100-page TOR takes ~7.5 minutes with
// nothing on screen but a page counter. A user is entitled to know whether that
// means "wait" or "something has hung".
//
// WHY NOT A FIXED RATIO: the obvious approach is pages x a constant. The same
// measurement makes that a bad estimator — per-page time ranged 1.1 s to 8.6 s
// on ONE document, an eightfold spread driven by how much text a page carries,
// and 4.5 s/page was one machine. A fixed number would routinely be wrong by
// minutes, and a confidently wrong ETA is worse than no ETA.
//
// SO: measure this document, on this machine, while it runs. After two pages
// there is a real rate to extrapolate from, and it self-corrects as it goes.
// A caller may supply a rough constant to bridge the gap before then; callers
// with no measured figure (Typhoon, Vision, Gemini) simply show nothing until
// the real rate is known, which is more honest than inventing one.

/**
 * Mean per-page wall-clock for browser Tesseract at render scale 3, measured over
 * 31 pages on one machine (TESTING.md §3f). A bridge for the first pages only —
 * it is replaced by the observed rate as soon as there is one, and is deliberately
 * NOT used by engines whose speed has never been measured.
 */
export const TESSERACT_MS_PER_PAGE = 4500;

/** Start showing an estimate above this — a short wait needs no commentary. */
export const ETA_SHOW_MS = 60_000;
/**
 * Stop showing it below this. The gap between the two is deliberate: with a
 * single threshold the line flickers off and on as the per-page rate wobbles
 * across it — observed live on a 31-page run, where it read "…page 20 of 31",
 * then "…page 21 of 31 · about a minute left", then went silent again.
 *
 * A one-way latch would be simpler and is WRONG: if pages slow down materially
 * the remaining time genuinely grows, and a tracker that had gone quiet would
 * sit silent through a wait that had become long again.
 */
export const ETA_HIDE_MS = 40_000;

/** Intervals averaged. Enough to smooth the page-to-page spread, short enough to track drift. */
const WINDOW = 8;

/**
 * Human wait time. Deliberately coarse: the underlying spread does not justify
 * "4 min 37 s", and a rounded figure reads as the estimate it is.
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "";
  const min = Math.round(ms / 60_000);
  if (ms < 90_000) return "about a minute";
  if (min < 60) return `about ${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `about ${h} hr ${m} min` : `about ${h} hr`;
}

/**
 * Remaining milliseconds from observed per-page intervals, or null when there is
 * not enough data to say anything.
 *
 * The FIRST interval is dropped: it carries worker startup and, on a cold run,
 * the ~15 MB Thai language-pack download, so including it inflates every later
 * estimate.
 */
export function estimateRemainingMs(
  intervals: readonly number[],
  completedPages: number,
  totalPages: number,
): number | null {
  const usable = intervals.slice(1); // drop first-page startup cost
  if (usable.length === 0) return null;
  const recent = usable.slice(-WINDOW);
  const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
  const left = totalPages - completedPages;
  if (left <= 0) return 0;
  return mean * left;
}

/** Tracks page timings across one extraction run and renders the progress line. */
export interface EtaTracker {
  /**
   * Call as page `page` of `total` STARTS (which is when the OCR helpers report
   * progress). Returns the suffix to append to the progress line, or "" when
   * there is nothing worth saying.
   */
  tick(page: number, total: number, now?: number): string;
}

/**
 * @param fallbackMsPerPage Optional rough figure used only until two pages have
 *   completed. Omit it for engines whose speed has not been measured.
 */
export function createEtaTracker(fallbackMsPerPage?: number): EtaTracker {
  const marks: number[] = [];
  let showing = false;

  return {
    tick(page, total, now = Date.now()) {
      marks.push(now);
      const completed = page - 1;

      const intervals: number[] = [];
      for (let i = 1; i < marks.length; i++) intervals.push(marks[i] - marks[i - 1]);

      let remaining = estimateRemainingMs(intervals, completed, total);
      if (remaining === null && fallbackMsPerPage != null) {
        remaining = fallbackMsPerPage * (total - completed);
      }
      if (remaining === null) return ""; // no data yet — may still speak later

      // Hysteresis band: cross ETA_SHOW_MS to start, fall below ETA_HIDE_MS to
      // stop, hold the previous state in between.
      if (remaining >= ETA_SHOW_MS) showing = true;
      else if (remaining < ETA_HIDE_MS) showing = false;

      return showing ? ` · ${formatDuration(remaining)} left` : "";
    },
  };
}
