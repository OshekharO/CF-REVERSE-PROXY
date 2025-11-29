/*
   _______  _______    _______  _______           _______  _______  _______  _______    _______  _______  _______                   
  (  ____ \(  ____ \  (  ____ )(  ____ \|\     /|(  ____ \(  ____ )(  ____ \(  ____ \  (  ____ )(  ____ )(  ___  )|\     /||\     /|
  | (    \/| (    \/  | (    )|| (    \/| )   ( || (    \/| (    )|| (    \/| (    \/  | (    )|| (    )|| (   ) |( \   / )( \   / )
  | |      | (__      | (____)|| (__    | |   | || (__    | (____)|| (_____ | (__      | (____)|| (____)|| |   | | \ (_) /  \ (_) / 
  | |      |  __)     |     __)|  __)   ( (   ) )|  __)   |     __)(_____  )|  __)     |  _____)|     __)| |   | |  ) _ (    \   /  
  | |      | (        | (\ (   | (       \ \_/ / | (      | (\ (         ) || (        | (      | (\ (   | |   | | / ( ) \    ) (   
  | (____/\| )        | ) \ \__| (____/\  \   /  | (____/\| ) \ \__/\____) || (____/\  | )      | ) \ \__| (___) |( /   \ )   | |   
  (_______/|/         |/   \__/(_______/   \_/   (_______/|/   \__/\_______)(_______/  |/       |/   \__/(_______)|/     \|   \_/   
                                                                                                                          
   A CF-REVERSE-PROXY Script (Optimized Version)
   Original: https://github.com/OshekharO/CF-REVERSE-PROXY
   
   Features:
   - Domain & subdomain mapping
   - Region/IP blocking
   - Rate limiting
   - Bot/Crawler detection
   - Health check endpoint
   - Request logging
   - Configurable caching
   - Custom headers injection
   - WebSocket proxy support
   - HTMLRewriter for DOM manipulation
   - Compression support
   - Custom error pages
   - Metrics/Stats endpoint
*/

