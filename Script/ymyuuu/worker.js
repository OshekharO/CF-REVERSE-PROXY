/* CF-REVERSE-PROXY — ymyuuu/worker.js
 * A general-purpose open reverse proxy for Cloudflare Workers.
 *
 * Repository : https://github.com/OshekharO/CF-REVERSE-PROXY
 * Original author : ymyuuu  |  Enhanced by : OshekharO
 */

// ─── Configuration ────────────────────────────────────────────────────────────

const ALLOWED_PROTOCOLS = ['http:', 'https:'];
const BLOCKED_DOMAINS = ['example.com', 'another-blocked-site.com'];

const CF_HEADERS_TO_STRIP = [
  'cf-connecting-ip',
  'cf-ipcountry',
  'cf-ray',
  'cf-visitor',
  'cf-worker',
];

// Set a password to prevent abuse. Leave empty ("") to disable.
const PROXY_PASSWORD = ""; // e.g., "mySecret123"

// ─── Entry Point ──────────────────────────────────────────────────────────────

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return handlePreflight(request);
    }
    try {
      return await handleRequest(request);
    } catch (err) {
      console.error('Unhandled error:', err);
      return jsonError(500, 'Internal Server Error', err.message);
    }
  },
};

// ─── Request Handler ──────────────────────────────────────────────────────────

