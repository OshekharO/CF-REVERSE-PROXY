# Reverse Proxy — KusakabeSi

> A multi-site Cloudflare Worker reverse proxy with string replacement, custom resource mapping, ad removal, and Cloudflare email-obfuscation bypass.

---

## ✨ Features

- 🌐 **Multiple upstream sites** in a single Worker — each incoming hostname maps to its own target
- 🔁 **String replacement** — substitute any text string in proxied HTML/JS/JSON responses
- 🔗 **Custom resource mapping** — redirect specific paths to entirely different URLs
- 🔀 **302 Redirects** — configure path-level redirects per site
- 🛡️ **Cloudflare email-obfuscation bypass** — decode Cloudflare-encoded email addresses in proxied pages
- 🚫 **Ad removal** — strip ad-injecting `<script>` and `<iframe>` blocks from pages

---

## 🚀 Deploy

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create Application** → **Create Worker**.
2. Open [`worker.js`](https://github.com/OshekharO/CF-REVERSE-PROXY/blob/main/Script/KusakabeSi/worker.js), copy its full contents, and paste them into the online editor.
3. Edit the `reverse` configuration object (see [Configuration](#️-configuration) below).
4. Click **Save and Deploy**.
5. Bind each domain listed in your `reverse` config to the Worker via **Workers** → **Add Route** in your domain dashboard.

---

## ⚙️ Configuration

The entire configuration lives in the `reverse` object at the top of `worker.js`. Each key is an **incoming hostname** (your custom domain); the value describes how to handle requests for that host.

```js
reverse = {
    "proxy.yourdomain.com": {
        // Protocol of the upstream site: "http" or "https"
        "protocol": "https",

        // The upstream hostname to proxy to
        "host": "www.example.com",

        // Text replacements applied to all HTML/JS/JSON responses
        "replace": {
            "Example": "Demo",
            "Download App": "Install"
        },

        // Map specific incoming paths to different upstream paths or full URLs
        "reverse": {
            "/":          "/home",
            "/logo.png":  "https://cdn.yourdomain.com/logo.png"
        },

        // Respond with a 302 redirect for specific incoming paths
        "redirect": {
            "/old-path": "/new-path"
        }
    }
}
```

See [`reverse_demo.js`](https://github.com/OshekharO/CF-REVERSE-PROXY/blob/main/Script/KusakabeSi/reverse_demo.js) for a full worked example with multiple sites.

---

## 📖 Configuration Reference

| Field | Type | Description |
|---|---|---|
| `protocol` | `string` | `"http"` or `"https"` — protocol used to connect to the upstream |
| `host` | `string` | Upstream hostname (e.g., `"en.wikipedia.org"`) |
| `replace` | `Object` | Key → value text substitutions applied to all text responses |
| `reverse` | `Object` | Incoming path → upstream path or full URL override |
| `redirect` | `Object` | Incoming path → URL; responds with a `302` redirect |

---

## 🚫 Ad Removal

To strip ad blocks from proxied pages, add the following snippet inside the `response(req)` handler in `worker.js`:

```js
// Remove ad-injecting <script> blocks
const scriptPattern = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
html = html.replace(scriptPattern, match =>
    match.includes('ads') ? '' : match
);

// Remove ad-injecting <iframe> blocks
const iframePattern = /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi;
html = html.replace(iframePattern, match =>
    match.includes('ads') ? '' : match
);
```

---

## 📄 License

MIT — part of [OshekharO/CF-REVERSE-PROXY](https://github.com/OshekharO/CF-REVERSE-PROXY).
Original script by [KusakabeSi](https://github.com/KusakabeSi).
