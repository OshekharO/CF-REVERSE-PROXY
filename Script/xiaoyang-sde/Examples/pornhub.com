// Website you intended to retrieve for users.
const upstream = 'www.pornhub.com'

// Custom pathname for the upstream website.
const upstream_path = '/'

// Website you intended to retrieve for users using mobile devices.
const upstream_mobile = 'www.pornhub.com'

// Countries and regions where you wish to suspend your service.
const blocked_region = ['CN', 'KP', 'SY', 'PK', 'CU']

// IP addresses which you wish to block from using your service.
const blocked_ip_address = ['0.0.0.0', '127.0.0.1']

// Whether to use HTTPS protocol for upstream address.
const https = true

// Whether to disable cache.
const disable_cache = false

// Replace texts.
const replace_dict = {
    '$upstream': '$custom_domain',
    '//ci.phncdn.com': '//ciphncdncom.pornproxy.workers.dev', // replace this with your other deployment.
    'trafficjunky.com': '',
    'trafficjunky.net': '',
    'contentabc.com': '',
    'Ads By Traffic Junky': '',
    'cdn1d-static-shared.phncdn.com/iframe-1.1.5.html': '',
    '/ads/iframe-mobile-3.0.0.html': '',
    '<iframe': '<!--',
    '</iframe>': '-->',
    'Remove Ads': ''
}
