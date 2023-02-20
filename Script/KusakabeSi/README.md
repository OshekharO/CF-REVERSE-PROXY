# Reverse proxy for cloudflare worker
A reverse proxy for cloudflare worker with some additional features:
1. Miltiple site in one worker
2. String replacement
3. Custom resource replacment
3. [cloudflare email-protection](https://support.cloudflare.com/hc/en-us/articles/200170016-What-is-Email-Address-Obfuscation-) bypass.

## Demo
1. https://wix.kskb.eu.org
1. https://proxy.oshekher.workers.dev
1. https://uwiki.kskb.eu.org 
1. https://revdemo.kskb.eu.org
1. https://blog.kskb.eu.org
1. https://blog.wget.date


## How to use:

Create a cloudflare worker  
Checkout my [worker.js](https://github.com/OshekharO/CF-REVERSE-PROXY/blob/main/Script/KusakabeSi/worker.js), copy and paste to your cloudflare worker.  
Then modify the `reverse ` section, fill the infomatoin based on my [reverse_demo.js](https://github.com/OshekharO/CF-REVERSE-PROXY/blob/main/Script/KusakabeSi/reverse_demo.js).

## code

        // Remove ads from scripts
        const scriptPattern = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
        html = html.replace(scriptPattern, (match, p1) => {
            if (match.includes("ads")) {
                return "";
            } else {
                return match;
            }
        });
        
        // Remove ads from iframes
        const iframePattern = /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi;
        html = html.replace(iframePattern, (match, p1) => {
            if (match.includes("ads")) {
                return "";
            } else {
                return match;
            }
        });

Need to be placed in response(req)
