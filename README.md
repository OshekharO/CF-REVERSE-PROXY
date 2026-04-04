# CF-REVERSE-PROXY

> A collection of lightweight, serverless **Reverse Proxy** scripts for [Cloudflare Workers](https://workers.cloudflare.com/) — no servers, no VMs, no Nginx required.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Cloudflare%20Workers-orange)](https://workers.cloudflare.com/)

---

## 📖 Overview

**CF-REVERSE-PROXY** lets you deploy a fully functional reverse proxy on Cloudflare's global edge network in minutes. Map any custom domain to any upstream target, enforce access controls, rewrite content on the fly, and serve your users with minimal latency — all without managing infrastructure.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🌍 **Domain & Subdomain Mapping** | Map one or more custom domains/subdomains to upstream targets |
| 🔐 **Region & IP Blocking** | Deny access from specific countries (ISO 3166-1 alpha-2) or IP addresses |
| 🔁 **URL Rewriting** | Automatically rewrite URLs in HTML, JS, CSS, and JSON responses |
| 🧠 **Text Replacement Engine** | Replace arbitrary strings in response bodies via a simple config dictionary |
| ⚡ **HTMLRewriter Support** | Stream-based, efficient HTML transformation using Cloudflare's native `HTMLRewriter` API |
| 🛡️ **Security Headers** | Inject `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, and more |
| 🚫 **Ad Removal** | Strip ad-injecting `<script>` and `<iframe>` blocks from proxied pages |
| 🔗 **CORS Support** | Adds appropriate CORS headers so proxied resources load cleanly in browsers |
| ⚙️ **Zero Infrastructure** | 100% serverless — runs on Cloudflare's edge, no VMs or containers needed |
| 🔒 **HTTPS Enforcement** | Force all upstream connections to use HTTPS |
| ♻️ **Cache Control** | Enable or disable caching with a single config flag |

---

## 📂 Repository Structure

```
CF-REVERSE-PROXY/
└── Script/
    ├── xiaoyang-sde/   # Original lightweight reverse proxy
    ├── viperadnan/     # Booster — speed, caching, firewall, and route optimizations
    ├── KusakabeSi/     # Multi-site proxy with string replacement & ad removal
    ├── Clansty/        # Telegram channel preview reverse proxy
    ├── Mikotwa/        # HTMLRewriter-based proxy
    ├── ymyuuu/         # Simple general-purpose reverse proxy
    └── OshekharO/      # Enhanced proxy with full subdomain mapping (recommended)
```

---

## 🚀 Quick Start

### 1. Open Cloudflare Workers

Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create Application** → **Create Worker**.

### 2. Paste the Script

Pick the script that fits your use case (see [Script Variants](#-script-variants)), copy its contents, and paste it into the Cloudflare Workers online editor, replacing the default code.

### 3. Configure the Script

Edit the `config` object (or top-level constants) at the top of the script:

```js
const config = {
  // Map incoming host → upstream target
  domain_map: {
    'proxy.yourdomain.com': 'www.example.com',
    'cdn.yourdomain.com':   'cdn.example.com',
  },
  default_target:      'www.example.com',

  // Block access by country code (ISO 3166-1 alpha-2)
  blocked_region:      ['CN', 'KP', 'SY', 'PK', 'CU'],

  // Block specific IP addresses
  blocked_ip_address:  ['0.0.0.0', '127.0.0.1'],

  // Force HTTPS for upstream requests
  https:               true,

  // Disable response caching
  disable_cache:       true,

  // Replace text in response bodies
  replace_dict: {
    'example.com':     'yourdomain.com',
    'Premium':         '',
  },
};
```

### 4. Deploy & Bind a Custom Domain

1. Click **Save and Deploy** in the Workers editor.
2. In the Cloudflare dashboard, navigate to your domain → **Workers** → **Add Route**.
3. Enter `https://proxy.yourdomain.com/*` as the route and select your Worker.
4. Add a `CNAME` DNS record:
   - **Name:** `proxy` (or `@` for root)
   - **Target:** `<your-worker-subdomain>.workers.dev`
   - **Proxy status:** Proxied (orange cloud ☁️)

---

## 📦 Script Variants

### [`OshekharO/worker.js`](Script/OshekharO/worker.js) ⭐ Recommended

A full-featured reverse proxy with explicit subdomain mapping, security headers, CORS handling, redirect rewriting, and `X-Pjax-Url` support. Best for production use.

### [`OshekharO/beta.js`](Script/OshekharO/beta.js)

An optimized variant of `worker.js` that adds **streaming HTML transformation** via the native `HTMLRewriter` API, a loop-detection guard, and configurable request timeout handling.

### [`xiaoyang-sde/index.js`](Script/xiaoyang-sde/index.js)

The original lightweight reverse proxy. Simple configuration with `upstream`, `blocked_region`, `blocked_ip_address`, and `replace_dict` constants. Great starting point for basic use cases.

### [`viperadnan/booster.js`](Script/viperadnan/booster.js)

Extends the proxy with performance optimizations: static asset caching, image compression (Polish/Mirage), JavaScript minification, scrape shielding, and region-based routing.

### [`KusakabeSi/worker.js`](Script/KusakabeSi/worker.js)

Supports multiple upstream sites within a single Worker. Includes string replacement, custom resource substitution, Cloudflare email-obfuscation bypass, and optional ad removal from `<script>` and `<iframe>` elements.

### [`Clansty/proxy.js`](Script/Clansty/proxy.js)

Specifically designed to reverse-proxy **Telegram channel preview** pages, stripping the headers that prevent embedding so the channel can be shown in an `<iframe>` on your own website.

### [`ymyuuu/worker.js`](Script/ymyuuu/worker.js)

A straightforward general-purpose reverse proxy with CORS headers, relative-to-absolute path rewriting, redirect handling, and a user-friendly input UI when no target URL is provided.

---

## ⚙️ Configuration Reference

| Key | Type | Description |
|---|---|---|
| `domain_map` | `Object` | Maps incoming hostnames to upstream target hostnames |
| `default_target` | `string` | Fallback upstream when no mapping is found |
| `blocked_region` | `string[]` | ISO 3166-1 alpha-2 country codes to block |
| `blocked_ip_address` | `string[]` | IP addresses to block |
| `https` | `boolean` | Use `https:` for upstream connections |
| `disable_cache` | `boolean` | Set `Cache-Control: no-store` on responses |
| `replace_dict` | `Object` | Key-value pairs for text replacement in response bodies |
| `security_headers` | `Object` | Additional response headers to inject |

---

## ⚠️ Disclaimer

- This project is intended **for educational and legitimate use only**.
- Do **not** use this to proxy sites you do not own or have permission to mirror.
- Do **not** use this to violate Cloudflare's [Terms of Service](https://www.cloudflare.com/terms/) or any applicable laws.
- This script is **free** — do not sell it.
- The authors are not responsible for any misuse or legal consequences.

---

## 🤝 Credits

| Contributor | Contribution |
|---|---|
| [xiaoyang-sde](https://github.com/xiaoyang-sde) | Original Workers-Proxy script |
| [viperadnan-git](https://github.com/viperadnan-git) | Booster — caching, optimization, firewall |
| [KusakabeSi](https://github.com/KusakabeSi) | Multi-site support, string replacement, ad removal |
| [Mikotwa](https://github.com/Mikotwa) | HTMLRewriter integration |
| [Clansty](https://github.com/Clansty) | Telegram channel proxy |
| [ymyuuu](https://github.com/ymyuuu) | General-purpose proxy with UI |
| [OshekharO](https://github.com/OshekharO) | Repository maintainer & enhancements |

---

## 💬 Support

For questions or help, reach out via Telegram: [@OshekherO](https://t.me/OshekherO)

> Please verify your configuration is correct before asking for support.

---

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

---

<p align="center">© 2024 OshekharO · CF-REVERSE-PROXY</p>

