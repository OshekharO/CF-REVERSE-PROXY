# Reverse-proxy-cf

Turn your Cloudflare Worker into an HTTP online web proxy/mirror.

> Warning! Use of this item is restricted by the laws and regulations of your location. It is your responsibility to ensure the compliant use of this program. This item is provided "as is" without any express or implied. The author is not responsible for any damages caused by the use of this project.

## What are the advantages
- Flexible handling of resource/JS loading in web pages without missing content.
- Multisite support. One node, many worlds.
- Lightweight and easy to build. All you need is a free Cloudflare account.

## test example
> The test instance is limited to only allow access to the following two domain names. You can build it yourself, and there is no limit to the instance you can build.
1. Reverse MDN: https://reverse-proxy-cf-mdn.lacknown.workers.dev/developer.mozilla.org
2. Reverse example.com: https://reverse-proxy-cf-mdn.lacknown.workers.dev/example.com

## how to use?
Open index.js and modify the following:
- ```WORKER_HOSTNAME```: your Worker domain name

Then, paste the modified content onto the newly created Cloudflare Worker. Try it out and see the effect.

## Known limitations / to be improved
- Some sites (such as Bing, Mediawiki, etc.) have abnormal reverse results.
- Referer inversion is broken...
- ~~Only one site can be reversed. ~~ Multisite is already supported.
- ~~Web pages that depend on other CDN JS loading may be missing content (the relevant code is not perfect)~~ Partially fixed.
- ...
