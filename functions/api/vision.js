// Cloudflare Pages Function — proxy to the Google Cloud Vision API.
// Route: /api/vision  (keeps GOOGLE_VISION_API_KEY server-side; the key is billing-linked)
// The browser posts a v1 images:annotate body; we append the API key and forward it.
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
    const resp = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${env.GOOGLE_VISION_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      },
    );
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
