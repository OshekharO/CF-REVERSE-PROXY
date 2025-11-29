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
  disable_cache: true,
  replace_dict: {
    'literotica.com': 'goindex.eu.org',
    'Premium': ''
  },
  security_headers: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  }
};

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

// Unified Fetch Event Listener
addEventListener('fetch', event => {
  const req = event.request;
  if (req.method === 'OPTIONS') {
    event.respondWith(handleOptions(req));
  } else {
    event.respondWith(fetchAndApply(req));
  }
});

async function fetchAndApply(request) {
  try {
    const region = request.headers.get('cf-ipcountry')?.toUpperCase();
    const ip_address = request.headers.get('cf-connecting-ip');
    const user_agent = request.headers.get('user-agent');

    // Header validation
    if (!region || !ip_address || !user_agent) {
      return new Response('Access denied: Missing required headers.', { 
        status: 403,
        headers: { 'Content-Type': 'text/plain; charset=UTF-8' }
      });
    }

    if (config.blocked_region.includes(region)) {
      return new Response('Access denied: Region blocked.', { 
        status: 403,
        headers: { 'Content-Type': 'text/plain; charset=UTF-8' }
      });
    }

    if (config.blocked_ip_address.includes(ip_address)) {
      return new Response('Access denied: IP blocked.', { 
        status: 403,
        headers: { 'Content-Type': 'text/plain; charset=UTF-8' }
      });
    }

    const url = new URL(request.url);
    const incomingHost = url.hostname;
    const targetDomain = domain_map[incomingHost] || `www.${config.domains.target.main}`;

    // Prevent loop
    if (incomingHost === targetDomain) {
      return new Response('Loop detected', { status: 508 });
    }

    console.log(`Proxying ${incomingHost} -> ${targetDomain}${url.pathname}`);

    url.hostname = targetDomain;
    url.protocol = config.https ? 'https:' : 'http:';
    url.port = '';

    const modifiedRequest = await createModifiedRequest(request, url, targetDomain, incomingHost);

    // Timeout controller
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(modifiedRequest, { signal: controller.signal }).catch(() => null);
    clearTimeout(timeout);

    if (!response) return new Response('Upstream Timeout', { status: 504 });

    return await processResponse(response, targetDomain, incomingHost);

  } catch (err) {
    console.error('Error:', err);
    return new Response('Internal Server Error', { 
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=UTF-8' }
    });
  }
}