async function handleRequest(request) {
  const url = new URL(request.url);

  // ─── Password Protection Check ───
  if (PROXY_PASSWORD) {
    const auth = request.headers.get('Authorization');
    const expected = `Basic ${btoa('proxy:' + PROXY_PASSWORD)}`;
    if (auth !== expected) {
      return new Response('Authentication required.', {
        status: 401,
        headers: { 'WWW-Authenticate': 'Basic realm="CF Reverse Proxy"' }
      });
    }
  }

  // Serve the landing page for "/"
  if (url.pathname === '/') {
    return new Response(getLandingPage(), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Decode the target URL from the first path segment
  let targetStr = decodeURIComponent(url.pathname.slice(1));

  // Prepend protocol if missing
  if (!/^https?:\/\//i.test(targetStr)) {
    targetStr = `https://${targetStr}`;
  }

  // Append original query string
  if (url.search) {
    targetStr += url.search;
  }

  // Validate the target URL
  const validation = validateUrl(targetStr, url.hostname);
  if (!validation.valid) {
    return jsonError(400, 'Bad Request', `URL validation failed: ${validation.reason}`);
  }

  const targetUrl = validation.parsed;

  // ─── 2. WebSocket Support ───
  if (request.headers.get('Upgrade') === 'websocket') {
    const wsRequest = new Request(targetUrl.toString(), request);
    return fetch(wsRequest);
  }

  // Build upstream request headers
  const upstreamHeaders = new Headers(request.headers);
  CF_HEADERS_TO_STRIP.forEach(h => upstreamHeaders.delete(h));
  upstreamHeaders.set('Host', targetUrl.hostname);

  // ─── 1. Cookie Rewriting (Request) ───
  // Convert proxy cookies back to target cookies
  const incomingCookies = request.headers.get('Cookie');
  if (incomingCookies) {
    let cookiesForTarget = [];
    incomingCookies.split(';').forEach(c => {
      const trim = c.trim();
      const prefix = targetUrl.hostname + '__';
      if (trim.startsWith(prefix)) {
        // Restore original cookie name and value
        cookiesForTarget.push(trim.substring(prefix.length));
      }
    });
    if (cookiesForTarget.length > 0) {
      upstreamHeaders.set('Cookie', cookiesForTarget.join('; '));
    } else {
      upstreamHeaders.delete('Cookie');
    }
  }

  // ─── 2. UA Spoofing & Header Stripping ───
  upstreamHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');
  upstreamHeaders.delete('Origin');
  upstreamHeaders.delete('Referer');
  upstreamHeaders.set('Sec-Fetch-Site', 'same-origin');

  const upstreamRequest = new Request(targetUrl.toString(), {
    method: request.method,
    headers: upstreamHeaders,
    body: request.method === 'GET' || request.method === 'HEAD' ? null : request.body,
    redirect: 'manual',
  });

  const upstream = await fetch(upstreamRequest);

  // Intercept upstream Cloudflare error pages (Error 1016, etc.)
  if (upstream.status >= 500) {
    const ct = upstream.headers.get('Content-Type') || '';
    if (ct.includes('text/html')) {
      const errorText = await upstream.clone().text();
      if (errorText.includes('Error 1003') || errorText.includes('Error 1016') || errorText.includes('Error 1000') || errorText.includes('Ray ID:')) {
        return jsonError(502, 'Bad Gateway', 'The target website is unavailable, misconfigured, or blocking proxies.');
      }
    }
  }

  // Redirect handling
  if ([301, 302, 303, 307, 308].includes(upstream.status)) {
    return rewriteRedirect(upstream, url, targetUrl);
  }

  // Build response headers
  const responseHeaders = new Headers();
  const safeHeaders = ['Content-Type', 'Content-Length', 'Content-Language', 'Date', 'ETag', 'Last-Modified'];
  safeHeaders.forEach(h => {
    if (upstream.headers.has(h)) {
      responseHeaders.set(h, upstream.headers.get(h));
    }
  });
  
  applySecurityHeaders(responseHeaders);
  applyCorsHeaders(responseHeaders, request.headers.get('Origin'));
  responseHeaders.delete('Content-Security-Policy');
  responseHeaders.delete('Content-Security-Policy-Report-Only');

  // ─── 1. Cookie Rewriting (Response) ───
  // Convert target cookies to proxy cookies
  const setCookies = upstream.headers.getAll('Set-Cookie');
  if (setCookies.length > 0) {
    responseHeaders.delete('Set-Cookie');
    setCookies.forEach(c => {
      // Strip Domain and Path attributes
      let rewritten = c.replace(/;\s*Domain=[^;]*/gi, '').replace(/;\s*Path=[^;]*/gi, '');
      rewritten += '; Path=/'; // Set path to proxy root
      
      // Prefix cookie name with target domain
      rewritten = rewritten.replace(/^([^=]+)=/, `${targetUrl.hostname}__$1=`);
      responseHeaders.append('Set-Cookie', rewritten);
    });
  }

  const contentType = (responseHeaders.get('Content-Type') || '').toLowerCase();
  let body;
  let finalHeaders = new Headers(responseHeaders);

  // ─── 4. Performance: Asset Caching ───
  if (contentType.includes('text/html')) {
    finalHeaders.set('Cache-Control', 'no-store');
  } else {
    finalHeaders.set('Cache-Control', 'public, max-age=3600');
  }

  // ─── HTML Content: Use HTMLRewriter ───
  if (contentType.includes('text/html')) {
    const htmlResponse = new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: upstream.headers
    });

    const rewriter = new HTMLRewriter()
      .on('a', new AttributeRewriter('href', targetUrl, url.origin))
      .on('img', new AttributeRewriter('src', targetUrl, url.origin))
      .on('img', new AttributeRewriter('srcset', targetUrl, url.origin, true))
      .on('script', new AttributeRewriter('src', targetUrl, url.origin))
      .on('link', new AttributeRewriter('href', targetUrl, url.origin))
      .on('form', new AttributeRewriter('action', targetUrl, url.origin))
      .on('iframe', new AttributeRewriter('src', targetUrl, url.origin))
      .on('meta', new MetaRefreshRewriter(targetUrl, url.origin))
      .on('base', new BaseTagRemover())
      .on('video', new AttributeRewriter('src', targetUrl, url.origin))
      .on('audio', new AttributeRewriter('src', targetUrl, url.origin))
      .on('source', new AttributeRewriter('src', targetUrl, url.origin))
      .on('source', new AttributeRewriter('srcset', targetUrl, url.origin, true))
      .on('object', new AttributeRewriter('data', targetUrl, url.origin))
      .on('head', new ClientSideInterceptor(url.origin, targetUrl.origin));

    const transformedResponse = rewriter.transform(htmlResponse);
    body = transformedResponse.body;
    
    finalHeaders.set('Content-Type', 'text/html; charset=utf-8');
    finalHeaders.delete('Content-Length');
  } 
  // ─── CSS Content ───
  else if (contentType.includes('text/css')) {
    const cssText = await upstream.text();
    const rewrittenCss = rewriteCss(cssText, targetUrl, url.origin);
    body = rewrittenCss;
    finalHeaders.set('Content-Type', 'text/css; charset=utf-8');
    finalHeaders.delete('Content-Length');
  } 
  // ─── JavaScript / JSON Content ───
  else if (contentType.includes('javascript') || contentType.includes('application/json')) {
    const jsText = await upstream.text();
    const rewrittenJs = rewriteJs(jsText, targetUrl, url.origin);
    body = rewrittenJs;
    finalHeaders.delete('Content-Length');
  }
  // ─── Other Content (Images, Fonts, etc.) ───
  else {
    body = upstream.body;
  }

  return new Response(body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: finalHeaders,
  });
}

