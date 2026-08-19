import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  COMPACT_MAX,
  PHONE_MAX,
  MEDIA_COMPACT,
  MEDIA_PHONE,
  isCompactWidth,
  isPhoneWidth,
} from "./breakpoints";

const CSS = fs.readFileSync(path.resolve(__dirname, "../styles.css"), "utf8");

describe("breakpoints", () => {
  it("orders the ranges correctly", () => {
    expect(PHONE_MAX).toBeLessThan(COMPACT_MAX);
  });

  it("classifies the widths the plan calls out", () => {
    // Phone
    expect(isPhoneWidth(375)).toBe(true);
    expect(isPhoneWidth(414)).toBe(true);
    expect(isCompactWidth(375)).toBe(true); // phone is also compact
    // Compact but not phone
    expect(isPhoneWidth(768)).toBe(false);
    expect(isCompactWidth(768)).toBe(true);
    expect(isCompactWidth(1024)).toBe(true);
    // Desktop — the two-pane layout needs ~1105px, so 1120 is the first safe width
    expect(isCompactWidth(1120)).toBe(false);
    expect(isCompactWidth(1280)).toBe(false);
  });

  it("the media strings match the constants", () => {
    expect(MEDIA_COMPACT).toBe(`(max-width: ${COMPACT_MAX}px)`);
    expect(MEDIA_PHONE).toBe(`(max-width: ${PHONE_MAX}px)`);
  });

  it("styles.css actually uses these exact widths", () => {
    // The whole point of this module is that the CSS and the JS mirroring it
    // cannot drift. A drawer that slides at one width while its dialog
    // semantics switch at another is a real and confusing bug, so the
    // stylesheet is asserted against the constants rather than trusted.
    expect(CSS).toContain(`@media (max-width: ${COMPACT_MAX}px)`);
  });
});
