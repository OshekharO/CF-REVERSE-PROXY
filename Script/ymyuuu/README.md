# Cloudflare Workers Proxy — ymyuuu

> A general-purpose, open-ended reverse proxy built on [Cloudflare Workers](https://workers.cloudflare.com/) that lets any visitor proxy any URL through your Worker — complete with a modern glassmorphism web UI powered by Bootstrap 5.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🌐 **Open proxy** | Visitors enter any target URL in the UI; the Worker fetches it on their behalf |
| 🔁 **HTML path rewriting** | Rewrites `href`, `src`, `action`, and `data-src` attributes (absolute & root-relative) so proxied pages render correctly |
| 🔀 **Redirect handling** | Rewrites `301`/`302`/`303`/`307`/`308` `Location` headers to stay within the proxy |
| 🔓 **CORS support** | Injects `Access-Control-Allow-*` headers; handles `OPTIONS` preflight requests with a `204` response |
| 🛡️ **Security headers** | Adds `X-Content-Type-Options`, `X-XSS-Protection`, and `Referrer-Policy` to every response |
| 🔐 **CSP removal** | Strips upstream `Content-Security-Policy` headers that would otherwise block proxied resources |
| 🚫 **Domain blocklist** | Exact and suffix-based hostname matching (e.g. blocking `evil.com` also blocks `sub.evil.com`) |
| 🎨 **Built-in web UI** | Glassmorphism landing page with Bootstrap 5, client-side validation, no extra deployment needed |
| ⚙️ **Modern Workers API** | Uses ES module `export default { fetch }` syntax for forward-compatibility |

---

## 🚀 Deploy

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create Application** → **Create Worker**.
2. Open [`worker.js`](https://github.com/OshekharO/CF-REVERSE-PROXY/blob/main/Script/ymyuuu/worker.js), copy its full contents, and paste them into the online editor (replacing the default code).
3. Optionally edit `BLOCKED_DOMAINS` (see [Configuration](#️-configuration)).
4. Click **Save and Deploy**.

> **Note:** Because this script uses ES module syntax (`export default`), make sure the **"Module" compatibility flag** is enabled in your Worker settings (it is the default for new Workers in 2024+).

---

## ⚙️ Configuration

Edit the constants near the top of `worker.js`:

```js
// Protocols allowed to be proxied. Any other protocol is rejected.
const ALLOWED_PROTOCOLS = ['http:', 'https:'];

/**
 * Domains that must never be proxied.
 * Matched exactly OR as a hostname suffix
 * (e.g. 'evil.com' also blocks 'sub.evil.com').
 */
const BLOCKED_DOMAINS = ['example.com', 'another-blocked-site.com'];
```

No other changes are required. The Worker is ready to use once deployed.

---

## 🖥️ Usage

### Via the Web UI

Visit your Worker's URL (e.g., `https://your-worker.workers.dev`) to see the built-in landing page. Enter any target URL in the input box and click **Open via Proxy** — the proxied page opens in a new tab.

### Via Direct URL

Construct a proxy URL directly without using the UI:

```
https://your-worker.workers.dev/<target-url>
```

**Example:**

```
https://your-worker.workers.dev/https://example.com/page
```

Replace `your-worker.workers.dev` with your actual Worker URL and append the full target URL (URL-encoded if it contains special characters).

---

## 🔒 Security Notes

- **Header stripping** — The following Cloudflare-injected headers are removed before forwarding: `cf-connecting-ip`, `cf-ipcountry`, `cf-ray`, `cf-visitor`, `cf-worker`.
- **Domain blocklist** — Requests targeting a blocked domain receive a `400 Bad Request` JSON error.
- **Protocol enforcement** — Only `http:` and `https:` targets are permitted.
- **No caching** — All responses are served with `Cache-Control: no-store`.
- **CORS scoping** — `Access-Control-Allow-Origin` echoes the requesting `Origin` when present; falls back to `*`.

---

## ⚠️ Disclaimer

Use this proxy only for lawful purposes. Do not use it to access sites you do not have permission to access. See the root [repository disclaimer](../../README.md#️-disclaimer) for full terms.

---

## 📄 License

MIT — part of [OshekharO/CF-REVERSE-PROXY](https://github.com/OshekharO/CF-REVERSE-PROXY).
Original script by [ymyuuu](https://github.com/ymyuuu).
