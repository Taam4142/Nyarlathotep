// Layout breakpoints.
//
// These numbers are measured, not conventional — see RESPONSIVE_PLAN.md §3.1.
// The two-pane desktop layout needs the 288px sidebar plus the matrix table's
// own 817px of column widths, so it stops working just above 1100px. Below
// that the sidebar has to get out of the way; below ~700px the table cannot be
// a table at all, because squeezing the Requirement column under ~250px makes
// Thai text unreadable.
//
// Centralised here so the CSS media queries and the JS that mirrors them cannot
// drift apart — a drawer that slides at one width while its dialog semantics
// switch at another is a genuinely confusing bug.

/** Below this, the sidebar becomes an off-canvas drawer. */
export const COMPACT_MAX = 1119;
/** Below this, the matrix renders as cards instead of a table. */
export const PHONE_MAX = 699;

/** Matches the `@media (max-width: 1119px)` block in styles.css. */
export const MEDIA_COMPACT = `(max-width: ${COMPACT_MAX}px)`;
/** Matches the `@media (max-width: 699px)` block in styles.css. */
export const MEDIA_PHONE = `(max-width: ${PHONE_MAX}px)`;

/** True when the viewport width falls in the compact (drawer) range or below. */
export const isCompactWidth = (width: number): boolean => width <= COMPACT_MAX;
/** True when the viewport width falls in the phone (card) range. */
export const isPhoneWidth = (width: number): boolean => width <= PHONE_MAX;

/**
 * Coarse pointer — a finger or stylus rather than a mouse.
 *
 * Used to hide the figure-snip tool, which is a mouse drag-crop and cannot work
 * on touch (A11Y_PLAN P4 records the keyboard gap; touch is the same problem).
 * Deliberately a POINTER query, not a width one: the question is "can this
 * device drag precisely", which a narrow desktop window can and a wide tablet
 * cannot. RESPONSIVE_PLAN scope (a) makes Snip a stated desktop feature.
 */
export const MEDIA_COARSE_POINTER = "(pointer: coarse)";
