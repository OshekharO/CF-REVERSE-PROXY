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
    '$target_main': '$custom_main',
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
  mappings[config.domains.custom.main] = config.domains.target.main;
  mappings[`www.${config.domains.custom.main}`] = `www.${config.domains.target.main}`;
  config.domains.custom.subdomains.forEach(subdomain => {
    if (subdomain !== 'www') {
      mappings[`${subdomain}.${config.domains.custom.main}`] = `${subdomain}.${config.domains.target.main}`;
    }
  });
  return mappings;
}

function generateReverseMappings() {
  const reverse = {};
  reverse[config.domains.target.main] = config.domains.custom.main;
  reverse[`www.${config.domains.target.main}`] = `www.${config.domains.custom.main}`;
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
      return new Response('Access denied: Missing required headers.', { status: 403 });
    }

    if (config.blocked_region.includes(region)) {
      return new Response('Access denied: Region blocked.', { status: 403 });
    }

    if (config.blocked_ip_address.includes(ip_address)) {
      return new Response('Access denied: IP blocked.', { status: 403 });
    }

    const url = new URL(request.url);
    const incomingHost = url.hostname;
    const targetDomain = domain_map[incomingHost] || config.domains.target.main;

    // Prevent loop
    if (incomingHost === targetDomain) {
      return new Response('Loop detected', { status: 508 });
    }

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
    return new Response('Internal Server Error', { status: 500 });
  }
}

async function createModifiedRequest(originalRequest, targetUrl, targetDomain, incomingHost) {
  const headers = new Headers(originalRequest.headers);
  headers.set('Host', targetDomain);
  headers.set('Referer', `${targetUrl.protocol}//${incomingHost}`);
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
        if (u.hostname.includes(config.domains.target.main)) {
          u.hostname = getCustomDomain(u.hostname);
          headers.set('location', u.toString());
        }
      } catch {}
    }
  }

  const contentType = headers.get('content-type') || '';
  let body;

  if (contentType.includes('text/html') || contentType.includes('text/plain') || contentType.includes('text/css')) {
    const text = await originalResponse.text();
    body = await replace_all_domains(text, incomingHost);
  } else {
    // Skip rewriting JSON/JS for safety
    body = originalResponse.body;
  }

  return new Response(body, {
    status: originalResponse.status,
    statusText: originalResponse.statusText,
    headers
  });
}

function getCustomDomain(targetHostname) {
  for (const [target, custom] of Object.entries(reverse_map)) {
    if (targetHostname === target || targetHostname.endsWith('.' + target)) {
      return custom;
    }
  }
  return config.domains.custom.main;
}

async function replace_all_domains(text, incomingHost) {
  let replaced_text = text;

  for (const [key, value] of Object.entries(config.replace_dict)) {
    let searchValue = key;
    let replaceValue = value;

    if (searchValue === '$target_main') searchValue = config.domains.target.main;
    if (replaceValue === '$custom_main') replaceValue = config.domains.custom.main;

    const re = new RegExp(escapeRegExp(searchValue), 'gi');
    replaced_text = replaced_text.replace(re, replaceValue);
  }

  for (const [targetDomain, customDomain] of Object.entries(reverse_map)) {
    replaced_text = replaced_text.replace(new RegExp(`https?://${escapeRegExp(targetDomain)}`, 'gi'), `https://${customDomain}`);
    replaced_text = replaced_text.replace(new RegExp(`//${escapeRegExp(targetDomain)}`, 'gi'), `//${customDomain}`);
  }

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