// ─── URL Validation ───────────────────────────────────────────────────────────

function isIPAddress(hostname) {
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) return true;
  if (hostname.includes(':')) return true;
  return false;
}

function validateUrl(rawUrl, proxyHost) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { valid: false, reason: 'Malformed URL' };
  }

  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    return { valid: false, reason: `Protocol "${parsed.protocol}" is not allowed` };
  }

  const host = parsed.hostname.toLowerCase();
  if (isIPAddress(host)) return { valid: false, reason: 'Proxying IP addresses is not allowed' };
  if (host === proxyHost) return { valid: false, reason: 'Cannot proxy the proxy itself' };

  const isBlocked = BLOCKED_DOMAINS.some(d => host === d || host.endsWith(`.${d}`));
  if (isBlocked) return { valid: false, reason: 'Domain is blocked' };

  return { valid: true, parsed };
}

// ─── Rewriter Classes ─────────────────────────────────────────────────────────

class AttributeRewriter {
  constructor(attributeName, targetUrl, proxyOrigin, isSrcset = false) {
    this.attributeName = attributeName;
    this.targetUrl = targetUrl;
    this.proxyOrigin = proxyOrigin;
    this.isSrcset = isSrcset;
  }
  element(element) {
    const attr = element.getAttribute(this.attributeName);
    if (!attr) return;
    if (this.isSrcset) {
      element.setAttribute(this.attributeName, rewriteSrcset(attr, this.targetUrl, this.proxyOrigin));
    } else {
      element.setAttribute(this.attributeName, rewriteUrl(attr, this.targetUrl, this.proxyOrigin));
    }
  }
}

class MetaRefreshRewriter {
  constructor(targetUrl, proxyOrigin) {
    this.targetUrl = targetUrl;
    this.proxyOrigin = proxyOrigin;
  }
  element(element) {
    const httpEquiv = element.getAttribute('http-equiv');
    if (httpEquiv && httpEquiv.toLowerCase() === 'refresh') {
      const content = element.getAttribute('content');
      if (content) {
        const parts = content.split(';');
        if (parts.length > 1) {
          const urlPart = parts[1].trim();
          if (urlPart.toLowerCase().startsWith('url=')) {
            const actualUrl = urlPart.substring(4);
            const rewritten = rewriteUrl(actualUrl, this.targetUrl, this.proxyOrigin);
            element.setAttribute('content', `${parts[0]}; url=${rewritten}`);
          }
        }
      }
    }
  }
}

class BaseTagRemover {
  element(element) { element.remove(); }
}

// ─── Client-Side Interceptor Class ─────────────────────────────────────────────
class ClientSideInterceptor {
  constructor(proxyOrigin, targetOrigin) {
    this.proxyOrigin = proxyOrigin;
    this.targetOrigin = targetOrigin;
  }
  element(element) {
    const script = `
      <script>
        (function() {
          const PROXY = "${this.proxyOrigin}";
          const TARGET = "${this.targetOrigin}";
          function rewriteUrl(url) {
            if (!url || url.startsWith('#') || url.startsWith('data:') || url.startsWith('mailto:') || url.startsWith('blob:') || url.startsWith('javascript:')) return url;
            try {
              if (url.startsWith(TARGET)) return PROXY + '/' + url;
              if (url.startsWith('/') || !url.startsWith('http')) {
                const absolute = new URL(url, TARGET).toString();
                return PROXY + '/' + absolute;
              }
              return url;
            } catch(e) { return url; }
          }
          const originalFetch = window.fetch;
          window.fetch = function(input, init) {
            if (typeof input === 'string') input = rewriteUrl(input);
            else if (input instanceof Request) {
              const newUrl = rewriteUrl(input.url);
              if (newUrl !== input.url) input = new Request(newUrl, input);
            }
            return originalFetch.call(this, input, init);
          };
          const originalOpen = XMLHttpRequest.prototype.open;
          XMLHttpRequest.prototype.open = function(method, url, ...args) {
            if (typeof url === 'string') url = rewriteUrl(url);
            return originalOpen.call(this, method, url, ...args);
          };
          const originalPushState = history.pushState;
          history.pushState = function(state, title, url) {
            if (typeof url === 'string') url = rewriteUrl(url);
            return originalPushState.call(this, state, title, url);
          };
          const originalReplaceState = history.replaceState;
          history.replaceState = function(state, title, url) {
            if (typeof url === 'string') url = rewriteUrl(url);
            return originalReplaceState.call(this, state, title, url);
          };
          const originalWindowOpen = window.open;
          window.open = function(url, ...args) {
            if (typeof url === 'string') url = rewriteUrl(url);
            return originalWindowOpen.call(this, url, ...args);
          };
        })();
      </script>
    `;
    element.prepend(script, { html: true });
  }
}

