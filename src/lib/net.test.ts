import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchWithRetry } from "./net";

afterEach(() => {
  vi.restoreAllMocks();
});

// A Response-like stub good enough for fetchWithRetry (reads .status/.headers).
function resp(status: number, headers: Record<string, string> = {}): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
  } as unknown as Response;
}

describe("fetchWithRetry (R9)", () => {
  it("returns immediately on a 200 without retrying", async () => {
    const fetchMock = vi.fn().mockResolvedValue(resp(200));
    vi.stubGlobal("fetch", fetchMock);
    const res = await fetchWithRetry("/x");
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry a non-retryable 400", async () => {
    const fetchMock = vi.fn().mockResolvedValue(resp(400));
    vi.stubGlobal("fetch", fetchMock);
    const res = await fetchWithRetry("/x", undefined, { retries: 3 });
    expect(res.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries 429 then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(resp(429))
      .mockResolvedValueOnce(resp(200));
    vi.stubGlobal("fetch", fetchMock);
    const res = await fetchWithRetry("/x", undefined, { baseDelayMs: 1 });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after `retries` and returns the last retryable response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(resp(529));
    vi.stubGlobal("fetch", fetchMock);
    const res = await fetchWithRetry("/x", undefined, {
      retries: 2,
      baseDelayMs: 1,
    });
    expect(res.status).toBe(529);
    expect(fetchMock).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("retries a transient network error, then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network down"))
      .mockResolvedValueOnce(resp(200));
    vi.stubGlobal("fetch", fetchMock);
    const res = await fetchWithRetry("/x", undefined, { baseDelayMs: 1 });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("propagates an AbortError without retrying", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new DOMException("Aborted", "AbortError"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      fetchWithRetry("/x", undefined, { retries: 3, baseDelayMs: 1 }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
