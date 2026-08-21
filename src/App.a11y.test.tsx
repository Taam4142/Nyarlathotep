// @vitest-environment jsdom
//
// Automated accessibility SEMANTICS check (A11Y_PLAN P5a).
//
// ─────────────────────────────────────────────────────────────────────────────
// READ THIS BEFORE TRUSTING A GREEN RUN.
//
// This file checks semantics ONLY: labels, ARIA validity, roles, accessible
// names, heading order, duplicate ids. It is a regression net over work already
// done by hand (A11Y_PLAN A–J), not a way to find new problems.
//
// It CANNOT check contrast, focus visibility, scrollable-region reachability or
// target size, because jsdom has no layout engine — `scrollWidth` always equals
// `clientWidth`, and nothing is ever painted. Every accessibility bug this
// project has actually hit was in that category, so a green run here says
// strictly less than it appears to. The rules disabled below say so individually.
//
// It also applies NO CSS. Vitest does not process stylesheets by default, so
// jsdom computes no display/visibility and axe audits hidden elements as though
// they were visible. That is not theoretical: the first run of this file failed
// "critical" on the file input, which is display:none in the real app and is
// correctly ignored by the browser pass. Prefer giving such an element a real
// accessible name over disabling the rule; if false positives ever pile up,
// enabling `test.css` in the Vite config is the faithful fix, at a speed cost.
//
// The counterpart that DOES cover those is the browser axe pass in
// TESTING.md §3e, run at release time at BOTH a desktop and a mobile width.
// It is what found the landmark, heading and contrast issues this suite cannot.
//
// `jest-axe` is Jest-branded but framework-agnostic — it is just
// `expect.extend(toHaveNoViolations)` over axe-core, and works unchanged under
// Vitest. It is not stray Jest baggage; please don't "clean it up".
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import App from "./App";

expect.extend(toHaveNoViolations);

beforeEach(() => {
  localStorage.clear();
  // index.html is never loaded in a Testing Library render, so the document
  // arrives with no lang and no title. Set them rather than disabling the rules:
  // the real page does have both, and disabling would stop the browser pass in
  // §3e from ever checking them.
  document.documentElement.lang = "en";
  document.title = "Nyarlathotep — TOR Compliance Matrix";
});

afterEach(cleanup);

/**
 * Rules jsdom cannot evaluate. Each is listed with its reason, deliberately here
 * in the test rather than only in the plan — a reader looking at a green run
 * should be able to see what it did not check without leaving the file.
 */
const JSDOM_CANNOT_JUDGE = {
  // No paint, no computed backgrounds. Covered instead by src/lib/contrast.ts
  // (static stylesheet analysis, token-level) and by the browser pass in §3e —
  // which found a real 3.12:1 failure this rule would have reported as passing.
  "color-contrast": { enabled: false },
  // Needs real scrollWidth/clientWidth; identical in jsdom. This is finding K.
  "scrollable-region-focusable": { enabled: false },
  // Needs box geometry.
  "target-size": { enabled: false },
};

describe("App accessibility — semantics only (see header)", () => {
  it("has no semantic accessibility violations in its default state", async () => {
    const { container } = render(<App />);

    // Audit the app's own subtree, not document.body: RTL leaves wrapper nodes
    // behind, and auditing the whole body pulls them into the result.
    const results = await axe(container, { rules: JSDOM_CANNOT_JUDGE });

    expect(results).toHaveNoViolations();
  });

  it("keeps the landmark and heading structure added in P5c", async () => {
    // Guards the specific fixes for findings L and M. These are cheap to undo by
    // accident in a 2,900-line component, and the axe assertion above would not
    // necessarily fail if, say, <header> reverted to <div> — the landmark rules
    // are advisory rather than violations in some configurations.
    const { container } = render(<App />);

    expect(container.querySelector("header.topbar")).not.toBeNull();
    expect(container.querySelector("aside#app-sidebar")).not.toBeNull();
    expect(container.querySelector("main.content")).not.toBeNull();

    const h1s = container.querySelectorAll("h1");
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toBe("Nyarlathotep");
  });
});
