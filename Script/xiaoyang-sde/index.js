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

// Website you intended to retrieve for users.
const upstream = 'uncoder.eu.org';

// Custom pathname for the upstream website.
const upstream_path = '/';

// Website you intended to retrieve for users using mobile devices.
const upstream_mobile = 'uncoder.eu.org';

// Countries and regions where you wish to suspend your service.
const blocked_region = ['CN', 'KP', 'SY', 'PK', 'CU'];

// IP addresses which you wish to block from using your service.
const blocked_ip_address = ['0.0.0.0', '127.0.0.1'];

// Whether to use HTTPS protocol for upstream address.
const https = true;

// Whether to disable cache.
const disable_cache = true;

// Replace texts.
const replace_dict = {
    '$upstream': '$custom_domain',
    'Premium': ''
};

addEventListener('fetch', event => {
    event.respondWith(fetchAndApply(event.request));
});

async function fetchAndApply(request) {
    const region = request.headers.get('cf-ipcountry')?.toUpperCase();
    const ip_address = request.headers.get('cf-connecting-ip');
    const user_agent = request.headers.get('user-agent');

    if (!region || !ip_address || !user_agent) {
        console.error('Missing required headers:', region, ip_address, user_agent);
        return new Response('Access denied: Missing required headers.', { status: 403 });
    }

    let response = null;
    let url = new URL(request.url);
    let url_hostname = url.hostname;

    if (https) {
        url.protocol = 'https:';
    } else {
        url.protocol = 'http:';
    }

    const isDesktop = await device_status(user_agent);
    const upstream_domain = isDesktop ? upstream : upstream_mobile;

    url.host = upstream_domain;
    if (url.pathname === '/') {
        url.pathname = upstream_path;
    } else {
        url.pathname = upstream_path + url.pathname;
    }

    if (blocked_region.includes(region)) {
        console.error('Access denied for region:', region);
        response = new Response('Access denied: WorkersProxy is not available in your region yet.', {
            status: 403
        });
    } else if (blocked_ip_address.includes(ip_address)) {
        console.error('Access denied for IP:', ip_address);
        response = new Response('Access denied: Your IP address is blocked by WorkersProxy.', {
            status: 403
        });
    } else {
        const method = request.method;
        const request_headers = request.headers;
        const new_request_headers = new Headers(request_headers);

        new_request_headers.set('Host', upstream_domain);
        new_request_headers.set('Referer', url.protocol + '//' + url_hostname);

        try {
            const original_response = await fetch(url.href, {
                method,
                headers: new_request_headers
            });

            const response_headers = original_response.headers;
            const new_response_headers = new Headers(response_headers);
            const status = original_response.status;

            if (disable_cache) {
                new_response_headers.set('Cache-Control', 'no-store');
            }

            new_response_headers.set('Access-Control-Allow-Origin', '*');
            new_response_headers.set('Access-Control-Allow-Credentials', 'true');
            new_response_headers.delete('Content-Security-Policy');
            new_response_headers.delete('Content-Security-Policy-Report-Only');
            new_response_headers.delete('Clear-Site-Data');

            if (new_response_headers.get('X-Pjax-Url')) {
                new_response_headers.set('X-Pjax-Url', response_headers.get('X-Pjax-Url').replace('//' + upstream_domain, '//' + url_hostname));
            }

            const content_type = new_response_headers.get('Content-Type');
            let original_text = null;

            if (content_type && content_type.includes('text/html') && content_type.includes('UTF-8')) {
                console.log('Content type is text/html and UTF-8, applying text replacement.');
                original_text = await replace_response_text(original_response, upstream_domain, url_hostname);
                console.log('Text after replacement:', original_text);
            } else {
                console.log('Content type is not text/html and UTF-8, not applying text replacement.');
                original_text = await original_response.blob();
            }

            response = new Response(original_text, {
                status,
                headers: new_response_headers
            });
        } catch (error) {
            console.error('Error fetching upstream:', error);
            response = new Response('Internal server error', { status: 500 });
        }
    }
    return response;
}

async function replace_response_text(response, upstream_domain, host_name) {
    const text = await response.text();
    console.log('Original text:', text);

    let replaced_text = text;

    for (const [i, j] of Object.entries(replace_dict)) {
        let key = i;
        let value = j;

        if (key === '$upstream') {
            key = upstream_domain;
        } else if (key === '$custom_domain') {
            key = host_name;
        }

        if (value === '$upstream') {
            value = upstream_domain;
        } else if (value === '$custom_domain') {
            value = host_name;
        }

        const re = new RegExp(key, 'gi'); // Use 'gi' for case-insensitive and global replacement
        replaced_text = replaced_text.replace(re, value);
    }

    console.log('Replaced text:', replaced_text);
    return replaced_text;
}

async function device_status(user_agent_info) {
    const agents = ["Android", "iPhone", "SymbianOS", "Windows Phone", "iPad", "iPod"];
    return !agents.some(agent => user_agent_info.includes(agent));
}
