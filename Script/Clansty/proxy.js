/* CF-REVERSE-PROXY — Clansty/proxy.js
 * Reverse-proxy a Telegram public channel preview so it can be embedded
 * in any website via an <iframe>.
 *
 * Repository : https://github.com/OshekharO/CF-REVERSE-PROXY
 * Original author : Clansty  |  Enhanced by : OshekharO
 */

// ─── Configuration ────────────────────────────────────────────────────────────

/**
 * Telegram channel username (without the @ symbol).
 * Example: 'durov'
 */
const USERNAME = 'thewantedcracker';

/**
 * Full base URL of this Worker (your .workers.dev URL or custom domain).
 * Leave empty ('') to auto-detect from the incoming request — recommended.
 * Example: 'https://your-worker.workers.dev'
 */
const BASE_URL = '';

/** Favicon URL injected into proxied Telegram pages. */
const FAVICON_URL = 'https://cdn.lwqwq.com/pic/41329_SaVJ3LWa.webp';

// ─── Derived Constants ────────────────────────────────────────────────────────

const CHANNEL_URL = `https://t.me/s/${USERNAME}`;

/** Cloudflare-injected headers to strip before forwarding requests. */
const CF_HEADERS_TO_STRIP = [
  'cf-connecting-ip',
  'cf-ipcountry',
  'cf-ray',
  'cf-visitor',
  'cf-worker',
];

/** Response headers that block <iframe> embedding — must be removed. */
const EMBED_BLOCKING_HEADERS = [
  'x-frame-options',
  'content-security-policy',
  'content-security-policy-report-only',
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
      return new Response('Internal Server Error', { status: 500 });
    }
  },
};

// ─── Main Request Router ──────────────────────────────────────────────────────

