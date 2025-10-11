# 🌀 Reverse Proxy (Cloudflare Worker)

A lightweight, optimized **Cloudflare Worker reverse proxy** that maps your custom domain to any target site — with caching control, region/IP blocking, HTTPS, and smart text replacement.

---

### ⚡ Features

* 🌍 Custom & subdomain mapping
* 🚫 Region/IP blocking
* 🔐 HTTPS + security headers
* 🔁 Redirect & link rewriting
* 🧠 Text replacement engine
* ⚙️ Config-based, single-file deployment

---

### 🚀 Quick Setup

1. Go to **Cloudflare Dashboard → Workers**
2. Create a new Worker → paste `worker.js`
3. Deploy & assign a **custom domain** (e.g., `proxy.yourdomain.com`)
4. Edit config:

   ```js
   const config = {
     domains: {
       custom: { main: 'goindex.eu.org' },
       target: { main: 'literotica.com' }
     },
     https: true,
     disable_cache: true
   };
   ```

---

### 🧾 Example Usage

**Proxy literotica.com → goindex.eu.org**

| Incoming Request                       | Proxied To                             |
| -------------------------------------- | -------------------------------------- |
| `https://goindex.eu.org/`              | `https://literotica.com/`              |
| `https://cdn.goindex.eu.org/style.css` | `https://cdn.literotica.com/style.css` |

---

### 🧹 Maintenance & Best Practices

* Avoid using the proxy for illegal or ToS-violating targets.
* Monitor logs for high traffic or abuse.
* Limit target replacements for speed.
* Use cache wisely if your content is static.

---

### ⚖️ License

This project is based on and inspired by [OshekharO/CF-REVERSE-PROXY](https://github.com/OshekharO/CF-REVERSE-PROXY)
Licensed under the **MIT License** — you may freely modify and distribute it.

---

### ❤️ Credits

* **Original Author:** [OshekharO](https://github.com/OshekharO)
* **Optimized Version:** Improved by Saksham Shekher using GPT-5
* **Platform:** [Cloudflare Workers](https://workers.cloudflare.com)
