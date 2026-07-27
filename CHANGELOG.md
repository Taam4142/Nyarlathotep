# Changelog

All notable changes to TOR-Extract. Format loosely follows [Keep a Changelog](https://keepachangelog.com/).
There are no version tags yet, so released history below is grouped by date and git commit.

## [Unreleased]

## [0.1.0] - 2026-07-27

First tagged release (pre-release). Captures the current working tool — four extraction engines
(Browser OCR, Claude, Gemini) with selectable OCR feeders, editable compliance matrix, comply library,
and `.xlsx` export — plus the project's first proper documentation set. Marked pre-release because known
bugs/security items are still open; see [`RISK_REVIEW.md`](RISK_REVIEW.md).

### Added
- Project documentation: `README.md`, `ROADMAP.md`, `RISK_REVIEW.md`, and this `CHANGELOG.md`.

### Changed
- Reconciled `SKILL.md` (and light touch-ups to `CLAUDE.md`) to describe the current four-engine reality
  instead of the earlier Claude-only, two-engine tool.

_The dated entries below are the development history leading up to this release._

---

## 2026-05-30

### Added
- **Browser OCR engine** (`a547bdd`) — Tesseract.js runs fully client-side (Thai+English) with heuristic
  row-splitting, giving a zero-key, offline, no-billing path. Restructured the engine selection around it.
- **Test Connection button** (`a2b7cba`) for Claude and Gemini, with plain-language error mapping
  (quota, invalid key, missing credits, proxy-not-found).

### Fixed
- **Deprecated Gemini model** (`a2b7cba`) updated to a working model string.

## 2026-05-29

### Added
- **Initial release** (`dc595e9`) — single-file React app: PDF upload, digital-vs-scanned detection,
  Claude extraction of verbatim requirements, editable compliance matrix, comply library of standard
  responses, and `.xlsx` export.
- **AI analysis as selectable options** (`b3de40c`) — reworked extraction into configurable engine/OCR
  options rather than a single fixed path; expanded `CLAUDE.md` prompt guidance.
- **Gemini support + Claude proxy** (`0928914`) — added the `api/claude.js` serverless proxy (keeps
  `ANTHROPIC_API_KEY` server-side) and a direct-from-browser Gemini path; added `vercel.json`.

### Fixed
- **Vercel deploy** (`2ee7c5d`) — bypassed the build process so the static HTML app deploys cleanly;
  added `SKILL.md` and `CLAUDE.md`.
