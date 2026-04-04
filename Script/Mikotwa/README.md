# HTMLRewriter Proxy — Mikotwa

> A [Cloudflare Worker](https://workers.cloudflare.com/) reverse proxy that uses Cloudflare's native `HTMLRewriter` API to stream-rewrite all resource URLs in proxied pages — no full-page buffering required.

---

## ✨ Features

- ⚡ **Streaming HTML rewriting** via Cloudflare's `HTMLRewriter` — efficient even for large pages
- 🔗 **Full URL rewriting** — rewrites `href`, `src`, and `data-src` on `<a>`, `<img>`, `<iframe>`, `<link>`, and `<script>` elements
- 🔀 **Path-in-URL routing** — the target hostname is embedded directly in the Worker URL path (no config changes needed to switch targets)
- 🔁 **Referer-aware forwarding** — requests with a `Referer` header from a previously proxied page are automatically routed to the same upstream
- 🧹 **`x-content-type-options` removal** — strips the header that prevents browsers from rendering cross-origin resources
- 📄 **CSS content-type fix** — corrects mis-labelled CSS responses that arrive with a `text/javascript` content type

---

## 🚀 Deploy

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create Application** → **Create Worker**.
2. Open [`index.js`](https://github.com/OshekharO/CF-REVERSE-PROXY/blob/main/Script/Mikotwa/index.js), copy its full contents, and paste them into the online editor.
3. Set `WORKER_HOSTNAME` to your Worker's public URL (see [Configuration](#️-configuration)).
4. Click **Save and Deploy**.

---

## ⚙️ Configuration

There is a single constant to set at the top of `index.js`:

```js
// The public hostname of this Worker (without a trailing slash).
const WORKER_HOSTNAME = "your-worker.workers.dev";
```

Set this to your Worker's `.workers.dev` subdomain, or a custom domain if you have one bound.

---

## 🖥️ Usage

Requests are routed using a **path-in-URL** convention — the target hostname is the first path segment after the Worker's own hostname:

```
https://<WORKER_HOSTNAME>/<target-hostname>/<path>
```

**Examples:**

```
# Proxy the MDN homepage
https://your-worker.workers.dev/developer.mozilla.org/

# Proxy a specific Wikipedia article
https://your-worker.workers.dev/en.wikipedia.org/wiki/Reverse_proxy

# Proxy an image from a CDN
https://your-worker.workers.dev/cdn.example.com/assets/logo.png
```

Any link on the proxied page that points back to the same upstream host is automatically rewritten to stay within the Worker, so navigation works seamlessly.

---

## 🔧 How It Works

1. **Incoming request** — the Worker extracts the real target hostname and path from the URL.
2. **Upstream fetch** — the target resource is fetched with the `Referer` header set to the proxied origin.
3. **`HTMLRewriter` transform** — for HTML responses, `HTMLRewriter` rewrites every `href`, `src`, and `data-src` attribute that contains an absolute or relative URL, routing it through the Worker.
4. **CSS fix** — responses requested with `Accept: text/css` but served as `text/javascript` have their content-type corrected before being returned.
5. **Response** — the transformed response is streamed back to the client.

---

## 📄 License

MIT — part of [OshekharO/CF-REVERSE-PROXY](https://github.com/OshekharO/CF-REVERSE-PROXY).
HTMLRewriter integration by [Mikotwa](https://github.com/Mikotwa).
