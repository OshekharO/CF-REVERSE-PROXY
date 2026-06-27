/* CF-REVERSE-PROXY — Clansty/proxy.js
 * Reverse-proxy a Telegram public channel preview so it can be embedded
 * in any website via an <iframe>.
 *
 * Repository : https://github.com/OshekharO/CF-REVERSE-PROXY
 * Original author : Clansty  |  Enhanced by : OshekharO
 */

// ─── Configuration ────────────────────────────────────────────────────────────

const USERNAME = 'rax_net';
const BASE_URL = '';
const FAVICON_URL = 'https://cdn.lwqwq.com/pic/41329_SaVJ3LWa.webp';

const CHANNEL_URL = `https://t.me/s/${USERNAME}`;

const CF_HEADERS_TO_STRIP = [
  'cf-connecting-ip',
  'cf-ipcountry',
  'cf-ray',
  'cf-visitor',
  'cf-worker',
  'host',
];

const EMBED_BLOCKING_HEADERS = [
  'x-frame-options',
  'content-security-policy',
  'content-security-policy-report-only',
];

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

async function handleRequest(request) {
  const u = new URL(request.url);
  const base = BASE_URL || u.origin;
  const pathname = u.pathname;
  const pathParts = pathname.split('/').filter(Boolean);
  const host = pathParts[0] || '';
  const hostParam = pathParts[1] || '';

  if (pathname === '/v/') {
    return jsonOk('true');
  }

  if (pathname === '/') {
    const targetUrl = CHANNEL_URL + u.search;
    const upstream = await fetchUpstream(targetUrl, { method: 'GET' });
    return transformChannelPage(upstream, base);
  }

  if (/^\/\d+$/.test(pathname)) {
    const upstream = await fetchUpstream(`${CHANNEL_URL}${pathname}`, { method: 'GET' });
    return transformChannelPage(upstream, base);
  }

  if (host === 'tgorg') {
    const targetPath = pathParts.slice(1).join('/');
    const upstream = await fetchUpstream(`https://telegram.org/${targetPath}`, { method: 'GET' });
    return transformTgOrgAsset(upstream, base);
  }

  if (host === 'ts') {
    const cdnIndex = hostParam;
    const assetPath = pathParts.slice(2).join('/');
    return fetchUpstream(`https://cdn${cdnIndex}.telesco.pe/${assetPath}`, { method: 'GET' });
  }

  if (host === 's') {
    const ajaxUrl = new URL(u.toString());
    ajaxUrl.hostname = 't.me';
    ajaxUrl.protocol = 'https:';
    
    const init = {
      method: request.method,
      headers: request.headers
    };
    
    if (request.method === 'POST') {
      init.body = await request.text();
    }
    
    const upstream = await fetchUpstream(ajaxUrl.toString(), init);
    return transformChannelPage(upstream, base);
  }

  return new Response('Not Found', { status: 404 });
}

async function transformChannelPage(response, base) {
  const ct = (response.headers.get('content-type') || '').toLowerCase();
  if (!(ct.includes('text/html') || ct.includes('application/json'))) {
    return buildProxyResponse(response);
  }

  const customHead =
    `<link rel="icon" type="image/webp" href="${FAVICON_URL}"/>` +
    `<base target="_blank"/>` +
    `<style>
      div.tgme_header_info   { margin-right: 0 !important; }
      div.tgme_footer        { display: none; }
    </style>`;

  let text = await response.text();

  text = text
    .replace(
      /<form class="tgme_header_search_form"/,
      '<form class="tgme_header_search_form" target="_self"'
    )
    .replace(
      /<a class="tgme_channel_join_telegram" href="\/\/telegram\.org\/dl[\?a-z0-9_=]*">/g,
      `<a class="tgme_channel_join_telegram" href="https://t.me/${USERNAME}">`,
    )
    .replace(
      /<a class="tgme_channel_download_telegram" href="\/\/telegram\.org\/dl[\?a-z0-9_=]*">/g,
      `<a class="tgme_channel_download_telegram" href="https://t.me/${USERNAME}">`,
    )
    .replace(
      /<link rel="shortcut icon" href="\/\/telegram\.org\/favicon\.ico\?\d+" type="image\/x-icon" \/>/g,
      customHead,
    )
    .replace(/https?:\/\/telegram\.org\//g, `${base}/tgorg/`)
    .replace(/https?:\/\/cdn(\d)\.telesco\.pe\//g, `${base}/ts/$1/`)
    .replace(new RegExp(`https?://t\\.me/s/${USERNAME}/`, 'g'), `${base}/`)
    .replace(new RegExp(`//t\\.me/s/${USERNAME}/`, 'g'), `${base}/`)
    .replace(new RegExp(`https?://t\\.me/s/${USERNAME}(?!/)`, 'g'), `${base}/s/${USERNAME}`)
    .replace(new RegExp(`//t\\.me/s/${USERNAME}(?!/)`, 'g'), `${base}/s/${USERNAME}`)
    .replace(
      /<div class="tgme_channel_download_telegram_bottom">to view and join the conversation<\/div>/g,
      '',
    )
    .replace(/Download Telegram/g, 'Join Channel');

  const headers = buildResponseHeaders(response, ct);
  return new Response(text, { status: response.status, headers });
}

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

function buildProxyResponse(response) {
  const headers = buildResponseHeaders(response, response.headers.get('content-type'));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function buildResponseHeaders(response, contentType) {
  const headers = new Headers(response.headers);
  EMBED_BLOCKING_HEADERS.forEach(h => headers.delete(h));

  if (contentType) {
    headers.set('content-type', contentType);
  }

  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', '*');
  return headers;
}

async function fetchUpstream(url, init = {}) {
  const headers = new Headers(init.headers || {});
  CF_HEADERS_TO_STRIP.forEach(h => headers.delete(h));
  return fetch(new Request(url, { ...init, headers }));
}

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
