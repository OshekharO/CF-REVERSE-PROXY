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

// Centralized Configuration
const config = {
    // Define your domains here - change these to proxy different sites
    domains: {
        // Your custom domain and subdomains
        custom: {
            main: 'goindex.eu.org',
            subdomains: ['www', 'speedy', 'search', 'images', 'static', 'cdn']
        },
        // Target site domains
        target: {
            main: 'literotica.com',
            subdomains: ['www', 'speedy', 'search', 'images', 'static', 'cdn']
        }
    },
    
    // Countries and regions where you wish to suspend your service.
    blocked_region: ['CN', 'KP', 'SY', 'PK', 'CU'],
    
    // IP addresses which you wish to block from using your service.
    blocked_ip_address: ['0.0.0.0', '127.0.0.1'],
    
    // Whether to use HTTPS protocol for upstream address.
    https: true,
    
    // Whether to disable cache.
    disable_cache: true,
    
    // Replace texts - use $custom and $target as variables
    replace_dict: {
        '$target_main': '$custom_main',
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

// Generate domain mappings dynamically
function generateDomainMappings() {
    const mappings = {};
    
    // Main domain mapping
    mappings[config.domains.custom.main] = config.domains.target.main;
    mappings[`www.${config.domains.custom.main}`] = `www.${config.domains.target.main}`;
    
    // Subdomain mappings
    config.domains.custom.subdomains.forEach(subdomain => {
        if (subdomain !== 'www') {
            const customDomain = `${subdomain}.${config.domains.custom.main}`;
            const targetDomain = `${subdomain}.${config.domains.target.main}`;
            mappings[customDomain] = targetDomain;
        }
    });
    
    return mappings;
}

// Generate reverse mappings for domain rewriting
function generateReverseMappings() {
    const reverseMap = {};
    
    // Main domain
    reverseMap[config.domains.target.main] = config.domains.custom.main;
    reverseMap[`www.${config.domains.target.main}`] = `www.${config.domains.custom.main}`;
    
    // Subdomains
    config.domains.target.subdomains.forEach(subdomain => {
        if (subdomain !== 'www') {
            const targetDomain = `${subdomain}.${config.domains.target.main}`;
            const customDomain = `${subdomain}.${config.domains.custom.main}`;
            reverseMap[targetDomain] = customDomain;
        }
    });
    
    return reverseMap;
}

// Initialize domain mappings
const domain_map = generateDomainMappings();
const reverse_map = generateReverseMappings();

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
        const targetDomain = domain_map[incomingHost] || config.domains.target.main;
        
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
                if (locationUrl.hostname.includes(config.domains.target.main)) {
                    // Convert back to custom domain
                    const customDomain = getCustomDomain(locationUrl.hostname);
                    locationUrl.hostname = customDomain;
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

function getCustomDomain(targetHostname) {
    // Find matching domain in reverse map
    for (const [target, custom] of Object.entries(reverse_map)) {
        if (targetHostname === target || targetHostname.endsWith('.' + target)) {
            return custom;
        }
    }
    
    // Default to main custom domain
    return config.domains.custom.main;
}

async function replace_all_domains(text, incomingHost) {
    let replaced_text = text;

    // First, apply variable replacements from replace_dict
    for (const [key, value] of Object.entries(config.replace_dict)) {
        let searchValue = key;
        let replaceValue = value;

        // Handle variables in search
        if (searchValue === '$target_main') {
            searchValue = config.domains.target.main;
        } else if (searchValue === '$custom_main') {
            searchValue = config.domains.custom.main;
        } else if (searchValue.startsWith('$target_')) {
            const subdomain = searchValue.replace('$target_', '');
            searchValue = `${subdomain}.${config.domains.target.main}`;
        } else if (searchValue.startsWith('$custom_')) {
            const subdomain = searchValue.replace('$custom_', '');
            searchValue = `${subdomain}.${config.domains.custom.main}`;
        }

        // Handle variables in replace
        if (replaceValue === '$target_main') {
            replaceValue = config.domains.target.main;
        } else if (replaceValue === '$custom_main') {
            replaceValue = config.domains.custom.main;
        } else if (replaceValue.startsWith('$target_')) {
            const subdomain = replaceValue.replace('$target_', '');
            replaceValue = `${subdomain}.${config.domains.target.main}`;
        } else if (replaceValue.startsWith('$custom_')) {
            const subdomain = replaceValue.replace('$custom_', '');
            replaceValue = `${subdomain}.${config.domains.custom.main}`;
        }

        const re = new RegExp(escapeRegExp(searchValue), 'gi');
        replaced_text = replaced_text.replace(re, replaceValue);
    }

    // Then, replace all target domains with custom domains using the reverse map
    for (const [targetDomain, customDomain] of Object.entries(reverse_map)) {
        // Replace full URLs
        replaced_text = replaced_text.replace(
            new RegExp(`https?://${escapeRegExp(targetDomain)}`, 'gi'),
            `https://${customDomain}`
        );
        
        // Replace protocol-relative URLs
        replaced_text = replaced_text.replace(
            new RegExp(`//${escapeRegExp(targetDomain)}`, 'gi'),
            `//${customDomain}`
        );
        
        // Replace in JSON/JavaScript contexts
        replaced_text = replaced_text.replace(
            new RegExp(`"${escapeRegExp(targetDomain)}"`, 'gi'),
            `"${customDomain}"`
        );
        
        replaced_text = replaced_text.replace(
            new RegExp(`'${escapeRegExp(targetDomain)}'`, 'gi'),
            `'${customDomain}'`
        );
    }

    // Catch-all for any other target domain occurrences
    replaced_text = replaced_text.replace(
        new RegExp(`https?://([a-zA-Z0-9-]+\\.)?${escapeRegExp(config.domains.target.main)}`, 'gi'), 
        (match) => {
            const url = new URL(match);
            const customDomain = getCustomDomain(url.hostname);
            return `https://${customDomain}`;
        }
    );
    
    // Protocol-relative catch-all
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