const config = {
  domains: {
    custom: {
      main: 'goindex.eu.org',
      subdomains: ['www', 'speedy', 'search', 'images', 'static', 'cdn']
    },
    target: {
      main: 'literotica.com',
      subdomains: ['www', 'speedy', 'search', 'images', 'static', 'cdn']
    }
  },
  blocked_region: ['CN', 'KP', 'SY', 'PK', 'CU'],
  blocked_ip_address: ['0.0.0.0', '127.0.0.1'],
  https: true,
  
  // Cache configuration
  cache: {
    enabled: false,
    ttl: {
      'text/html': 300,           // 5 minutes
      'text/css': 86400,          // 1 day
      'application/javascript': 86400,
      'image/*': 604800,          // 1 week
      'default': 3600             // 1 hour
    }
  },
  
  // Rate limiting configuration
  rate_limit: {
    enabled: true,
    requests_per_minute: 60,
    burst_limit: 10
  },
  
  // Request timeout in milliseconds
  timeout: 15000,
  
  // Logging configuration
  logging: {
    enabled: true,
    level: 'info'  // 'debug', 'info', 'warn', 'error'
  },
  
  // Bot/Crawler blocking
  block_bots: {
    enabled: false,
    blocked_user_agents: [
      'bot', 'crawler', 'spider', 'scraper', 'curl', 'wget'
    ],
    allow_good_bots: true,
    good_bots: ['googlebot', 'bingbot', 'yandexbot', 'duckduckbot']
  },
  
  // Custom headers to inject
  custom_headers: {
    request: {},     // Headers to add to upstream request
    response: {}     // Headers to add to client response
  },
  
  // HTMLRewriter rules for DOM manipulation
  html_rewriter: {
    enabled: true,
    remove_elements: [],  // CSS selectors of elements to remove (e.g., '.ad-banner', '#popup')
    remove_attributes: [] // Attributes to remove (e.g., {selector: 'a', attribute: 'target'})
  },
  
  // Endpoints
  endpoints: {
    health: '/__health',
    stats: '/__stats'
  },
  
  replace_dict: {
    'literotica.com': 'goindex.eu.org',
    'Premium': ''
  },
  
  security_headers: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
  },
  
  // Custom error pages
  error_pages: {
    enabled: true,
    template: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error {{STATUS_CODE}}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
           display: flex; align-items: center; justify-content: center; 
           min-height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    .container { text-align: center; color: white; padding: 2rem; }
    h1 { font-size: 6rem; margin: 0; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); }
    p { font-size: 1.5rem; opacity: 0.9; }
    a { color: white; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <h1>{{STATUS_CODE}}</h1>
    <p>{{STATUS_MESSAGE}}</p>
    <p><a href="/">Go back to homepage</a></p>
  </div>
</body>
</html>`
  }
};

// In-memory stats (resets on worker restart)
const stats = {
  requests: 0,
  errors: 0,
  blocked: 0,
  cache_hits: 0,
  start_time: Date.now()
};

// Simple rate limiter using Map (resets on worker restart)
const rateLimitMap = new Map();

// Domain Mappings
function generateDomainMappings() {
  const mappings = {};
  
  // Handle both with and without www for custom domains
  mappings[config.domains.custom.main] = `www.${config.domains.target.main}`;
  mappings[`www.${config.domains.custom.main}`] = `www.${config.domains.target.main}`;
  
  // Subdomains
  config.domains.custom.subdomains.forEach(subdomain => {
    if (subdomain !== 'www') {
      mappings[`${subdomain}.${config.domains.custom.main}`] = `${subdomain}.${config.domains.target.main}`;
    }
  });
  
  return mappings;
}

function generateReverseMappings() {
  const reverse = {};
  
  // Handle all possible target domain combinations
  // Without www
  reverse[config.domains.target.main] = config.domains.custom.main;
  
  // With www
  reverse[`www.${config.domains.target.main}`] = `www.${config.domains.custom.main}`;
  
  // Subdomains
  config.domains.target.subdomains.forEach(subdomain => {
    if (subdomain !== 'www') {
      reverse[`${subdomain}.${config.domains.target.main}`] = `${subdomain}.${config.domains.custom.main}`;
    }
  });
  
  return reverse;
}

const domain_map = generateDomainMappings();
const reverse_map = generateReverseMappings();

// Logging utility
function log(level, message, data = {}) {
  if (!config.logging.enabled) return;
  
  const levels = { debug: 0, info: 1, warn: 2, error: 3 };
  const configLevel = levels[config.logging.level] || 1;
  const msgLevel = levels[level] || 1;
  
  if (msgLevel >= configLevel) {
    const timestamp = new Date().toISOString();
    const logData = { timestamp, level, message, ...data };
    console.log(JSON.stringify(logData));
  }
}

// Rate limiting check
function checkRateLimit(ip) {
  if (!config.rate_limit.enabled) return { allowed: true };
  
  const now = Date.now();
  const windowMs = 60000; // 1 minute window
  const key = ip;
  
  let record = rateLimitMap.get(key);
  
  if (!record || now - record.windowStart > windowMs) {
    record = { count: 1, windowStart: now };
    rateLimitMap.set(key, record);
    return { allowed: true, remaining: config.rate_limit.requests_per_minute - 1 };
  }
  
  record.count++;
  
  if (record.count > config.rate_limit.requests_per_minute) {
    return { 
      allowed: false, 
      remaining: 0,
      retryAfter: Math.ceil((record.windowStart + windowMs - now) / 1000)
    };
  }
  
  return { allowed: true, remaining: config.rate_limit.requests_per_minute - record.count };
}

// Bot detection
function isBot(userAgent) {
  if (!config.block_bots.enabled || !userAgent) return false;
  
  const ua = userAgent.toLowerCase();
  
  // Check for good bots first
  if (config.block_bots.allow_good_bots) {
    for (const goodBot of config.block_bots.good_bots) {
      if (ua.includes(goodBot.toLowerCase())) {
        return false;
      }
    }
  }
  
  // Check for blocked bot patterns
  for (const pattern of config.block_bots.blocked_user_agents) {
    if (ua.includes(pattern.toLowerCase())) {
      return true;
    }
  }
  
  return false;
}

// Get cache TTL based on content type
function getCacheTTL(contentType) {
  if (!config.cache.enabled) return 0;
  
  for (const [pattern, ttl] of Object.entries(config.cache.ttl)) {
    if (pattern === 'default') continue;
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace('*', '.*'));
      if (regex.test(contentType)) return ttl;
    } else if (contentType.includes(pattern)) {
      return ttl;
    }
  }
  
  return config.cache.ttl.default || 0;
}

// Generate error page
function generateErrorPage(statusCode, message) {
  if (!config.error_pages.enabled) {
    return new Response(message, {
      status: statusCode,
      headers: { 'Content-Type': 'text/plain; charset=UTF-8' }
    });
  }
  
  const html = config.error_pages.template
    .replace(/\{\{STATUS_CODE\}\}/g, statusCode)
    .replace(/\{\{STATUS_MESSAGE\}\}/g, message);
  
  return new Response(html, {
    status: statusCode,
    headers: { 'Content-Type': 'text/html; charset=UTF-8' }
  });
}

// Unified Fetch Event Listener
addEventListener('fetch', event => {
  const req = event.request;
  
  // Handle WebSocket upgrades
  if (req.headers.get('Upgrade') === 'websocket') {
    event.respondWith(handleWebSocket(req));
    return;
  }
  
  if (req.method === 'OPTIONS') {
    event.respondWith(handleOptions(req));
  } else {
    event.respondWith(fetchAndApply(req));
  }
});

// Handle WebSocket connections
async function handleWebSocket(request) {
  const url = new URL(request.url);
  const incomingHost = url.hostname;
  const targetDomain = domain_map[incomingHost] || `www.${config.domains.target.main}`;
  
  url.hostname = targetDomain;
  url.protocol = config.https ? 'wss:' : 'ws:';
  
  log('info', 'WebSocket upgrade request', { from: incomingHost, to: targetDomain });
  
  // Forward WebSocket connection
  return fetch(url.toString(), {
    headers: request.headers,
  });
}

// Health check endpoint
function handleHealthCheck() {
  const health = {
    status: 'healthy',
    uptime: Math.floor((Date.now() - stats.start_time) / 1000),
    timestamp: new Date().toISOString()
  };
  
  return new Response(JSON.stringify(health, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Stats endpoint
function handleStats() {
  const uptimeSeconds = Math.floor((Date.now() - stats.start_time) / 1000);
  const statsResponse = {
    ...stats,
    uptime_seconds: uptimeSeconds,
    uptime_formatted: formatUptime(uptimeSeconds),
    requests_per_second: stats.requests / Math.max(uptimeSeconds, 1),
    error_rate: stats.requests > 0 ? (stats.errors / stats.requests * 100).toFixed(2) + '%' : '0%'
  };
  
  return new Response(JSON.stringify(statsResponse, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  
  return parts.join(' ');
}

async function fetchAndApply(request) {
  stats.requests++;
  
  try {
    const url = new URL(request.url);
    
    // Handle special endpoints
    if (url.pathname === config.endpoints.health) {
      return handleHealthCheck();
    }
    if (url.pathname === config.endpoints.stats) {
      return handleStats();
    }
    
    const region = request.headers.get('cf-ipcountry')?.toUpperCase();
    const ip_address = request.headers.get('cf-connecting-ip');
    const user_agent = request.headers.get('user-agent');

    // Header validation
    if (!region || !ip_address || !user_agent) {
      stats.blocked++;
      log('warn', 'Missing required headers', { ip: ip_address });
      return generateErrorPage(403, 'Access denied: Missing required headers.');
    }

    // Rate limiting check
    const rateLimit = checkRateLimit(ip_address);
    if (!rateLimit.allowed) {
      stats.blocked++;
      log('warn', 'Rate limit exceeded', { ip: ip_address });
      return new Response('Too Many Requests', {
        status: 429,
        headers: {
          'Content-Type': 'text/plain; charset=UTF-8',
          'Retry-After': rateLimit.retryAfter.toString(),
          'X-RateLimit-Remaining': '0'
        }
      });
    }

    // Bot detection
    if (isBot(user_agent)) {
      stats.blocked++;
      log('info', 'Bot blocked', { ip: ip_address, ua: user_agent });
      return generateErrorPage(403, 'Access denied: Automated requests are not allowed.');
    }

    if (config.blocked_region.includes(region)) {
      stats.blocked++;
      log('info', 'Region blocked', { ip: ip_address, region });
      return generateErrorPage(403, 'Access denied: Region blocked.');
    }

    if (config.blocked_ip_address.includes(ip_address)) {
      stats.blocked++;
      log('info', 'IP blocked', { ip: ip_address });
      return generateErrorPage(403, 'Access denied: IP blocked.');
    }

    const incomingHost = url.hostname;
    const targetDomain = domain_map[incomingHost] || `www.${config.domains.target.main}`;

    // Prevent loop
    if (incomingHost === targetDomain) {
      return generateErrorPage(508, 'Loop detected');
    }

    log('debug', 'Proxying request', { 
      from: incomingHost, 
      to: targetDomain, 
      path: url.pathname 
    });

    url.hostname = targetDomain;
    url.protocol = config.https ? 'https:' : 'http:';
    url.port = '';

    const modifiedRequest = await createModifiedRequest(request, url, targetDomain, incomingHost);

    // Timeout controller
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeout);

    const response = await fetch(modifiedRequest, { signal: controller.signal }).catch(() => null);
    clearTimeout(timeout);

    if (!response) {
      stats.errors++;
      return generateErrorPage(504, 'Upstream Timeout');
    }

    return await processResponse(response, targetDomain, incomingHost, rateLimit);

  } catch (err) {
    stats.errors++;
    log('error', 'Request error', { error: err.message });
    return generateErrorPage(500, 'Internal Server Error');
  }
}

async function createModifiedRequest(originalRequest, targetUrl, targetDomain, incomingHost) {
  const headers = new Headers(originalRequest.headers);
  headers.set('Host', targetDomain);
  headers.set('Referer', `${targetUrl.protocol}//${targetDomain}`);
  headers.delete('cf-connecting-ip');
  headers.delete('cf-ipcountry');
  headers.delete('cf-ray');

  // Add custom request headers
  Object.entries(config.custom_headers.request).forEach(([key, value]) => {
    headers.set(key, value);
  });

  // Safely clone body for non-GET/HEAD
  let body = null;
  if (originalRequest.method !== 'GET' && originalRequest.method !== 'HEAD') {
    body = await originalRequest.clone().arrayBuffer();
  }

  return new Request(targetUrl, {
    method: originalRequest.method,
    headers,
    body,
    redirect: 'manual'
  });
}

