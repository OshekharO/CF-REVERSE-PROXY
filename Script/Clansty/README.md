# Telegram Channel Proxy — Clansty

> Reverse-proxy a Telegram public channel's preview page so it can be embedded in any website via an `<iframe>`.

---

## 🧩 What Does It Do?

Telegram channel preview pages (`t.me/s/<username>`) send response headers that prevent browsers from loading them inside `<iframe>` elements. This Cloudflare Worker:

1. Proxies the Telegram channel preview page and all its sub-resources (images, CSS, JS).
2. Strips the headers that block embedding (`X-Frame-Options`, `Content-Security-Policy`).
3. Rewrites internal Telegram URLs to route through the Worker.
4. Applies optional CSS customisations to hide Telegram's navigation chrome.
5. Handles "Load more" AJAX requests so infinite scroll works inside the iframe.

The result is a clean, embeddable channel feed you can drop into any webpage.

---

## 🚀 Deploy

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create Application** → **Create Worker**.
2. Open [`proxy.js`](https://github.com/OshekharO/CF-REVERSE-PROXY/blob/main/Script/Clansty/proxy.js), copy its full contents, and paste them into the online editor.
3. Set `USERNAME` at the top of the script (see [Configuration](#️-configuration) below).
4. Click **Save and Deploy**.
5. Visit your Worker's `.workers.dev` URL to verify the channel loads correctly, then embed it.

> **Note:** This script uses ES module syntax (`export default`). Make sure the **"Module" compatibility flag** is enabled in your Worker settings (it is the default for new Workers in 2024+).

---

## ⚙️ Configuration

Edit the constants near the top of `proxy.js`:

```js
// Your Telegram channel username (without the @ symbol).
const USERNAME = 'your_channel_username';

// Full base URL of this Worker (your .workers.dev URL or custom domain).
// Leave empty ('') to auto-detect from the incoming request — recommended.
const BASE_URL = '';

// Favicon URL injected into proxied pages.
const FAVICON_URL = 'https://cdn.lwqwq.com/pic/41329_SaVJ3LWa.webp';
```

`BASE_URL` defaults to `''` which causes the Worker to auto-detect its own origin from each incoming request. Only set it explicitly if you run the Worker behind a custom domain and the auto-detection doesn't work.

---

## 🖼️ Embedding in a Webpage

Once deployed, embed the proxied feed with a standard `<iframe>`:

```html
<iframe
  src="https://your-worker.workers.dev"
  width="100%"
  height="600"
  frameborder="0"
  scrolling="yes">
</iframe>
```

> **Tip:** For the best visual result, keep the iframe width at or below **720px**.

---

## 🔀 How URL Routing Works

| Incoming Path | Proxied To | Notes |
|---|---|---|
| `/` | `https://t.me/s/<USERNAME>` | Channel home |
| `/<number>` | `https://t.me/s/<USERNAME>/<number>` | Specific message |
| `/tgorg/<path>` | `https://telegram.org/<path>` | Telegram.org CSS / assets |
| `/ts/<n>/<path>` | `https://cdn<n>.telesco.pe/<path>` | Telescope CDN media |
| `/s/<USERNAME>` | `https://t.me/s/<USERNAME>` (POST) | "Load more" AJAX |
| `/v/` | Health-check endpoint | Returns `true` |

---

## 🔒 What Gets Stripped / Injected

| Direction | What | Why |
|---|---|---|
| Upstream request | `cf-connecting-ip`, `cf-ipcountry`, `cf-ray`, `cf-visitor`, `cf-worker` | Prevent Cloudflare header leakage |
| Upstream response | `X-Frame-Options`, `Content-Security-Policy`, `Content-Security-Policy-Report-Only` | Allow `<iframe>` embedding |
| Upstream response | `Access-Control-Allow-*` headers added | Enable cross-origin loading |

---

## 📄 License

MIT — part of [OshekharO/CF-REVERSE-PROXY](https://github.com/OshekharO/CF-REVERSE-PROXY).
Original script by [Clansty](https://github.com/Clansty).