// ─── Rewriting Logic ──────────────────────────────────────────────────────────

function rewriteUrl(originalUrl, targetUrl, proxyOrigin) {
  if (!originalUrl || originalUrl.startsWith('#') || originalUrl.startsWith('data:') || originalUrl.startsWith('mailto:') || originalUrl.startsWith('javascript:') || originalUrl.startsWith('blob:')) return originalUrl;
  if (originalUrl.startsWith(proxyOrigin)) return originalUrl;
  try {
    const resolvedUrl = new URL(originalUrl, targetUrl);
    if (isIPAddress(resolvedUrl.hostname)) return originalUrl;
    return `${proxyOrigin}/${resolvedUrl.toString()}`;
  } catch (e) { return originalUrl; }
}

function rewriteSrcset(srcset, targetUrl, proxyOrigin) {
  if (!srcset) return srcset;
  return srcset.split(',').map(part => {
    let [url, descriptor] = part.trim().split(' ');
    if (url) {
      url = rewriteUrl(url, targetUrl, proxyOrigin);
      return descriptor ? `${url} ${descriptor}` : url;
    }
    return part;
  }).join(', ');
}

function rewriteCss(cssText, targetUrl, proxyOrigin) {
  if (!cssText) return cssText;
  return cssText.replace(/url\(['"]?([^'")]+)['"]?\)/g, (match, p1) => {
    const rewritten = rewriteUrl(p1, targetUrl, proxyOrigin);
    return `url('${rewritten}')`;
  });
}

function rewriteJs(jsText, targetUrl, proxyOrigin) {
  if (!jsText) return jsText;
  return jsText.replace(/["'](https?:\/\/[^"']+)["']/g, (match, url) => {
    const rewritten = rewriteUrl(url, targetUrl, proxyOrigin);
    return `"${rewritten}"`;
  });
}

// ─── Redirect Handling ───────────────────────────────────────────────────────

