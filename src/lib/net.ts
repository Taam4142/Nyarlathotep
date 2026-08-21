// Fetch wrapper with exponential backoff for transient failures — RISK_REVIEW R9.
// Retries on 429 (rate limit), 529 (overloaded), other 5xx, and network errors.
// Retrying is safe here: every call is a stateless extraction / OCR request.
// The optional AbortSignal also lays the groundwork for cancellation (R10).

export interface RetryOptions {
  /** Max retry attempts after the initial try. */
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  signal?: AbortSignal;
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504, 529]);

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted)
      return reject(new DOMException("Aborted", "AbortError"));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

/** Parse a Retry-After header (seconds or HTTP-date) into ms, capped at 60s. */
function parseRetryAfter(v: string | null): number | null {
  if (!v) return null;
  const secs = Number(v);
  if (!Number.isNaN(secs)) return Math.min(secs * 1000, 60000);
  const date = Date.parse(v);
  if (!Number.isNaN(date))
    return Math.max(0, Math.min(date - Date.now(), 60000));
  return null;
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  opts: RetryOptions = {},
): Promise<Response> {
  const {
    retries = 3,
    baseDelayMs = 800,
    maxDelayMs = 15000,
    signal = init?.signal ?? undefined,
  } = opts;

  const backoff = (attempt: number) =>
    Math.min(maxDelayMs, baseDelayMs * 2 ** attempt) + Math.random() * 250;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(input, { ...init, signal });
      if (!RETRYABLE_STATUS.has(res.status) || attempt === retries) return res;
      const retryAfter = parseRetryAfter(res.headers.get("retry-after"));
      await sleep(retryAfter ?? backoff(attempt), signal);
    } catch (err) {
      // Cancellation propagates immediately; transient network errors retry.
      if ((err as { name?: string })?.name === "AbortError") throw err;
      lastErr = err;
      if (attempt === retries) throw err;
      await sleep(backoff(attempt), signal);
    }
  }
  throw lastErr ?? new Error("fetchWithRetry: retries exhausted");
}

/**
 * A human-readable message out of an API error body.
 *
 * Providers disagree about where they put it. Anthropic and Google use
 * `{ error: { message } }`; Typhoon runs FastAPI, which uses `{ detail }` —
 * either a string or, for validation errors, an array of `{ msg }`.
 *
 * Reading only `error.message` discarded Typhoon's reason entirely. Measured
 * 2026-08-21: a real 400 carried
 * `{"detail":"An error occurred during model processing"}` and reached the user
 * as the bare string "Typhoon OCR API 400". The proxy passes the upstream body
 * through verbatim, so the reason was always arriving — it was being dropped at
 * the last step, on the engine now recommended for scanned Thai documents.
 */
export function apiErrorMessage(body: unknown, fallback: string): string {
  const b = body as any;
  const candidates = [
    b?.error?.message,
    typeof b?.detail === "string" ? b.detail : undefined,
    Array.isArray(b?.detail)
      ? b.detail
          .map((d: any) => d?.msg)
          .filter(Boolean)
          .join("; ")
      : undefined,
    typeof b?.error === "string" ? b.error : undefined,
    b?.message,
  ];
  const found = candidates.find(
    (v) => typeof v === "string" && v.trim().length > 0,
  );
  return found ? found.trim() : fallback;
}
