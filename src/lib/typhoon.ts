// The typhoon-ocr model returns its OCR result as a JSON envelope
// {"natural_text": "...\n..."} — newlines are escaped inside the string, not
// emitted as real line breaks. Unwrap it so downstream structuring sees real
// newlines and can split the page into per-clause rows (matching the Browser-OCR
// path). If the content isn't that envelope, return it unchanged.
export function extractTyphoonText(content: string): string {
  const trimmed = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  // Clean case: the whole content is the JSON envelope.
  try {
    const obj = JSON.parse(trimmed);
    if (obj && typeof obj.natural_text === "string") return obj.natural_text;
  } catch {
    /* not clean JSON — fall through to salvage */
  }

  // Salvage: a natural_text field embedded in prose or a truncated response.
  const m = trimmed.match(/"natural_text"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (m) {
    try {
      return JSON.parse(`"${m[1]}"`); // decode the escaped string body
    } catch {
      /* fall through to raw content */
    }
  }

  return content;
}
