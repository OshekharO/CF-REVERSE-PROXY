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

const config = {
  basic: {
    upstream: 'https://www.google.com/',
    mobileRedirect: 'https://www.google.com/'
  },
  firewall: {
    blockedRegion: ['CN', 'KP', 'SY', 'PK', 'CU'],
    blockedIPAddress: [],
    scrapeShield: true
  },
  routes: {
    CA: 'https://www.google.ca/',
    FR: 'https://www.google.fr/'
  },
  optimization: {
    cacheEverything: false,
    cacheTtl: 5,
    mirage: true,
    polish: 'off',
    minify: {
      javascript: true,
      css: true,
      html: true
    }
  }
};

function isMobile(userAgent) {
  const agents = ['Android', 'iPhone', 'SymbianOS', 'Windows Phone', 'iPad', 'iPod'];
  return agents.some(agent => userAgent.includes(agent));
}

async function fetchAndApply(request) {
  const region = request.headers.get('cf-ipcountry') || '';
  const ipAddress = request.headers.get('cf-connecting-ip') || '';
  const userAgent = request.headers.get('user-agent') || '';

  // Firewall checks
  if (config.firewall.blockedRegion.includes(region.toUpperCase())) {
    return new Response('Access denied: booster.js is not available in your region.', { status: 403 });
  }

  if (config.firewall.blockedIPAddress.includes(ipAddress)) {
    return new Response('Access denied: Your IP address is blocked by booster.js.', { status: 403 });
  }

  // Determine upstream URL
  let upstreamURL = new URL(config.basic.upstream);

  if (isMobile(userAgent)) {
    upstreamURL = new URL(config.basic.mobileRedirect);
  } else if (region.toUpperCase() in config.routes) {
    upstreamURL = new URL(config.routes[region.toUpperCase()]);
  }

  const requestURL = new URL(request.url);
  requestURL.protocol = upstreamURL.protocol;
  requestURL.host = upstreamURL.host;
  requestURL.pathname = upstreamURL.pathname + requestURL.pathname;

  // Create new request
  let newRequest;
  if (request.method === 'GET' || request.method === 'HEAD') {
    newRequest = new Request(requestURL, {
      cf: {
        cacheEverything: config.optimization.cacheEverything,
        cacheTtl: config.optimization.cacheTtl,
        mirage: config.optimization.mirage,
        polish: config.optimization.polish,
        minify: config.optimization.minify,
        scrapeShield: config.firewall.scrapeShield
      },
      method: request.method,
      headers: request.headers
    });
  } else {
    const requestBody = await request.text();
    newRequest = new Request(requestURL, {
      cf: {
        cacheEverything: config.optimization.cacheEverything,
        cacheTtl: config.optimization.cacheTtl,
        mirage: config.optimization.mirage,
        polish: config.optimization.polish,
        minify: config.optimization.minify,
        scrapeShield: config.firewall.scrapeShield
      },
      method: request.method,
      headers: request.headers,
      body: requestBody
    });
  }

  try {
    const fetchedResponse = await fetch(newRequest);
    const modifiedResponseHeaders = new Headers(fetchedResponse.headers);

    if (modifiedResponseHeaders.has('x-pjax-url')) {
      const pjaxURL = new URL(modifiedResponseHeaders.get('x-pjax-url'));
      pjaxURL.protocol = requestURL.protocol;
      pjaxURL.host = requestURL.host;
      pjaxURL.pathname = pjaxURL.pathname.replace(requestURL.pathname, '/');
      modifiedResponseHeaders.set('x-pjax-url', pjaxURL.href);
    }

    return new Response(fetchedResponse.body, {
      headers: modifiedResponseHeaders,
      status: fetchedResponse.status,
      statusText: fetchedResponse.statusText
    });
  } catch (error) {
    return new Response('An error occurred while processing your request.', { status: 500 });
  }
}

addEventListener('fetch', event => {
  event.respondWith(fetchAndApply(event.request));
});
