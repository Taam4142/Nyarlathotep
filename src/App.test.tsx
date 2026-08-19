// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import App from "./App";
import { MEDIA_COMPACT } from "./lib/breakpoints";

// Minimal smoke coverage for App.tsx — the one large, untested UI surface
// (everything in src/lib/* has its own pure-function unit tests already).
// Not exhaustive: the goal is to catch "the app doesn't render" / "a core
// action silently breaks" regressions automatically, so future changes
// (accessibility or otherwise) don't rely solely on manual browser
// verification. Several assertions query by the aria-label/accessible-name
// added in the accessibility P1 pass, so this doubles as a regression check
// for those labels too.

beforeEach(() => {
  localStorage.clear();
});

// Vitest doesn't inject Jest-style globals (`test.globals` is off, on
// purpose, so the existing src/lib/* tests keep their explicit imports) —
// RTL's auto-cleanup relies on detecting a global `afterEach`, which isn't
// present here, so without this each test's render() would accumulate in
// jsdom's shared document instead of unmounting between tests.
afterEach(cleanup);

// addRow() in App.tsx has its own setTimeout(..., 60) that auto-focuses the
// new row's textarea (a real, harmless UX nicety — not test-relevant). Under
// system load that deferred focus can land *after* a subsequent user.type()
// has already started, occasionally stealing keystrokes mid-sequence and
// producing flaky failures. Clicking "+ Row" through this helper waits past
// that window before the test does anything else, so every test's typing
// always lands in the field it explicitly targeted.
async function addRow(user) {
  // Uses the always-visible "+ Add Row" beneath the table rather than the
  // top-bar "+ Row", which moved into the overflow menu (RESPONSIVE_PLAN R1).
  // Both call the same addRow() handler; this one keeps these tests focused on
  // what they are actually about (editing, bulk-set, undo, search) instead of
  // coupling every one of them to the menu's open/close behaviour. The menu
  // itself is covered by its own test below.
  await user.click(screen.getByRole("button", { name: "+ Add Row" }));
  await new Promise((r) => setTimeout(r, 150)); // >2x the app's own 60ms, for headroom under load
}

describe("App smoke tests", () => {
  it("renders the empty state with the top-bar controls labeled", () => {
    render(<App />);
    expect(screen.getByText(/No requirements loaded/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Project name")).toBeInTheDocument();
    expect(screen.getByLabelText("Verified by")).toBeInTheDocument();
    expect(screen.getByLabelText("Extraction engine")).toBeInTheDocument();
  });

  it("adds a row via + Row, with its fields labeled", async () => {
    const user = userEvent.setup();
    render(<App />);
    await addRow(user);
    expect(await screen.findByLabelText("Reference")).toBeInTheDocument();
    expect(screen.getByLabelText("Requirement text, verbatim")).toBeInTheDocument();
    expect(screen.getByLabelText("Compliance status")).toBeInTheDocument();
  });

  it("editing the requirement textarea updates the row", async () => {
    const user = userEvent.setup();
    render(<App />);
    await addRow(user);
    const reqBox = await screen.findByLabelText("Requirement text, verbatim");
    await user.type(reqBox, "PLC shall be Siemens");
    expect(reqBox).toHaveValue("PLC shall be Siemens");
  });

  it("bulk status-set changes the selected row's status", async () => {
    const user = userEvent.setup();
    render(<App />);
    await addRow(user);
    await user.click(await screen.findByLabelText("Select row for bulk actions"));
    await user.click(await screen.findByRole("button", { name: "✗ Not Comply" }));
    expect(screen.getByLabelText("Compliance status")).toHaveValue("notcomply");
  });

  it("undo reverts the last change", async () => {
    const user = userEvent.setup();
    render(<App />);
    await addRow(user);
    const remarksBox = await screen.findByLabelText("Remarks");
    await user.type(remarksBox, "x");
    expect(remarksBox).toHaveValue("x");
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(remarksBox).toHaveValue("");
  });

  it("search filters rows by text", async () => {
    const user = userEvent.setup();
    render(<App />);
    await addRow(user);
    const reqBox = await screen.findByLabelText("Requirement text, verbatim");
    await user.type(reqBox, "IP54 enclosure");
    // Add a second, non-matching row before searching.
    await addRow(user);
    await user.type(await screen.findByLabelText("Search rows"), "IP54");
    expect(await screen.findByText(/1 match/)).toBeInTheDocument();
  });

  it("the top-bar overflow menu opens, acts, and closes", async () => {
    // R1 moved the secondary actions here because the inline row needed 1505px
    // and was being clipped inside an overflow:hidden container — at 1280px
    // "Load .json" and "New" were unreachable entirely.
    const user = userEvent.setup();
    render(<App />);

    const trigger = screen.getByRole("button", { name: "More actions" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const menu = screen.getByRole("menu", { name: "More actions" });

    // The actions that were previously clipped away must all be reachable.
    for (const name of [/\+ Row/, /Snip a figure/, /Save \.json/, /Load \.json/, /New \/ clear matrix/]) {
      expect(within(menu).getByRole("menuitem", { name })).toBeInTheDocument();
    }

    // An item actually performs its action, and the menu closes afterwards.
    await user.click(within(menu).getByRole("menuitem", { name: /\+ Row/ }));
    await new Promise((r) => setTimeout(r, 150));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getAllByLabelText("Requirement text, verbatim").length).toBe(1);
  });

  it("the overflow menu closes on Escape", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("the sidebar drawer opens, traps focus, and closes on Escape (compact widths)", async () => {
    // jsdom has no matchMedia, so useMediaQuery falls back to "desktop" and the
    // drawer semantics never engage. Stub it to report compact so this path is
    // covered at all — without this the drawer would be verified only in a real
    // browser, and nothing would catch a regression in CI.
    const original = window.matchMedia;
    window.matchMedia = (query) => ({
      matches: query === MEDIA_COMPACT,
      media: query,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      onchange: null,
      dispatchEvent: () => false,
    });

    try {
      const user = userEvent.setup();
      render(<App />);

      const toggle = screen.getByRole("button", { name: "Open setup panel" });
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      // Closed: the sidebar exists but is not a dialog the user is inside.
      expect(screen.queryByRole("dialog", { name: "Setup panel" })).toBeInTheDocument();

      await user.click(toggle);
      expect(screen.getByRole("button", { name: "Close setup panel" })).toHaveAttribute(
        "aria-expanded",
        "true",
      );

      // Focus must land on a VISIBLE control inside the drawer. The first
      // focusable descendant is a display:none file input; focusing that
      // silently does nothing and strands focus outside the dialog.
      const drawer = screen.getByRole("dialog", { name: "Setup panel" });
      expect(drawer.contains(document.activeElement)).toBe(true);

      await user.keyboard("{Escape}");
      expect(screen.getByRole("button", { name: "Open setup panel" })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    } finally {
      window.matchMedia = original;
    }
  });
});
