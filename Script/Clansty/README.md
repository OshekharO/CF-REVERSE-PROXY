### Cloudflare-Telegram-Channel-Proxy

Reverse proxy Telegram Channel's preview page for embedding in other web pages

## Cause

When you want to embed your TG channel preview into your website, you should find that the parameter in the response header of the channel preview page tells the browser not to load it. So we need to reverse proxy the preview page and remove the header that prevents loading.

## What does this program do

This is a [Cloudflare Worker](https://workers.dev) program, which can reverse proxy your TG channel preview page, and proxy images, CSS, JS and other resources together. Then you can easily embed the proxied web page into your own website.

At the same time, you can also modify the CSS of the page and make some other customizations.

## how to use

1. Go to the [Cloudflare Dashboard](https://dash.cloudflare.com/sign-up/workers) to create a worker

2. Edit the Worker code online, copy and paste all the content of [program](./proxy.js) into the edit box (replace the original content)

3. Replace some constants at the beginning of the script with the values ​​you want, then save and deploy

4. Visit the domain name of .workers.dev, if there is no problem, you can embed this webpage into the webpage you want

## hint

If you want to get a better display effect, the width of the embedded web page should not exceed 720px.