async function createModifiedRequest(originalRequest, targetUrl, targetDomain, incomingHost) {
  const headers = new Headers(originalRequest.headers);
  headers.set('Host', targetDomain);
  headers.set('Referer', `${targetUrl.protocol}//${targetDomain}`);
  headers.delete('cf-connecting-ip');
  headers.delete('cf-ipcountry');
  headers.delete('cf-ray');

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

// HTMLRewriter Element Handler for rewriting URL attributes
class AttributeRewriter {
  constructor(attributeName, incomingHost) {
    this.attributeName = attributeName;
    this.incomingHost = incomingHost;
  }

  element(element) {
    const attribute = element.getAttribute(this.attributeName);
    if (attribute) {
      const rewritten = rewriteUrl(attribute, this.incomingHost);
      if (rewritten !== attribute) {
        element.setAttribute(this.attributeName, rewritten);
      }
    }
  }
}

// HTMLRewriter Element Handler for srcset attributes (multiple URLs with descriptors)
class SrcsetRewriter {
  constructor(incomingHost) {
    this.incomingHost = incomingHost;
  }

  element(element) {
    const srcset = element.getAttribute('srcset');
    if (srcset) {
      const rewritten = rewriteSrcset(srcset, this.incomingHost);
      if (rewritten !== srcset) {
        element.setAttribute('srcset', rewritten);
      }
    }
  }
}

// HTMLRewriter Element Handler for meta tags with URL content
class MetaRewriter {
  constructor(incomingHost) {
    this.incomingHost = incomingHost;
  }

  element(element) {
    const httpEquiv = element.getAttribute('http-equiv');
    const property = element.getAttribute('property');
    const name = element.getAttribute('name');
    const content = element.getAttribute('content');
    
    if (!content) return;
    
    // Only rewrite content for meta tags that are known to contain URLs
    const isRefresh = httpEquiv && httpEquiv.toLowerCase() === 'refresh';
    const isOgUrl = property && (property === 'og:url' || property === 'og:image' || property === 'og:video');
    const isTwitterUrl = name && (name === 'twitter:url' || name === 'twitter:image');
    
    if (isRefresh || isOgUrl || isTwitterUrl) {
      const rewritten = rewriteUrl(content, this.incomingHost);
      if (rewritten !== content) {
        element.setAttribute('content', rewritten);
      }
    }
  }
}

// HTMLRewriter Text Handler for rewriting text content
class TextRewriter {
  constructor(incomingHost) {
    this.incomingHost = incomingHost;
    this.buffer = '';
  }

  text(text) {
    this.buffer += text.text;
    if (text.lastInTextNode) {
      const rewritten = rewriteTextContent(this.buffer, this.incomingHost);
      text.replace(rewritten);
      this.buffer = '';
    } else {
      text.remove();
    }
  }
}

// Check if hostname matches target domain (exact match or subdomain)
function isTargetDomain(hostname) {
  const targetMain = config.domains.target.main;
  return hostname === targetMain || hostname.endsWith('.' + targetMain);
}

// Rewrite URL to use custom domain
function rewriteUrl(url, incomingHost) {
  if (!url) return url;
  
  try {
    // Handle absolute URLs with protocol
    if (url.startsWith('https://') || url.startsWith('http://')) {
      const urlObj = new URL(url);
      if (isTargetDomain(urlObj.hostname)) {
        urlObj.hostname = getCustomDomain(urlObj.hostname);
        urlObj.protocol = 'https:';
        return urlObj.toString();
      }
    }
    // Handle protocol-relative URLs
    else if (url.startsWith('//')) {
      const hostname = url.slice(2).split('/')[0];
      if (isTargetDomain(hostname)) {
        const customDomain = getCustomDomain(hostname);
        return url.replace(`//${hostname}`, `//${customDomain}`);
      }
    }
  } catch (e) {
    // URL parsing may fail for malformed URLs or relative paths - return original
  }
  
  return url;
}

// Rewrite srcset attribute (handles multiple URLs with descriptors)
function rewriteSrcset(srcset, incomingHost) {
  if (!srcset) return srcset;
  
  // srcset format: "url1 1x, url2 2x" or "url1 100w, url2 200w"
  return srcset.split(',').map(entry => {
    const trimmed = entry.trim();
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 1) {
      parts[0] = rewriteUrl(parts[0], incomingHost);
    }
    return parts.join(' ');
  }).join(', ');
}

// Rewrite text content to replace target domains
function rewriteTextContent(text, incomingHost) {
  let result = text;
  
  // Apply text replacements from replace_dict
  for (const [key, value] of Object.entries(config.replace_dict)) {
    const re = new RegExp(escapeRegExp(key), 'gi');
    result = result.replace(re, value);
  }
  
  // Replace all target domain occurrences
  const allTargetDomains = Object.keys(reverse_map);
  for (const targetDomain of allTargetDomains) {
    const customDomain = reverse_map[targetDomain];
    
    // Replace full URLs with protocol
    result = result.replace(
      new RegExp(`https?://${escapeRegExp(targetDomain)}`, 'gi'),
      `https://${customDomain}`
    );
    
    // Replace protocol-relative URLs
    result = result.replace(
      new RegExp(`//${escapeRegExp(targetDomain)}`, 'gi'),
      `//${customDomain}`
    );
  }
  
  return result;
}

