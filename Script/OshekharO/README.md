# Reverse Proxy — OshekharO

> A production-ready [Cloudflare Worker](https://workers.cloudflare.com/) reverse proxy with explicit subdomain mapping, security headers, CORS support, redirect rewriting, and a text replacement engine.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🌍 **Subdomain mapping** | Map any number of custom subdomains to upstream subdomains via a simple dictionary |
| 🚫 **Region & IP blocking** | Deny access by country code (ISO 3166-1 alpha-2) or specific IP address |
| 🔐 **Security headers** | Automatically injects `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, and `Referrer-Policy` |
| 🔁 **URL & redirect rewriting** | Rewrites upstream URLs in `Location` headers and `X-Pjax-Url` so links stay on your domain |
| 🧠 **Text replacement** | Replace arbitrary strings in HTML, JS, CSS, and JSON response bodies |
| 🔓 **CORS** | Sets permissive `Access-Control-Allow-*` headers for cross-origin resource loading |
| ♻️ **Cache control** | Toggle response caching on or off with a single flag |
| 🔒 **HTTPS enforcement** | Forces all upstream connections to use HTTPS |

---

## 🚀 Deploy

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create Application** → **Create Worker**.
2. Open [`worker.js`](https://github.com/OshekharO/CF-REVERSE-PROXY/blob/main/Script/OshekharO/worker.js), copy its full contents, and paste them into the online editor.
3. Edit the `config` object (see [Configuration](#️-configuration) below).
4. Click **Save and Deploy**.
5. For each custom domain in `domain_map`, add a route in **Workers** → **Add Route** and a `CNAME` DNS record pointing to `<your-worker>.workers.dev`.

---

## ⚙️ Configuration

Edit the `config` object at the top of `worker.js`:

```js
const config = {
    // Map each incoming hostname to its upstream target hostname.
    domain_map: {
        'proxy.yourdomain.com':        'www.upstream.com',
        'www.proxy.yourdomain.com':    'www.upstream.com',
        'cdn.proxy.yourdomain.com':    'cdn.upstream.com',
        'images.proxy.yourdomain.com': 'images.upstream.com',
    },

    // Fallback upstream when no mapping matches the incoming hostname.
    default_target: 'www.upstream.com',

    // ISO 3166-1 alpha-2 country codes to block.
    blocked_region: ['CN', 'KP', 'SY', 'PK', 'CU'],

    // IP addresses to block.
    blocked_ip_address: ['0.0.0.0', '127.0.0.1'],

    // Force HTTPS for all upstream connections.
    https: true,

    // Disable response caching (sets Cache-Control: no-store).
    disable_cache: true,

    // Text substitutions applied to all HTML, JS, CSS, and JSON responses.
    replace_dict: {
        'upstream.com': 'yourdomain.com',
        'Premium':      ''
    },

    // Extra response headers to inject.
    security_headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options':        'DENY',
        'X-XSS-Protection':       '1; mode=block',
        'Referrer-Policy':        'strict-origin-when-cross-origin'
    }
};
```

---

## 🔢 How Domain Mapping Works

When a request arrives, the Worker looks up `request.hostname` in `domain_map`. If a match is found, the request is forwarded to the corresponding upstream hostname. If no match is found, the request falls back to `default_target`.

**Example:**

| Incoming Request | Proxied To |
|---|---|
| `https://proxy.yourdomain.com/` | `https://www.upstream.com/` |
| `https://cdn.proxy.yourdomain.com/style.css` | `https://cdn.upstream.com/style.css` |

All URLs in the response body (`href`, `src`, `Location` header, etc.) are rewritten back to your custom domain so the visitor never sees the upstream domain.

---

## 🛡️ Access Control

Requests are rejected with `403 Access Denied` in the following cases:

- The `cf-ipcountry` country code is in `blocked_region`.
- The `cf-connecting-ip` address is in `blocked_ip_address`.
- Any of the required Cloudflare headers (`cf-ipcountry`, `cf-connecting-ip`, `user-agent`) are missing.

---

## 📄 License

MIT — part of [OshekharO/CF-REVERSE-PROXY](https://github.com/OshekharO/CF-REVERSE-PROXY).
Script by [OshekharO](https://github.com/OshekharO).
