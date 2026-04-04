# Telegram Channel Proxy — Clansty

> Reverse-proxy a Telegram public channel's preview page so it can be embedded in any website via an `<iframe>`.

---

## 🧩 What Does It Do?

Telegram channel preview pages (`t.me/s/<username>`) send response headers that prevent browsers from loading them inside `<iframe>` elements. This Cloudflare Worker:

1. Proxies the Telegram channel preview page and all its sub-resources (images, CSS, JS).
2. Strips the headers that block embedding.
3. Rewrites internal Telegram URLs to route through the Worker.
4. Applies optional CSS customizations to hide Telegram's navigation chrome.

The result is a clean, embeddable channel feed you can drop into any webpage.

---

## 🚀 Deploy

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create Application** → **Create Worker**.
2. Open [`proxy.js`](https://github.com/OshekharO/CF-REVERSE-PROXY/blob/main/Script/Clansty/proxy.js), copy its full contents, and paste them into the online editor.
3. Set the two constants at the top of the script (see [Configuration](#️-configuration) below).
4. Click **Save and Deploy**.
5. Visit your Worker's `.workers.dev` URL to verify the channel loads correctly, then embed it.

---

## ⚙️ Configuration

Edit the constants at the top of `proxy.js`:

```js
// Your Telegram channel username (without the @ symbol).
const USERNAME = 'your_channel_username';

// The full base URL of this Worker (your .workers.dev URL or custom domain).
const BASE_URL = 'https://your-worker.workers.dev';
```

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

| Incoming Path | Proxied To |
|---|---|
| `/` | `https://t.me/s/<USERNAME>` (channel home) |
| `/<number>` | `https://t.me/s/<USERNAME>/<number>` (specific message) |
| `/tgorg/<path>` | `https://telegram.org/<path>` (Telegram.org assets) |
| `/ts/<n>/<path>` | `https://cdn<n>.telesco.pe/<path>` (Telescope CDN) |
| `/s/<USERNAME>` | Handles "load more" AJAX requests |

---

## 📄 License

MIT — part of [OshekharO/CF-REVERSE-PROXY](https://github.com/OshekharO/CF-REVERSE-PROXY).
Original script by [Clansty](https://github.com/Clansty).
