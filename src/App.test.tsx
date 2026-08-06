// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import App from "./App";

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
  await user.click(screen.getByRole("button", { name: "+ Row" }));
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
});