function rewriteRedirect(response, proxyUrl, targetUrl) {
  const location = response.headers.get('Location');
  const headers = new Headers();
  applyCorsHeaders(headers, null);
  if (location) {
    try {
      const resolvedLocation = new URL(location, targetUrl).toString();
      const redirectUrl = new URL(resolvedLocation);
      if (isIPAddress(redirectUrl.hostname)) return jsonError(400, 'Bad Request', 'Redirect to IP address is not allowed');
      headers.set('Location', `${proxyUrl.origin}/${resolvedLocation}`);
    } catch (e) { headers.set('Location', location); }
  }
  return new Response(null, { status: response.status, headers });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function applySecurityHeaders(headers) {
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-XSS-Protection', '1; mode=block');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
}

function applyCorsHeaders(headers, origin) {
  headers.set('Access-Control-Allow-Origin', origin || '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  headers.set('Access-Control-Allow-Headers', '*');
  headers.set('Access-Control-Max-Age', '86400');
}

function handlePreflight(request) {
  const headers = new Headers();
  applyCorsHeaders(headers, request.headers.get('Origin'));
  return new Response(null, { status: 204, headers });
}

function jsonError(status, title, detail) {
  return new Response(JSON.stringify({ error: title, detail }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

// ─── Landing Page ─────────────────────────────────────────────────────────────

function getLandingPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Proxy any URL through Cloudflare Workers — fast, free, and serverless.">
  <title>CF Reverse Proxy</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔗</text></svg>">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { min-height: 100vh; background: linear-gradient(135deg, #0f0c29 0%, #302b63 55%, #24243e 100%); font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #fff; display: flex; flex-direction: column; overflow-x: hidden; }
    body::before, body::after { content: ''; position: fixed; border-radius: 50%; pointer-events: none; z-index: 0; }
    body::before { width: 700px; height: 700px; background: radial-gradient(circle, rgba(108,99,255,0.22) 0%, transparent 65%); top: -200px; left: -200px; }
    body::after { width: 600px; height: 600px; background: radial-gradient(circle, rgba(62,207,207,0.18) 0%, transparent 65%); bottom: -150px; right: -150px; }
    header { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 3rem; border-bottom: 1px solid rgba(255,255,255,0.06); }
    .header-logo { display: flex; align-items: center; gap: 0.55rem; font-size: 1rem; font-weight: 700; color: rgba(255,255,255,0.9); }
    .header-logo .emoji { font-size: 1.3rem; }
    .header-nav { display: flex; gap: 1.5rem; align-items: center; }
    .header-nav a { font-size: 0.82rem; color: rgba(255,255,255,0.45); text-decoration: none; transition: color 0.2s; }
    .header-nav a:hover { color: #fff; }
    .main { position: relative; z-index: 1; flex: 1; display: flex; align-items: center; gap: 5rem; padding: 4rem 3rem; max-width: 1200px; margin: 0 auto; width: 100%; }
    .hero { flex: 1; min-width: 0; }
    .hero-badge { display: inline-flex; align-items: center; gap: 0.4rem; background: rgba(108,99,255,0.18); border: 1px solid rgba(108,99,255,0.38); border-radius: 999px; padding: 0.28rem 0.9rem; font-size: 0.74rem; color: #b0aaff; margin-bottom: 1.5rem; }
    .hero h1 { font-size: clamp(2rem, 3.5vw, 3rem); font-weight: 800; line-height: 1.18; letter-spacing: -1px; margin-bottom: 1.1rem; background: linear-gradient(130deg, #ffffff 35%, #b0aaff 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .hero p { color: rgba(255,255,255,0.5); font-size: 1rem; line-height: 1.75; margin-bottom: 2.5rem; max-width: 400px; }
    .feature-list { list-style: none; display: flex; flex-direction: column; gap: 1rem; }
    .feature-list li { display: flex; align-items: center; gap: 0.85rem; font-size: 0.88rem; color: rgba(255,255,255,0.65); }
    .feature-list li strong { color: rgba(255,255,255,0.88); }
    .feat-icon { width: 34px; height: 34px; flex-shrink: 0; border-radius: 9px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 1rem; }
    .form-card { flex-shrink: 0; width: 100%; max-width: 420px; background: rgba(255,255,255,0.07); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border: 1px solid rgba(255,255,255,0.14); border-radius: 1.5rem; padding: 2.4rem 2.2rem; box-shadow: 0 12px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07); }
    .form-card h2 { font-size: 1.2rem; font-weight: 700; margin-bottom: 0.35rem; }
    .form-sub { font-size: 0.82rem; color: rgba(255,255,255,0.42); margin-bottom: 1.8rem; }
    .field-label { display: block; font-size: 0.74rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: rgba(255,255,255,0.5); margin-bottom: 0.45rem; }
    .proxy-input { width: 100%; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14); border-radius: 0.75rem; color: #fff; padding: 0.78rem 1rem; font-size: 0.92rem; font-family: inherit; outline: none; transition: border-color 0.2s, box-shadow 0.2s, background 0.2s; }
    .proxy-input::placeholder { color: rgba(255,255,255,0.25); }
    .proxy-input:focus { background: rgba(255,255,255,0.1); border-color: rgba(108,99,255,0.65); box-shadow: 0 0 0 3px rgba(108,99,255,0.18); }
    .error-msg { color: #ff8a8a; font-size: 0.78rem; margin-top: 0.42rem; display: none; }
    .btn-proxy { display: flex; align-items: center; justify-content: center; gap: 0.5rem; width: 100%; margin-top: 1rem; padding: 0.82rem 1.5rem; background: linear-gradient(90deg, #6c63ff, #3ecfcf); border: none; border-radius: 0.75rem; color: #fff; font-weight: 700; font-size: 0.95rem; cursor: pointer; font-family: inherit; transition: opacity 0.2s, transform 0.12s, box-shadow 0.2s; box-shadow: 0 4px 22px rgba(108,99,255,0.38); }
    .btn-proxy:hover { opacity: 0.88; box-shadow: 0 6px 30px rgba(108,99,255,0.55); }
    .btn-proxy:active { transform: scale(0.98); }
    .divider { height: 1px; background: rgba(255,255,255,0.08); margin: 1.6rem 0; }
    .steps { display: flex; flex-direction: column; gap: 0.75rem; }
    .step { display: flex; align-items: flex-start; gap: 0.7rem; font-size: 0.79rem; color: rgba(255,255,255,0.4); line-height: 1.5; }
    .step-num { flex-shrink: 0; width: 20px; height: 20px; border-radius: 50%; background: rgba(108,99,255,0.22); font-size: 0.68rem; font-weight: 700; color: #b0aaff; display: flex; align-items: center; justify-content: center; margin-top: 1px; }
    footer { position: relative; z-index: 1; text-align: center; padding: 1.25rem 3rem; font-size: 0.72rem; color: rgba(255,255,255,0.22); border-top: 1px solid rgba(255,255,255,0.05); }
    footer a { color: rgba(255,255,255,0.32); text-decoration: none; transition: color 0.2s; }
    footer a:hover { color: #fff; }
    @media (max-width: 860px) { .main { flex-direction: column; align-items: stretch; gap: 2.5rem; padding: 2.5rem 1.5rem; } .form-card { max-width: 100%; } .hero p { max-width: 100%; } header { padding: 1rem 1.5rem; } footer { padding: 1rem 1.5rem; } }
    @media (max-width: 480px) { .hero h1 { font-size: 1.85rem; } .form-card { padding: 1.75rem 1.4rem; } .header-nav { display: none; } }
  </style>
</head>
<body>
  <header>
    <div class="header-logo"><span class="emoji">🔗</span> CF Reverse Proxy</div>
    <nav class="header-nav">
      <a href="https://github.com/OshekharO/CF-REVERSE-PROXY" target="_blank" rel="noopener noreferrer">GitHub</a>
      <a href="https://workers.cloudflare.com/" target="_blank" rel="noopener noreferrer">Cloudflare Workers</a>
    </nav>
  </header>
  <main class="main">
    <div class="hero">
      <div class="hero-badge">☁️ Powered by Cloudflare Workers</div>
      <h1>Proxy any URL,<br>instantly.</h1>
      <p>A fast, free, and serverless reverse proxy running on Cloudflare's global edge network. No sign-up required.</p>
      <ul class="feature-list">
        <li><span class="feat-icon">⚡</span><span><strong>Edge-native</strong> — deployed across 300+ data centers worldwide</span></li>
        <li><span class="feat-icon">🔒</span><span><strong>CORS bypass</strong> — full cross-origin header injection on every response</span></li>
        <li><span class="feat-icon">🔁</span><span><strong>Redirect rewriting</strong> — keeps you inside the proxy chain automatically</span></li>
        <li><span class="feat-icon">🧩</span><span><strong>Open source</strong> — auditable, self-hostable, and free forever</span></li>
      </ul>
    </div>
    <div class="form-card">
      <h2>Open via Proxy</h2>
      <p class="form-sub">Paste a URL to browse it through this worker.</p>
      <form id="proxyForm" novalidate>
        <div>
          <label class="field-label" for="targetUrl">Target URL</label>
          <input type="text" id="targetUrl" class="proxy-input" placeholder="https://example.com/page" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" required>
          <div class="error-msg" id="errorMsg">Please enter a valid http or https URL.</div>
        </div>
        <button type="submit" class="btn-proxy">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          Go
        </button>
      </form>
      <div class="divider"></div>
      <div class="steps">
        <div class="step"><span class="step-num">1</span><span>Paste a full URL (http or https) into the field above</span></div>
        <div class="step"><span class="step-num">2</span><span>Click <em>Go</em> — the target page loads through this Worker</span></div>
        <div class="step"><span class="step-num">3</span><span>Internal links are rewritten to stay inside the proxy</span></div>
      </div>
    </div>
  </main>
  <footer>
    Powered by <a href="https://workers.cloudflare.com/" target="_blank" rel="noopener noreferrer">Cloudflare Workers</a> &nbsp;·&nbsp;
    <a href="https://github.com/OshekharO/CF-REVERSE-PROXY" target="_blank" rel="noopener noreferrer">GitHub</a>
  </footer>
  <script>
    const form = document.getElementById('proxyForm');
    const input = document.getElementById('targetUrl');
    const errMsg = document.getElementById('errorMsg');
    const PROTO = new RegExp('^https?://', 'i');
    function isValidUrl(str) {
      try {
        const u = new URL(PROTO.test(str) ? str : 'https://' + str);
        return u.protocol === 'http:' || u.protocol === 'https:';
      } catch (e) { return false; }
    }
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var raw = input.value.trim();
      if (!raw || !isValidUrl(raw)) {
        errMsg.style.display = 'block'; input.focus(); return;
      }
      errMsg.style.display = 'none';
      var target = PROTO.test(raw) ? raw : 'https://' + raw;
      window.location.href = window.location.origin + '/' + encodeURIComponent(target);
    });
    input.addEventListener('input', function() { errMsg.style.display = 'none'; });
  </script>
</body>
</html>`;
}
