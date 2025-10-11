/*
      _______  _______    _______  _______           _______  _______  _______  _______    _______  _______  _______                   
     (  ____ \(  ____ \  (  ____ )(  ____ \|\     /|(  ____ \(  ____ )(  ____ \(  ____ \  (  ____ )(  ____ )(  ___  )|\     /||\     /|
     | (    \/| (    \/  | (    )|| (    \/| )   ( || (    \/| (    )|| (    \/| (    \/  | (    )|| (    )|| (   ) |( \   / )( \   / )
     | |      | (__      | (____)|| (__    | |   | || (__    | (____)|| (_____ | (__      | (____)|| (____)|| |   | | \ (_) /  \ (_) / 
     | |      |  __)     |     __)|  __)   ( (   ) )|  __)   |     __)(_____  )|  __)     |  _____)|     __)| |   | |  ) _ (    \   /  
     | |      | (        | (\ (   | (       \ \_/ / | (      | (\ (         ) || (        | (      | (\ (   | |   | | / ( ) \    ) (   
     | (____/\| )        | ) \ \__| (____/\  \   /  | (____/\| ) \ \__/\____) || (____/\  | )      | ) \ \__| (___) |( /   \ )   | |   
     (_______/|/         |/   \__/(_______/   \_/   (_______/|/   \__/\_______)(_______/  |/       |/   \__/(_______)|/     \|   \_/   
                                                                                                                                  
A CF-REVERSE-PROXY Script For Cloudflare Workers at https://github.com/OshekharO/CF-REVERSE-PROXY */

// Configuration for goindex.eu.org
const config = {
    // Domain mapping: your subdomain -> target subdomain
    domain_map: {
        // Main domains
        'goindex.eu.org': 'www.literotica.com',
        'www.goindex.eu.org': 'www.literotica.com',
        
        // Subdomains
        'speedy.goindex.eu.org': 'speedy.literotica.com',
        'search.goindex.eu.org': 'search.literotica.com',
        'images.goindex.eu.org': 'images.literotica.com',
        'static.goindex.eu.org': 'static.literotica.com',
        'cdn.goindex.eu.org': 'cdn.literotica.com',
        
        // Keep workers.dev routes for backward compatibility
        'reverse.oshekher.workers.dev': 'www.literotica.com'
    },
    
    // Default if no mapping found
    default_target: 'www.literotica.com',
    
    // Countries and regions where you wish to suspend your service.
    blocked_region: ['CN', 'KP', 'SY', 'PK', 'CU'],
    
    // IP addresses which you wish to block from using your service.
    blocked_ip_address: ['0.0.0.0', '127.0.0.1'],
    
    // Whether to use HTTPS protocol for upstream address.
    https: true,
    
    // Whether to disable cache.
    disable_cache: true,
    
    // Replace texts.
    replace_dict: {
        'Premium': ''
    },
    
    // Additional security headers
    security_headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
    }
};

addEventListener('fetch', event => {
    event.respondWith(fetchAndApply(event.request));
});

async function fetchAndApply(request) {
    try {
        const region = request.headers.get('cf-ipcountry')?.toUpperCase();
        const ip_address = request.headers.get('cf-connecting-ip');
        const user_agent = request.headers.get('user-agent');

        // Early validation
        if (!region || !ip_address || !user_agent) {
            return new Response('Access denied: Missing required headers.', { 
                status: 403,
                headers: { 'Content-Type': 'text/plain; charset=UTF-8' }
            });
        }

        // Check if request is blocked
        if (config.blocked_region.includes(region)) {
            return new Response('Access denied: Service is not available in your region.', {
                status: 403,
                headers: { 'Content-Type': 'text/plain; charset=UTF-8' }
            });
        }

        if (config.blocked_ip_address.includes(ip_address)) {
            return new Response('Access denied: Your IP address is blocked.', {
                status: 403,
                headers: { 'Content-Type': 'text/plain; charset=UTF-8' }
            });
        }

        const url = new URL(request.url);
        const incomingHost = url.hostname;
        
        // Determine target domain based on incoming host
        const targetDomain = config.domain_map[incomingHost] || config.default_target;
        
        console.log(`Proxying ${incomingHost} -> ${targetDomain}${url.pathname}`);
        
        // Build target URL
        url.hostname = targetDomain;
        url.protocol = config.https ? 'https:' : 'http:';
        url.port = '';

        // Create modified request
        const modifiedRequest = createModifiedRequest(request, url, targetDomain, incomingHost);

        // Fetch from upstream
        const response = await fetch(modifiedRequest);
        
        // Process and return response
        return await processResponse(response, targetDomain, incomingHost);

    } catch (error) {
        console.error('Unexpected error:', error);
        return new Response('Internal Server Error', { 
            status: 500,
            headers: { 'Content-Type': 'text/plain; charset=UTF-8' }
        });
    }
}

function createModifiedRequest(originalRequest, targetUrl, targetDomain, incomingHost) {
    const headers = new Headers(originalRequest.headers);
    
    // Update headers for upstream
    headers.set('Host', targetDomain);
    headers.set('Referer', `${targetUrl.protocol}//${incomingHost}`);
    
    // Remove headers that might cause issues
    headers.delete('cf-connecting-ip');
    headers.delete('cf-ipcountry');
    headers.delete('cf-ray');
    
    return new Request(targetUrl, {
        method: originalRequest.method,
        headers: headers,
        body: originalRequest.body,
        redirect: 'manual'
    });
}