// Create HTMLRewriter with all necessary handlers
function createHTMLRewriter(incomingHost) {
  return new HTMLRewriter()
    // Rewrite href attributes on anchor and link tags
    .on('a', new AttributeRewriter('href', incomingHost))
    .on('link', new AttributeRewriter('href', incomingHost))
    // Rewrite src attributes on various elements
    .on('img', new AttributeRewriter('src', incomingHost))
    .on('img', new AttributeRewriter('data-src', incomingHost))
    .on('img', new SrcsetRewriter(incomingHost))
    .on('script', new AttributeRewriter('src', incomingHost))
    .on('iframe', new AttributeRewriter('src', incomingHost))
    .on('video', new AttributeRewriter('src', incomingHost))
    .on('audio', new AttributeRewriter('src', incomingHost))
    .on('source', new AttributeRewriter('src', incomingHost))
    .on('source', new SrcsetRewriter(incomingHost))
    // Rewrite action attributes on forms
    .on('form', new AttributeRewriter('action', incomingHost))
    // Rewrite content in meta tags that contain URLs (og:url, og:image, twitter:url, etc.)
    .on('meta', new MetaRewriter(incomingHost))
    // Rewrite poster attribute on video elements
    .on('video', new AttributeRewriter('poster', incomingHost))
    // Rewrite data attributes that may contain URLs
    .on('*', new AttributeRewriter('data-url', incomingHost))
    .on('*', new AttributeRewriter('data-href', incomingHost))
    // Rewrite inline scripts and styles that may contain URLs
    .on('script', new TextRewriter(incomingHost))
    .on('style', new TextRewriter(incomingHost));
}

async function processResponse(originalResponse, targetDomain, incomingHost) {
  const headers = new Headers(originalResponse.headers);

  if (config.disable_cache) {
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');
  }

  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', '*');
  headers.set('Access-Control-Allow-Credentials', 'true');

  headers.delete('Content-Security-Policy');
  headers.delete('Content-Security-Policy-Report-Only');
  headers.delete('Clear-Site-Data');

  Object.entries(config.security_headers).forEach(([key, value]) => headers.set(key, value));

  // Rewrite redirects
  if ([301, 302, 303, 307, 308].includes(originalResponse.status)) {
    const loc = headers.get('location');
    if (loc) {
      try {
        const u = new URL(loc, `https://${targetDomain}`);
        if (isTargetDomain(u.hostname)) {
          u.hostname = getCustomDomain(u.hostname);
          headers.set('location', u.toString());
        }
      } catch (e) {
        console.error('Error parsing location header:', e);
      }
    }
  }

  // Handle X-Pjax-Url header
  if (headers.get('X-Pjax-Url')) {
    const pjaxUrl = headers.get('X-Pjax-Url');
    try {
      const pjaxUrlObj = new URL(pjaxUrl);
      if (isTargetDomain(pjaxUrlObj.hostname)) {
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

  const contentType = headers.get('content-type') || '';

  // Use HTMLRewriter for HTML content (streaming, more efficient)
  if (contentType.includes('text/html')) {
    const rewriter = createHTMLRewriter(incomingHost);
    const transformedResponse = rewriter.transform(
      new Response(originalResponse.body, {
        status: originalResponse.status,
        statusText: originalResponse.statusText,
        headers
      })
    );
    return transformedResponse;
  }

  // Use regex-based replacement for non-HTML text content (JSON, JavaScript, CSS)
  if (contentType.includes('text/') || 
      contentType.includes('application/json') || 
      contentType.includes('application/javascript') ||
      contentType.includes('application/x-javascript')) {
    const text = await originalResponse.text();
    const body = await replace_all_domains(text, incomingHost);
    return new Response(body, {
      status: originalResponse.status,
      statusText: originalResponse.statusText,
      headers
    });
  }

  // Return binary content as-is
  return new Response(originalResponse.body, {
    status: originalResponse.status,
    statusText: originalResponse.statusText,
    headers
  });
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
