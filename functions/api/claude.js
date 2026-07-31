// Cloudflare Pages Function — proxy to the Anthropic API.
// Route: /api/claude  (keeps ANTHROPIC_API_KEY server-side; browser never sees it)
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
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
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
