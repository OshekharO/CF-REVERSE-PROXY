# Workers-Proxy — xiaoyang-sde

> The original lightweight JavaScript [Reverse Proxy](https://www.cloudflare.com/learning/cdn/glossary/reverse-proxy/) built for [Cloudflare Workers](https://workers.cloudflare.com/).

Deploy a fully functional reverse proxy on Cloudflare's global edge network — no VMs, no servers, no Nginx configuration required.

---

## ✨ Features

- 🪞 Build mirror / proxy websites for any upstream
- 🚀 Improve loading speed via Cloudflare's global network
- 🔐 Hide the origin server's IP address
- 🚫 Block specific countries/regions or IP addresses
- 📱 Redirect mobile visitors to a different upstream
- 🔁 Text replacement in response bodies

---

## 🚀 Deploy

### Step 1 — Create a Cloudflare Worker

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create Application** → **Create Worker**.
2. Open [`index.js`](https://github.com/OshekharO/CF-REVERSE-PROXY/blob/main/Script/xiaoyang-sde/index.js), copy its full contents, and paste them into the online editor (replacing the default code).
3. Click **Save and Deploy**.

### Step 2 — Bind to a Custom Domain

1. Make sure your domain is added to Cloudflare (orange-cloud DNS).
2. In your domain's dashboard, go to **Workers** → **Add Route**.
3. Set the route to `https://<your-domain>/*` and select the Worker you just created.
4. Add a `CNAME` DNS record:
   - **Name:** your subdomain (e.g., `proxy`) or `@` for root
   - **Target:** `<your-worker-name>.workers.dev`
   - **Proxy status:** Proxied ☁️

---

## ⚙️ Configuration

Edit the constants at the top of `index.js`:

```js
// The upstream website to proxy.
const upstream = 'www.google.com'

// Path prefix for all upstream requests.
const upstream_path = '/'

// Upstream for mobile device visitors.
const upstream_mobile = 'www.google.com'

// Countries/regions to block (ISO 3166-1 alpha-2 codes).
const blocked_region = ['CN', 'KP', 'SY', 'PK', 'CU']

// IP addresses to block.
const blocked_ip_address = ['0.0.0.0', '127.0.0.1']

// Force HTTPS for all upstream requests.
const https = true

// Disable response caching.
const disable_cache = false

// Text replacement map applied to all response bodies.
const replace_dict = {
    '$upstream': '$custom_domain',
    '//google.com': ''
}
```

---

## 🌐 Proxying Sites with Multiple Domains

Many websites load static assets (images, scripts, fonts) from a separate CDN domain. To proxy those correctly, deploy a second Worker for the CDN domain and wire the two together via `replace_dict`.

**Example — proxying Google (assets on gstatic.com):**

1. Deploy **Worker A** to proxy `www.gstatic.com` → bound to `static.yourdomain.com`
2. Deploy **Worker B** to proxy `www.google.com` → bound to `proxy.yourdomain.com`
3. In **Worker B**, add the following replacement so asset URLs point to your Worker A:

```js
const replace_dict = {
    '$upstream': '$custom_domain',
    'www.gstatic.com': 'static.yourdomain.com'
}
```

---

## 📄 License

MIT — part of [OshekharO/CF-REVERSE-PROXY](https://github.com/OshekharO/CF-REVERSE-PROXY).
Original script by [xiaoyang-sde](https://github.com/xiaoyang-sde).
