// Cloudflare Pages Function — proxy to the Google Cloud Vision API.
// Route: /api/vision  (keeps GOOGLE_VISION_API_KEY server-side; the key is billing-linked)
// The browser posts a v1 images:annotate body; we append the API key and forward it.
// Hardened via ./_guard.js (RISK_REVIEW R6): origin allow-list, body cap,
// per-IP rate limit, optional shared secret. (No model field to allow-list here.)

import { guard, corsHeaders, json } from "./_guard.js";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestPost({ request, env }) {
  const g = await guard(request, env);
  if (g.error) return g.error;
  try {
    const resp = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${env.GOOGLE_VISION_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: g.body,
      },
    );
    const text = await resp.text();
    return new Response(text, {
      status: resp.status,
      headers: { "Content-Type": "application/json", ...g.cors },
    });
  } catch (e) {
    return json(500, { error: e.message }, g.cors);
  }
}