async function handleRequest(request) {
  const u = new URL(request.url);
  // Resolve base URL from the incoming request when not explicitly configured.
  const base = BASE_URL || u.origin;

  const pathname = u.pathname;
  const pathParts = pathname.split('/').filter(Boolean); // ['seg1', 'seg2', ...]
  const host = pathParts[0] || '';
  const hostParam = pathParts[1] || '';

  // ── Statistics / health-check endpoint ─────────────────────────────────────
  if (pathname === '/v/') {
    return jsonOk('true');
  }

  // ── Channel home ───────────────────────────────────────────────────────────
  if (pathname === '/') {
    const upstream = await fetchUpstream(CHANNEL_URL, { method: 'GET' });
    return transformChannelPage(upstream, base);
  }

  // ── Specific message (e.g. /42) ────────────────────────────────────────────
  if (/^\/\d+$/.test(pathname)) {
    const upstream = await fetchUpstream(`${CHANNEL_URL}${pathname}`, { method: 'GET' });
    return transformChannelPage(upstream, base);
  }

  // ── telegram.org assets (CSS, icons, …) ────────────────────────────────────
  if (host === 'tgorg') {
    const targetPath = pathParts.slice(1).join('/');
    const upstream = await fetchUpstream(`https://telegram.org/${targetPath}`, { method: 'GET' });
    return transformTgOrgAsset(upstream, base);
  }

  // ── Telescope CDN images & videos ──────────────────────────────────────────
  if (host === 'ts') {
    const cdnIndex = hostParam; // e.g. '1', '2', '3', '4', '5'
    const assetPath = pathParts.slice(2).join('/');
    return fetchUpstream(`https://cdn${cdnIndex}.telesco.pe/${assetPath}`, { method: 'GET' });
  }

  // ── "Load more" AJAX requests from the channel page ────────────────────────
  if (host === 's' && hostParam === USERNAME) {
    const ajaxUrl = new URL(u.toString());
    ajaxUrl.hostname = 't.me';
    const upstream = await fetchUpstream(ajaxUrl.toString(), {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
    return transformChannelPage(upstream, base);
  }

  // ── Fallback: 404 ──────────────────────────────────────────────────────────
  return new Response('Not Found', { status: 404 });
}

// ─── Content Transformers ─────────────────────────────────────────────────────

/**
 * Rewrites Telegram channel HTML/JSON so all internal URLs route through this
 * Worker, and injects custom CSS to hide Telegram's navigation chrome.
 */
async function transformChannelPage(response, base) {
  const ct = (response.headers.get('content-type') || '').toLowerCase();
  if (!(ct.includes('text/html') || ct.includes('application/json'))) {
    return buildProxyResponse(response);
  }

  const customHead =
    `<link rel="icon" type="image/webp" href="${FAVICON_URL}"/>` +
    `<base target="_blank"/>` +
    `<style>
      div.tgme_header_search { display: none; }
      div.tgme_header_info   { margin-right: 0 !important; }
      div.tgme_footer        { display: none; }
    </style>`;

  let text = await response.text();

  text = text
    // Replace "Download Telegram" call-to-action links with a direct channel link
    .replace(
      /<a class="tgme_channel_join_telegram" href="\/\/telegram\.org\/dl[\?a-z0-9_=]*">/g,
      `<a class="tgme_channel_join_telegram" href="https://t.me/${USERNAME}">`,
    )
    .replace(
      /<a class="tgme_channel_download_telegram" href="\/\/telegram\.org\/dl[\?a-z0-9_=]*">/g,
      `<a class="tgme_channel_download_telegram" href="https://t.me/${USERNAME}">`,
    )
    // Inject custom head elements (replace the favicon shortcut)
    .replace(
      /<link rel="shortcut icon" href="\/\/telegram\.org\/favicon\.ico\?\d+" type="image\/x-icon" \/>/g,
      customHead,
    )
    // Route external assets through the Worker
    .replace(/https?:\/\/telegram\.org\//g, `${base}/tgorg/`)
    .replace(/https?:\/\/cdn(\d)\.telesco\.pe\//g, `${base}/ts/$1/`)
    // Strip channel-specific path prefixes so navigation stays on this Worker
    .replace(new RegExp(`https?://t\\.me/[A-Za-z0-9_]{5,}/`, 'g'), `${base}/`)
    // Remove "download Telegram" banner text
    .replace(
      /<div class="tgme_channel_download_telegram_bottom">to view and join the conversation<\/div>/g,
      '',
    )
    .replace(/Download Telegram/g, 'Join Channel');

  const headers = buildResponseHeaders(response, ct);
  return new Response(text, { status: response.status, headers });
}

/**
 * Rewrites root-relative asset paths inside telegram.org CSS files so they
 * resolve through the Worker's `/tgorg/` route.
 */
async function transformTgOrgAsset(response, base) {
  const ct = (response.headers.get('content-type') || '').toLowerCase();
  if (!ct.includes('text/css')) {
    return buildProxyResponse(response);
  }

  let text = await response.text();
  text = text
    .replace(/url\(\//g, `url(${base}/tgorg/`)
    .replace(/url\('\//g, `url('${base}/tgorg/`);

  const headers = buildResponseHeaders(response, ct);
  return new Response(text, { status: response.status, headers });
}

// ─── Response Builders ────────────────────────────────────────────────────────

/**
 * Wraps an upstream response, stripping headers that block <iframe> embedding
 * and applying CORS headers.
 */
function buildProxyResponse(response) {
  const headers = buildResponseHeaders(response, response.headers.get('content-type'));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

/**
 * Builds clean response headers from an upstream response:
 *  - Copies all upstream headers
 *  - Removes embedding-blocking headers
 *  - Sets the correct Content-Type
 *  - Adds CORS headers
 */
function buildResponseHeaders(response, contentType) {
  const headers = new Headers(response.headers);

  // Remove headers that prevent <iframe> embedding
  EMBED_BLOCKING_HEADERS.forEach(h => headers.delete(h));

  if (contentType) {
    headers.set('content-type', contentType);
  }

  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', '*');
  return headers;
}

// ─── Fetch Helper ─────────────────────────────────────────────────────────────

/**
 * Fetches an upstream URL, stripping Cloudflare-injected headers from the
 * forwarded request.
 */
async function fetchUpstream(url, init = {}) {
  const headers = new Headers(init.headers || {});
  CF_HEADERS_TO_STRIP.forEach(h => headers.delete(h));
  return fetch(new Request(url, { ...init, headers }));
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function handlePreflight(request) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    },
  });
}

function jsonOk(data) {
  return new Response(data, {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
