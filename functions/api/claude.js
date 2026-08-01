// Cloudflare Pages Function — proxy to the Anthropic API.
// Route: /api/claude  (keeps ANTHROPIC_API_KEY server-side; browser never sees it)
// Hardened via ./_guard.js (RISK_REVIEW R6): origin allow-list, body cap,
// per-IP rate limit, model allow-list, optional shared secret.

import { guard, corsHeaders, json } from "./_guard.js";

// Keep in sync with src/lib/models.ts (server-side validation can't import it).
// Override at deploy time with the ALLOWED_MODELS env var if needed.
const CLAUDE_MODELS = ["claude-sonnet-5", "claude-opus-5"];

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestPost({ request, env }) {
  const g = await guard(request, env, CLAUDE_MODELS);
  if (g.error) return g.error;
  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: g.body,
    });
    const text = await resp.text();
    return new Response(text, {
      status: resp.status,
      headers: { "Content-Type": "application/json", ...g.cors },
    });
  } catch (e) {
    return json(500, { error: e.message }, g.cors);
  }
}
