# DEPLOY.md — deploying & securing Nyarlathotep on Cloudflare Pages

Step-by-step click paths for the engineer. Covers the **base deploy**, the **server-side API keys**, and
the **proxy hardening** (RISK_REVIEW **R6**) — the part that stops strangers from spending your API credits.

> The base project setup (create a *Pages* project, build command `npm run build`, output `dist`) is in
> [`README.md`](README.md) → *Setup & deploy*. This doc goes deeper on **securing the `/api/*` proxies**.

---

## 1. Why the proxies need securing

Your three routes — `/api/claude`, `/api/typhoon`, `/api/vision` — run as Cloudflare **Pages Functions**.
They inject your API keys server-side, so the browser never sees a key. The flip side: the routes
themselves are **public URLs**. Without protection, anyone who finds `https://<your-site>/api/typhoon`
can POST to it and burn your **Anthropic / Typhoon / Google Vision** credits — no key required, because the
proxy adds the key for them.

All three proxies run every request through one shared guard,
[`functions/api/_guard.js`](functions/api/_guard.js), which enforces four layers. **Each layer is dormant
until you configure it**, so deploying the code changed nothing on its own — you turn the protection on with
the env vars and binding below.

| Layer | Turned on by | Stops | Default when unset |
| --- | --- | --- | --- |
| Origin allow-list | `ALLOWED_ORIGINS` env var | Calls from other websites; casual browser abuse | **Open** (`*`) — legacy behavior |
| **Per-IP rate limit** | a **KV namespace** bound as `RATE_LIMIT` | Scripted / `curl` spend (60 req/min per IP → 429) | **Off** (no limit) |
| Body-size cap | *always on* | Oversized payloads (> 8 MB → 413) | n/a |
| Model allow-list | *always on* (override via `ALLOWED_MODELS`) | Forcing an expensive off-list model (→ 400) | Built-in per-proxy list |

**Minimum to actually close the hole:** set **`ALLOWED_ORIGINS`** *and* bind **`RATE_LIMIT`**. Origin-check
alone stops other sites but not a scripted attacker (who can spoof the `Origin` header); the rate limit is
what caps their spend. Do both.

---

## 2. Server-side API keys (prerequisite)

These are what the proxies inject. Add them as **Secret** (encrypted) variables. In the Cloudflare
dashboard: **Workers & Pages → your Pages project → Settings → Variables and Secrets**
*(older UI: "Environment variables")*. Add to **Production** (and **Preview** if you test on preview URLs):

| Name | Type | Where to get it |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Secret | `console.anthropic.com` (a claude.ai subscription is **not** API credits) |
| `TYPHOON_API_KEY` | Secret | Free key from `opentyphoon.ai` |
| `GOOGLE_VISION_API_KEY` | Secret | Google Cloud Vision API key *(only needed for the Google Vision feeder)* |

> The **Gemini** key is entered in the UI at runtime (held in React state, cleared on reload) — it is **not**
> a Cloudflare variable.

---

## 3. `ALLOWED_ORIGINS` — lock down who can call the proxies

### What an "origin" is
An origin is **scheme + host + port** — no path, no trailing slash:

```
https://yog-sothoth.pages.dev        ✅  an origin
https://tor.yourcompany.com          ✅  an origin
https://yog-sothoth.pages.dev/app    ❌  that's a URL, not an origin
```

When the app's browser code calls `/api/typhoon`, the browser **automatically attaches an `Origin:` header**
naming the site the request came from. A web page **cannot forge** that header for a different site — the
browser controls it — so checking it reliably answers "did this come from my app, or from some other site?"

### Behavior
- **Unset / empty** → the guard stays open (`*`), exactly as before.
- **Set** → read as a **comma-separated allow-list**. A request whose `Origin` matches proceeds; anything
  else gets **`403 Origin not allowed`** (including requests that send *no* `Origin`).

