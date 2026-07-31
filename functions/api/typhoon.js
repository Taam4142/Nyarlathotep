// Cloudflare Pages Function — proxy to the Typhoon (OpenTyphoon) OCR API.
// Route: /api/typhoon  (keeps TYPHOON_API_KEY server-side)
// OpenAI-compatible chat/completions; model "typhoon-ocr-preview".
// NOTE: CORS is open ("*") with no auth/rate-limit — see RISK_REVIEW.md R6.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.text();
    const resp = await fetch("https://api.opentyphoon.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.TYPHOON_API_KEY}`,
      },
      body,
    });
    const text = await resp.text();
    return new Response(text, {
      status: resp.status,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }
}
