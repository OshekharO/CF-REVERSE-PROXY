# Booster — viperadnan

> A speed and performance optimizer for your website, built on [Cloudflare Workers](https://workers.cloudflare.com/).

Booster delivers fast, optimized web experiences to end users by caching static assets on Cloudflare's global edge, applying automatic web optimizations, and guarding your website from scrapers and malicious traffic.

---

## ✨ Features

| Feature | Description |
|---|---|
| ⚡ **Speed** | Serve your site from Cloudflare's global network — milliseconds from virtually every Internet user |
| 🔒 **Network** | Automatic HTTP/2, TLS 1.3, HTTPS (free SSL certificate), and IPv6 support |
| 🖼️ **Optimization** | Minify JS/CSS/HTML, compress images, cache static assets |
| 🛡️ **Firewall** | Block traffic from specific IP addresses, regions, or known scrapers |
| 🗺️ **Routing** | Serve different upstream pages to visitors based on their country or device |
| ☁️ **Serverless** | No virtual machines, no servers, no containers to manage |

---

## 🚀 Deploy

### Step 1 — Create a Cloudflare Worker

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create Application** → **Create Worker**.
2. Open [`booster.js`](https://github.com/OshekharO/CF-REVERSE-PROXY/blob/main/Script/viperadnan/booster.js), copy its full contents, and paste them into the online editor (replacing the default code).
3. Click **Save and Deploy**.

### Step 2 — Bind to a Custom Domain

1. Make sure your domain is added to Cloudflare (orange-cloud DNS).
2. In your domain's dashboard, go to **Workers** → **Add Route**.
3. Set the route to `https://<your-domain>/*` and select the Worker you just created.
4. Add a `CNAME` DNS record:
   - **Name:** your subdomain (e.g., `www`) or `@` for root
   - **Target:** `<your-worker-name>.workers.dev` (e.g., `mybooster.workers.dev`)
   - **Proxy status:** Proxied ☁️

---

## ⚙️ Configuration

Edit the `config` object at the top of `booster.js`:

```js
const config = {
  basic: {
    // The upstream website to proxy.
    upstream: 'https://www.example.com/',
    // Redirect mobile device visitors to this URL.
    mobileRedirect: 'https://m.example.com/'
  },
  firewall: {
    // Block visitors from these country codes (ISO 3166-1 alpha-2).
    blockedRegion: ['CN', 'KP', 'SY', 'PK', 'CU'],
    // Block specific IP addresses.
    blockedIPAddress: [],
    // Enable scrape shield to detect and deter content scraping.
    scrapeShield: true
  },
  // Map country codes to specific upstream URLs.
  routes: {
    FR: 'https://www.google.fr/',
    CA: 'https://www.google.ca/'
  },
  optimization: {
    // Force Cloudflare to cache all responses regardless of response headers.
    cacheEverything: false,
    // Cache TTL in seconds.
    cacheTtl: 5,
    // Detect screen size and connection speed to serve optimized images.
    mirage: true,
    // Automatic image optimization: 'lossy', 'lossless', or 'off'.
    polish: 'off',
    // Minify JavaScript, CSS, and HTML files.
    minify: {
      javascript: true,
      css: true,
      html: true
    }
  }
};
```

---

## 📖 Configuration Reference

### `basic`

| Key | Type | Description |
|---|---|---|
| `upstream` | `string` | Full URL of the upstream origin to proxy |
| `mobileRedirect` | `string` | URL to redirect mobile device visitors to |

### `firewall`

| Key | Type | Description |
|---|---|---|
| `blockedRegion` | `string[]` | [ISO 3166-1 alpha-2](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2) country codes to block |
| `blockedIPAddress` | `string[]` | IP addresses to block |
| `scrapeShield` | `boolean` | Enable Cloudflare's ScrapeShield protection |

### `routes`

Map [ISO 3166-1 alpha-2](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2) country codes to specific upstream URLs. Visitors from those countries will be routed to the mapped URL instead of the default `upstream`.

### `optimization`

| Key | Type | Description |
|---|---|---|
| `cacheEverything` | `boolean` | Cache all responses regardless of headers |
| `cacheTtl` | `number` | Cache TTL in seconds |
| `mirage` | `boolean` | Enable [Mirage](https://developers.cloudflare.com/images/mirage/) image optimization |
| `polish` | `string` | Image compression: `'lossy'`, `'lossless'`, or `'off'` |
| `minify` | `object` | Enable minification for `javascript`, `css`, and/or `html` |

---

## 📄 License

MIT — part of [OshekharO/CF-REVERSE-PROXY](https://github.com/OshekharO/CF-REVERSE-PROXY).
Original script by [viperadnan-git](https://github.com/viperadnan-git).
