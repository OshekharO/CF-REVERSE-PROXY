# Introduction

Workers-Proxy is a lightweight Javascript [Reverse Proxy](https://www.cloudflare.com/learning/cdn/glossary/reverse-proxy/) based on [Cloudflare Workers](https://workers.cloudflare.com/).

Users could deploy the reverse proxy on Cloudflare's global network without setting up virtual private servers and configuring Nginx or Apache.

### Features

* Build mirror websites
* Improve loading speed with Cloudflare's global network
* Increase security (Hide IP addresses of websites)
* Block specific areas or IP addresses
* Redirect mobile users to different web pages

## Getting Started

### Build and Deploy

#### Deploy manually

1. Navigate to [Cloudflare Workers](https://workers.cloudflare.com), register or sign in your Cloudflare account, and set custom subdomain for workers, and create a new Worker.

2. Customize '[src/index.js](https://github.com/OshekharO/CF-REVERSE-PROXY/blob/main/Script/xiaoyang-sde/index.js)', paste the code into Cloudflare online editor to replace the default one.

3. Change name of your Worker, save and deploy it, and check whether its performance fulfills your demand.

### Bind to Custom Domain

1. Check whether your domain is currently under Cloudflare's protection.

2. Navigate to the dashboard of your domain, select 'Workers' page, and click on 'Add Route'.

3. Type `https://<domain_name>/*` in `Route` and select the Worker you created previously.

4. Add a CNAME DNS record for your custom domain. Concretely, enter the subdomain (or '@' for root) in the 'Name' field, enter the **second level domain** of your workers in the 'Target' field, and set 'Proxy status' to 'Proxied'.

### Customize index.js

Basically, there are a few constants on the top of the 'index.js' file.

To customize your own Workers-Proxy Service, you should edit these constants according to your demands.

```
// Website you intended to retrieve for users.
const upstream = 'www.google.com'

// Custom pathname for the upstream website.
const upstream_path = '/'

// Website you intended to retrieve for users using mobile devices.
const upstream_mobile = 'www.google.com'

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
    '//google.com': ''
}
```

### Websites with Multiple Domains

If the website uses another domain name to serve static resources, users could deploy multiple Workers-Proxy and configure text replacement.

1. **www.google.com** serve static resources on **www.gstatic.com**
2. Deploy **Workers-Proxy A** to proxy **www.gstatic.com**
3. Deploy **Workers-Proxy B** to proxy **www.google.com**
4. Configure text replacement for **Workers-Proxy B**:
```
const replace_dict = {
    '$upstream': '$custom_domain',
    'www.gstatic.com': '<Domain name of Workers-Proxy A>'
}
```
