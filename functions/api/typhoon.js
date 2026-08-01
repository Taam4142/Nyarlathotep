// Cloudflare Pages Function — proxy to the Typhoon (OpenTyphoon) OCR API.
// Route: /api/typhoon  (keeps TYPHOON_API_KEY server-side)
// OpenAI-compatible chat/completions; model "typhoon-ocr-preview".
// Hardened via ./_guard.js (RISK_REVIEW R6): origin allow-list, body cap,
// per-IP rate limit, model allow-list, optional shared secret.

import { guard, corsHeaders, json } from "./_guard.js";

// Keep in sync with src/lib/models.ts. Override via the ALLOWED_MODELS env var.
const TYPHOON_MODELS = ["typhoon-ocr-preview"];

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestPost({ request, env }) {
  const g = await guard(request, env, TYPHOON_MODELS);
  if (g.error) return g.error;
  try {
    const resp = await fetch("https://api.opentyphoon.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.TYPHOON_API_KEY}`,
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
