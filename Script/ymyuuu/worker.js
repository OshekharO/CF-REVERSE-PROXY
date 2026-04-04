/* CF-REVERSE-PROXY — ymyuuu/worker.js
 * A general-purpose open reverse proxy for Cloudflare Workers.
 *
 * Repository : https://github.com/OshekharO/CF-REVERSE-PROXY
 * Original author : ymyuuu  |  Enhanced by : OshekharO
 */

// ─── Configuration ────────────────────────────────────────────────────────────

/** Protocols allowed to be proxied. Any other protocol is rejected. */
const ALLOWED_PROTOCOLS = ['http:', 'https:'];

/**
 * Domains that must never be proxied.
 * Matched exactly OR as a hostname suffix
 * (e.g. 'evil.com' also blocks 'sub.evil.com').
 */
const BLOCKED_DOMAINS = ['example.com', 'another-blocked-site.com'];

/** Cloudflare-injected request headers that must be stripped before forwarding. */
const CF_HEADERS_TO_STRIP = [
  'cf-connecting-ip',
  'cf-ipcountry',
  'cf-ray',
  'cf-visitor',
  'cf-worker',
];

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

  // Serve the landing page for "/"
  if (url.pathname === '/') {
    return new Response(getLandingPage(), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Decode the target URL from the first path segment
  // e.g.  /https://example.com/path  →  https://example.com/path
  let targetStr = decodeURIComponent(url.pathname.slice(1));

  // Prepend protocol if missing
  if (!/^https?:\/\//i.test(targetStr)) {
    targetStr = `${url.protocol}//${targetStr}`;
  }

  // Append original query string
  if (url.search) {
    targetStr += url.search;
  }

  // Validate the target URL
  const validation = validateUrl(targetStr);
  if (!validation.valid) {
    return jsonError(400, 'Bad Request', `URL validation failed: ${validation.reason}`);
  }

  const targetUrl = validation.parsed;

  // Build upstream request headers (strip Cloudflare-internal headers)
  const upstreamHeaders = new Headers(request.headers);
  CF_HEADERS_TO_STRIP.forEach(h => upstreamHeaders.delete(h));
  upstreamHeaders.set('Host', targetUrl.hostname);

  const upstreamRequest = new Request(targetUrl.toString(), {
    method:   request.method,
    headers:  upstreamHeaders,
    body:     request.body,
    redirect: 'manual',
  });

  const upstream = await fetch(upstreamRequest);

  // Redirect handling — rewrite Location to stay within the proxy
  if ([301, 302, 303, 307, 308].includes(upstream.status)) {
    return rewriteRedirect(upstream, url);
  }

  // Build response headers
  const responseHeaders = new Headers(upstream.headers);
  applySecurityHeaders(responseHeaders);
  applyCorsHeaders(responseHeaders, request.headers.get('Origin'));
  responseHeaders.set('Cache-Control', 'no-store');

  // Remove headers that would break proxying
  responseHeaders.delete('Content-Security-Policy');
  responseHeaders.delete('Content-Security-Policy-Report-Only');

  // Rewrite HTML body
  const contentType = responseHeaders.get('Content-Type') || '';
  let body;
  if (contentType.includes('text/html')) {
    const html = await upstream.text();
    body = rewriteHtml(html, url, targetUrl);
    responseHeaders.delete('Content-Encoding'); // body is already decoded
    responseHeaders.set('Content-Type', 'text/html; charset=utf-8');
  } else {
    body = upstream.body;
  }

  return new Response(body, {
    status:     upstream.status,
    statusText: upstream.statusText,
    headers:    responseHeaders,
  });
}

// ─── URL Validation ───────────────────────────────────────────────────────────

function validateUrl(rawUrl) {
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
  const isBlocked = BLOCKED_DOMAINS.some(d => host === d || host.endsWith(`.${d}`));
  if (isBlocked) {
    return { valid: false, reason: 'Domain is blocked' };
  }

  return { valid: true, parsed };
}

// ─── Redirect Rewriting ───────────────────────────────────────────────────────

function rewriteRedirect(response, proxyUrl) {
  const location = response.headers.get('Location');
  const headers = new Headers(response.headers);
  applyCorsHeaders(headers, null);

  if (location) {
    let absolute = location;
    try { absolute = new URL(location).toString(); } catch { /* keep as-is */ }
    headers.set('Location', `${proxyUrl.origin}/${encodeURIComponent(absolute)}`);
  }

  return new Response(null, { status: response.status, headers });
}

// ─── HTML Body Rewriting ──────────────────────────────────────────────────────

function rewriteHtml(html, proxyUrl, targetUrl) {
  const targetOrigin  = targetUrl.origin;
  const proxyOrigin   = proxyUrl.origin;

  // 1. Rewrite absolute URLs pointing to the proxied origin
  let result = html.replace(
    new RegExp(`(https?:)?//${escapeRegExp(targetUrl.hostname)}`, 'gi'),
    `${proxyOrigin}/${targetOrigin}`
  );

  // 2. Rewrite root-relative paths  ( /path → proxyOrigin/targetOrigin/path )
  result = result.replace(
    /((href|src|action|data-src)=["'])\//gi,
    `$1${proxyOrigin}/${targetOrigin}/`
  );

  return result;
}

// ─── Header Helpers ───────────────────────────────────────────────────────────

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

// ─── Error Response ───────────────────────────────────────────────────────────

function jsonError(status, title, detail) {
  return new Response(JSON.stringify({ error: title, detail }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Landing Page ─────────────────────────────────────────────────────────────

function getLandingPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Proxy any URL through Cloudflare Workers — fast, free, and serverless.">
  <meta name="robots" content="index, follow">
  <title>CF Reverse Proxy</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔗</text></svg>">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" crossorigin="anonymous">
  <style>
    :root {
      --glass-bg: rgba(255, 255, 255, 0.10);
      --glass-border: rgba(255, 255, 255, 0.22);
      --blur: 20px;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Segoe UI', system-ui, sans-serif;
      padding: 1.25rem;
    }
    .glass-card {
      background: var(--glass-bg);
      backdrop-filter: blur(var(--blur));
      -webkit-backdrop-filter: blur(var(--blur));
      border: 1px solid var(--glass-border);
      border-radius: 1.5rem;
      padding: 2.5rem 2rem;
      width: 100%;
      max-width: 520px;
      box-shadow: 0 8px 40px rgba(0, 0, 0, 0.45);
      color: #fff;
    }
    .badge-pill {
      display: inline-block;
      background: rgba(255, 255, 255, 0.12);
      border-radius: 999px;
      padding: 0.2rem 0.8rem;
      font-size: 0.72rem;
      letter-spacing: 0.4px;
      margin-bottom: 1.1rem;
      color: rgba(255, 255, 255, 0.65);
    }
    .glass-card h1 {
      font-size: 1.75rem;
      font-weight: 700;
      letter-spacing: -0.4px;
      margin-bottom: 0.4rem;
    }
    .glass-card .subtitle {
      color: rgba(255, 255, 255, 0.58);
      font-size: 0.88rem;
      margin-bottom: 1.75rem;
    }
    .proxy-input {
      background: rgba(255, 255, 255, 0.08) !important;
      border: 1px solid rgba(255, 255, 255, 0.2) !important;
      border-radius: 0.75rem !important;
      color: #fff !important;
      padding: 0.72rem 1rem !important;
      font-size: 0.95rem;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .proxy-input::placeholder { color: rgba(255, 255, 255, 0.38); }
    .proxy-input:focus {
      background: rgba(255, 255, 255, 0.13) !important;
      border-color: rgba(255, 255, 255, 0.48) !important;
      box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.10) !important;
      outline: none;
      color: #fff !important;
    }
    .btn-proxy {
      background: linear-gradient(90deg, #6c63ff, #3ecfcf);
      border: none;
      border-radius: 0.75rem;
      color: #fff;
      font-weight: 600;
      padding: 0.72rem 1.5rem;
      width: 100%;
      font-size: 1rem;
      cursor: pointer;
      transition: opacity 0.2s, transform 0.1s;
    }
    .btn-proxy:hover  { opacity: 0.87; }
    .btn-proxy:active { transform: scale(0.98); }
    .error-msg {
      color: #ff8a8a;
      font-size: 0.82rem;
      margin-top: 0.35rem;
      display: none;
    }
    footer {
      margin-top: 1.6rem;
      font-size: 0.72rem;
      color: rgba(255, 255, 255, 0.32);
      text-align: center;
    }
    footer a { color: rgba(255, 255, 255, 0.42); text-decoration: none; }
    footer a:hover { color: #fff; }
  </style>
</head>
<body>
  <div class="glass-card">
    <span class="badge-pill">☁️ Cloudflare Workers</span>
    <h1>CF Reverse Proxy</h1>
    <p class="subtitle">Paste any URL below and browse it through the proxy.</p>
    <form id="proxyForm" novalidate>
      <div class="mb-3">
        <input
          type="text"
          id="targetUrl"
          class="form-control proxy-input"
          placeholder="https://example.com/page"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          required
        >
        <div class="error-msg" id="errorMsg">Please enter a valid http or https URL.</div>
      </div>
      <button type="submit" class="btn-proxy">Open via Proxy</button>
    </form>
    <footer>
      Powered by <a href="https://workers.cloudflare.com/" target="_blank" rel="noopener noreferrer">Cloudflare Workers</a>
      &nbsp;·&nbsp;
      <a href="https://github.com/OshekharO/CF-REVERSE-PROXY" target="_blank" rel="noopener noreferrer">GitHub</a>
    </footer>
  </div>

  <script>
    const form   = document.getElementById('proxyForm');
    const input  = document.getElementById('targetUrl');
    const errMsg = document.getElementById('errorMsg');

    function isValidUrl(str) {
      try {
        const u = new URL(/^https?:\/\//i.test(str) ? str : 'https://' + str);
        return u.protocol === 'http:' || u.protocol === 'https:';
      } catch { return false; }
    }

    form.addEventListener('submit', e => {
      e.preventDefault();
      const raw = input.value.trim();
      if (!raw || !isValidUrl(raw)) {
        errMsg.style.display = 'block';
        input.focus();
        return;
      }
      errMsg.style.display = 'none';
      const target = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw;
      window.open(window.location.origin + '/' + encodeURIComponent(target), '_blank', 'noopener,noreferrer');
    });

    input.addEventListener('input', () => { errMsg.style.display = 'none'; });
  </script>
</body>
</html>`;
}