async function processResponse(originalResponse, targetDomain, incomingHost, rateLimit = {}) {
  const headers = new Headers(originalResponse.headers);
  const contentType = headers.get('content-type') || '';

  // Cache control
  if (config.cache.enabled) {
    const ttl = getCacheTTL(contentType);
    if (ttl > 0) {
      headers.set('Cache-Control', `public, max-age=${ttl}`);
      stats.cache_hits++;
    }
  } else {
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');
  }

  // CORS headers
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', '*');
  headers.set('Access-Control-Allow-Credentials', 'true');

  // Rate limit headers
  if (config.rate_limit.enabled && rateLimit.remaining !== undefined) {
    headers.set('X-RateLimit-Limit', config.rate_limit.requests_per_minute.toString());
    headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString());
  }

  headers.delete('Content-Security-Policy');
  headers.delete('Content-Security-Policy-Report-Only');
  headers.delete('Clear-Site-Data');

  // Security headers
  Object.entries(config.security_headers).forEach(([key, value]) => headers.set(key, value));

  // Custom response headers
  Object.entries(config.custom_headers.response).forEach(([key, value]) => {
    headers.set(key, value);
  });

  // Rewrite redirects
  if ([301, 302, 303, 307, 308].includes(originalResponse.status)) {
    const loc = headers.get('location');
    if (loc) {
      try {
        const u = new URL(loc, `https://${targetDomain}`);
        if (u.hostname.includes(config.domains.target.main)) {
          u.hostname = getCustomDomain(u.hostname);
          headers.set('location', u.toString());
        }
      } catch (e) {
        log('error', 'Error parsing location header', { error: e.message });
      }
    }
  }

  // Handle X-Pjax-Url header
  if (headers.get('X-Pjax-Url')) {
    const pjaxUrl = headers.get('X-Pjax-Url');
    try {
      const pjaxUrlObj = new URL(pjaxUrl);
      if (pjaxUrlObj.hostname.includes(config.domains.target.main)) {
        const customDomain = getCustomDomain(pjaxUrlObj.hostname);
        pjaxUrlObj.hostname = customDomain;
        headers.set('X-Pjax-Url', pjaxUrlObj.toString());
      }
    } catch (e) {
      // If URL parsing fails, try simple replacement
      const newPjaxUrl = pjaxUrl.replace(`//${targetDomain}`, `//${incomingHost}`);
      headers.set('X-Pjax-Url', newPjaxUrl);
    }
  }

  let body;

  // Process all text-based content including JSON and JavaScript
  if (contentType.includes('text/') || 
      contentType.includes('application/json') || 
      contentType.includes('application/javascript') ||
      contentType.includes('application/x-javascript')) {
    let text = await originalResponse.text();
    
    // Apply HTMLRewriter rules for HTML content
    if (contentType.includes('text/html') && config.html_rewriter.enabled) {
      text = applyHTMLRewriterRules(text);
    }
    
    body = await replace_all_domains(text, incomingHost);
  } else {
    body = originalResponse.body;
  }

  return new Response(body, {
    status: originalResponse.status,
    statusText: originalResponse.statusText,
    headers
  });
}