async function processResponse(originalResponse, targetDomain, incomingHost) {
    const headers = new Headers(originalResponse.headers);
    
    // Apply cache settings
    if (config.disable_cache) {
        headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        headers.set('Pragma', 'no-cache');
        headers.set('Expires', '0');
    }
    
    // Set CORS headers
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers', '*');
    headers.set('Access-Control-Allow-Credentials', 'true');
    
    // Remove security headers that might block the proxy
    headers.delete('Content-Security-Policy');
    headers.delete('Content-Security-Policy-Report-Only');
    headers.delete('Clear-Site-Data');
    
    // Add security headers for the proxy
    Object.entries(config.security_headers).forEach(([key, value]) => {
        headers.set(key, value);
    });
    
    // Handle redirects
    if ([301, 302, 303, 307, 308].includes(originalResponse.status)) {
        const location = headers.get('location');
        if (location) {
            try {
                const locationUrl = new URL(location, `https://${targetDomain}`);
                if (locationUrl.hostname.includes('literotica.com')) {
                    // Convert back to worker domain
                    const workerDomain = getWorkerDomain(locationUrl.hostname);
                    locationUrl.hostname = workerDomain;
                    locationUrl.protocol = 'https:';
                    headers.set('location', locationUrl.toString());
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
            if (pjaxUrlObj.hostname.includes('literotica.com')) {
                const workerDomain = getWorkerDomain(pjaxUrlObj.hostname);
                pjaxUrlObj.hostname = workerDomain;
                headers.set('X-Pjax-Url', pjaxUrlObj.toString());
            }
        } catch (e) {
            // If URL parsing fails, try simple replacement
            const newPjaxUrl = pjaxUrl.replace(`//${targetDomain}`, `//${incomingHost}`);
            headers.set('X-Pjax-Url', newPjaxUrl);
        }
    }
    
    // Process response body based on content type
    const contentType = headers.get('content-type') || '';
    let body;
    
    if (contentType.includes('text/html') || 
        contentType.includes('text/plain') || 
        contentType.includes('application/json') ||
        contentType.includes('application/javascript') ||
        contentType.includes('text/css')) {
        
        const text = await originalResponse.text();
        body = await replace_all_domains(text, incomingHost);
    } else {
        body = await originalResponse.blob();
    }
    
    return new Response(body, {
        status: originalResponse.status,
        statusText: originalResponse.statusText,
        headers: headers
    });
}

function getWorkerDomain(targetHostname) {
    // Reverse mapping: target domain -> your domain
    const reverseMap = {
        'www.literotica.com': 'goindex.eu.org',
        'speedy.literotica.com': 'speedy.goindex.eu.org',
        'search.literotica.com': 'search.goindex.eu.org',
        'images.literotica.com': 'images.goindex.eu.org',
        'static.literotica.com': 'static.goindex.eu.org',
        'cdn.literotica.com': 'cdn.goindex.eu.org'
    };
    
    // Find matching domain (supports subdomains)
    for (const [target, worker] of Object.entries(reverseMap)) {
        if (targetHostname === target || targetHostname.endsWith('.' + target)) {
            return worker;
        }
    }
    
    // Default to main domain
    return 'goindex.eu.org';
}

async function replace_all_domains(text, incomingHost) {
    let replaced_text = text;
    
    // Replace all literotica.com subdomains with corresponding your domains
    const domainMappings = {
        'www.literotica.com': 'goindex.eu.org',
        'speedy.literotica.com': 'speedy.goindex.eu.org',
        'search.literotica.com': 'search.goindex.eu.org',
        'images.literotica.com': 'images.goindex.eu.org',
        'static.literotica.com': 'static.goindex.eu.org',
        'cdn.literotica.com': 'cdn.goindex.eu.org'
    };

    for (const [originalDomain, yourDomain] of Object.entries(domainMappings)) {
        // Replace full URLs
        replaced_text = replaced_text.replace(
            new RegExp(`https?://${escapeRegExp(originalDomain)}`, 'gi'),
            `https://${yourDomain}`
        );
        
        // Replace protocol-relative URLs
        replaced_text = replaced_text.replace(
            new RegExp(`//${escapeRegExp(originalDomain)}`, 'gi'),
            `//${yourDomain}`
        );
        
        // Replace in JSON/JavaScript contexts
        replaced_text = replaced_text.replace(
            new RegExp(`"${escapeRegExp(originalDomain)}"`, 'gi'),
            `"${yourDomain}"`
        );
        
        replaced_text = replaced_text.replace(
            new RegExp(`'${escapeRegExp(originalDomain)}'`, 'gi'),
            `'${yourDomain}'`
        );
    }

    // Also replace any other literotica.com subdomain (catch-all)
    replaced_text = replaced_text.replace(
        /https?:\/\/([a-zA-Z0-9-]+\.)?literotica\.com/gi, 
        (match) => {
            const url = new URL(match);
            const yourDomain = getWorkerDomain(url.hostname);
            return `https://${yourDomain}`;
        }
    );
    
    // Replace protocol-relative catch-all
    replaced_text = replaced_text.replace(
        /\/\/([a-zA-Z0-9-]+\.)?literotica\.com/gi,
        (match) => {
            const hostname = match.replace('//', '');
            const yourDomain = getWorkerDomain(hostname);
            return `//${yourDomain}`;
        }
    );

    // Apply other replacements from replace_dict
    for (const [key, value] of Object.entries(config.replace_dict)) {
        const re = new RegExp(escapeRegExp(key), 'gi');
        replaced_text = replaced_text.replace(re, value);
    }

    return replaced_text;
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Handle OPTIONS requests for CORS preflight
addEventListener('fetch', event => {
    if (event.request.method === 'OPTIONS') {
        event.respondWith(handleOptions(event.request));
    }
});

function handleOptions(request) {
    return new Response(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Max-Age': '86400',
        }
    });
}
