# Cloudflare Workers Proxy — ymyuuu

> A general-purpose, open-ended reverse proxy built on [Cloudflare Workers](https://workers.cloudflare.com/) that lets any visitor proxy any URL through your Worker — complete with a clean web UI.

---

## ✨ Features

- 🌐 **Open proxy** — visitors enter any target URL in the UI and the Worker fetches it on their behalf
- 🔁 **Relative-to-absolute path rewriting** — rewrites `href`, `src`, and `action` attributes so relative links resolve correctly
- 🔀 **Redirect handling** — follows and rewrites `301`/`302`/`307`/`308` redirects to stay within the proxy
- 🔓 **CORS headers** — injects appropriate `Access-Control-Allow-*` headers so resources load cleanly in browsers
- 🚫 **Domain blocklist** — configure a list of domains that may not be proxied
- 🎨 **Built-in web UI** — a styled landing page with an input box; no extra front-end deployment needed

---

## 🚀 Deploy

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create Application** → **Create Worker**.
2. Open [`worker.js`](https://github.com/OshekharO/CF-REVERSE-PROXY/blob/main/Script/ymyuuu/worker.js), copy its full contents, and paste them into the online editor (replacing the default code).
3. Optionally edit `BLACKLISTED_DOMAINS` (see [Configuration](#️-configuration)).
4. Click **Save and Deploy**.

---

## ⚙️ Configuration

Edit the constants near the top of `worker.js`:

```js
// Protocols that are allowed to be proxied (any other protocol is rejected).
const ALLOWED_PROTOCOLS = ['http:', 'https:'];

// Domains that must never be proxied through this Worker.
const BLACKLISTED_DOMAINS = ['example.com', 'another-blocked-site.com'];
```

No other changes are required. The Worker is ready to use once deployed.

---

## 🖥️ Usage

### Via the Web UI

Visit your Worker's URL (e.g., `https://your-worker.workers.dev`) to see the built-in UI. Enter any target URL in the input box and click **Submit** — the proxied page opens in a new tab.

### Via Direct URL

You can also construct a proxy URL directly without using the UI:

```
https://your-worker.workers.dev/<target-url>
```

**Example:**

```
https://your-worker.workers.dev/https://example.com/page
```

Replace `your-worker.workers.dev` with your actual Worker URL and append the full target URL (URL-encoded if needed).

---

## 🔒 Security Notes

- The Worker strips all `cf-*` request headers before forwarding, preventing header leakage.
- Requests with an invalid URL or a blacklisted domain receive a `400` JSON error response.
- Responses are served with `Cache-Control: no-store` to prevent stale cached content.
- CORS headers are scoped to the requesting `Origin` when one is present.

---

## ⚠️ Disclaimer

Use this proxy only for lawful purposes. Do not use it to access sites you do not have permission to access. See the root [repository disclaimer](../../README.md#️-disclaimer) for full terms.

---

## 📄 License

MIT — part of [OshekharO/CF-REVERSE-PROXY](https://github.com/OshekharO/CF-REVERSE-PROXY).
Original script by [ymyuuu](https://github.com/ymyuuu).