// Simple HTML manipulation (since HTMLRewriter is async/streaming, we use regex for config-based rules)
function applyHTMLRewriterRules(html) {
  let result = html;
  
  // Remove elements by selector (simple implementation for common patterns)
  for (const selector of config.html_rewriter.remove_elements) {
    // Handle class selectors (.classname)
    if (selector.startsWith('.')) {
      const className = selector.slice(1);
      const regex = new RegExp(`<[^>]*class="[^"]*\\b${escapeRegExp(className)}\\b[^"]*"[^>]*>.*?</[^>]+>`, 'gis');
      result = result.replace(regex, '');
    }
    // Handle id selectors (#id)
    else if (selector.startsWith('#')) {
      const id = selector.slice(1);
      const regex = new RegExp(`<[^>]*id="${escapeRegExp(id)}"[^>]*>.*?</[^>]+>`, 'gis');
      result = result.replace(regex, '');
    }
  }
  
  // Remove attributes
  for (const rule of config.html_rewriter.remove_attributes) {
    if (rule.selector && rule.attribute) {
      const attrRegex = new RegExp(`(${escapeRegExp(rule.attribute)}="[^"]*")`, 'gi');
      result = result.replace(attrRegex, '');
    }
  }
  
  return result;
}

function getCustomDomain(targetHostname) {
  // Exact match first
  if (reverse_map[targetHostname]) {
    return reverse_map[targetHostname];
  }
  
  // Then check for subdomain matches
  for (const [target, custom] of Object.entries(reverse_map)) {
    if (targetHostname.endsWith('.' + target)) {
      // Replace the target part with custom part
      const subdomainPart = targetHostname.slice(0, -target.length);
      return subdomainPart + custom;
    }
  }
  
  // Default to main custom domain
  return config.domains.custom.main;
}