### Steps
1. **Workers & Pages → your Pages project → Settings → Variables and Secrets → Add variable**.
2. Type **Plaintext** (it's not a secret).
3. **Name:** `ALLOWED_ORIGINS`
4. **Value:** every origin the app is actually served from, comma-separated:
   ```
   https://yog-sothoth.pages.dev,https://tor.yourcompany.com
   ```
   Find your exact `*.pages.dev` URL at the top of the project page / in the Deployments list — copy it
   verbatim. Include your custom domain too if you use one.
5. Add it to **Production** (and **Preview**, if you use preview URLs). **Save.**

> ⚠️ **The value must include the app's own origin**, or the app will 403 *its own* API calls. This is the
> #1 mistake. If the site is served from `https://yog-sothoth.pages.dev`, that exact string must be in the
> list.
>
> ⚠️ **Preview deployments** get per-build subdomains like `https://a1b2c3.yog-sothoth.pages.dev`, which
> won't match a production-only list. Either test on production, or add the preview origin(s) to the
> **Preview** environment's value.

---

## 4. `RATE_LIMIT` — cap scripted abuse (recommended)

`ALLOWED_ORIGINS` stops other **websites**, but a determined attacker using `curl`/a script isn't a browser
— they can send any `Origin` header they like, including your real one. The per-IP rate limit is what
actually caps their spend. It's a **KV namespace binding** and is a **no-op until you create and bind it**.

The guard allows **60 requests per minute per IP** (keyed on Cloudflare's `CF-Connecting-IP`); over that →
**`429 Rate limit exceeded`**. (Constants live at the top of
[`functions/api/_guard.js`](functions/api/_guard.js) if you want to tune them.)

### Steps
1. **Create the namespace:** Cloudflare dashboard → **Storage & Databases → KV → Create a namespace**
   *(older UI: Workers → KV)*. Name it e.g. `yog-sothoth-ratelimit`.
2. **Bind it to the Pages project:** **Workers & Pages → your Pages project → Settings → Bindings**
   *(older UI: "Functions → KV namespace bindings")* → **Add → KV namespace**.
   - **Variable name:** `RATE_LIMIT`  ← must be exactly this
   - **KV namespace:** the one you just created
3. Add the binding to **Production** (and **Preview** if desired). **Save.**

That's it — the guard detects `env.RATE_LIMIT` and starts limiting. No code change needed.

---

## 5. Optional knobs

### `PROXY_SECRET` (optional shared secret)
If set, every proxy request must send a matching `x-proxy-token` header, else **`401 Unauthorized`**.

> **Honest caveat:** for a *public* browser app this adds little — the token would have to ship in the
> browser bundle, where anyone can read it. It's only meaningful for a **private** deployment where you
> inject the token at build time or put the whole app behind Cloudflare Access. For a public tool, rely on
> `ALLOWED_ORIGINS` + `RATE_LIMIT` instead and leave this unset.

Add as a **Secret** named `PROXY_SECRET` if you use it.

### `ALLOWED_MODELS` (optional model-list override)
Each proxy already has a built-in model allow-list (kept in sync with
[`src/lib/models.ts`](src/lib/models.ts)):

- `/api/claude` → `claude-sonnet-5`, `claude-opus-5`
- `/api/typhoon` → `typhoon-ocr`
- `/api/vision` → *(no model field — not checked)*

A request naming any other model gets **`400 Model not allowed`**. To change the accepted list without a
code change, set a **Plaintext** var `ALLOWED_MODELS` (comma-separated) — it overrides the built-in list
for **all** proxies. Usually you don't need this; update `src/lib/models.ts` and the per-proxy constant
together instead.

---

## 6. Apply the changes

Environment variables and bindings only take effect on a **new deployment** — existing deployments keep the
snapshot they built with. After adding vars/bindings, either:

- push any commit (Cloudflare auto-builds), or
- **Deployments → latest → ⋯ → Retry deployment**.

---

## 7. Verify

**A) The app still works** — open the site, run an extraction with Typhoon/Claude. Its own calls carry the
allow-listed `Origin`, so they pass.

**B) A foreign / header-less origin is blocked** (with `ALLOWED_ORIGINS` set):

```bash
curl -i -X POST https://yog-sothoth.pages.dev/api/typhoon \
  -H "Content-Type: application/json" \
  -H "Origin: https://evil.example" \
  -d '{"model":"typhoon-ocr","messages":[]}'
# → HTTP/1.1 403 Forbidden
# → {"error":"Origin not allowed"}
```

**C) A spoofed real origin still passes the origin check** — this is expected, and is exactly why you also
bind `RATE_LIMIT`:

```bash
curl -i -X POST https://yog-sothoth.pages.dev/api/typhoon \
  -H "Content-Type: application/json" \
  -H "Origin: https://yog-sothoth.pages.dev" \
  -d '{"model":"typhoon-ocr","messages":[]}'
# → passes origin; with RATE_LIMIT bound, the 61st such call within a minute → 429.
```

**D) An off-list model is rejected:**

```bash
curl -i -X POST https://yog-sothoth.pages.dev/api/claude \
  -H "Content-Type: application/json" \
  -H "Origin: https://yog-sothoth.pages.dev" \
  -d '{"model":"gpt-4","max_tokens":10,"messages":[]}'
# → HTTP/1.1 400 Bad Request   {"error":"Model not allowed: gpt-4"}
```

---

## 8. Quick reference

| Setting | Kind | Required? | Effect |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | Secret var | for Claude engine | Injected into `/api/claude` |
| `TYPHOON_API_KEY` | Secret var | for Typhoon engine | Injected into `/api/typhoon` |
| `GOOGLE_VISION_API_KEY` | Secret var | for Vision feeder | Injected into `/api/vision` |
| `ALLOWED_ORIGINS` | Plaintext var | **strongly recommended** | Origin allow-list; else open |
| `RATE_LIMIT` | KV binding | **recommended** | 60 req/min per IP; else no limit |
| `PROXY_SECRET` | Secret var | optional | Require `x-proxy-token`; niche |
| `ALLOWED_MODELS` | Plaintext var | optional | Override the built-in model list |

---

## 9. Troubleshooting

- **The app itself gets 403 on `/api/*`.** `ALLOWED_ORIGINS` is set but doesn't include the origin the app
  is served from. Copy the site's exact origin (from the address bar / Deployments list) into the value.
- **Works on production, 403s on a preview URL.** Preview deployments have their own `*.pages.dev`
  subdomain. Add it to the **Preview** environment's `ALLOWED_ORIGINS`, or test on production.
- **Everything returns 429.** The rate limit (60/min/IP) is tripping — expected under load or if many users
  share one NAT IP. Raise `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW` in `functions/api/_guard.js` and redeploy.
- **A model returns `400 Model not allowed`.** The requested model isn't in the proxy's allow-list. Update
  both [`src/lib/models.ts`](src/lib/models.ts) and the per-proxy constant (or set `ALLOWED_MODELS`).
- **Env change seems ignored.** Env vars/bindings only apply to **new** deployments — redeploy (§6).
