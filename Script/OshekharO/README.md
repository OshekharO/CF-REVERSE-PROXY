# 🌀 Reverse Proxy (Cloudflare Worker) - Beta Version

A feature-rich, optimized **Cloudflare Worker reverse proxy** that maps your custom domain to any target site — with advanced features like rate limiting, bot detection, caching control, and custom error pages.

---

## ✨ Features

### Core Features
* 🌍 **Domain & Subdomain Mapping** - Automatic mapping of custom domains to target domains
* 🚫 **Region/IP Blocking** - Block specific countries or IP addresses
* 🔐 **HTTPS Support** - Secure connections with configurable protocol
* 🔁 **Redirect & Link Rewriting** - Automatic URL rewriting in responses
* 🧠 **Text Replacement Engine** - Replace any text in responses

### Advanced Features (Beta)
* ⚡ **Rate Limiting** - Prevent abuse with configurable request limits
* 🤖 **Bot/Crawler Detection** - Block bad bots while allowing good ones (Googlebot, Bingbot, etc.)
* 🏥 **Health Check Endpoint** - Monitor proxy health at `/__health`
* 📊 **Stats/Metrics Endpoint** - View request statistics at `/__stats`
* 📝 **Request Logging** - Configurable log levels (debug, info, warn, error)
* 💾 **Smart Caching** - Content-type based cache TTL configuration
* 🔧 **Custom Headers** - Inject custom headers in requests and responses
* 🌐 **WebSocket Support** - Proxy WebSocket connections
* 🎨 **Custom Error Pages** - Beautiful, branded error pages
* 🛡️ **Enhanced Security Headers** - Including Permissions-Policy
* 🧹 **HTML Element Removal** - Remove ads, popups, or any element by selector

---

## 🚀 Quick Setup

1. Go to **Cloudflare Dashboard → Workers**
2. Create a new Worker → paste `beta.js`
3. Deploy & assign a **custom domain** (e.g., `proxy.yourdomain.com`)
4. Edit the config section at the top of the file

---

## ⚙️ Configuration

### Basic Configuration

```javascript
const config = {
  domains: {
    custom: {
      main: 'your-domain.com',
      subdomains: ['www', 'api', 'cdn']
    },
    target: {
      main: 'target-site.com',
      subdomains: ['www', 'api', 'cdn']
    }
  },
  https: true,
  blocked_region: ['CN', 'KP'],
  blocked_ip_address: ['0.0.0.0']
};
```

### Rate Limiting

```javascript
rate_limit: {
  enabled: true,
  requests_per_minute: 60,  // Max requests per IP per minute
  burst_limit: 10           // Burst allowance
}
```

### Caching

```javascript
cache: {
  enabled: true,
  ttl: {
    'text/html': 300,           // 5 minutes
    'text/css': 86400,          // 1 day
    'application/javascript': 86400,
    'image/*': 604800,          // 1 week
    'default': 3600             // 1 hour
  }
}
```

### Bot Detection

```javascript
block_bots: {
  enabled: true,
  blocked_user_agents: ['bot', 'crawler', 'spider', 'scraper'],
  allow_good_bots: true,
  good_bots: ['googlebot', 'bingbot', 'yandexbot']
}
```

### Custom Headers

```javascript
custom_headers: {
  request: {
    'X-Custom-Header': 'value'
  },
  response: {
    'X-Powered-By': 'CF-Reverse-Proxy'
  }
}
```

### HTML Element Removal

```javascript
html_rewriter: {
  enabled: true,
  remove_elements: ['.ad-banner', '#popup', '.cookie-notice'],
  remove_attributes: [
    { selector: 'a', attribute: 'target' }
  ]
}
```

### Logging

```javascript
logging: {
  enabled: true,
  level: 'info'  // 'debug', 'info', 'warn', 'error'
}
```

---

## 📡 API Endpoints

### Health Check
```
GET /__health
```
Returns:
```json
{
  "status": "healthy",
  "uptime": 3600,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Statistics
```
GET /__stats
```
Returns:
```json
{
  "requests": 1000,
  "errors": 5,
  "blocked": 50,
  "cacheable_responses": 200,
  "uptime_seconds": 3600,
  "uptime_formatted": "1h 0m 0s",
  "requests_per_second": 0.28,
  "error_rate": "0.50%"
}
```

---

## 🧾 Example Usage

**Proxy target-site.com → your-domain.com**

| Incoming Request | Proxied To |
|------------------|------------|
| `https://your-domain.com/` | `https://target-site.com/` |
| `https://cdn.your-domain.com/style.css` | `https://cdn.target-site.com/style.css` |

---

## 🔒 Security Features

- **X-Content-Type-Options**: nosniff
- **X-Frame-Options**: DENY
- **X-XSS-Protection**: 1; mode=block
- **Referrer-Policy**: strict-origin-when-cross-origin
- **Permissions-Policy**: Restricts geolocation, microphone, camera

---

## 🧹 Best Practices

* ✅ Enable rate limiting to prevent abuse
* ✅ Use caching for static content to improve performance
* ✅ Enable bot blocking to reduce unwanted traffic
* ✅ Monitor the `/__stats` endpoint for insights
* ✅ Set appropriate log levels for debugging
* ⚠️ Avoid using the proxy for illegal or ToS-violating targets

---

## 🔄 Migrating from worker.js

The `beta.js` script is backward compatible with `worker.js`. To migrate:

1. Copy your domain configuration from `worker.js`
2. Update the `config.domains` section in `beta.js`
3. Enable/disable new features as needed
4. Deploy and test

---

## ⚖️ License

This project is based on and inspired by [OshekharO/CF-REVERSE-PROXY](https://github.com/OshekharO/CF-REVERSE-PROXY)
Licensed under the **MIT License** — you may freely modify and distribute it.

---

## ❤️ Credits

* **Original Author:** [OshekharO](https://github.com/OshekharO)
* **Platform:** [Cloudflare Workers](https://workers.cloudflare.com)