async function replace_all_domains(text, incomingHost) {
  let replaced_text = text;

  // Apply text replacements from replace_dict
  for (const [key, value] of Object.entries(config.replace_dict)) {
    const re = new RegExp(escapeRegExp(key), 'gi');
    replaced_text = replaced_text.replace(re, value);
  }

  // Replace all domain occurrences - handle all variations
  const allTargetDomains = Object.keys(reverse_map);
  
  for (const targetDomain of allTargetDomains) {
    const customDomain = reverse_map[targetDomain];
    
    // Replace full URLs with protocol
    replaced_text = replaced_text.replace(
      new RegExp(`https?://${escapeRegExp(targetDomain)}`, 'gi'),
      `https://${customDomain}`
    );
    
    // Replace protocol-relative URLs
    replaced_text = replaced_text.replace(
      new RegExp(`//${escapeRegExp(targetDomain)}`, 'gi'),
      `//${customDomain}`
    );
    
    // Replace in JSON/JavaScript contexts (quoted)
    replaced_text = replaced_text.replace(
      new RegExp(`"${escapeRegExp(targetDomain)}"`, 'gi'),
      `"${customDomain}"`
    );
    
    replaced_text = replaced_text.replace(
      new RegExp(`'${escapeRegExp(targetDomain)}'`, 'gi'),
      `'${customDomain}'`
    );
    
    // Replace in various other contexts
    replaced_text = replaced_text.replace(
      new RegExp(`\\\\/${escapeRegExp(targetDomain)}`, 'gi'),
      `\\/${customDomain}`
    );
  }

  // Catch-all for any target domain subdomain that might have been missed
  replaced_text = replaced_text.replace(
    new RegExp(`https?://([a-zA-Z0-9-]+\\.)?${escapeRegExp(config.domains.target.main)}`, 'gi'), 
    (match) => {
      const url = new URL(match);
      const customDomain = getCustomDomain(url.hostname);
      return `https://${customDomain}`;
    }
  );
  
  // Catch-all for protocol-relative URLs
  replaced_text = replaced_text.replace(
    new RegExp(`//([a-zA-Z0-9-]+\\.)?${escapeRegExp(config.domains.target.main)}`, 'gi'),
    (match) => {
      const hostname = match.replace('//', '');
      const customDomain = getCustomDomain(hostname);
      return `//${customDomain}`;
    }
  );

  return replaced_text;
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function handleOptions() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400'
    }
  });
}
