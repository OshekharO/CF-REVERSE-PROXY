**Booster.js** is a speed and performance optimizier for your website, delivering fast web experiences to users. Built with Cloudflare Workers, it caches static assets on the high performance global network, applies optimizations to web pages, and guards your website from scrapers or malicious attacks.

- Speed: Deliver your website with Cloudflare’s global network, which is milliseconds away from virtually every Internet user.
- Network: Set up HTTP/2, TLS 1.3, HTTPS (Free SSL Certificate), and IPv6 for your website.
- Optimization: Minify JavaScript codes, compress images, cache static assets.
- Firewall: Block traffics from specific IP addresses, regions, or known scrapers.
- Routes: Serve different webpages to visitors based on their region or devices.
- Serverless: No virtual machines, no servers, and no containers to maintain.
- Todo: Load balancer, HTMLRewriter, and advanced routing rules.

## Deploy manually

1. Navigate to [Cloudflare Workers](https://workers.cloudflare.com), register or sign in your Cloudflare account, and set custom subdomain for workers, and create a new Worker.

2. Customize [booster.js](https://github.com/OshekharO/CF-REVERSE-PROXY/blob/main/Script/viperadnan/booster.js), paste the code into Cloudflare online editor to replace the default one.

3. Change the name of your Worker, save and deploy the code.

### Bind to Custom Domain

1. Add your domain to Cloudflare.

2. Navigate to the dashboard, select 'Workers' page, and click on 'Add Route'.

3. Type `https://<domain_name>/*` in `Route` and select the Worker you've created.

4. Add a CNAME DNS record for your custom domain. Input the subdomain (Example: `@` or `www`) in the 'Name' field, input the **second level domain** of your workers (Example: `readme.workers.dev`) in the 'Target' field, and then set 'Proxy status' to 'Proxied'. 

## Config

[![Config](https://raw.githubusercontent.com/viperadnan-git/website-booster/master/.github/img/config.png)](https://github.com/discordiy/CF-REVERSE-PROXY)

`basic`
- `upstream`: Protocol, Domain, Port (Optional), Path (Optional). Example: `https://www.math.ucla.edu/~tao/`
- `mobileRedirect`: Automatically redirect mobile device visitors to a mobile-optimized website.

`firewall`
- `blockedRegion`: Block visitors from specific regions. Full list of codes: [ISO 3166-1 alpha-2](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2)
- `blockedIPAddress`: Block visitors from specific IP Address.
- `scrapeShield`: Discover, detect, and deter content scraping. Reference: [Introducing ScrapeShield](https://blog.cloudflare.com/introducing-scrapeshield-discover-defend-dete/)

`routes`: Map country/region codes to specific upstream. Full list of codes: [ISO 3166-1 alpha-2](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2) Example:

```js
routes: {
    FR: 'https://www.google.fr/',
    CA: 'https://www.google.ca/'
}
```

`optimization`
- `cacheEverything`: Forces Cloudflare to cache the response for this request, regardless of the response headers.
- `cacheTtl`: Forces Cloudflare to cache the response for this request with specific TTL, regardless of the response headers.
- `mirage`: Detects screen size and connection speed to optimally deliver images for the current browser window.
- `polish`: Automatically optimizes the images on your site. The possible values are `lossy`, `lossless` or `off`. Reference: [Introducing Polish](https://blog.cloudflare.com/introducing-polish-automatic-image-optimizati/)
- `minify`: Removes unnecessary characters from JavaScript, CSS, and HTML files.
