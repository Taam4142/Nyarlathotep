// Shared hardening for the API proxies (RISK_REVIEW R6).
// Leading underscore → Cloudflare Pages does NOT treat this as a route.
//
// Layers (each degrades gracefully when its config is absent, so landing this
// never breaks the live deploy — turn each on by setting the env/binding):
//   • Origin allow-list   — set ALLOWED_ORIGINS (comma-separated). Until then,
//                           CORS stays open ("*") as before.
//   • Body-size cap        — always on (MAX_BODY_BYTES).
//   • Per-IP rate limit    — bind a KV namespace as RATE_LIMIT. No-op if unbound.
//   • Model allow-list     — per-proxy; env override via ALLOWED_MODELS.
//   • Shared secret        — set PROXY_SECRET to require an x-proxy-token header.

export const MAX_BODY_BYTES = 8 * 1024 * 1024; // 8 MB — one high-res page + prompt
const RATE_LIMIT_MAX = 60; // requests per window per IP
const RATE_LIMIT_WINDOW = 60; // seconds

function allowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allow = allowedOrigins(env);
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-proxy-token",
    Vary: "Origin",
  };
  if (allow.length === 0) {
    headers["Access-Control-Allow-Origin"] = "*"; // not configured → open (legacy)
  } else if (origin && allow.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  // else: no ACAO header → the browser blocks a cross-origin response.
  return headers;
}

function originAllowed(request, env) {
  const allow = allowedOrigins(env);
  if (allow.length === 0) return true; // not configured → allow (other guards apply)
  const origin = request.headers.get("Origin");
  return !!origin && allow.includes(origin);
}

export function json(status, obj, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

function secretOk(request, env) {
  if (!env.PROXY_SECRET) return true; // not configured → no secret required
  return request.headers.get("x-proxy-token") === env.PROXY_SECRET;
}

// Fixed-window per-IP limiter backed by KV. No-op when RATE_LIMIT is unbound.
async function rateLimited(request, env) {
  const kv = env.RATE_LIMIT;
  if (!kv) return false;
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const key = `rl:${ip}`;
  const now = Math.floor(Date.now() / 1000);
  let count = 0;
  let reset = now + RATE_LIMIT_WINDOW;
  const raw = await kv.get(key);
  if (raw) {
    try {
      const p = JSON.parse(raw);
      if (p.reset > now) {
        count = p.count;
        reset = p.reset;
      }
    } catch {
      /* corrupt entry → treat as fresh window */
    }
  }
  if (count >= RATE_LIMIT_MAX) return true;
  await kv.put(key, JSON.stringify({ count: count + 1, reset }), {
    expirationTtl: RATE_LIMIT_WINDOW + 5,
  });
  return false;
}

async function readCappedBody(request) {
  const cl = Number(request.headers.get("Content-Length") || "0");
  if (cl && cl > MAX_BODY_BYTES) return { tooLarge: true };
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) return { tooLarge: true };
  return { body };
}

/**
 * Run the shared guard pipeline. On success returns { cors, body }.
 * On rejection returns { error: Response } — return it directly from the proxy.
 * `defaultModels` is the per-proxy allow-list (overridable via env.ALLOWED_MODELS).
 * Omit it (Vision) to skip model checking.
 */
export async function guard(request, env, defaultModels) {
  const cors = corsHeaders(request, env);
  if (!originAllowed(request, env))
    return { error: json(403, { error: "Origin not allowed" }, cors) };
  if (!secretOk(request, env))
    return { error: json(401, { error: "Unauthorized" }, cors) };
  if (await rateLimited(request, env))
    return {
      error: json(429, { error: "Rate limit exceeded. Try again shortly." }, cors),
    };

  const { body, tooLarge } = await readCappedBody(request);
  if (tooLarge) return { error: json(413, { error: "Request too large" }, cors) };

  if (defaultModels) {
    const allow = env.ALLOWED_MODELS
      ? env.ALLOWED_MODELS.split(",").map((s) => s.trim()).filter(Boolean)
      : defaultModels;
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      return { error: json(400, { error: "Invalid JSON body" }, cors) };
    }
    if (parsed.model && !allow.includes(parsed.model))
      return {
        error: json(400, { error: `Model not allowed: ${parsed.model}` }, cors),
      };
  }

  return { cors, body };
}
